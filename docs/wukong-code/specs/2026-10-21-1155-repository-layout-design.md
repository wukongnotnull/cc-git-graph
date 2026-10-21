# 仓库目录结构调整设计

Status: Approved
Date: 2026-10-21  
Source: brainstorming  
Issue: [#60](https://github.com/wukongnotnull/wukong-git-graph/issues/60)

## 目标

让仓库根目录清楚地区分仓库级资料与两种客户端插件实现。Claude 与 Codex 插件分别放入 `claude/` 和 `codex/`，普通使用者可以从根目录的 README 开始；维护者可以在对应子目录中找到产品实现与专属构建配置。

调整只改变文件位置和引用路径，不改变插件功能、安装标识、发布版本或用户安装入口。

现有 Codex 插件会直接复用 Claude hooks 中的 Git 解析、布局、格式化和类型模块。本次保留这份共享源码，模块仍由 `claude/` 管理；Codex 的相对导入随之改为引用 `../claude/hooks/` 和 `../claude/types/`，不复制或重写算法。

## 方案选择

采用保留根目录 marketplace 清单的方案：

- 根目录 `.claude-plugin/marketplace.json` 继续作为仓库的 Claude 插件市场入口，其插件 `source` 改为 `./claude`。
- `claude/` 成为完整的 Claude 插件工程，包含插件 manifest、hooks、类型、TypeScript 配置及 CI 类型快照。
- `codex/` 继续作为独立 Codex 插件工程。
- 根目录保留仓库说明、产品需求、变更记录、仓库级配置、CI workflow 和两个客户端的 marketplace 入口配置。

不把 Claude marketplace 清单一并迁入 `claude/`，因为这会改变从仓库根目录添加 marketplace 的方式，也可能使现有安装流程失效。

## 目标目录

```text
.
├── .agents/                         # Codex marketplace 入口
├── .claude/                         # 仓库级 Claude 配置
├── .claude-plugin/
│   └── marketplace.json             # 根目录 Claude marketplace，source: ./claude
├── .codex/                          # 仓库级 Codex 环境和 Action
├── .github/                         # GitHub workflow 与模板
├── .wukong-code/                    # 仓库级 Wukong Code 配置
├── claude/
│   ├── .claude-plugin/
│   │   └── plugin.json              # Claude 插件 manifest
│   ├── hooks/                       # Claude 插件实现与测试
│   ├── types/                       # Claude 插件领域类型
│   ├── ci/                          # Claude Code 类型快照和 CI tsconfig
│   └── tsconfig.json                # Claude 插件本地类型配置
├── codex/                           # Codex 插件源码、构建和技能
├── docs/                            # 设计及维护文档
├── AGENTS.md                        # 仓库级代理说明
├── CLAUDE.md                        # 指向 AGENTS.md 的 Claude 说明
├── CHANGELOG.md                     # 仓库版本变更记录
├── PRD.md                           # 产品需求
└── README.md                        # 面向使用者的说明
```

根目录 `tsconfig.json` 与 `ci/` 随 Claude 插件工程迁入 `claude/`；因此示意树里的类型快照路径为 `claude/ci/types/claude-code.d.ts`。根 `.gitignore`、`.github/workflows/ci.yml` 和 marketplace 配置留在根目录，因为它们服务于整个仓库。

## 文件迁移和引用更新

1. 将 `.claude-plugin/plugin.json` 迁为 `claude/.claude-plugin/plugin.json`，同步移动 Claude 插件实现目录 `hooks/`、`types/`、`ci/` 和根 `tsconfig.json` 至 `claude/`。
2. 根 `.claude-plugin/marketplace.json` 保留，插件来源改为 `./claude`；插件名称、ID 和版本保持不变。
3. 更新 `.gitignore` 中随插件移动的生成类型目录路径。Codex 构建产物仍忽略在 `codex/dist/`。
4. 更新 CI 的 Claude 校验、测试和类型检查路径；Codex 构建与测试命令继续从根目录通过 `npm --prefix codex` 执行。
5. 更新 README、PRD、AGENTS.md 和源码中的路径引用。用户从仓库安装 Claude 插件的命令保持不变；维护者执行插件专属命令时指定 `claude/`。
6. 更新 Codex 内部对共享 hooks/types 模块的导入路径(`../hooks/` → `../claude/hooks/`, `../types` → `../claude/types`)、包检查及其他自动化中对 Claude manifest 或 Claude 工程文件的路径断言。

Git 应保留文件历史可追踪性；不改源码内容，除非路径变更要求同步调整相对路径。

## 验收标准

- 根目录不再直接包含 Claude 插件源码、测试和 Claude 专属 TypeScript/CI 配置。
- Claude、Codex 实现分别位于 `claude/`、`codex/`，根 marketplace 均能正确定位各自插件。
- README 中面向普通用户的安装步骤仍然有效，Claude 插件 ID、Codex 插件 ID 和版本没有意外变化。
- GitHub Actions 中 Claude 和 Codex 检查都从正确目录运行。
- 以下检查通过：
  - `claude plugin validate .`（根 marketplace）
  - `claude plugin validate claude`
  - `claude plugin test claude`
  - `npx -y -p typescript@5.6.3 tsc -p claude/ci`
  - `npm --prefix codex test`
  - `npm --prefix codex run typecheck`
- PRD、README、AGENTS.md、Codex 包检查和 CI 不再引用已迁出的旧路径。

## 风险与处理

- **marketplace 相对路径解析**：根 marketplace 的 `source` 必须按清单所在目录解析到 `./claude`。通过 Claude marketplace validator 和插件测试验证。
- **遗漏路径引用**：移动后搜索仓库中的旧路径，并运行全套 Claude、Codex 检查。
- **文档结构描述不一致**：README、PRD 与 AGENTS.md 同步描述新目录分工；Codex 插件安装说明继续指向 `codex/`。

## 不在本次范围

- 不改 Claude 或 Codex 插件的运行时功能、UI、协议和标识。
- 不更改 marketplace 发布方式、任何插件版本或 Release/tag。
- 不调整根目录中仓库级配置的职责，也不重写与目录迁移无关的文档内容。
