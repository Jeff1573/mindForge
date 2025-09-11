#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 窗口尺寸配置统一在 tauri.conf.json 中声明（含最小尺寸），Rust 端不做覆盖。
fn main() {
    tauri::Builder::default()
        // 注册 OS 插件（提供平台/版本等信息给前端）
        .plugin(tauri_plugin_os::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
