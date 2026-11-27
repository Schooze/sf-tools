use crate::device::{apply_config, run_commission, validate, write_verified};
use crate::protocol::*;
use crate::transport::{self, Session};
use parking_lot::Mutex;
use serde::Serialize;
use std::sync::{atomic::Ordering, Arc};
use tauri::State;

#[derive(Default)]
pub struct AppState {
    pub session: Mutex<Option<Arc<Session>>>,
    connection: Mutex<()>,
}
impl Drop for AppState {
    fn drop(&mut self) {
        if let Some(s) = self.session.get_mut().take() {
            s.close();
        }
    }
}
impl AppState {
    fn session(&self) -> Result<Arc<Session>, String> {
        let s = self.session.lock().clone().ok_or("No device connected")?;
        s.check(s.token())?;
        Ok(s)
    }
}
async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct ConnectionResult {
    pub info: DeviceInfo,
    pub config: MotorConfig,
}
#[derive(Serialize)]
pub struct PvtResult {
    pub uploaded: usize,
    pub requested: usize,
    pub error: Option<String>,
}
#[tauri::command]
pub fn list_ports() -> Vec<transport::PortDetail> {
    transport::list_ports()
}
#[tauri::command]
pub async fn connect_device(
    port: String,
    baudrate: u32,
    node_id: u8,
    state: State<'_, AppState>,
) -> Result<DeviceInfo, String> {
    let s = blocking(move || {
        let s = Session::open(&port, baudrate, node_id)?;
        match s.info(s.token()).and_then(|info| {
            s.clear_remote_streams(s.token())?;
            Ok(info)
        }) {
            Ok(info) => Ok((s, info)),
            Err(e) => {
                s.close();
                Err(e)
            }
        }
    })
    .await?;
    let _lock = state.connection.lock();
    if let Some(old) = state.session.lock().replace(s.0) {
        old.close();
    }
    Ok(s.1)
}
#[tauri::command]
pub async fn disconnect_device(state: State<'_, AppState>) -> Result<bool, String> {
    let s = state.session.lock().take();
    blocking(move || {
        if let Some(s) = s {
            s.generation.fetch_add(1, Ordering::SeqCst);
            let _ = s.clear_remote_streams(s.token());
            s.close();
        }
        Ok(true)
    })
    .await
}
#[tauri::command]
pub async fn select_node(
    node_id: u8,
    state: State<'_, AppState>,
) -> Result<ConnectionResult, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let token = s.token();
        let (info, config) = crate::device::change_node(&s, node_id, token)?;
        Ok(ConnectionResult { info, config })
    })
    .await
}
#[tauri::command]
pub async fn get_device_info(state: State<'_, AppState>) -> Result<DeviceInfo, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        s.info(s.token())
    })
    .await
}
#[tauri::command]
pub async fn read_config(state: State<'_, AppState>) -> Result<MotorConfig, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        s.read_config(s.token())
    })
    .await
}

#[tauri::command]
pub async fn write_config(
    config: MotorConfig,
    state: State<'_, AppState>,
) -> Result<ApplyResult, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        apply_config(&s, config, s.token())
    })
    .await
}
#[tauri::command]
pub async fn save_config(state: State<'_, AppState>) -> Result<MotorConfig, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let t = s.token();
        s.write(8, &[], t)?;
        s.read_config(t)
    })
    .await
}
#[tauri::command]
pub async fn restore_defaults(state: State<'_, AppState>) -> Result<ConnectionResult, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let t = s.token();
        s.set_streams(vec![], t)?;
        s.write(102, &[0.], t)?;
        s.enabled.store(false, Ordering::SeqCst);
        s.write(104, &[0.], t)?;
        s.write(7, &[], t)?;
        s.node.store(0, Ordering::SeqCst);
        s.clear_remote_streams(t)?;
        Ok(ConnectionResult {
            info: s.info(t)?,
            config: s.read_config(t)?,
        })
    })
    .await
}
#[tauri::command]
pub async fn read_register(address: u8, state: State<'_, AppState>) -> Result<Vec<f64>, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        s.read(address, s.token())
    })
    .await
}

#[tauri::command]
pub async fn write_register(
    address: u8,
    values: Vec<f64>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        write_verified(&s, address, &values, s.token())?;
        Ok(true)
    })
    .await
}
#[tauri::command]
pub async fn set_motor_mode(mode: u8, state: State<'_, AppState>) -> Result<bool, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        write_verified(&s, 14, &[mode as f64], s.token())?;
        Ok(true)
    })
    .await
}
#[tauri::command]
pub async fn set_motor_enabled(
    enabled: bool,
    mode: u8,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let t = s.token();
        if enabled {
            validate(14, &[mode as f64])?;
            if mode == 0 {
                return Err("Select an active motor mode before enabling".into());
            }
        }
        s.write(102, &[0.], t)?;
        s.enabled.store(false, Ordering::SeqCst);
        if enabled {
            s.write(102, &[1.], t)?;
            if let Err(e) = write_verified(&s, 14, &[mode as f64], t) {
                let _ = s.write(102, &[0.], t);
                return Err(e);
            }
            s.enabled.store(true, Ordering::SeqCst);
        }
        Ok(true)
    })
    .await
}
#[tauri::command]
pub async fn set_setpoint(
    mode: u8,
    value: f64,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let a = match mode {
        1 => 54,
        2 => 55,
        3 => 56,
        _ => return Err("Use Torque=1, Speed=2, Position=3".into()),
    };
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let t = s.token();
        if s.read(14, t)?[0] != mode as f64 {
            return Err("Setpoint mode does not match active device mode".into());
        }
        write_verified(&s, a, &[value], t)?;
        Ok(true)
    })
    .await
}
#[tauri::command]
pub async fn set_control_references(
    mode: u8,
    values: Vec<f64>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let addresses = match mode {
        4 => [76, 75, 42],
        6 => [69, 70, 71],
        _ => return Err("Use Impedance or Voltage mode".into()),
    };
    if values.len() != 3 {
        return Err("Expected three reference values".into());
    }
    for (a, v) in addresses.iter().zip(&values) {
        validate(*a, &[*v])?;
    }
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let t = s.token();
        if !s.enabled.load(Ordering::SeqCst) || s.read(14, t)?[0] != mode as f64 {
            return Err("Enable the matching motor mode first".into());
        }
        for (a, v) in addresses.iter().zip(&values) {
            write_verified(&s, *a, &[*v], t)?;
        }
        Ok(true)
    })
    .await
}
#[tauri::command]
pub async fn emergency_stop(state: State<'_, AppState>) -> Result<bool, String> {
    let s = state.session()?;
    blocking(move || {
        s.emergency_stop()?;
        Ok(true)
    })
    .await
}
#[tauri::command]
pub async fn set_telemetry_channels(
    addresses: Vec<u8>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        s.set_streams(addresses, s.token())?;
        Ok(true)
    })
    .await
}
#[tauri::command]
pub fn get_telemetry_sample(state: State<'_, AppState>) -> Result<TelemetrySample, String> {
    Ok(state.session()?.sample())
}
#[tauri::command]
pub fn get_diagnostics(state: State<'_, AppState>) -> Diagnostics {
    state
        .session
        .lock()
        .as_ref()
        .map(|s| s.diagnostics())
        .unwrap_or_default()
}

#[tauri::command]
pub async fn run_commissioning_action(
    action: String,
    bandwidth: f64,
    state: State<'_, AppState>,
) -> Result<CommissionResult, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        run_commission(&s, &action, bandwidth, s.token())
    })
    .await
}
#[tauri::command]
pub async fn upload_pvt(
    points: Vec<PvtPoint>,
    state: State<'_, AppState>,
) -> Result<PvtResult, String> {
    if points.is_empty() || points.len() > 256 {
        return Err("Upload between 1 and 256 PVT points".into());
    }
    for p in &points {
        register(103)?.encode(&[p.position_deg, p.velocity_deg_s])?;
    }
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let t = s.token();
        let mut result = PvtResult {
            uploaded: 0,
            requested: points.len(),
            error: None,
        };
        for p in points {
            if let Err(e) = s.write(103, &[p.position_deg, p.velocity_deg_s], t) {
                result.error = Some(format!(
                    "{e}. Buffer may contain a partial upload; Stop does not clear it."
                ));
                break;
            }
            result.uploaded += 1;
        }
        Ok(result)
    })
    .await
}
#[tauri::command]
pub async fn run_pvt(run: bool, state: State<'_, AppState>) -> Result<bool, String> {
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let t = s.token();
        if run && (!s.enabled.load(Ordering::SeqCst) || s.read(14, t)?[0] != 4.) {
            return Err("PVT requires Impedance mode and an explicitly enabled motor".into());
        }
        s.write(104, &[if run { 1. } else { 0. }], t)?;
        Ok(true)
    })
    .await
}
#[tauri::command]
pub async fn move_trajectory(
    target: f64,
    velocity: f64,
    acceleration: f64,
    jerk: f64,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    for v in [target, velocity, acceleration, jerk] {
        if !v.is_finite() || !(v as f32).is_finite() {
            return Err("Trajectory values must be finite float32".into());
        }
    }
    if velocity <= 0. || acceleration <= 0. || jerk <= 0. {
        return Err("Trajectory limits must be positive".into());
    }
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        let t = s.token();
        if !s.enabled.load(Ordering::SeqCst) || s.read(14, t)?[0] != 4. {
            return Err(
                "S-curve motion requires Impedance mode and an explicitly enabled motor".into(),
            );
        }
        for (a, v) in [(80, velocity), (81, acceleration), (82, jerk)] {
            write_verified(&s, a, &[v], t)?;
        }
        s.write(83, &[target], t)?;
        Ok(true)
    })
    .await
}
fn terminal(s: &Session, command: &str) -> Result<String, String> {
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return Ok(String::new());
    }
    let t = s.token();
    let numeric = |i: usize| {
        parts
            .get(i)
            .ok_or("Missing value".to_string())?
            .parse::<f64>()
            .map_err(|_| "Invalid number".to_string())
    };
    let address = |text: &str| -> Result<u8, String> {
        if let Some(r) = registers().iter().find(|r| r.name == text) {
            return Ok(r.address);
        }
        if let Some(hex) = text.strip_prefix("0x") {
            u8::from_str_radix(hex, 16).map_err(|_| "Invalid address".into())
        } else {
            text.parse().map_err(|_| "Unknown register".into())
        }
    };
    match parts[0]{
  "help"=>Ok("help | status | get_param | read <register> | write <register> <values...> | set_mode <mode> | enable <mode> | disable | set_current <A> | set_speed <RPM> | set_position <deg> | save_config | reboot\nCommissioning and PVT use their dedicated pages. No hardware clear-fault command exists.".into()),
  "status"=>Ok(serde_json::to_string_pretty(&s.sample()).unwrap()),
  "get_param"=>Ok(serde_json::to_string_pretty(&s.read_config(t)?).unwrap()),
  "read"=>Ok(format!("{:?}",s.read(address(parts.get(1).ok_or("Missing register")?)?,t)?)),
  "write"=>{let a=address(parts.get(1).ok_or("Missing register")?)?;let v=(2..parts.len()).map(numeric).collect::<Result<Vec<_>,_>>()?;write_verified(s,a,&v,t)?;Ok("Written and read back where supported".into())},
  "set_mode"=>{write_verified(s,14,&[numeric(1)?],t)?;Ok("Mode verified".into())},
  "enable"=>{let mode=numeric(1)?;validate(14,&[mode])?;if mode==0.{return Err("Choose an active mode".into());}s.write(102,&[0.],t)?;s.enabled.store(false,Ordering::SeqCst);s.write(102,&[1.],t)?;write_verified(s,14,&[mode],t)?;s.enabled.store(true,Ordering::SeqCst);Ok("Motor enabled; mode verified".into())},
  "disable"=>{s.write(102,&[0.],t)?;s.enabled.store(false,Ordering::SeqCst);Ok("Disable acknowledged".into())},
  "set_current"|"set_speed"|"set_position"=>{let a=match parts[0]{"set_current"=>54,"set_speed"=>55,_=>56};write_verified(s,a,&[numeric(1)?],t)?;Ok("Setpoint verified".into())},
  "save_config"=>{s.write(8,&[],t)?;Ok("Flash save acknowledged".into())},
  "reboot"=>{s.write(6,&[],t)?;s.close();Ok("Reset sent; ACK is not guaranteed. Reconnect to verify.".into())},
  _=>Err(format!("Unknown command '{}'. Type help.",parts[0])),
 }
}
#[tauri::command]
pub async fn execute_terminal(
    command: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if command.trim() == "help" {
        return Ok("help | status | get_param | read <name/address> | write <name/address> <value> | set_mode <0/1/2/3/4/6> | enable <mode> | disable | set_current <A> | set_speed <RPM> | set_position <deg> | save_config | reboot".into());
    }
    if command.trim() == "estop" {
        let s = state.session()?;
        return blocking(move || {
            s.emergency_stop()?;
            Ok("Disable and PVT stop acknowledged".into())
        })
        .await;
    }
    let s = state.session()?;
    blocking(move || {
        let _guard = s.lock_operation()?;
        terminal(&s, &command)
    })
    .await
}
#[tauri::command]
pub fn window_start_dragging(window: tauri::Window) {
    let _ = window.start_dragging();
}
#[tauri::command]
pub fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}
#[tauri::command]
pub fn window_toggle_maximize(window: tauri::Window) {
    if let Ok(v) = window.is_maximized() {
        if v {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}
#[tauri::command]
pub fn window_close(window: tauri::Window) {
    let _ = window.close();
}
