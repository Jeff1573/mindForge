# MindForge Indexer（Rust）

高性能“仓库文件扫描器”，合并 `.gitignore`/`.indexignore` 与额外忽略规则，过滤二进制与超大文件，并输出 NDJSON。

## 安装与构建

```bash
cargo build -p mindforge_indexer --release
```

可执行文件：`target/release/mf-indexer`

## 使用示例

```bash
mf-indexer --root . --include "**/*" --ignore "node_modules/" --max-size 5242880 \
  --concurrency 64 > scan.ndjson
```

输出（NDJSON 每行一条）：

```json
{"rel_path":"src/main.rs","size":1234,"mtime_ms":1726110000000,"binary":false}
```

## 验收要点
- 忽略规则：顶层 `.gitignore` 与 `.indexignore` 生效，支持 `!` 取反；内置忽略包括 `.git/`、`target/`、`node_modules/`、`.gitignore`、`.indexignore` 等。
- 二进制识别：常见二进制扩展直接判定；未知扩展读取前 4KB，若含 NUL 判为二进制。
- 尺寸过滤：`--max-size-bytes` 控制最大文件大小，超限即跳过。

## 字段说明
- `rel_path`: 相对 `--root` 的 POSIX 路径
- `size`: 字节数
- `mtime_ms`: 最后修改时间（Unix 毫秒）
- `binary`: 是否二进制
- `abs_path`: 仅在 `--absolute` 开启时包含
