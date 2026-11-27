use crate::protocol::*;
use crate::simulator::DeviceSimulator;
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::sync::{
    atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering},
    mpsc, Arc,
};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize)]
pub struct PortDetail {
    pub name: String,
    pub description: String,
    pub is_virtual: bool,
}
pub fn list_ports() -> Vec<PortDetail> {
    let mut ports = vec![PortDetail {
        name: "SIMULATOR".into(),
        description: "SF-Motion 0.3.0 simulator".into(),
        is_virtual: true,
    }];
    if let Ok(list) = serialport::available_ports() {
        for p in list {
            ports.push(PortDetail {
                name: p.port_name,
                description: format!("{:?}", p.port_type),
                is_virtual: false,
            });
        }
    }
    ports
}
pub trait Link: Send {
    fn send(&mut self, bytes: &[u8]) -> Result<(), String>;
    fn receive(&mut self) -> Result<Vec<u8>, String>;
}
struct SerialLink(Box<dyn serialport::SerialPort>);
impl Link for SerialLink {
    fn send(&mut self, b: &[u8]) -> Result<(), String> {
        self.0
            .write_all(b)
            .map_err(|e| format!("Serial write: {e}"))
    }
    fn receive(&mut self) -> Result<Vec<u8>, String> {
        let mut b = [0u8; 512];
        match self.0.read(&mut b) {
            Ok(n) => Ok(b[..n].to_vec()),
            Err(e)
                if matches!(
                    e.kind(),
                    std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock
                ) =>
            {
                Ok(vec![])
            }
            Err(e) => Err(format!("Serial read: {e}")),
        }
    }
}
#[derive(Default)]
pub struct Observed {
    pub diagnostics: Diagnostics,
    pub samples: HashMap<u8, TelemetrySample>,
    pub event_sequence: u64,
    pub responses: VecDeque<Frame>,
    pub cogging: HashMap<u8, Vec<f64>>,
}
impl Observed {
    fn packet(&mut self, direction: &str, bytes: &[u8]) {
        let p = Packet {
            timestamp_ms: now_ms(),
            direction: direction.into(),
            hex: bytes
                .iter()
                .map(|b| format!("{b:02X}"))
                .collect::<Vec<_>>()
                .join(" "),
        };
        self.diagnostics.packets.push(p);
        if self.diagnostics.packets.len() > 300 {
            self.diagnostics.packets.remove(0);
        }
    }
    fn route(&mut self, f: Frame) {
        self.diagnostics.packets_rx += 1;
        self.packet("RX", &f.bytes());
        match f.kind {
            RESPONSE => {
                self.responses.push_back(f);
                if self.responses.len() > 32 {
                    self.responses.pop_front();
                }
            }
            STREAM => {
                if let Ok(r) = register(f.address) {
                    if r.streaming && f.data.len() == r.size() {
                        if let Ok(v) = r.decode(&f.data) {
                            if let Some(v) = v.first() {
                                if f.address == 92 {
                                    let lut = self.cogging.entry(f.node).or_default();
                                    if lut.len() < 1024 {
                                        lut.push(*v);
                                    }
                                }
                                let s = self.samples.entry(f.node).or_default();
                                let now = now_ms();
                                s.node_id = f.node;
                                s.timestamp_ms = now;
                                s.values.insert(r.name.clone(), *v);
                                s.updated_ms.insert(r.name.clone(), now);
                            }
                        }
                    } else {
                        self.diagnostics.malformed += 1;
                    }
                }
            }
            EVENT => {
                if !f.data.is_empty() {
                    self.diagnostics.malformed += 1;
                    return;
                }
                self.event_sequence += 1;
                let name = match f.address {
                    0 => "move_done",
                    1 => "self_commissioning_done",
                    2 => "I2T_tripped",
                    3 => "over_voltage_error",
                    4 => "under_voltage_error",
                    _ => "unknown_event",
                }
                .to_string();
                self.diagnostics.events.push(DeviceEvent {
                    sequence: self.event_sequence,
                    timestamp_ms: now_ms(),
                    node_id: f.node,
                    code: f.address,
                    name,
                });
                if self.diagnostics.events.len() > 300 {
                    self.diagnostics.events.remove(0);
                }
            }
            _ => self.diagnostics.malformed += 1,
        }
    }
}
struct Request {
    frame: Frame,
    generation: u64,
    priority: bool,
    reply: mpsc::Sender<Result<Vec<u8>, String>>,
}
pub struct Session {
    pub node: AtomicU8,
    pub observed: Arc<Mutex<Observed>>,
    pub busy: AtomicBool,
    pub generation: Arc<AtomicU64>,
    pub stop: Arc<AtomicBool>,
    pub enabled: AtomicBool,
    tx: mpsc::Sender<Request>,
    priority_tx: mpsc::Sender<Request>,
    pub simulator: bool,
    pub subscriptions: Mutex<Vec<u8>>,
    pub cogging: AtomicBool,
    thread: Mutex<Option<std::thread::JoinHandle<()>>>,
}
pub struct BusyGuard<'a>(&'a AtomicBool);
impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}
impl Session {
    pub fn open(port: &str, baudrate: u32, node: u8) -> Result<Arc<Self>, String> {
        let link: Box<dyn Link> = if port == "SIMULATOR" {
            Box::new(DeviceSimulator::new(node))
        } else {
            Box::new(SerialLink(
                serialport::new(port, baudrate)
                    .timeout(Duration::from_millis(10))
                    .open()
                    .map_err(|e| format!("Cannot open {port}: {e}"))?,
            ))
        };
        Ok(Self::start(
            link,
            node,
            port == "SIMULATOR",
            Duration::from_secs(2),
        ))
    }
    pub(crate) fn start(
        link: Box<dyn Link>,
        node: u8,
        simulator: bool,
        timeout: Duration,
    ) -> Arc<Self> {
        let (tx, rx) = mpsc::channel();
        let (ptx, prx) = mpsc::channel();
        let observed = Arc::new(Mutex::new(Observed::default()));
        observed.lock().diagnostics.connected = true;
        let stop = Arc::new(AtomicBool::new(false));
        let generation = Arc::new(AtomicU64::new(0));
        let (o, s, g) = (observed.clone(), stop.clone(), generation.clone());
        let thread = std::thread::spawn(move || worker(link, rx, prx, o, s, g, timeout));
        Arc::new(Self {
            node: AtomicU8::new(node),
            observed,
            busy: AtomicBool::new(false),
            generation,
            stop,
            enabled: AtomicBool::new(false),
            tx,
            priority_tx: ptx,
            simulator,
            subscriptions: Mutex::new(vec![]),
            cogging: AtomicBool::new(false),
            thread: Mutex::new(Some(thread)),
        })
    }
    pub fn lock_operation(&self) -> Result<BusyGuard<'_>, String> {
        self.busy
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| "Device operation in progress".to_string())?;
        Ok(BusyGuard(&self.busy))
    }
    pub fn token(&self) -> u64 {
        self.generation.load(Ordering::SeqCst)
    }
    pub fn check(&self, token: u64) -> Result<(), String> {
        if self.stop.load(Ordering::SeqCst) {
            return Err(self
                .observed
                .lock()
                .diagnostics
                .error
                .clone()
                .unwrap_or("Disconnected".into()));
        }
        if token != self.token() {
            return Err("Operation cancelled by E-STOP".into());
        }
        Ok(())
    }
    pub fn rpc(
        &self,
        kind: u8,
        address: u8,
        data: Vec<u8>,
        token: u64,
        priority: bool,
    ) -> Result<Vec<u8>, String> {
        self.check(token)?;
        let (tx, rx) = mpsc::channel();
        let r = Request {
            frame: Frame {
                kind,
                node: self.node.load(Ordering::SeqCst),
                address,
                data,
            },
            generation: token,
            priority,
            reply: tx,
        };
        (if priority {
            &self.priority_tx
        } else {
            &self.tx
        })
        .send(r)
        .map_err(|_| "Transport worker stopped".to_string())?;
        rx.recv()
            .map_err(|_| "Transport worker stopped".to_string())?
    }
    pub fn read(&self, address: u8, token: u64) -> Result<Vec<f64>, String> {
        let r = register(address)?;
        if !r.read {
            return Err(format!("{} is not readable", r.name));
        }
        r.decode(&self.rpc(READ, address, vec![], token, false)?)
    }
    pub fn write(&self, address: u8, values: &[f64], token: u64) -> Result<(), String> {
        let r = register(address)?;
        if !r.write {
            return Err(format!("{} is not writable", r.name));
        }
        self.rpc(WRITE, address, r.encode(values)?, token, false)?;
        Ok(())
    }
    pub fn emergency_stop(&self) -> Result<(), String> {
        let token = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        // The disable request bypasses queued normal requests, including a pending commissioning wait.
        self.rpc(WRITE, 102, vec![0], token, true)?;
        self.enabled.store(false, Ordering::SeqCst);
        self.rpc(WRITE, 104, vec![0], token, true)?;
        Ok(())
    }
    pub fn info(&self, token: u64) -> Result<DeviceInfo, String> {
        let v = self.read(1, token)?;
        let fw = format!("{}.{}.{}", v[0], v[1], v[2]);
        if fw != "0.3.0" {
            return Err(format!(
                "Unsupported firmware {fw}; this build targets 0.3.0"
            ));
        }
        let id = self.read(2, token)?[0] as u8;
        // Register 2 can contain a staged ID. The response node is the active routing identity.
        Ok(DeviceInfo {
            name: if self.simulator {
                "SF-Motion Simulator"
            } else {
                "SF-Motion"
            }
            .into(),
            hardware_version: None,
            firmware_version: fw,
            device_id: id.to_string(),
            node_id: self.node.load(Ordering::SeqCst),
            is_simulator: self.simulator,
            capabilities: vec![
                "register_protocol".into(),
                "telemetry".into(),
                "motion".into(),
                "commissioning".into(),
            ],
            firmware_commit: FIRMWARE_COMMIT.into(),
        })
    }
    pub fn read_config(&self, token: u64) -> Result<MotorConfig, String> {
        let mut c = HashMap::new();
        for r in registers().iter().filter(|r| r.config) {
            c.insert(r.name.clone(), self.read(r.address, token)?[0]);
        }
        Ok(c)
    }
    pub fn set_streams(&self, addresses: Vec<u8>, token: u64) -> Result<(), String> {
        if self.cogging.load(Ordering::SeqCst) {
            return Err("Cogging LUT acquisition owns streaming until capture ends".into());
        }
        if addresses.len() > MAX_CHANNELS {
            return Err("At most 10 telemetry channels".into());
        }
        let mut seen = std::collections::HashSet::new();
        for a in &addresses {
            let r = register(*a)?;
            if !r.streaming || *a == 92 || !seen.insert(*a) {
                return Err("Invalid, duplicate, or acquisition-only telemetry channel".into());
            }
        }
        let old = self.subscriptions.lock().clone();
        for a in old.iter().filter(|a| !addresses.contains(a)) {
            self.rpc(DISABLE_STREAM, *a, vec![], token, false)?;
            self.subscriptions.lock().retain(|v| v != a);
            if let Some(s) = self
                .observed
                .lock()
                .samples
                .get_mut(&self.node.load(Ordering::SeqCst))
            {
                if let Ok(r) = register(*a) {
                    s.values.remove(&r.name);
                    s.updated_ms.remove(&r.name);
                }
            }
        }
        for a in &addresses {
            if !old.contains(a) {
                self.rpc(ENABLE_STREAM, *a, vec![], token, false)?;
                self.subscriptions.lock().push(*a);
            }
        }
        Ok(())
    }
    pub fn clear_remote_streams(&self, token: u64) -> Result<(), String> {
        for r in registers().iter().filter(|r| r.streaming) {
            match self.rpc(DISABLE_STREAM, r.address, vec![], token, false) {
                Ok(_) => {}
                Err(e) if e.starts_with("Device status -1") => {}
                Err(e) => return Err(e),
            }
        }
        self.subscriptions.lock().clear();
        self.observed.lock().samples.clear();
        Ok(())
    }
    pub fn wait_event(
        &self,
        code: u8,
        after: u64,
        seconds: u64,
        token: u64,
    ) -> Result<DeviceEvent, String> {
        let end = Instant::now() + Duration::from_secs(seconds);
        loop {
            self.check(token)?;
            if let Some(e) = self
                .observed
                .lock()
                .diagnostics
                .events
                .iter()
                .find(|e| {
                    e.sequence > after
                        && e.code == code
                        && e.node_id == self.node.load(Ordering::SeqCst)
                })
                .cloned()
            {
                return Ok(e);
            }
            if Instant::now() >= end {
                return Err(format!(
                    "Timed out waiting for event {code}; no completion confirmed"
                ));
            }
            std::thread::sleep(Duration::from_millis(10));
        }
    }
    pub fn sample(&self) -> TelemetrySample {
        let n = self.node.load(Ordering::SeqCst);
        self.observed
            .lock()
            .samples
            .get(&n)
            .cloned()
            .unwrap_or(TelemetrySample {
                node_id: n,
                ..Default::default()
            })
    }
    pub fn diagnostics(&self) -> Diagnostics {
        let mut d = self.observed.lock().diagnostics.clone();
        d.motor_enabled_acknowledged = self.enabled.load(Ordering::SeqCst);
        d.busy = self.busy.load(Ordering::SeqCst);
        d
    }
    pub fn close(&self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(h) = self.thread.lock().take() {
            let _ = h.join();
        }
        self.observed.lock().diagnostics.connected = false;
    }
}
impl Drop for Session {
    fn drop(&mut self) {
        self.close();
    }
}
fn pump(
    link: &mut dyn Link,
    decoder: &mut Decoder,
    observed: &Arc<Mutex<Observed>>,
) -> Result<(), String> {
    let bytes = link.receive()?;
    let frames = decoder.feed(&bytes);
    let mut o = observed.lock();
    o.diagnostics.malformed += decoder.malformed;
    decoder.malformed = 0;
    for f in frames {
        o.route(f);
    }
    Ok(())
}
fn transact(
    link: &mut dyn Link,
    decoder: &mut Decoder,
    o: &Arc<Mutex<Observed>>,
    stop: &AtomicBool,
    g: &AtomicU64,
    r: &Request,
    timeout: Duration,
) -> Result<Vec<u8>, String> {
    if !r.priority && r.generation != g.load(Ordering::SeqCst) {
        return Err("Operation cancelled by E-STOP".into());
    }
    o.lock().responses.clear();
    let b = r.frame.bytes();
    link.send(&b)?;
    {
        let mut s = o.lock();
        s.diagnostics.packets_tx += 1;
        s.packet("TX", &b);
    }
    // Reset may reboot before it can ACK. Treat it only as sent, never as acknowledged.
    if r.frame.kind == WRITE && r.frame.address == 6 {
        return Ok(vec![]);
    }
    let deadline = Instant::now() + timeout;
    loop {
        if stop.load(Ordering::SeqCst) {
            return Err("Disconnected".into());
        }
        if !r.priority && r.generation != g.load(Ordering::SeqCst) {
            return Err("Operation cancelled by E-STOP".into());
        }
        pump(link, decoder, o)?;
        {
            let mut s = o.lock();
            while let Some(f) = s.responses.pop_front() {
                if f.address != r.frame.address
                    || (f.node != r.frame.node
                        && !(r.frame.kind == WRITE && r.frame.address == 7 && f.node == 0))
                {
                    continue;
                }
                if r.frame.kind == READ {
                    let reg = register(f.address)?;
                    if f.data.len() == 1 && reg.size() != 1 && (f.data[0] as i8) < 0 {
                        return Err(format!(
                            "Device status {} at register {}",
                            f.data[0] as i8, f.address
                        ));
                    }
                    reg.decode(&f.data)?;
                    return Ok(f.data);
                }
                if f.data.len() != 1 {
                    return Err("Invalid ACK length".into());
                }
                let status = f.data[0] as i8;
                if status != 0 {
                    return Err(format!("Device status {status} at register {}", f.address));
                }
                return Ok(f.data);
            }
        }
        if Instant::now() >= deadline {
            o.lock().diagnostics.timeouts += 1;
            return Err(format!(
                "Response timeout at node {}, register {}",
                r.frame.node, r.frame.address
            ));
        }
        std::thread::sleep(Duration::from_millis(1));
    }
}
fn worker(
    mut link: Box<dyn Link>,
    rx: mpsc::Receiver<Request>,
    prx: mpsc::Receiver<Request>,
    o: Arc<Mutex<Observed>>,
    stop: Arc<AtomicBool>,
    g: Arc<AtomicU64>,
    timeout: Duration,
) {
    let mut decoder = Decoder::default();
    while !stop.load(Ordering::SeqCst) {
        let request = prx.try_recv().ok().or_else(|| rx.try_recv().ok());
        let result = if let Some(r) = request {
            let result = transact(link.as_mut(), &mut decoder, &o, &stop, &g, &r, timeout);
            let fatal = result
                .as_ref()
                .err()
                .filter(|e| e.starts_with("Serial") || e.starts_with("Response timeout"))
                .cloned();
            let _ = r.reply.send(result);
            fatal.map_or(Ok(()), Err)
        } else {
            pump(link.as_mut(), &mut decoder, &o)
        };
        if let Err(e) = result {
            let mut s = o.lock();
            s.diagnostics.connected = false;
            s.diagnostics.error = Some(e);
            stop.store(true, Ordering::SeqCst);
            break;
        }
        std::thread::sleep(Duration::from_millis(1));
    }
    o.lock().diagnostics.connected = false;
    // Resolve callers rather than leaving a blocked receiver alive after transport shutdown.
    while let Ok(r) = prx.try_recv() {
        let _ = r.reply.send(Err("Disconnected".into()));
    }
    while let Ok(r) = rx.try_recv() {
        let _ = r.reply.send(Err("Disconnected".into()));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Mock {
        frames: VecDeque<Vec<u8>>,
        behavior: u8,
        sent: Arc<Mutex<Vec<u8>>>,
    }
    impl Link for Mock {
        fn send(&mut self, b: &[u8]) -> Result<(), String> {
            self.sent.lock().push(b[5]);
            if self.behavior == 4 {
                return Err("Serial unplugged".into());
            }
            if self.behavior == 3 {
                return Ok(());
            }
            if self.behavior == 2 {
                self.frames.push_back(
                    Frame {
                        kind: EVENT,
                        node: b[4],
                        address: 1,
                        data: vec![],
                    }
                    .bytes(),
                );
            }
            self.frames.push_back(
                Frame {
                    kind: RESPONSE,
                    node: if self.behavior == 5 { b[4] + 1 } else { b[4] },
                    address: b[5],
                    data: if self.behavior == 1 {
                        vec![255]
                    } else {
                        vec![0]
                    },
                }
                .bytes(),
            );
            Ok(())
        }
        fn receive(&mut self) -> Result<Vec<u8>, String> {
            Ok(self.frames.pop_front().unwrap_or_default())
        }
    }
    fn session(b: u8) -> Arc<Session> {
        Session::start(
            Box::new(Mock {
                frames: VecDeque::new(),
                behavior: b,
                sent: Arc::new(Mutex::new(vec![])),
            }),
            0,
            false,
            Duration::from_millis(30),
        )
    }
    #[test]
    fn negative_ack() {
        let s = session(1);
        assert!(s
            .write(102, &[0.], s.token())
            .unwrap_err()
            .contains("status -1"));
        s.close();
    }
    #[test]
    fn event_before_ack() {
        let s = session(2);
        let seq = s.observed.lock().event_sequence;
        s.write(102, &[0.], s.token()).unwrap();
        assert_eq!(s.wait_event(1, seq, 1, s.token()).unwrap().code, 1);
        s.close();
    }
    #[test]
    fn timeout_closes_connection() {
        let s = session(3);
        assert!(s
            .write(102, &[0.], s.token())
            .unwrap_err()
            .contains("timeout"));
        s.close();
        assert!(!s.diagnostics().connected);
    }
    #[test]
    fn wrong_node_does_not_complete() {
        let s = session(5);
        assert!(s
            .write(102, &[0.], s.token())
            .unwrap_err()
            .contains("timeout"));
        s.close();
    }
    #[test]
    fn unplug_is_error() {
        let s = session(4);
        assert!(s.write(102, &[0.], s.token()).is_err());
        s.close();
    }
    #[test]
    fn estop_cancels_old_generation() {
        let s = session(0);
        let old = s.token();
        s.emergency_stop().unwrap();
        assert!(s.write(55, &[5.], old).is_err());
        assert_eq!(
            s.diagnostics()
                .packets
                .iter()
                .filter(|p| p.direction == "TX")
                .map(|p| p.hex.clone())
                .collect::<Vec<_>>(),
            vec!["A5 A5 04 02 00 66 00", "A5 A5 04 02 00 68 00"]
        );
        s.close();
    }

    #[test]
    fn emergency_queue_bypasses_stale_motion_requests() {
        struct SlowFirst {
            out: VecDeque<Vec<u8>>,
            sent: Arc<Mutex<Vec<u8>>>,
        }
        impl Link for SlowFirst {
            fn send(&mut self, b: &[u8]) -> Result<(), String> {
                self.sent.lock().push(b[5]);
                if b[5] != 55 {
                    self.out.push_back(
                        Frame {
                            kind: RESPONSE,
                            node: b[4],
                            address: b[5],
                            data: vec![0],
                        }
                        .bytes(),
                    );
                }
                Ok(())
            }
            fn receive(&mut self) -> Result<Vec<u8>, String> {
                Ok(self.out.pop_front().unwrap_or_default())
            }
        }
        let sent = Arc::new(Mutex::new(vec![]));
        let s = Session::start(
            Box::new(SlowFirst {
                out: VecDeque::new(),
                sent: sent.clone(),
            }),
            0,
            false,
            Duration::from_secs(2),
        );
        let t = s.token();
        let first = s.clone();
        let a = std::thread::spawn(move || first.write(55, &[100.], t));
        let deadline = Instant::now() + Duration::from_secs(1);
        while sent.lock().is_empty() {
            assert!(Instant::now() < deadline);
            std::thread::sleep(Duration::from_millis(1));
        }
        let second = s.clone();
        let b = std::thread::spawn(move || second.write(56, &[90.], t));
        s.emergency_stop().unwrap();
        assert!(a.join().unwrap().is_err());
        assert!(b.join().unwrap().is_err());
        assert_eq!(*sent.lock(), vec![55, 102, 104]);
        s.close();
    }
}
