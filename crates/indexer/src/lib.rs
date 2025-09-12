//! MindForge 索引扫描器（库）
//! - 合并 `.gitignore`、自定义 `.indexignore` 与额外忽略规则
//! - 基于扩展名启发 + 4KB 内容采样（NUL 字节）判断二进制
//! - 遍历并过滤大文件，统一输出 POSIX 相对路径

pub mod ignore;
pub mod scanner;

pub use scanner::{scan_repo, scan_repo_collect, Config, FileRecord};

