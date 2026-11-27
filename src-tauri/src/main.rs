// Keep ordinary desktop launches free of an extra console window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("--self-test") {
        let result = sf_tools_lib::self_test();
        let report = match &result {
            Ok(v) => v.clone(),
            Err(e) => serde_json::json!({"ok":false,"error":e}),
        };
        let file = args
            .get(2)
            .map(String::as_str)
            .unwrap_or("sf-tools-self-test.json");
        if let Err(e) = std::fs::write(file, serde_json::to_string_pretty(&report).unwrap()) {
            eprintln!("{e}");
            std::process::exit(1);
        }
        std::process::exit(if result.is_ok() { 0 } else { 1 });
    }
    sf_tools_lib::run();
}
