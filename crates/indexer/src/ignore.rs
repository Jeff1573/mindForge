use anyhow::Result;
use ignore::gitignore::{Gitignore, GitignoreBuilder};
use std::fs;
use std::io::BufRead;
use std::path::{Path, PathBuf};

/// 忽略匹配器：基于 Gitignore 语法，支持 `!` 取反。
#[derive(Clone)]
pub struct IgnoreMatcher {
    root: PathBuf,
    inner: Gitignore,
}

impl IgnoreMatcher {
    /// 判断相对 POSIX 路径是否应忽略（`true` 表示应忽略）。
    pub fn should_ignore(&self, rel_posix_path: &str, is_dir: bool) -> bool {
        // 将 POSIX 路径 `/` 转为当前平台分隔符，拼到根目录形成绝对路径进行匹配
        let os_rel = rel_posix_path.replace('/', std::path::MAIN_SEPARATOR_STR);
        let abs = self.root.join(os_rel);
        self.inner
            .matched_path_or_any_parents(&abs, is_dir)
            .is_ignore()
    }
}

/// 从根目录加载忽略规则，合并：
/// - 顶层 `.gitignore`
/// - 顶层 `.indexignore`
/// - 内置常见目录/文件
/// - 额外的 `extra` 规则（与 Gitignore 语法一致，支持 `!`）
pub fn load_ignore(root: impl AsRef<Path>, extra: &[String]) -> Result<IgnoreMatcher> {
    let root = root.as_ref().to_path_buf();
    let mut builder = GitignoreBuilder::new(&root);

    // 读取并合并顶层 .gitignore
    let gi = root.join(".gitignore");
    if gi.exists() {
        add_file_lines(&mut builder, &gi)?;
    }

    // 读取并合并顶层 .indexignore（自定义）
    let ii = root.join(".indexignore");
    if ii.exists() {
        add_file_lines(&mut builder, &ii)?;
    }

    // 内置忽略（可按需调整）
    let builtins = [
        ".git/",
        "target/",
        "node_modules/",
        ".DS_Store",
        "Thumbs.db",
        ".gitignore",
        ".indexignore",
    ];
    for pat in builtins {
        builder.add_line(None, pat)?;
    }

    // 额外忽略
    for pat in extra {
        builder.add_line(None, pat)?;
    }

    let inner = builder.build()?;
    Ok(IgnoreMatcher { root, inner })
}

fn add_file_lines(builder: &mut GitignoreBuilder, file: &Path) -> Result<()> {
    let f = fs::File::open(file)?;
    let reader = std::io::BufReader::new(f);
    for line in reader.lines() {
        let line = line?;
        // 允许空行与注释
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        builder.add_line(Some(file.to_path_buf()), trimmed)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_ignore_merge_and_negation() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();

        // 顶层 .gitignore
        fs::write(root.join(".gitignore"), "foo/\n").unwrap();
        // 顶层 .indexignore，包含取反规则
        fs::write(root.join(".indexignore"), "build/\n!build/README.md\nsecret.txt\n").unwrap();

        let matcher = load_ignore(root, &vec!["temp/".to_string()]).unwrap();

        // 命中 .gitignore
        assert!(matcher.should_ignore("foo/a.txt", false));
        // 命中 .indexignore 普通规则
        assert!(matcher.should_ignore("secret.txt", false));
        // 命中 extra 规则
        assert!(matcher.should_ignore("temp/x", false));
        // 取反规则：build/README.md 不应被忽略
        assert!(!matcher.should_ignore("build/README.md", false));
        // build/ 其他文件仍被忽略
        assert!(matcher.should_ignore("build/app.bin", false));
        // 未匹配路径不忽略
        assert!(!matcher.should_ignore("src/main.rs", false));
    }
}
