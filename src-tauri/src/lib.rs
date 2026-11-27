#[cfg(feature = "desktop")]
mod commands;
mod device;
mod protocol;
mod simulator;
mod transport;
#[cfg(feature = "desktop")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::list_ports,
            commands::connect_device,
            commands::disconnect_device,
            commands::select_node,
            commands::get_device_info,
            commands::read_config,
            commands::write_config,
            commands::save_config,
            commands::restore_defaults,
            commands::read_register,
            commands::write_register,
            commands::set_motor_mode,
            commands::set_motor_enabled,
            commands::set_setpoint,
            commands::set_control_references,
            commands::emergency_stop,
            commands::set_telemetry_channels,
            commands::get_telemetry_sample,
            commands::get_diagnostics,
            commands::run_commissioning_action,
            commands::upload_pvt,
            commands::run_pvt,
            commands::move_trajectory,
            commands::execute_terminal,
            commands::window_start_dragging,
            commands::window_minimize,
            commands::window_toggle_maximize,
            commands::window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running SF-Tools");
}

pub fn self_test() -> Result<serde_json::Value, String> {
    use std::sync::atomic::Ordering;
    let s = transport::Session::open("SIMULATOR", 115200, 0)?;
    let t = s.token();
    let info = s.info(t)?;
    let initial = s.read_config(t)?;
    if initial["motor_mode"] != 0. {
        return Err("Simulator must start disabled".into());
    }
    s.set_streams(vec![72, 63, 79], t)?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
    while s.sample().values.len() != 3 && std::time::Instant::now() < deadline {
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
    if s.sample().values.len() != 3 {
        return Err("Telemetry subscription failed".into());
    }
    s.write(102, &[1.], t)?;
    s.write(14, &[6.], t)?;
    s.enabled.store(true, Ordering::SeqCst);
    let commission = device::run_commission(&s, "full", 250., t)?;
    if commission.config["rs"] <= 0. {
        return Err("Commissioning did not produce resistance".into());
    }
    s.write(102, &[0.], t)?;
    s.write(102, &[1.], t)?;
    s.write(14, &[4.], t)?;
    s.enabled.store(true, Ordering::SeqCst);
    for (p, v) in [(0., 0.), (1., 100.), (1., 0.)] {
        s.write(103, &[p, v], t)?;
    }
    s.write(104, &[1.], t)?;
    std::thread::sleep(std::time::Duration::from_millis(15));
    s.emergency_stop()?;
    if s.read(14, s.token())?[0] != 0. {
        return Err("E-STOP did not disable simulated motor".into());
    }
    let diag = s.diagnostics();
    s.close();
    Ok(
        serde_json::json!({"ok":true,"application_version":env!("CARGO_PKG_VERSION"),"firmware_version":info.firmware_version,"registers":protocol::registers().len(),"packets_tx":diag.packets_tx,"packets_rx":diag.packets_rx,"commissioning_events":diag.events.len(),"checks":["handshake","disabled_start","configuration","telemetry","explicit_enable","commissioning","PVT","E-STOP"]}),
    )
}
