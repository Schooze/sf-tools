// Portable entry point. Only Windows system libraries are imported by this binary.
// The Tauri engine and its matching loader are embedded and verified before launch.
#![cfg_attr(not(test), windows_subsystem = "windows")]

use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};

const CORE: &[u8] = include_bytes!(env!("SF_TOOLS_CORE_PATH"));
const LOADER: &[u8] = include_bytes!(env!("SF_TOOLS_LOADER_PATH"));
const VERSION: &str = env!("SF_TOOLS_APP_VERSION");
const PAYLOAD_ID: &str = env!("SF_TOOLS_PAYLOAD_ID");
static NEXT_FILE_ID: AtomicU64 = AtomicU64::new(0);

fn matches(path: &Path, contents: &[u8]) -> bool {
    fs::read(path)
        .map(|current| current == contents)
        .unwrap_or(false)
}

fn materialize(path: &Path, contents: &[u8]) -> io::Result<bool> {
    if matches(path, contents) {
        return Ok(false);
    }
    let directory = path
        .parent()
        .ok_or_else(|| io::Error::other("Missing cache directory"))?;
    fs::create_dir_all(directory)?;
    let filename = path
        .file_name()
        .ok_or_else(|| io::Error::other("Missing cache filename"))?;
    let (temporary, mut file) = loop {
        let id = NEXT_FILE_ID.fetch_add(1, Ordering::Relaxed);
        let mut name = OsString::from(".");
        name.push(filename);
        name.push(format!(".{}.{id}.tmp", std::process::id()));
        let temporary = directory.join(name);
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
        {
            Ok(file) => break (temporary, file),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    };
    let result = (|| {
        file.write_all(contents)?;
        file.sync_all()?;
        drop(file);
        match fs::rename(&temporary, path) {
            Ok(()) => Ok(true),
            // Another launch may already have installed (and loaded) the same file.
            Err(_) if matches(path, contents) => Ok(false),
            Err(error) => Err(error),
        }
    })();
    let _ = fs::remove_file(&temporary);
    result
}

fn runtime_root() -> io::Result<PathBuf> {
    if let Some(directory) = std::env::var_os("SF_TOOLS_RUNTIME_DIR") {
        let path = PathBuf::from(directory);
        if !path.is_absolute() {
            return Err(io::Error::other("SF_TOOLS_RUNTIME_DIR must be absolute"));
        }
        return Ok(path);
    }
    let local = std::env::var_os("LOCALAPPDATA")
        .ok_or_else(|| io::Error::other("Windows LOCALAPPDATA is not available"))?;
    Ok(PathBuf::from(local).join("SF-Tools").join("runtime"))
}

fn prepare(directory: &Path) -> io::Result<PathBuf> {
    let engine = directory.join("sf-tools-core.exe");
    materialize(&directory.join("WebView2Loader.dll"), LOADER)?;
    materialize(&engine, CORE)?;
    Ok(engine)
}

fn launch() -> io::Result<i32> {
    let directory = runtime_root()?.join(format!("{VERSION}-{PAYLOAD_ID}"));
    let engine = prepare(&directory)?;
    // Preserve arguments as OS strings: paths with spaces and Unicode stay intact.
    let status = Command::new(&engine)
        .args(std::env::args_os().skip(1))
        .status()?;
    Ok(status.code().unwrap_or(1))
}

#[link(name = "user32")]
unsafe extern "system" {
    fn MessageBoxW(
        window: *mut core::ffi::c_void,
        text: *const u16,
        title: *const u16,
        flags: u32,
    ) -> i32;
}

fn main() {
    match launch() {
        Ok(code) => std::process::exit(code),
        Err(error) => {
            eprintln!("SF-Tools could not start: {error}");
            let text: Vec<u16> = format!(
                "SF-Tools could not prepare or start its internal components.\n\n{error}\n\nCheck that your Windows user account can write to Local AppData."
            ).encode_utf16().chain(Some(0)).collect();
            let title: Vec<u16> = "SF-Tools startup error"
                .encode_utf16()
                .chain(Some(0))
                .collect();
            unsafe {
                MessageBoxW(core::ptr::null_mut(), text.as_ptr(), title.as_ptr(), 0x10);
            }
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Directory(PathBuf);
    impl Directory {
        fn new() -> Self {
            let path = PathBuf::from(env!("SF_TOOLS_TEST_ROOT")).join(format!(
                "{}-{}",
                std::process::id(),
                NEXT_FILE_ID.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Directory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn prepares_matching_engine_and_loader() {
        let directory = Directory::new();
        let engine = prepare(&directory.0).unwrap();
        assert!(matches(&engine, CORE));
        assert!(matches(&directory.0.join("WebView2Loader.dll"), LOADER));
    }
    #[test]
    fn reuses_verified_files_without_rewriting() {
        let directory = Directory::new();
        let file = directory.0.join("component");
        assert!(materialize(&file, b"verified content").unwrap());
        let modified = fs::metadata(&file).unwrap().modified().unwrap();
        assert!(!materialize(&file, b"verified content").unwrap());
        assert_eq!(modified, fs::metadata(&file).unwrap().modified().unwrap());
    }
    #[test]
    fn repairs_incomplete_or_modified_cache() {
        let directory = Directory::new();
        let file = directory.0.join("component");
        fs::write(&file, b"truncated").unwrap();
        assert!(materialize(&file, b"expected content").unwrap());
        assert!(matches(&file, b"expected content"));
    }
    #[test]
    fn concurrent_materialization_never_leaves_partial_payloads() {
        let directory = Directory::new();
        let jobs: Vec<_> = (0..4)
            .map(|_| {
                let file = directory.0.join("shared component");
                std::thread::spawn(move || materialize(&file, &[42; 16384]))
            })
            .collect();
        for job in jobs {
            job.join().unwrap().unwrap();
        }
        assert!(matches(&directory.0.join("shared component"), &[42; 16384]));
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1);
    }
}
