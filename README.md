# cc-git-graph

在 Claude Code 桌面应用里查看 Git 提交图谱的只读看板(Claude Code mod)。

## 功能

- 输入 `/git-graph` 打开面板,显示当前仓库的泳道图和提交列表。
- 桌面应用里,也可以点输入框上方的「Git Graph」按钮打开。
- 顶部筛选:分支下拉(单选)和「Show Remote Branches」开关。
- 分页加载,底部「Load more」。引擎对面板内容的总量有上限(约 20 万字符,约 100 行),所以列表按窗口显示:一次画一批行,底部的「Load more」换到更旧的一批,顶部的「↑ Newer commits」换回来。
- 点击提交的描述区,展开详情:哈希、父提交、作者、提交者、日期、完整说明和改动文件(`+n | -n`)。
- 只读:只执行 `git log`、`git show`、`git for-each-ref`、`git rev-parse`。

## 安装

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

仅支持桌面应用;其他界面只显示一句提示。

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
- 发版流程见 [AGENTS.md](AGENTS.md) 的「发版」一节。

### 开发环境

本项目在 `.claude/settings.json` 中以项目级方式启用了插件 [wukong-code](https://github.com/wukongnotnull/wukong-code)(来自市场 `wukong-code-dev`),提供 TDD、系统化调试、计划编写等技能。

克隆仓库后用 Claude Code 打开并信任该项目,按提示安装插件即可。也可以手动安装:

```bash
claude plugin marketplace add wukongnotnull/wukong-code --scope project
claude plugin install wukong-code@wukong-code-dev --scope project
```
