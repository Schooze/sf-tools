use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
pub const RESPONSE: u8 = 0;
pub const READ: u8 = 1;
pub const WRITE: u8 = 2;
pub const ENABLE_STREAM: u8 = 3;
pub const DISABLE_STREAM: u8 = 4;
pub const STREAM: u8 = 5;
pub const EVENT: u8 = 6;
pub const MAX_CHANNELS: usize = 10;
pub const FIRMWARE_COMMIT: &str = "2e58c941620b2fbd82c751d390fcecee27f16ece";
pub type MotorConfig = HashMap<String, f64>;
#[derive(Debug, Clone, Deserialize)]
pub struct Register {
    pub address: u8,
    pub name: String,
    pub format: Option<String>,
    pub read: bool,
    pub write: bool,
    pub streaming: bool,
    #[serde(default)]
    pub config: bool,
    pub default: Option<f64>,
    pub editable: Option<bool>,
}
pub fn registers() -> &'static Vec<Register> {
    static C: OnceLock<Vec<Register>> = OnceLock::new();
    C.get_or_init(|| {
        #[derive(Deserialize)]
        struct Catalog {
            registers: Vec<Register>,
        }
        serde_json::from_str::<Catalog>(include_str!("../../shared/registers.json"))
            .expect("valid catalog")
            .registers
    })
}
pub fn register(address: u8) -> Result<&'static Register, String> {
    registers()
        .iter()
        .find(|r| r.address == address)
        .ok_or_else(|| format!("Unknown register {address}"))
}
pub fn defaults() -> MotorConfig {
    registers()
        .iter()
        .filter_map(|r| r.default.map(|v| (r.name.clone(), v)))
        .collect()
}
impl Register {
    pub fn size(&self) -> usize {
        match self.format.as_deref() {
            Some("<B") => 1,
            Some("<3B") => 3,
            Some("<f" | "<I") => 4,
            Some("<fh") => 6,
            _ => 0,
        }
    }
    pub fn encode(&self, values: &[f64]) -> Result<Vec<u8>, String> {
        if values.iter().any(|v| !v.is_finite()) {
            return Err("Values must be finite".into());
        }
        let count = match self.format.as_deref() {
            None => 0,
            Some("<3B") => 3,
            Some("<fh") => 2,
            _ => 1,
        };
        if values.len() != count {
            return Err(format!("{} requires {count} value(s)", self.name));
        }
        let integer = |v: f64, max: f64| {
            if v >= 0.0 && v <= max && v.fract() == 0.0 {
                Ok(v)
            } else {
                Err("Integer out of range".to_string())
            }
        };
        Ok(match self.format.as_deref() {
            None => vec![],
            Some("<B") => vec![integer(values[0], 255.0)? as u8],
            Some("<3B") => values
                .iter()
                .map(|v| integer(*v, 255.0).map(|v| v as u8))
                .collect::<Result<_, _>>()?,
            Some("<I") => (integer(values[0], u32::MAX as f64)? as u32)
                .to_le_bytes()
                .to_vec(),
            Some("<f") => {
                let v = values[0] as f32;
                if !v.is_finite() {
                    return Err("Float32 overflow".into());
                }
                v.to_le_bytes().to_vec()
            }
            Some("<fh") => {
                let p = values[0] as f32;
                let v = values[1];
                if !p.is_finite() || v.fract() != 0.0 || v < i16::MIN as f64 || v > i16::MAX as f64
                {
                    return Err("PVT requires float32 position and int16 velocity".into());
                }
                [
                    p.to_le_bytes().as_slice(),
                    (v as i16).to_le_bytes().as_slice(),
                ]
                .concat()
            }
            _ => return Err("Unsupported format".into()),
        })
    }
    pub fn decode(&self, data: &[u8]) -> Result<Vec<f64>, String> {
        if data.len() != self.size() {
            return Err(format!(
                "{}: expected {} bytes, got {}",
                self.name,
                self.size(),
                data.len()
            ));
        }
        let v: Vec<f64> = match self.format.as_deref() {
            None => vec![],
            Some("<B" | "<3B") => data.iter().map(|v| *v as f64).collect(),
            Some("<I") => vec![u32::from_le_bytes(data.try_into().unwrap()) as f64],
            Some("<f") => vec![f32::from_le_bytes(data.try_into().unwrap()) as f64],
            Some("<fh") => vec![
                f32::from_le_bytes(data[..4].try_into().unwrap()) as f64,
                i16::from_le_bytes(data[4..].try_into().unwrap()) as f64,
            ],
            _ => return Err("Unsupported format".into()),
        };
        if v.iter().any(|v| !v.is_finite()) {
            return Err(format!("{} returned non-finite data", self.name));
        }
        Ok(v)
    }
}
#[derive(Debug, Clone, PartialEq)]
pub struct Frame {
    pub kind: u8,
    pub node: u8,
    pub address: u8,
    pub data: Vec<u8>,
}
impl Frame {
    pub fn bytes(&self) -> Vec<u8> {
        let mut b = vec![
            0xa5,
            0xa5,
            (3 + self.data.len()) as u8,
            self.kind,
            self.node,
            self.address,
        ];
        b.extend_from_slice(&self.data);
        b
    }
}
#[derive(Default)]
pub struct Decoder {
    buffer: Vec<u8>,
    pub malformed: u64,
}
impl Decoder {
    pub fn feed(&mut self, bytes: &[u8]) -> Vec<Frame> {
        self.buffer.extend_from_slice(bytes);
        let mut frames = vec![];
        loop {
            if self.buffer.len() < 3 {
                break;
            }
            if self.buffer[..2] != [0xa5, 0xa5] {
                self.buffer.remove(0);
                self.malformed += 1;
                continue;
            }
            let size = self.buffer[2] as usize;
            if !(3..=29).contains(&size) {
                self.buffer.remove(0);
                self.malformed += 1;
                continue;
            }
            if self.buffer.len() < size + 3 {
                break;
            }
            if self.buffer[3] > EVENT {
                self.buffer.remove(0);
                self.malformed += 1;
                continue;
            }
            frames.push(Frame {
                kind: self.buffer[3],
                node: self.buffer[4],
                address: self.buffer[5],
                data: self.buffer[6..size + 3].to_vec(),
            });
            self.buffer.drain(..size + 3);
        }
        frames
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub name: String,
    pub hardware_version: Option<String>,
    pub firmware_version: String,
    pub device_id: String,
    pub node_id: u8,
    pub is_simulator: bool,
    pub capabilities: Vec<String>,
    pub firmware_commit: String,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TelemetrySample {
    pub timestamp_ms: u64,
    pub node_id: u8,
    pub values: HashMap<String, f64>,
    pub updated_ms: HashMap<String, u64>,
}
#[derive(Debug, Clone, Serialize)]
pub struct DeviceEvent {
    pub sequence: u64,
    pub timestamp_ms: u64,
    pub node_id: u8,
    pub code: u8,
    pub name: String,
}
#[derive(Debug, Clone, Serialize)]
pub struct Packet {
    pub timestamp_ms: u64,
    pub direction: String,
    pub hex: String,
}
#[derive(Debug, Clone, Default, Serialize)]
pub struct Diagnostics {
    pub motor_enabled_acknowledged: bool,
    pub connected: bool,
    pub error: Option<String>,
    pub packets_rx: u64,
    pub packets_tx: u64,
    pub malformed: u64,
    pub timeouts: u64,
    pub events: Vec<DeviceEvent>,
    pub packets: Vec<Packet>,
    pub busy: bool,
}
#[derive(Debug, Clone, Serialize)]
pub struct ApplyResult {
    pub applied: MotorConfig,
    pub failed: HashMap<String, String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PvtPoint {
    pub position_deg: f64,
    pub velocity_deg_s: f64,
}
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fragmentation_noise_and_coalescing() {
        let f = Frame {
            kind: STREAM,
            node: 17,
            address: 72,
            data: 123f32.to_le_bytes().to_vec(),
        };
        let b = f.bytes();
        let mut d = Decoder::default();
        assert!(d.feed(&[0, 0xa5]).is_empty());
        assert!(d.feed(&b[..4]).is_empty());
        let mut rest = b[4..].to_vec();
        rest.extend(f.bytes());
        assert_eq!(d.feed(&rest), vec![f.clone(), f]);
        assert!(d.malformed > 0);
    }
    #[test]
    fn catalog_matches_upstream_handlers() {
        let c = include_str!("../../shared/firmware/sf_motion_com.upstream.c");
        let mut seen = std::collections::HashSet::new();
        for r in registers() {
            assert!(seen.insert(r.address));
            assert!(
                c.contains(&format!("// {}\n", r.address))
                    || c.contains(&format!("// {}\r", r.address)),
                "{}",
                r.address
            );
            assert!([0, 1, 3, 4, 6].contains(&r.size()));
        }
        assert_eq!(register(1).unwrap().size(), 3);
        assert_eq!(register(103).unwrap().size(), 6);
    }
    #[test]
    fn pvt_numeric_validation() {
        let r = register(103).unwrap();
        assert_eq!(
            r.encode(&[1.25, -32768.0]).unwrap(),
            [
                1.25f32.to_le_bytes().as_slice(),
                i16::MIN.to_le_bytes().as_slice()
            ]
            .concat()
        );
        assert!(r.encode(&[1., 32768.]).is_err());
        assert!(r.encode(&[1., 1.5]).is_err());
        assert!(register(17).unwrap().encode(&[f64::NAN]).is_err());
    }
}

#[derive(Debug, Serialize)]
pub struct CommissionResult {
    pub config: MotorConfig,
    pub cogging_lut: Vec<f64>,
}
