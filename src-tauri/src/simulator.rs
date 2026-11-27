use crate::protocol::*;
use crate::transport::Link;
use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

struct Node {
    values: MotorConfig,
    flash: MotorConfig,
    channels: Vec<u8>,
    enabled: bool,
    last_mode: f64,
    active_phase: f64,
    pending: Option<(Instant, u8)>,
    points: VecDeque<(f64, f64)>,
    pvt_run: bool,
    pvt_tick: Instant,
    position: f64,
    rpm: f64,
    last_tick: Instant,
    stream_tick: Instant,
    cogging: Option<usize>,
    trajectory: Option<(Instant, f64, f64, f64)>,
    fault: Option<u8>,
    thermal: f64,
}
impl Node {
    fn new(id: u8) -> Self {
        let mut v = defaults();
        v.insert("device_id".into(), id as f64);
        for r in registers() {
            if r.size() == 4 && !v.contains_key(&r.name) {
                v.insert(r.name.clone(), 0.);
            }
        }
        v.insert("v_bus".into(), 24.);
        Self {
            flash: v.clone(),
            values: v,
            channels: vec![],
            enabled: false,
            last_mode: 0.,
            active_phase: 0.,
            pending: None,
            points: VecDeque::new(),
            pvt_run: false,
            pvt_tick: Instant::now(),
            position: 0.,
            rpm: 0.,
            last_tick: Instant::now(),
            stream_tick: Instant::now(),
            cogging: None,
            trajectory: None,
            fault: None,
            thermal: 0.,
        }
    }
    fn get(&self, k: &str) -> f64 {
        *self.values.get(k).unwrap_or(&0.)
    }
    fn mode(&mut self, v: f64) {
        if self.get("motor_mode") != v {
            self.values.insert("motor_mode".into(), v);
            for k in [
                "is_ref",
                "current_set_point",
                "rpm_ref",
                "speed_set_point",
                "cff_ref",
                "vd",
                "vq",
                "e_rad",
            ] {
                self.values.insert(k.into(), 0.);
            }
            self.values.insert("pos_ref".into(), self.position);
            self.trajectory = None;
        }
    }
}
pub struct DeviceSimulator {
    nodes: HashMap<u8, Node>,
    out: VecDeque<Vec<u8>>,
    decoder: Decoder,
}
impl DeviceSimulator {
    pub fn new(node: u8) -> Self {
        let mut nodes = HashMap::new();
        nodes.insert(node, Node::new(node));
        Self {
            nodes,
            out: VecDeque::new(),
            decoder: Decoder::default(),
        }
    }
    fn reply(&mut self, n: u8, a: u8, d: Vec<u8>) {
        self.out.push_back(
            Frame {
                kind: RESPONSE,
                node: n,
                address: a,
                data: d,
            }
            .bytes(),
        );
    }
    fn handle(&mut self, f: Frame) {
        let Ok(r) = register(f.address) else { return };
        let n = self
            .nodes
            .entry(f.node)
            .or_insert_with(|| Node::new(f.node));
        let mut status = 0i8;
        match f.kind {
            READ => {
                if !r.read {
                    status = -1;
                } else {
                    let data = if f.address == 1 {
                        vec![0, 3, 0]
                    } else {
                        r.encode(&[match f.address {
                            54 => n.get("is_ref"),
                            55 => n.get("rpm_ref"),
                            56 => n.get("pos_ref"),
                            _ => n.get(&r.name),
                        }])
                        .unwrap_or_default()
                    };
                    self.reply(f.node, f.address, data);
                    return;
                }
            }
            ENABLE_STREAM => {
                if !r.streaming
                    || n.channels.contains(&f.address)
                    || n.channels.len() >= MAX_CHANNELS
                {
                    status = -1;
                } else {
                    n.channels.push(f.address);
                }
            }
            DISABLE_STREAM => {
                if !n.channels.contains(&f.address) {
                    status = -1;
                } else {
                    n.channels.retain(|v| *v != f.address);
                }
            }
            WRITE => {
                if !r.write || f.data.len() != r.size() {
                    status = -1;
                } else {
                    let v = r.decode(&f.data).unwrap_or_default();
                    match f.address {
                        6 => {
                            let mut v = n.flash.clone();
                            let new_id = *v.get("device_id").unwrap_or(&(f.node as f64)) as u8;
                            v.insert("motor_mode".into(), 0.);
                            let mut fresh = Node::new(new_id);
                            fresh.values = v.clone();
                            fresh.flash = v;
                            self.nodes.remove(&f.node);
                            self.nodes.insert(new_id, fresh);
                            return;
                        }
                        7 => {
                            let fresh = Node::new(0);
                            *n = fresh;
                        }
                        8 => {
                            n.values.insert("motor_phase_dir".into(), n.active_phase);
                            n.flash = n.values.clone();
                        }
                        9 | 10 | 11 | 12 | 84 | 85 => {
                            if n.pending.is_some() {
                                status = -1;
                            } else {
                                n.pending =
                                    Some((Instant::now() + Duration::from_millis(120), f.address));
                            }
                        }
                        14 => n.mode(v[0]),
                        54 => {
                            if n.get("motor_mode") == 1. {
                                n.values.insert("is_ref".into(), v[0]);
                                n.values.insert(r.name.clone(), v[0]);
                            }
                        }
                        55 => {
                            if n.get("motor_mode") == 2. {
                                n.values.insert("rpm_ref".into(), v[0]);
                                n.values.insert(r.name.clone(), v[0]);
                            }
                        }
                        56 => {
                            if n.get("motor_mode") == 3. {
                                n.values.insert("pos_ref".into(), v[0]);
                                n.values.insert(r.name.clone(), v[0]);
                            }
                        }
                        83 => {
                            let duration = ((v[0] - n.position).abs()
                                / n.get("trajectory_v_max").max(1.))
                            .max(0.05);
                            n.trajectory = Some((Instant::now(), n.position, v[0], duration));
                        }
                        90 => {
                            n.values.insert(r.name.clone(), v[0]);
                        }
                        102 => {
                            n.enabled = v[0] != 0.;
                            if n.enabled {
                                n.mode(n.last_mode);
                            } else {
                                n.last_mode = n.get("motor_mode");
                                n.mode(0.);
                            }
                        }
                        103 => {
                            if n.points.len() >= 256 {
                                status = -1;
                            } else {
                                n.points.push_back((v[0], v[1]));
                            }
                        }
                        104 => {
                            n.pvt_run = v[0] == 1. && !n.points.is_empty();
                            n.pvt_tick = Instant::now();
                            if n.pvt_run {
                                if let Some((p, v)) = n.points.pop_front() {
                                    if n.get("motor_mode") == 4. {
                                        n.values.insert("pos_ref".into(), p);
                                        n.values.insert("rpm_ref".into(), v / 6.);
                                    }
                                }
                            }
                        }
                        _ => {
                            if let Some(v) = v.first() {
                                n.values.insert(r.name.clone(), *v);
                            }
                        }
                    }
                }
            }
            _ => status = -2,
        }
        let reply_node = if f.kind == WRITE && f.address == 7 {
            0
        } else {
            f.node
        };
        self.reply(reply_node, f.address, vec![status as u8]);
    }
    fn tick(&mut self) {
        for (id, n) in &mut self.nodes {
            let now = Instant::now();
            let dt = now.duration_since(n.last_tick).as_secs_f64();
            n.last_tick = now;
            if let Some((due, action)) = n.pending {
                if now >= due {
                    n.pending = None;
                    match action {
                        9 => {
                            n.values.insert("rs".into(), 0.084);
                        }
                        10 => {
                            n.values.insert("ld".into(), 0.000121);
                        }
                        11 => {
                            n.values.insert("lq".into(), 0.000143);
                        }
                        84 => {
                            n.values.insert("pole_pairs".into(), 7.);
                            n.active_phase = 0.;
                            n.values.insert("motor_phase_dir".into(), 0.);
                        }
                        85 => {
                            n.channels = vec![];
                            n.cogging = Some(0);
                        }
                        _ => {}
                    }
                    self.out.push_back(
                        Frame {
                            kind: EVENT,
                            node: *id,
                            address: 1,
                            data: vec![],
                        }
                        .bytes(),
                    );
                }
            }
            if n.pvt_run && now.duration_since(n.pvt_tick) >= Duration::from_millis(1) {
                let steps = now.duration_since(n.pvt_tick).as_millis().min(256);
                n.pvt_tick = now;
                for _ in 0..steps {
                    if let Some((p, v)) = n.points.pop_front() {
                        if n.get("motor_mode") == 4. {
                            n.values.insert("pos_ref".into(), p);
                            n.values.insert("rpm_ref".into(), v / 6.);
                        }
                    } else {
                        n.pvt_run = false;
                        break;
                    }
                }
            }
            if let Some((start, from, to, duration)) = n.trajectory {
                let t = (now.duration_since(start).as_secs_f64() / duration).min(1.);
                let blend = t * t * t * (10. - 15. * t + 6. * t * t);
                n.values
                    .insert("pos_ref".into(), from + (to - from) * blend);
                if t >= 1. {
                    n.trajectory = None;
                }
            }
            let mode = n.get("motor_mode");
            let target = if !n.enabled || mode == 0. {
                0.
            } else if mode == 2. {
                n.get("rpm_ref")
            } else if mode == 3. || mode == 4. {
                ((n.get("pos_ref") - n.position) * 10.).clamp(-2000., 2000.)
            } else if mode == 1. {
                n.get("is_ref") * 120.
            } else if mode == 6. {
                n.get("vq") * 100.
            } else {
                0.
            };
            n.rpm += (target - n.rpm) * (dt * 12.).min(1.);
            n.position += n.rpm * 6. * dt;
            let angle =
                (n.position.to_radians() * n.get("pole_pairs")) % (std::f64::consts::PI * 2.);
            let mut iq = if n.enabled && mode != 0. {
                if mode == 1. {
                    n.get("is_ref")
                } else {
                    (target - n.rpm) * 0.01
                }
            } else {
                0.
            };
            iq = iq.clamp(-n.get("limit_current"), n.get("limit_current"));
            // Approximate I²t dynamics while preserving the firmware event codes and disable behavior.
            let rated = n.get("i2t_i_rated");
            let maximum = n.get("i2t_i_max");
            let excess = (iq * iq - rated * rated) / (maximum * maximum - rated * rated).max(0.01);
            n.thermal = (n.thermal + excess * dt / n.get("i2t_t_max").max(0.001)).max(0.);
            let fault = if n.get("v_bus") < n.get("under_voltage") {
                Some(4)
            } else if n.get("v_bus") > n.get("over_voltage") {
                Some(3)
            } else if n.thermal >= 1. {
                Some(2)
            } else {
                None
            };
            if fault != n.fault {
                n.fault = fault;
                if let Some(code) = fault {
                    n.last_mode = n.get("motor_mode");
                    n.enabled = false;
                    n.mode(0.);
                    iq = 0.;
                    self.out.push_back(
                        Frame {
                            kind: EVENT,
                            node: *id,
                            address: code,
                            data: vec![],
                        }
                        .bytes(),
                    );
                }
            }
            for (k, v) in [
                ("actual_rpm", n.rpm),
                ("actual_angle", n.position),
                ("following_error", n.get("pos_ref") - n.position),
                ("iq", iq),
                ("id", 0.),
                ("ia", iq * angle.sin()),
                ("ib", iq * (angle - 2.094395).sin()),
                ("ic", iq * (angle + 2.094395).sin()),
                ("m_angle_rad", n.position.to_radians()),
                ("m_angle_rad_comp", n.position.to_radians()),
                ("encd_e_rad", angle),
                ("hfi_e_rad", angle),
                ("smo_e_rad", angle),
            ] {
                n.values.insert(k.into(), v);
            }
            if mode != 6. {
                n.values.insert("e_rad".into(), angle);
            }
            if now.duration_since(n.stream_tick) >= Duration::from_millis(1) {
                n.stream_tick = now;
                for a in &n.channels {
                    if let Ok(r) = register(*a) {
                        self.out.push_back(
                            Frame {
                                kind: STREAM,
                                node: *id,
                                address: *a,
                                data: r.encode(&[n.get(&r.name)]).unwrap(),
                            }
                            .bytes(),
                        );
                    }
                }
            }
            if let Some(i) = n.cogging {
                if i < 1024 {
                    let v = ((i as f32 / 1024.) * std::f32::consts::PI * 14.).sin() * 0.08;
                    self.out.push_back(
                        Frame {
                            kind: STREAM,
                            node: *id,
                            address: 92,
                            data: v.to_le_bytes().to_vec(),
                        }
                        .bytes(),
                    );
                    n.cogging = Some(i + 1);
                } else {
                    n.cogging = None;
                }
            }
        }
    }
}
impl Link for DeviceSimulator {
    fn send(&mut self, b: &[u8]) -> Result<(), String> {
        for f in self.decoder.feed(b) {
            self.handle(f);
        }
        Ok(())
    }
    fn receive(&mut self) -> Result<Vec<u8>, String> {
        self.tick();
        let mut b = vec![];
        for _ in 0..64 {
            if let Some(f) = self.out.pop_front() {
                b.extend(f)
            } else {
                break;
            }
        }
        Ok(b)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn exchange(s: &mut DeviceSimulator, k: u8, a: u8, v: &[f64]) -> Frame {
        s.send(
            &Frame {
                kind: k,
                node: 0,
                address: a,
                data: register(a).unwrap().encode(v).unwrap(),
            }
            .bytes(),
        )
        .unwrap();
        Decoder::default()
            .feed(&s.receive().unwrap())
            .into_iter()
            .find(|f| f.kind == RESPONSE)
            .unwrap()
    }
    #[test]
    fn buffer_capacity_and_stop_preserves_queue() {
        let mut s = DeviceSimulator::new(0);
        for _ in 0..256 {
            assert_eq!(exchange(&mut s, WRITE, 103, &[12., 30.]).data, vec![0]);
        }
        assert_eq!(exchange(&mut s, WRITE, 103, &[0., 0.]).data, vec![255]);
        exchange(&mut s, WRITE, 104, &[0.]);
        assert_eq!(s.nodes[&0].points.len(), 256);
        exchange(&mut s, WRITE, 104, &[1.]);
        assert_eq!(s.nodes[&0].points.len(), 255);
    }
    #[test]
    fn real_mode_numbers_and_disabled_start() {
        let mut s = DeviceSimulator::new(0);
        assert!(!s.nodes[&0].enabled);
        assert_eq!(s.nodes[&0].get("motor_mode"), 0.);
        exchange(&mut s, WRITE, 14, &[2.]);
        exchange(&mut s, WRITE, 55, &[100.]);
        assert_eq!(s.nodes[&0].get("rpm_ref"), 100.);
    }
    #[test]
    fn ten_stream_limit() {
        let mut s = DeviceSimulator::new(0);
        for a in 57..67 {
            assert_eq!(exchange(&mut s, ENABLE_STREAM, a, &[0.]).data, vec![0]);
        }
        assert_eq!(exchange(&mut s, ENABLE_STREAM, 67, &[0.]).data, vec![255]);
    }

    #[test]
    fn protection_registers_generate_real_event_frames() {
        let mut s = DeviceSimulator::new(0);
        s.send(
            &Frame {
                kind: WRITE,
                node: 0,
                address: 101,
                data: 23f32.to_le_bytes().to_vec(),
            }
            .bytes(),
        )
        .unwrap();
        let frames = Decoder::default().feed(&s.receive().unwrap());
        assert!(frames
            .iter()
            .any(|f| f.kind == EVENT && f.address == 3 && f.node == 0));
        assert!(!s.nodes[&0].enabled);
    }
    #[test]
    fn setpoint_aliases_read_the_same_underlying_reference() {
        let mut s = DeviceSimulator::new(0);
        exchange(&mut s, WRITE, 74, &[0.5]);
        let f = exchange(&mut s, READ, 54, &[0.]);
        assert_eq!(register(54).unwrap().decode(&f.data).unwrap(), vec![0.5]);
    }
}
