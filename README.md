# cc-git-graph

在 Claude Code 和 Codex 桌面应用里查看 Git 提交图谱的只读看板。Claude Code 使用 mod 面板;Codex 使用 MCP Apps 对话面板。

## 功能

- Claude Code 输入 `/git-graph` 打开 mod 面板;Codex 安装下方插件后,用同名技能或 More tools 入口打开对话面板。
- Claude Code 桌面应用里,也可以点输入框上方的「Git Graph」按钮打开。
- 顶部筛选:分支下拉(单选)和「Show Remote Branches」开关。下拉最多列 62 个分支(本地分支在前),更多时末尾提示还有几个,可以关掉远程分支缩短列表。
- 分页加载,底部「Load more」。引擎对面板内容的总量有上限(约 20 万字符,约 100 行),所以列表按窗口显示:一次画一批行,底部的「Load more」换到更旧的一批,顶部的「↑ Newer commits」换回来。
- 点击提交的描述区,展开详情:哈希、父提交、作者、提交者、日期、完整说明和改动文件(`+n | -n`)。文件最多列 50 个,说明最多显示 4000 字符,超出时有提示。
- 只读:只执行 `git log`、`git show`、`git for-each-ref`、`git rev-parse`。

## 在 Codex 中打开

需要本机安装 Git、Node.js 22+ 和 npm,并克隆本仓库。Codex 插件与下方 Claude Code mod 分开安装。

### 本地源码构建与安装

当前采用**本地源码构建后安装**的方式。在仓库根目录执行:

```bash
npm --prefix codex ci
npm --prefix codex run build
codex plugin marketplace add "/absolute/path/to/cc-git-graph"
codex plugin add cc-git-graph@cc-git-graph-local
```

将第三行替换为本仓库的绝对路径。构建生成自包含的 `codex/dist/plugin`:包含可搬移的 MCP 服务、内嵌脚本/样式的面板、技能和两套兼容清单,无需从安装缓存访问源码或 `node_modules`。根目录 `.agents/plugins/marketplace.json` 指向该产物。**必须先运行 ci 和 build,再注册本地市场并安装**;不支持直接从未构建的 Git marketplace 安装。`dist` 不提交到 Git。

安装或更新后,请**新开本地项目聊天**再使用。旧聊天可能保留旧工具绑定并报 unknown MCP server;这时新开聊天加载已启用的插件。更新源码后重新构建,并通过 Codex 插件管理重新安装/加载新的构建产物,不会因修改源码自动刷新已安装的副本。

插件已包含 `git-graph` 技能。若过去手动创建过 `~/.codex/skills/git-graph` 链接,先检查它是否确为本仓库的旧链接,再仅移除该链接以避免重复发现;保留已有用户技能内容,不要覆盖目录。

### 对话面板与技能

在新项目聊天的 **More tools → Plugins and MCPs → Git Graph** 打开面板,或输入 `/git-graph` 选择 **Git Graph** 技能、输入 `$git-graph`。More tools 入口来自插件 MCP 工具的 thread entrypoint。技能默认调用 `open_git_graph`,显式传入**当前聊天仓库的绝对路径**,然后检查 MCP Apps 面板的仓库和内容并保留面板。也可以明确指定另一个本地仓库或 worktree。技能目录、插件缓存和源码目录均不是默认目标。

默认只打开面板,成功后不主动输出回复、URL 或截图;打开或验证失败时才说明原因。工具调用本身、错误仓库、UI 错误或未验证的面板都不算成功;有效空仓库的空状态算成功。Codex 的工具活动提示由应用控制,上层指令或用户明确要求的报告仍正常回答。工具缺失时先确认插件已启用并新开聊天,不会自动改走网页。

从 More tools 打开而未传路径时,服务依次使用客户端提供的唯一文件系统 root、没有 roots 能力时的进程工作目录;多个 root、零 root、插件缓存目录或非仓库会明确要求选择目标或报错。子目录解析到仓库根,worktree 保持独立根路径。每个打开的视图保留自己的仓库句柄,已有面板不会随下一次打开而切到别的仓库。

面板通过 Codex 管理的 stdio MCP 进程读取本地 Git,不启动 HTTP 守护进程,也不需要长期保留启动终端。进程的启停和重新加载由 Codex 管理;面板打开不创建新的项目聊天。当前构建和协议测试不能代替完整桌面图形验证,安装后的菜单、技能选择与面板交互需在桌面应用实测。

Codex 版支持泳道、分支/远程筛选、Refresh、每页 50 条的 Load more / Newer commits、提交详情和文件 diff。界面跟随主题并按宽度隐藏次要列。详情最多显示 50 个文件、4000 字符说明,diff 最多 3 万字符。只执行 `log`、`show`、`for-each-ref`、`rev-parse`,每次 10 秒超时并以 `LC_ALL=C` 运行;不上传仓库数据。翻页期间历史发生变化时,点击 Refresh 重新读取。

### 显式浏览器回退与项目 Action

仅在明确要求浏览器回退时使用下面的独立 HTTP 入口。先在源码仓库执行 `npm --prefix codex ci` 和 `npm --prefix codex run build`,再启动:

```bash
npm --prefix codex run open -- --repo "/absolute/path/to/repository"
```

终端打印 `http://127.0.0.1:<随机端口>/#<访问令牌>`。在 Codex 内置浏览器侧边页打开**完整地址**,保留 fragment;也可用普通浏览器打开。地址含访问凭证,不要提交或分享。首次启动的终端保持运行,Ctrl+C 停止;再次调用会验证身份、令牌与仓库后复用同仓库服务。关闭网页不会停止服务,服务退出或缓存失效后重建。服务固定读取启动时的仓库、只监听 IPv4 回环,缓存记录在用户私有临时目录。源码更新后重新构建并停止旧服务再启动。

`.codex/environments/environment.toml` 的顶部 **Git Graph** Action 保留为 HTTP 启动方式,安装依赖、构建并启动独立服务,不会自动打开侧边页;它需要应用加载本地环境。当前本机未验证 Action 的按钮显示和点击。此入口与默认的插件对话面板分开。

## Claude Code 安装

在**终端**里安装(桌面应用的会话里没有 `/plugin install`),任选一种:

```bash
claude
```

然后在打开的会话里输入:

```text
/plugin install cc-git-graph --marketplace wukongnotnull/cc-git-graph
```

按提示回答 `y` 添加市场,再选 user scope。也可以用不交互的命令:

```bash
claude plugin marketplace add wukongnotnull/cc-git-graph
```

```bash
claude plugin install cc-git-graph@cc-git-graph
```

装在 user scope 之后,桌面应用里之后新开的本地会话都会加载它:输入 `/git-graph`,或点输入框上方的「Git Graph」按钮。

Claude mod 仅支持 Claude Code 桌面应用;其他 Claude 界面只显示一句提示。Codex 使用上面的插件对话面板。

### 更新

已安装的版本是安装时的副本。有新版本时(见 [CHANGELOG.md](CHANGELOG.md) 和 [Releases](https://github.com/wukongnotnull/cc-git-graph/releases)),在终端运行:

```bash
claude plugin update cc-git-graph
```

## 开发

- 需求:[PRD.md](PRD.md);技术设计:[docs/wukong-code/specs](docs/wukong-code/specs);实施计划:[docs/wukong-code/plans](docs/wukong-code/plans)。
- 本地加载:在 `~/.claude/settings.json` 的 `env` 里设置 `CLAUDE_CODE_PLUGIN_DIRS` 为本仓库路径,并设置 `CLAUDE_CODE_PLUGIN_DIR_WATCH=1`。
- 检查:`claude plugin validate .`、`claude plugin test .`、`npx -y -p typescript@5.6.3 tsc -p ci`,CI 三项都跑。
- PATH 上的 `claude` 可能太旧、没有 `plugin test`,可以用 `npx -y @anthropic-ai/claude-code@2.1.299` 代替(与 CI 同版本)。
- Codex 适配的检查:`npm --prefix codex test`(构建、真实临时仓库集成测试、MCP/面板测试、自包含包搬移启动测试)、`npm --prefix codex run typecheck`(Node 和浏览器分别检查)。CI 两项都跑;构建输出位于 `codex/dist`,不提交。
- Codex 的 Node 测试以 `*.check.ts` 命名,由上述 npm test 执行,避免 Claude 的全仓库 `*.test.ts` 发现器把 Node 测试加载进 mod 沙盒。
- 发版流程见 [AGENTS.md](AGENTS.md) 的「发版」一节。

### 开发环境

本项目在 `.claude/settings.json` 中以项目级方式启用了插件 [wukong-code](https://github.com/wukongnotnull/wukong-code)(来自市场 `wukong-code-dev`),提供 TDD、系统化调试、计划编写等技能。

克隆仓库后用 Claude Code 打开并信任该项目,按提示安装插件即可。也可以手动安装:

```bash
claude plugin marketplace add wukongnotnull/wukong-code --scope project
claude plugin install wukong-code@wukong-code-dev --scope project
```
