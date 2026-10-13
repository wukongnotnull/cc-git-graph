# cc-git-graph

在 Claude Code 桌面应用里查看 Git 提交图谱的只读看板(Claude Code mod)。

## 功能

- 输入 `/git-graph` 打开面板,显示当前仓库的泳道图和提交列表。
- 顶部筛选:分支下拉(单选)和「Show Remote Branches」开关。
- 分页加载,底部「加载更多」。
- 点击提交的描述区,展开详情:哈希、父提交、作者、提交者、日期、完整说明和改动文件(`+n | -n`)。
- 只读:只执行 `git log`、`git show`、`git for-each-ref`、`git rev-parse`。

## 安装

```bash
/plugin install cc-git-graph --marketplace wukongnotnull/cc-git-graph
```

仅支持桌面应用;其他界面只显示一句提示。

## 开发

- 需求:[PRD.md](PRD.md);技术设计:[docs/wukong-code/specs](docs/wukong-code/specs);实施计划:[docs/wukong-code/plans](docs/wukong-code/plans)。
- 本地加载:在 `~/.claude/settings.json` 的 `env` 里设置 `CLAUDE_CODE_PLUGIN_DIRS` 为本仓库路径,并设置 `CLAUDE_CODE_PLUGIN_DIR_WATCH=1`。
- 检查:`claude plugin validate .`、`tsc -p . --noEmit`、`claude plugin test .`。
- 这些检查需要带有 `plugin test` 子命令的 Claude Code 版本,PATH 上的 `claude` 可能太旧;开发时用的是桌面应用自带的 2.1.295,以及 TypeScript 5.4 以上的 `tsc`。

### 开发环境

本项目在 `.claude/settings.json` 中以项目级方式启用了插件 [wukong-code](https://github.com/wukongnotnull/wukong-code)(来自市场 `wukong-code-dev`),提供 TDD、系统化调试、计划编写等技能。

克隆仓库后用 Claude Code 打开并信任该项目,按提示安装插件即可。也可以手动安装:

```bash
claude plugin marketplace add wukongnotnull/wukong-code --scope project
claude plugin install wukong-code@wukong-code-dev --scope project
```
