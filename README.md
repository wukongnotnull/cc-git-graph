# Wukong Git Graph

在 Codex 或 Claude Code 中查看当前项目的 Git 提交和分支。图谱只读，不会更改代码或 Git 历史，也不会上传项目内容。

## 让 AI 助手帮你安装

复制下面的提示词，发给 Codex 或 Claude Code：

> 请在当前 Agent 工具中安装 Wukong Git Graph，并在当前项目打开面板。先确认当前工具是 Codex 还是 Claude Code，再按对应步骤操作：
>
> - **Codex**：从 https://github.com/wukongnotnull/wukong-git-graph 获取仓库源码，在仓库目录运行 `npm --prefix codex ci` 和 `npm --prefix codex run build`，再运行 `codex plugin marketplace add "<仓库目录绝对路径>"` 和 `codex plugin add wukong-git-graph@wukong-git-graph-local`。
> - **Claude Code**：运行 `claude plugin marketplace add wukongnotnull/wukong-git-graph` 和 `claude plugin install wukong-git-graph@wukong-git-graph`。
>
> 安装后确认插件已启用，并在当前项目的新聊天或会话中打开 Git Graph。检查面板显示的是当前项目的提交历史，或该项目有效的空历史状态。不要修改项目文件或 Git 历史，也不要改用网页方式。如果当前工具不支持、缺少依赖或面板未能打开，请说明原因，不要声称安装成功。

## 打开图谱

- **Codex**：选择 **More tools → Plugins and MCPs → Wukong Git Graph**，或输入 `/git-graph` 并选择 **Wukong Git Graph**。
- **Claude Code**：输入 `/git-graph`，或点击 **Wukong Git Graph** 按钮。

面板显示当前项目的提交、分支和文件改动。

## 手动安装

### Codex

需要 Codex 桌面应用、Git、Node.js 22 或更高版本，以及 Codex CLI（终端里的 `codex` 命令）。在电脑终端中运行：

```bash
git clone https://github.com/wukongnotnull/wukong-git-graph.git
cd wukong-git-graph
npm --prefix codex ci
npm --prefix codex run build
codex plugin marketplace add "$PWD"
codex plugin add wukong-git-graph@wukong-git-graph-local
```

在 Codex 插件管理中启用 **Wukong Git Graph**，然后新开一个本地项目聊天。旧聊天可能还没有加载新插件。

### Claude Code

在电脑终端中运行：

```bash
claude plugin marketplace add wukongnotnull/wukong-git-graph
claude plugin install wukong-git-graph@wukong-git-graph
```

在 Claude Code 插件管理中启用插件，然后新开一个本地项目会话。更新插件时运行：

```bash
claude plugin update wukong-git-graph
```
