//! mf-indexer：命令行入口（NDJSON 输出）
use clap::{ArgAction, Parser};
use mindforge_indexer::{scan_repo, Config, FileRecord};
use serde_json::to_writer;
use std::fs;
use std::io::{self, Write};
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(name = "mf-indexer", version, about = "MindForge 索引扫描器（NDJSON）")]
struct Cli {
    /// 根目录（默认当前工作目录）
    #[arg(long, value_name = "PATH")]
    root: Option<PathBuf>,

    /// 包含的 glob（可多次）
    #[arg(long = "include", value_name = "GLOB", num_args = 1.., default_values_t = vec!["**/*".to_string()])]
    include_globs: Vec<String>,

    /// 额外忽略规则（Gitignore 语法，可多次）
    #[arg(long = "ignore", value_name = "PATTERN", num_args = 0..)]
    extra_ignore: Vec<String>,

    /// 最大文件尺寸（字节，默认 5MB）
    #[arg(long, value_name = "BYTES")]
    max_size_bytes: Option<u64>,

    /// 并发线程数（默认 64）
    #[arg(long, value_name = "N")]
    concurrency: Option<usize>,

    /// 跟随符号链接
    #[arg(long, action = ArgAction::SetTrue)]
    follow_symlinks: bool,

    /// 输出包含绝对路径字段
    #[arg(long, action = ArgAction::SetTrue)]
    absolute: bool,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let mut cfg = Config::default();
    if let Some(root) = cli.root { cfg.root = root; }
    cfg.include_globs = cli.include_globs;
    cfg.extra_ignore = cli.extra_ignore;
    if let Some(ms) = cli.max_size_bytes { cfg.max_size_bytes = Some(ms); }
    if let Some(c) = cli.concurrency { cfg.concurrency = c.max(1); }
    cfg.follow_symlinks = cli.follow_symlinks;
    cfg.absolute = cli.absolute;

    // 预校验根目录
    let meta = fs::metadata(&cfg.root)
        .map_err(|e| anyhow::anyhow!("根目录不可读：{}，错误：{e}", cfg.root.display()))?;
    if !meta.is_dir() {
        return Err(anyhow::anyhow!("根路径不是目录：{}", cfg.root.display()));
    }

    let stdout = io::stdout();
    let mut handle = stdout.lock();

    scan_repo(&cfg, |rec: FileRecord| {
        // 逐条写 NDJSON
        to_writer(&mut handle, &rec).expect("写入 stdout 失败");
        handle.write_all(b"\n").expect("写入换行失败");
    })?;

    handle.flush().ok();
    Ok(())
}

