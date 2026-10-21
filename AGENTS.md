# AGENTS.md

Wukong Git Graph:Claude Code mod,在桌面应用里显示只读的 Git 图谱面板。需求见 [PRD.md](PRD.md),安装和使用见 [README.md](README.md);改了行为要同步更新这两份。

## 验证

`claude plugin validate .`、`claude plugin validate claude`、`claude plugin test claude`、`npx -y -p typescript@5.6.3 tsc -p claude/ci`,CI 都跑。Claude Code 版本锁在 `.github/workflows/ci.yml` 里,升级时单独开 PR。`plugin test` 要较新的 Claude Code,本机版本不够时用 `npx -y @anthropic-ai/claude-code@<CI 里的版本> plugin test claude`。

类型检查用的引擎声明是提交进仓库的快照 `claude/ci/types/claude-code.d.ts`(第一行写着生成它的版本):引擎只在会话里加载 mod 时写类型,CI 里生成不了。升级 CI 的 Claude Code 时一起刷新:在新版本的会话里加载 `plugin-authoring` skill,它会写出单文件声明,复制过来覆盖。TypeScript 要 5.4 以上,本机全局的旧 tsc 会报 `TS6046`、`TS7006`,不要用它判断。没在桌面应用里看过的界面效果,要如实说没验证。

## 实测出来的约束

- **只读 git**:只能 `log`、`show`、`for-each-ref`、`rev-parse`(`claude/hooks/git/run-git.ts` 有白名单)。每次调用 10 秒超时,并以 `LC_ALL=C` 运行(失败类型靠英文报错区分);每页 50 条,300 条一页会让 `$.process.run` 不返回。
- **面板内容有上限**,超出的部分不画,后面的元素(包括列表底部的 Load more)一起消失。桌面应用实测 100 行约 20 万字符触顶;`plugin test` 里引擎会报 `N characters of text are drawn up to the first 99986`,key 也计入(一个文件约占路径长度的三倍)。所以列表按窗口显示(`claude/hooks/layout/window.ts`,预算在 `constants.ts`),diff 限 3 万字符,详情最多列 50 个文件、说明最多 4000 字符。每行新增内容要计入窗口的开销估计;`claude/hooks/ui/budget.test.ts` 用最坏情况检查 Load more 还在。
- **`Select` 最多 64 个选项**,超出时引擎拒绝画整个面板。分支下拉按 `branchOptions` 截断。
- **桌面端渲染**:`Button` 把子元素压成纯文本、丢样式,要样式的画在按钮外;带边框的 `Box` 上下各占一行,要和按钮等高就用 SVG;`Svg` 不要设 `isInteractive`(沙盒框每次重画都重载,滚动时闪);没有 tooltip;面板宽度由应用管理,`$.ui.open` 的 `columns` 只是请求,列按 `bodyColumns` 自适应。
- **`claude/hooks/register.tsx` 里的 `$`** 不能跨 import,控制器拿到的是 `engineOf($)` 转发的对象,新增调用要写进去且**参数完整转发**(丢参数会让超时之类悄悄失效)。状态引用的 `plugin`、`key` 必须是字面量。`ui.render` 里只读状态不写。不要在渲染钩子里用 `$.clock.now()`,测试环境没有,整个钩子会被跳过。
- 写进 SVG 的文本要 XML 转义。

## 测试

叶子元素(`Svg`)查不到 `key`,按 `alt` 找。同一个 `Pane` 的状态跨挂载保留,下一次挂载前先收起上一次展开的状态。`expect` 没有 `toBeCloseTo`。git 输出用 `claude/hooks/testing/fixtures.ts` 的 `serveGit` 模拟。

## Codex 图谱入口

默认使用正式插件内的 `codex/skills/wukong-git-graph` 技能,通过 `open_git_graph` 显式传入当前聊天仓库的绝对路径,再检查 MCP Apps 对话面板显示目标仓库的历史或有效空状态并保留。不是调用工具就算成功;错误仓库、UI 错误、未验证面板均为失败。默认成功不输出文字或截图,上层指令和用户要求报告时除外。More tools → Plugins and MCPs → Wukong Git Graph 来自 MCP thread entrypoint。工具缺失或 unknown MCP server 时确认插件启用并新开聊天,不要自动回退浏览器。

本地源码分发必须先在源码仓库执行 `npm --prefix codex ci`、`npm --prefix codex run build`,产物为忽略的自包含 `codex/dist/plugin`;根 `.agents/plugins/marketplace.json` 指向它。然后 `codex plugin marketplace add <本仓库绝对路径>`、`codex plugin add wukong-git-graph@wukong-git-graph-local`。未构建的 Git marketplace 安装不支持。修改源码后重新构建并重新安装/加载,旧聊天不会自动刷新工具绑定。Codex 插件版本独立于 Claude 清单版本,不要因此更改 Claude 版本。

不传路径时 MCP 依次采用客户端唯一文件系统 root、无 roots 能力时的进程工作目录;有多个/零个 root 或落在插件自身目录时要求显式目标,不能猜源码目录。子目录规范化到仓库根、worktree 独立;每个 graphId 固定仓库。stdio 进程由 Codex 管理,不启动 HTTP 守护进程。不得覆盖用户技能内容;检查旧 `~/.codex/skills/git-graph` 是本任务创建的链接后,仅移除该链接避免重复发现。

仅用户明确要求浏览器回退时,独立定位包含 `codex/package.json` 的源码 checkout 及启动器,与目标仓库区分。在源码仓库构建后用持续运行终端执行 `npm --prefix codex run open -- --repo <目标绝对路径>`,验证/复用同仓库服务,用 Codex 浏览器侧边页打开完整 URL(含 fragment)并验证。首次启动终端保持运行,Ctrl+C 停止;不要把带令牌 URL 写进 issue、PR 或版本库。安装缓存内的插件不含 HTTP 启动器。Codex 适配测试:`npm --prefix codex test`、`npm --prefix codex run typecheck`;前者包含只复制插件包到空目录后的真实 stdio 启动测试。

`.codex/environments/environment.toml` 的 Wukong Git Graph Action 保留为 HTTP 顶部启动入口,不自动打开侧边页。修改时保留其他 setup/actions 并实际执行命令;无法操作设置界面时,如实说明按钮显示与点击未验证。协议/构建通过不能当作桌面面板或菜单已验证。

## 分支流程

不直接推 `main`,从 `main` 切分支开 PR。提交信息 `<类型>: <描述>`。

## 发版

版本号遵循 SemVer,`claude/.claude-plugin/plugin.json` 和 `.claude-plugin/marketplace.json` 的 `version` 必须一致。使用者靠版本号变化收到更新,发布过的版本号不能复用。

1. 从 `main` 切 `release/vX.Y.Z`,改两处 `version`,在 [CHANGELOG.md](CHANGELOG.md) 顶部加这一版(按 Added / Changed / Fixed 分组,注明 PR 编号),README、PRD 有变化的一并改。
2. 开 PR,CI 通过、用户同意后合并。
3. 在更新后的 `main` 上打 tag 并推送:`claude plugin tag . --push`(会先校验两处版本一致,新 tag 名 `wukong-git-graph--vX.Y.Z`;历史 tag 保留旧前缀)。
4. 建 Release:`gh release create wukong-git-graph--vX.Y.Z --title vX.Y.Z --notes-file <这一版的 CHANGELOG 段落>`。
5. tag 和 Release 是公开的,第 3、4 步要用户明确同意后再做。

## 提问与回复同步到 Issue

用户在各个 Agent 工具里的提问和 AI 的回复,同步记录为**新建的 issue**。

### 类型与标签

| 类型 | 标签 | 标题 type | 用途 |
|---|---|---|---|
| Bug | `bug` | `fix` | 已有功能出现错误 |
| Feature | `feature` | `feat` | 提出新功能 |
| Improvement | `enhancement` | `feat` | 改进已有功能 |
| Documentation | `documentation` | `docs` | 文档新增或修改 |
| UI/UX | `ui` | `fix` 或 `feat` | 界面、交互体验问题 |
| Refactor | `refactor` | `refactor` | 重构代码,不改变功能 |
| Performance | `performance` | `perf` | 性能优化 |
| Test | `test` | `test` | 测试相关工作 |
| Security | `security` | `fix` | 安全问题 |
| Chore | `chore` | `chore` | 工程、依赖、配置等维护 |
| Question | `question` | `question` | 使用咨询、技术问题 |
| Discussion | `discussion` | `discussion` | 需要讨论后决定 |

同时符合多个类型时,选最主要的定标题 type,其余加为标签。标签不存在就先 `gh label create`。

### 标题

`<type>(<scope>): <description>`,参考 Conventional Commits,如 `fix(pane): 修复展开状态下关闭面板白屏`。

- `type`:上表的"标题 type"。
- `scope`:影响范围,**可选**,英文小写,如 `pane`、`band`、`detail`、`git`、`readme`;没有明确范围就写成 `<type>: <description>`。
- `description`:简短描述要解决的问题或完成的工作,不加句号。

### 正文与后续

- 每个提问一个 issue。正文写**提问原文**、**AI 回复的要点**,并注明来自哪个工具。
- 后续追问和进展追加评论,不新开 issue;实现它的 PR 用 `Closes #编号` 关联。
- 不记录密钥、令牌等敏感内容。
