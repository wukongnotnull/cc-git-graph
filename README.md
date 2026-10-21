# Wukong Git Graph

在 Codex 或 Claude Code 里查看项目的修改历史。Wukong Git Graph 会把保存下来的代码改动（Git 提交）和不同的开发线（分支）画成图，方便快速了解项目变化。它只供查看，不会修改代码或历史记录。

## 能做什么

- 用图形查看项目的提交历史和分支。
- 按分支筛选，查看某次提交改了哪些文件和具体内容。
- 在 Codex 里直接打开对话旁边的面板，不需要打开网页。
- 在 Claude Code 桌面应用里打开 Wukong Git Graph 面板。

## 在 Codex 中安装

下面的步骤只需安装一次。需要安装 Codex 桌面应用、Git、Node.js 22 或更高版本，以及 Codex CLI（终端里的 `codex` 命令）。Node.js 安装时会一并提供 npm。可从 [Git 下载页](https://git-scm.com/downloads)、[Node.js 下载页](https://nodejs.org/en/download) 和 [Codex CLI 官方说明](https://developers.openai.com/codex/cli)获取安装帮助。

### 1. 下载项目文件

打开 Codex 的 **Terminal** 工具，或电脑自带的终端，复制并运行：

```bash
git clone https://github.com/wukongnotnull/wukong-git-graph.git
cd wukong-git-graph
```

这会把安装所需的文件下载到电脑，并进入该文件夹。

### 2. 安装 Wukong Git Graph

继续在同一个终端里，一次复制并运行下面几行：

```bash
npm --prefix codex ci
npm --prefix codex run build
codex plugin marketplace add "$PWD"
codex plugin add wukong-git-graph@wukong-git-graph-local
```

这些命令会准备面板并把 Wukong Git Graph 添加到 Codex。安装完成后，在 Codex 的插件管理中确认 **Wukong Git Graph** 已启用，然后新开一个本地项目聊天。旧聊天可能还没有加载新插件。

如果终端提示找不到 `git`、`npm` 或 `codex` 命令，说明电脑还没有安装对应程序，或安装后需要重新打开终端。Codex CLI 的安装方法见上面的官方说明。

## 在 Codex 中打开面板

在项目聊天中，点 **More tools → Plugins and MCPs → Wukong Git Graph**。也可以输入 `/git-graph`，再选择 **Wukong Git Graph**。面板显示的是当前聊天对应项目的提交历史。

面板打开失败时，先确认插件已启用，再新开一个本地项目聊天重试。成功打开后，图谱会留在对话旁边；正常情况下，技能不会额外发一条说明消息。

## 在 Claude Code 中安装

在电脑终端中运行：

```bash
claude plugin marketplace add wukongnotnull/wukong-git-graph
claude plugin install wukong-git-graph@wukong-git-graph
```

安装完成后，在 Claude Code 桌面应用中新开一个本地项目会话，输入 `/git-graph`，或点输入框上方的 **Wukong Git Graph** 按钮。

更新 Claude Code 插件时，在终端运行：

```bash
claude plugin update wukong-git-graph
```

## 使用说明

图谱会显示提交、分支和提交时间。可以选择分支、显示或隐藏远程分支、刷新历史，也可以展开提交查看文件改动。历史较长时，可用 **Load more** 查看更早的提交，再用 **Newer commits** 返回较新的提交。

工具只读取 Git 历史，不会执行提交、切换分支或改动文件，也不会上传项目内容。
