# cc-git-graph

在 Claude Code 和 Codex 桌面应用里查看 Git 提交图谱的只读看板。Claude Code 使用 mod 面板;Codex 使用内置浏览器侧边页。

## 功能

- 输入 `/git-graph` 打开面板,显示当前仓库的泳道图和提交列表。
- 桌面应用里,也可以点输入框上方的「Git Graph」按钮打开。
- 顶部筛选:分支下拉(单选)和「Show Remote Branches」开关。下拉最多列 62 个分支(本地分支在前),更多时末尾提示还有几个,可以关掉远程分支缩短列表。
- 分页加载,底部「Load more」。引擎对面板内容的总量有上限(约 20 万字符,约 100 行),所以列表按窗口显示:一次画一批行,底部的「Load more」换到更旧的一批,顶部的「↑ Newer commits」换回来。
- 点击提交的描述区,展开详情:哈希、父提交、作者、提交者、日期、完整说明和改动文件(`+n | -n`)。文件最多列 50 个,说明最多显示 4000 字符,超出时有提示。
- 只读:只执行 `git log`、`git show`、`git for-each-ref`、`git rev-parse`。

## 在 Codex 中打开

需要本机安装 Git、Node.js 22 或更新版本,并克隆本仓库。在本仓库目录执行一次:

```bash
npm --prefix codex ci
npm --prefix codex run build
```

然后启动服务,把 `--repo` 后的路径换成要查看的本地仓库(也支持 worktree):

```bash
npm --prefix codex start -- --repo /absolute/path/to/repository
```

终端会打印 `http://127.0.0.1:<随机端口>/#<访问令牌>`。让 Codex **在内置浏览器侧边页打开完整地址**即可;也可用普通浏览器打开。请保留 `#` 后的部分,它用于访问本地服务,不要提交或分享这个地址。关闭服务用运行它的终端里的 Ctrl+C;重启会生成新地址。

在本项目的 Codex 聊天里也可以直接说「打开当前项目的 Git 图谱」,让 agent 按上述步骤启动并打开。更新代码后重新运行构建命令并重启服务。

Codex 版支持泳道、分支/远程筛选、手动刷新、每页 50 条的 Load more / Newer commits、提交详情与文件 diff。界面跟随浅色/深色主题,宽度不足时隐藏次要列。详情最多显示 50 个文件、4000 字符说明,diff 最多 3 万字符。

服务只监听 `127.0.0.1`,固定读取启动时指定的仓库,沿用只读 Git 命令白名单与 10 秒超时;不上传仓库数据。仓库历史在翻页期间发生变化时,点击 Refresh 重新读取。当前交付是源码运行的网页适配,不注册 Codex 原生按钮或斜杠命令,也不显示 Claude 账号用量。

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

Claude mod 仅支持 Claude Code 桌面应用;其他 Claude 界面只显示一句提示。Codex 使用上面的网页入口。

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
- Codex 适配的检查:`npm --prefix codex test`(构建、真实临时仓库集成测试、HTML 渲染测试)、`npm --prefix codex run typecheck`(Node 和浏览器分别检查)。CI 两项都跑;构建输出位于 `codex/dist`,不提交。
- Codex 的 Node 测试以 `*.check.ts` 命名,由上述 npm test 执行,避免 Claude 的全仓库 `*.test.ts` 发现器把 Node 测试加载进 mod 沙盒。
- 发版流程见 [AGENTS.md](AGENTS.md) 的「发版」一节。

### 开发环境

本项目在 `.claude/settings.json` 中以项目级方式启用了插件 [wukong-code](https://github.com/wukongnotnull/wukong-code)(来自市场 `wukong-code-dev`),提供 TDD、系统化调试、计划编写等技能。

克隆仓库后用 Claude Code 打开并信任该项目,按提示安装插件即可。也可以手动安装:

```bash
claude plugin marketplace add wukongnotnull/wukong-code --scope project
claude plugin install wukong-code@wukong-code-dev --scope project
```
