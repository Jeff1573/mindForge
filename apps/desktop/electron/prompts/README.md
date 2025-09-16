# Prompt 仓库使用说明

该目录集中维护 Electron 主进程使用的 system prompt：

- `common/`：存放可复用的 Markdown 片段，如约束、协议、工作流、环境设定等。
- `roles/`：每个角色一个 JSON 文件，描述角色元信息及需要拼接的公共片段。
- `loader.ts`：提供 `loadRolePrompt(roleId)` 方法，按角色合成完整 prompt，并在缺失时回退到默认角色。

## 角色文件结构

```json
{
  "id": "architect",
  "name": "资深架构师",
  "description": "角色说明，可选",
  "intro": "角色专属前置信息，可包含换行",
  "fragments": ["context", "workflow", "constraints", "protocol"]
}
```

- `intro`：角色独有的开场指令，会作为 prompt 的第一部分。
- `fragments`：按顺序引用 `common/` 下的 Markdown 文件（无需扩展名），loader 会读取并依次拼接，段落之间使用空行分隔。

## 在工厂中使用

- `FactoryOptions` 新增 `roleId` 字段，传入后会触发 `runPromptWithTemplate` 自动加载对应角色的 system prompt。
- 若调用方未提供 `system`，则使用 `roleId` 对应 prompt；当 `roleId` 为空时回退到 `default` 角色。
- 完整调用示例：

```ts
await runPromptWithTemplate({
  roleId: 'architect',
  template: '{需求}',
  variables: { 需求: '为多租户设计鉴权方案' },
  factoryOptions: { provider: 'openai' }
});
```

## 新增或更新角色流程

1. 在 `common/` 中补充需要复用的片段。
2. 在 `roles/` 新建 `<role>.json`，配置 `intro` 与 `fragments`。
3. 运行 `loadRolePrompt('<role>')` 验证是否成功拼接，并确保新片段内容经过评审。
4. 更新相关文档或任务记录，保持版本一致。
