use crate::ignore::{load_ignore, IgnoreMatcher};
use anyhow::{Context, Result};
use content_inspector::{inspect, ContentType};
use ignore::{DirEntry, WalkBuilder, WalkState};
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// 扫描配置
#[derive(Clone, Debug)]
pub struct Config {
    pub root: PathBuf,
    pub include_globs: Vec<String>,
    pub extra_ignore: Vec<String>,
    pub max_size_bytes: Option<u64>,
    pub concurrency: usize,
    pub follow_symlinks: bool,
    pub absolute: bool,
    pub sample_bytes: usize,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            root: PathBuf::from("."),
            include_globs: vec!["**/*".to_string()],
            extra_ignore: vec![],
            max_size_bytes: Some(5 * 1024 * 1024), // 默认 5MB
            concurrency: 64,
            follow_symlinks: false,
            absolute: false,
            sample_bytes: 4096,
        }
    }
}

/// 扫描结果记录（NDJSON 单行）
#[derive(Debug, Serialize, Clone)]
pub struct FileRecord {
    pub rel_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub abs_path: Option<String>,
    pub size: u64,
    pub mtime_ms: u64,
    pub binary: bool,
}

/// 收集型便捷接口：将扫描结果收集为内存向量
pub fn scan_repo_collect(config: &Config) -> Result<Vec<FileRecord>> {
    let mut out = Vec::new();
    scan_repo(config, |rec| out.push(rec))?;
    Ok(out)
}

/// 主扫描函数：并发遍历，将结果通过回调逐条返回
pub fn scan_repo<F>(config: &Config, mut on_entry: F) -> Result<()>
where
    F: FnMut(FileRecord),
{
    let root = config
        .root
        .canonicalize()
        .with_context(|| format!("无法解析根目录: {}", config.root.display()))?;

    let matcher = Arc::new(load_ignore(&root, &config.extra_ignore)?);

    // 采用 mpsc 渠道聚合并发回调，保证输出顺序稳定（近似遍历顺序）
    let (tx, rx) = mpsc::sync_channel::<FileRecord>(1024);

    // 构建并发遍历器
    let mut builder = WalkBuilder::new(&root);
    builder
        .hidden(false)
        .follow_links(config.follow_symlinks)
        .standard_filters(false)
        .threads(config.concurrency.max(1));

    // Include globs（使用 overrides 进行前置筛选）
    if !config.include_globs.is_empty() {
        let mut ob = ignore::overrides::OverrideBuilder::new(&root);
        for pat in &config.include_globs {
            ob.add(pat).with_context(|| format!("非法 include 模式: {pat}"))?;
        }
        let ov = ob.build()?;
        builder.overrides(ov);
    }

    let sample_bytes = config.sample_bytes;
    let absolute = config.absolute;
    let max_size = config.max_size_bytes;
    let matcher_cloned = matcher.clone();
    let root_cloned = root.clone();

    let walker = builder.build_parallel();
    walker.run(|| {
        let tx = tx.clone();
        let matcher = matcher_cloned.clone();
        let root = root_cloned.clone();
        Box::new(move |res| match res {
            Ok(entry) => {
                if let Err(e) = handle_entry(
                    entry,
                    &root,
                    matcher.as_ref(),
                    max_size,
                    sample_bytes,
                    absolute,
                    &tx,
                ) {
                    eprintln!("[scan] 跳过项：{e}");
                }
                WalkState::Continue
            }
            Err(err) => {
                eprintln!("[scan] 遍历错误: {err}");
                WalkState::Continue
            }
        })
    });

    drop(tx);
    for rec in rx {
        on_entry(rec);
    }

    Ok(())
}

fn handle_entry(
    entry: DirEntry,
    root: &Path,
    matcher: &IgnoreMatcher,
    max_size: Option<u64>,
    sample_bytes: usize,
    absolute: bool,
    tx: &mpsc::SyncSender<FileRecord>,
) -> Result<()> {
    let path = entry.path();
    let ft = match entry.file_type() {
        Some(t) => t,
        None => return Ok(()),
    };
    if ft.is_dir() {
        return Ok(());
    }

    // 计算相对路径并 POSIX 化
    let rel = path.strip_prefix(root).unwrap_or(path);
    let rel_posix = to_posix(rel);

    // 忽略规则
    if matcher.should_ignore(&rel_posix, false) {
        return Ok(());
    }

    // 元数据与尺寸过滤
    let meta = entry.metadata().or_else(|_| fs::metadata(path))?;
    if !meta.is_file() {
        return Ok(());
    }
    let size = meta.len();
    #[cfg(test)]
    eprintln!("[debug] file={} size={} limit={:?}", rel_posix, size, max_size);
    if let Some(limit) = max_size {
        if size > limit {
            return Ok(());
        }
    }

    // 二进制检测
    let binary = is_binary_file(path, sample_bytes)?;

    // mtime（毫秒）
    let mtime_ms = meta
        .modified()
        .unwrap_or(SystemTime::UNIX_EPOCH)
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_millis() as u64;

    let abs_path = if absolute {
        Some(path.to_string_lossy().into_owned())
    } else {
        None
    };

    let rec = FileRecord {
        rel_path: rel_posix,
        abs_path,
        size,
        mtime_ms,
        binary,
    };
    let _ = tx.send(rec);
    Ok(())
}

/// 将路径统一为 POSIX 字符串（`/` 分隔）
fn to_posix(p: &Path) -> String {
    let s = p.to_string_lossy();
    if std::path::MAIN_SEPARATOR == '/' {
        s.into_owned()
    } else {
        s.replace('\\', "/")
    }
}

/// 基于扩展名 + 内容采样判断是否二进制
pub fn is_binary_file(path: &Path, sample_bytes: usize) -> Result<bool> {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|s| s.to_ascii_lowercase()) {
        match ext.as_str() {
            // 典型文本扩展：直接判为非二进制，避免不必要 IO
            "txt" | "md" | "rs" | "ts" | "tsx" | "js" | "jsx" | "json" | "toml" | "yaml"
            | "yml" | "xml" | "html" | "css" | "scss" | "less" | "ini" | "cfg" | "log" => {
                return Ok(false)
            }
            // 明显二进制扩展：直接判为二进制
            "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "ico" | "svgz" | "pdf" | "zip"
            | "gz" | "bz2" | "xz" | "7z" | "rar" | "tar" | "wasm" | "exe" | "dll" | "so"
            | "dylib" | "ttf" | "otf" | "woff" | "woff2" | "mp3" | "wav" | "flac" | "mp4"
            | "mkv" | "mov" | "avi" | "heic" | "ico" => {
                return Ok(true)
            }
            _ => {}
        }
    }

    // 采样前 N 字节：若包含 NUL 则视为二进制
    let mut f = fs::File::open(path).with_context(|| format!("无法读取文件：{}", path.display()))?;
    let mut buf = vec![0u8; sample_bytes];
    let n = f.read(&mut buf)?;
    let buf = &buf[..n];
    let ty = inspect(buf);
    Ok(ty.is_binary())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_is_binary_file_sampling() {
        let tmp = tempdir().unwrap();
        let p_text = tmp.path().join("a.txt");
        let p_bin = tmp.path().join("b.bin");

        std::fs::write(&p_text, b"hello world\n").unwrap();
        std::fs::write(&p_bin, [0u8, 1, 2, 3, 0, 5]).unwrap();

        assert_eq!(is_binary_file(&p_text, 4096).unwrap(), false);
        assert_eq!(is_binary_file(&p_bin, 4096).unwrap(), true);
    }

    #[test]
    fn test_scan_repo_collect_basic() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();
        // 忽略 skip.txt
        std::fs::write(root.join(".indexignore"), "skip.txt\n").unwrap();
        std::fs::write(root.join("a.txt"), "hello").unwrap();
        // 大文件超限
        let mut f = std::fs::File::create(root.join("big.bin")).unwrap();
        f.write_all(&vec![b'x'; 100]).unwrap();
        drop(f); // 确保写入落盘，避免元数据尺寸为 0 的边界情况

        let mut cfg = Config::default();
        cfg.root = root.to_path_buf();
        cfg.max_size_bytes = Some(10);
        cfg.concurrency = 2;

        let items = scan_repo_collect(&cfg).unwrap();
        let names: Vec<String> = items.into_iter().map(|r| r.rel_path).collect();
        assert_eq!(names, vec!["a.txt".to_string()]);
    }
}
