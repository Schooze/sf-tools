use crate::protocol::*;
use crate::transport::Session;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};
pub fn validate(address: u8, v: &[f64]) -> Result<(), String> {
    let r = register(address)?;
    r.encode(v)?;
    if r.editable == Some(false) {
        return Err(format!(
            "{} cannot be reliably applied by this firmware; use commissioning",
            r.name
        ));
    }
    if v.is_empty() {
        return Ok(());
    }
    let x = v[0];
    if address == 13 && !(0.0..=3.0).contains(&x) {
        return Err("Invalid FOC mode".into());
    }
    if address == 14 && ![0., 1., 2., 3., 4., 6.].contains(&x) {
        return Err("Unsupported motor mode (Audio is not implemented)".into());
    }
    if [46, 47, 87, 91, 102, 104].contains(&address) && ![0., 1.].contains(&x) {
        return Err("Flag must be 0 or 1".into());
    }
    if [15, 16, 21, 22, 23, 86, 88, 89, 97, 98, 99, 100, 101].contains(&address) && x <= 0. {
        return Err(format!("{} must be positive", r.name));
    }
    if [
        17, 18, 19, 20, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 43,
        44, 80, 81, 82,
    ]
    .contains(&address)
        && x < 0.
    {
        return Err(format!("{} must be non-negative", r.name));
    }
    if address == 45 && x > 0. {
        return Err("Field weakening minimum must be non-positive".into());
    }
    Ok(())
}
pub fn apply_config(s: &Session, config: MotorConfig, token: u64) -> Result<ApplyResult, String> {
    // Validate every requested field before the first write. A partially failed I/O sequence is reported per parameter.
    let mut merged = s.read_config(token)?;
    for (name, v) in &config {
        let r = registers()
            .iter()
            .find(|r| r.name == *name && r.config)
            .ok_or_else(|| format!("Unknown configuration parameter {name}"))?;
        validate(r.address, &[*v])?;
        merged.insert(name.clone(), *v);
    }
    if merged["under_voltage"] as f32 >= merged["over_voltage"] as f32 {
        return Err("Under-voltage must be below over-voltage".into());
    }
    if merged["i2t_i_rated"] as f32 > merged["i2t_i_max"] as f32 {
        return Err("Rated current must not exceed I²t maximum".into());
    }
    let mut result = ApplyResult {
        applied: MotorConfig::new(),
        failed: Default::default(),
    };
    for r in registers().iter().filter(|r| config.contains_key(&r.name)) {
        let v = config[&r.name];
        match s
            .write(r.address, &[v], token)
            .and_then(|_| s.read(r.address, token))
            .and_then(|actual| {
                if actual == r.decode(&r.encode(&[v])?)? {
                    Ok(actual[0])
                } else {
                    Err(format!("Readback {} differs from requested {v}", actual[0]))
                }
            }) {
            Ok(actual) => {
                result.applied.insert(r.name.clone(), actual);
            }
            Err(e) => {
                result.failed.insert(r.name.clone(), e);
            }
        }
    }
    Ok(result)
}
pub fn write_verified(s: &Session, address: u8, values: &[f64], t: u64) -> Result<(), String> {
    validate(address, values)?;
    // Action registers are handled by explicit operations so event waits and cancellation cannot be bypassed.
    if [6, 7, 8, 9, 10, 11, 12, 84, 85, 103, 104, 102].contains(&address) {
        return Err("Use the dedicated action, motion, commissioning, or enable command".into());
    }
    s.write(address, values, t)?;
    let r = register(address)?;
    if r.read {
        let actual = s.read(address, t)?;
        if actual != r.decode(&r.encode(values)?)? {
            return Err(format!(
                "{} ACK received, but readback did not match (check active motor mode)",
                r.name
            ));
        }
    }
    Ok(())
}
pub fn run_commission(
    s: &Session,
    action: &str,
    bandwidth: f64,
    t: u64,
) -> Result<CommissionResult, String> {
    if action != "auto_bandwidth" && !s.enabled.load(Ordering::SeqCst) {
        return Err("Enable motor output explicitly before commissioning".into());
    }
    if !bandwidth.is_finite() || bandwidth <= 0. || bandwidth > 2000. {
        return Err("Bandwidth must be > 0 and <= 2000 Hz".into());
    }
    let actions: Vec<&str> = match action {
        "full" => vec![
            "calc_pole_pairs",
            "measure_rs",
            "measure_ld",
            "measure_lq",
            "calibrate_encoder",
            "auto_bandwidth",
        ],
        _ => vec![action],
    };
    let mut lut = vec![];
    for action in actions {
        s.check(t)?;
        if action == "auto_bandwidth" {
            let rs = s.read(17, t)?[0];
            let ld = s.read(18, t)?[0];
            let lq = s.read(19, t)?[0];
            if rs <= 0. || ld <= 0. || lq <= 0. {
                return Err("Measure positive Rs, Ld and Lq before calculating bandwidth".into());
            }
            let w = 2. * std::f64::consts::PI * bandwidth;
            for (a, v) in [
                (24, ld * 0.5 * w),
                (25, rs * 0.5 * w),
                (26, 0.),
                (27, lq * 0.5 * w),
                (28, rs * 0.5 * w),
                (29, 0.),
            ] {
                write_verified(s, a, &[v], t)?;
            }
            continue;
        }
        let (address, timeout) = match action {
            "measure_rs" => (9, 10),
            "measure_ld" => (10, 10),
            "measure_lq" => (11, 10),
            "calibrate_encoder" => (12, 180),
            "calc_pole_pairs" => (84, 60),
            "measure_cogging" => (85, 300),
            _ => return Err("Unknown commissioning action".into()),
        };
        let old = s.subscriptions.lock().clone();
        if address == 85 {
            s.set_streams(vec![], t)?;
            s.cogging.store(true, Ordering::SeqCst);
            s.observed
                .lock()
                .cogging
                .remove(&s.node.load(Ordering::SeqCst));
        }
        let result = (|| {
            let after = s.observed.lock().event_sequence;
            s.write(address, &[], t)?;
            s.wait_event(1, after, timeout, t)?;
            if address == 85 {
                let end = Instant::now() + Duration::from_secs(10);
                loop {
                    s.check(t)?;
                    lut = s
                        .observed
                        .lock()
                        .cogging
                        .get(&s.node.load(Ordering::SeqCst))
                        .cloned()
                        .unwrap_or_default();
                    if lut.len() == 1024 {
                        break;
                    }
                    if Instant::now() > end {
                        return Err(format!(
                            "Cogging capture incomplete: {}/1024 samples",
                            lut.len()
                        ));
                    }
                    std::thread::sleep(Duration::from_millis(5));
                }
            }
            Ok(())
        })();
        if address == 85 {
            s.cogging.store(false, Ordering::SeqCst);
            if s.check(t).is_ok() {
                s.clear_remote_streams(t)?;
                s.set_streams(old, t)?;
            }
        }
        result?;
    }
    Ok(CommissionResult {
        config: s.read_config(t)?,
        cogging_lut: lut,
    })
}
pub fn change_node(s: &Session, node: u8, t: u64) -> Result<(DeviceInfo, MotorConfig), String> {
    let result = (|| {
        s.set_streams(vec![], t)?;
        s.observed.lock().samples.clear();
        s.node.store(node, Ordering::SeqCst);
        s.enabled.store(false, Ordering::SeqCst);
        let info = s.info(t)?;
        s.clear_remote_streams(t)?;
        Ok((info, s.read_config(t)?))
    })();
    if result.is_err() {
        s.close();
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn commissioning_reads_after_completion_and_uses_bandwidth() {
        let s = Session::open("SIMULATOR", 115200, 0).unwrap();
        s.write(102, &[1.], s.token()).unwrap();
        s.write(14, &[6.], s.token()).unwrap();
        s.enabled.store(true, Ordering::SeqCst);
        let result = run_commission(&s, "full", 250., s.token()).unwrap();
        assert!(
            (result.config["id_kp"] - result.config["ld"] * std::f64::consts::PI * 250.).abs()
                < 1e-6
        );
        assert_eq!(
            s.diagnostics()
                .events
                .iter()
                .filter(|e| e.code == 1)
                .count(),
            5
        );
        s.close();
    }
    #[test]
    fn invalid_configuration_writes_nothing() {
        let s = Session::open("SIMULATOR", 115200, 0).unwrap();
        let mut v = MotorConfig::new();
        v.insert("over_voltage".into(), 5.);
        assert!(apply_config(&s, v, s.token()).is_err());
        assert_eq!(s.read(101, s.token()).unwrap()[0], 25.);
        s.close();
    }
    #[test]
    fn partial_apply_keeps_successes() {
        let s = Session::open("SIMULATOR", 115200, 0).unwrap();
        let mut v = MotorConfig::new();
        v.insert("kv".into(), 300.);
        v.insert("motor_mode".into(), 2.);
        let r = apply_config(&s, v, s.token()).unwrap();
        assert!(r.failed.is_empty());
        assert_eq!(r.applied["kv"], 300.);
        s.close();
    }

    #[test]
    fn partial_io_failure_preserves_successful_readbacks() {
        use crate::simulator::DeviceSimulator;
        use crate::transport::Link;
        use std::collections::VecDeque;
        struct FailingLink {
            sim: DeviceSimulator,
            queued: VecDeque<Vec<u8>>,
        }
        impl Link for FailingLink {
            fn send(&mut self, b: &[u8]) -> Result<(), String> {
                if b[3] == WRITE && b[5] == 17 {
                    self.queued.push_back(
                        Frame {
                            kind: RESPONSE,
                            node: b[4],
                            address: 17,
                            data: vec![255],
                        }
                        .bytes(),
                    );
                    Ok(())
                } else {
                    self.sim.send(b)
                }
            }
            fn receive(&mut self) -> Result<Vec<u8>, String> {
                if let Some(b) = self.queued.pop_front() {
                    Ok(b)
                } else {
                    self.sim.receive()
                }
            }
        }
        let s = Session::start(
            Box::new(FailingLink {
                sim: DeviceSimulator::new(0),
                queued: VecDeque::new(),
            }),
            0,
            true,
            Duration::from_secs(2),
        );
        let result = apply_config(
            &s,
            MotorConfig::from([("kv".into(), 300.), ("rs".into(), 0.1)]),
            s.token(),
        )
        .unwrap();
        assert_eq!(result.applied["kv"], 300.);
        assert!(result.failed["rs"].contains("status -1"));
        assert_eq!(s.read(17, s.token()).unwrap()[0], 0.);
        s.close();
    }
    #[test]
    fn cogging_capture_is_finite_and_restores_subscriptions() {
        let s = Session::open("SIMULATOR", 115200, 0).unwrap();
        s.write(102, &[1.], s.token()).unwrap();
        s.write(14, &[6.], s.token()).unwrap();
        s.enabled.store(true, Ordering::SeqCst);
        s.set_streams(vec![72, 79], s.token()).unwrap();
        let r = run_commission(&s, "measure_cogging", 500., s.token()).unwrap();
        assert_eq!(r.cogging_lut.len(), 1024);
        assert_eq!(*s.subscriptions.lock(), vec![72, 79]);
        assert!(!s.cogging.load(Ordering::SeqCst));
        s.close();
    }
    #[test]
    fn estop_interrupts_commissioning_wait_and_next_steps() {
        let s = Session::open("SIMULATOR", 115200, 0).unwrap();
        s.write(102, &[1.], s.token()).unwrap();
        s.write(14, &[6.], s.token()).unwrap();
        s.enabled.store(true, Ordering::SeqCst);
        let worker = s.clone();
        let t = s.token();
        let job = std::thread::spawn(move || run_commission(&worker, "full", 500., t));
        std::thread::sleep(Duration::from_millis(20));
        s.emergency_stop().unwrap();
        assert!(job.join().unwrap().unwrap_err().contains("cancelled"));
        assert_eq!(s.read(17, s.token()).unwrap()[0], 0.);
        s.close();
    }
    #[test]
    fn changing_node_clears_previous_values_and_subscriptions() {
        let s = Session::open("SIMULATOR", 115200, 0).unwrap();
        s.set_streams(vec![72], s.token()).unwrap();
        std::thread::sleep(Duration::from_millis(10));
        assert_eq!(s.sample().node_id, 0);
        let (info, cfg) = change_node(&s, 7, s.token()).unwrap();
        assert_eq!(info.node_id, 7);
        assert_eq!(cfg["device_id"], 7.);
        assert!(s.sample().values.is_empty());
        assert!(s.subscriptions.lock().is_empty());
        s.close();
    }
    #[test]
    fn commissioning_requires_explicit_motor_enable() {
        let s = Session::open("SIMULATOR", 115200, 0).unwrap();
        assert!(run_commission(&s, "measure_rs", 500., s.token())
            .unwrap_err()
            .contains("Enable motor output"));
        s.close();
    }
}
