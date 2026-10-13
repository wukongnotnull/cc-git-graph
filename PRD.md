# cc-git-graph PRD:Claude Code Git 图谱看板 mod

Status: Confirmed
Date: 2026-10-13
Source: grilling

## 1. Objective

在 Claude Code 桌面应用里,用 Claude Code mod 实现一个只读的 Git 图谱看板,界面参照 VS Code 扩展 Git Graph 的截图。用户输入 `/git-graph` 打开面板,面板里有顶部筛选区、泳道图加提交列表、点击提交后展开的详情区。

## 2. Verified Facts

- 截图是 VS Code/Cursor 的 Git Graph 扩展(很可能是 mhutchie/vscode-git-graph,最近一次推送 2023-07)。
- mod 通过 `$.ui.open` 打开 Pane,用 `ui.render` 钩子绘制,用 `$.process.run(["git", ...])` 读取数据。
- `desktop` surface 有 `Svg`、`Input`、`Select`;`terminal` 没有 `Svg`。
- `$.process.run` 的输出有长度上限,会返回 `isStdoutTruncated`。
- GitHub 上没有找到已用 Claude Code mod 实现该需求的项目。该结论只覆盖 GitHub 搜索,没有查插件市场,各项目许可证也未核对。
- 仓库 `wukongnotnull/cc-git-graph` 已创建(公开),`.claude/settings.json` 已启用 `wukong-code` 插件。

## 3. Confirmed Decisions

1. 目标 surface 是 **desktop**,用 SVG 绘制泳道和节点。
2. **v1 只读**,只执行读取类 git 命令。
3. 只显示**当前会话工作目录所在的仓库**,没有仓库选择器。
4. 面板通过 **`/git-graph` 斜杠命令手动打开**,不自动弹出。
5. 提交历史**分页加载**:首次读一批,底部「加载更多」追加。
6. 数据**只手动刷新**,面板提供刷新按钮。
7. v1 包含**顶部筛选工具栏**,内有分支下拉和「显示远程分支」开关。
8. 分支下拉**单选**:「Show All」或某一个分支。
9. **v1 不含搜索。**
10. **点击提交行展开详情区**,左侧显示完整哈希、父提交、作者和提交者(含邮箱)、日期、完整提交说明。
11. 详情区右侧是**改动文件的平铺列表**,每行带 `+n | -n`,没有树形视图和切换。
12. 交付形式:**仓库根目录就是 mod**(`.claude-plugin/plugin.json`、`hooks/`、`marketplace.json`)。
13. 需求记录存为仓库根目录的 **`PRD.md`**(用户的明确要求,覆盖流程默认路径)。

## 4. Closed Branches

- **终端 CLI 和 VS Code 扩展 surface:** 目标是 desktop,不在 v1 范围。
- **修改类 git 操作(checkout、merge、reset、push 等):** v1 只读。
- **多仓库切换:** v1 只显示当前会话工作目录的仓库。
- **会话启动自动打开:** 选了手动命令。
- **自动刷新:** 判断 git 写操作复杂,外部终端的提交也观察不到。
- **搜索:** 行为(过滤还是高亮、是否跨页)有多种方案,会拉长 v1。
- **文件树形视图:** 平铺列表已够用。
- **分支多选:** 单选覆盖最常见的看法,实现更简单。
- **一次加载全部提交:** 大仓库既慢,又可能被输出上限截断。

## 5. Constraints and Non-goals

- 约束:所有 git 命令只读;只用 `$.process.run` 读取数据;提交说明等内容按纯文本渲染。
- 非目标:任何仓库写操作、搜索、自动刷新、多仓库、树形文件视图、分支多选、非 desktop surface 的完整支持。

## 6. Authorized Defaults

以下细节低影响且可改,按默认处理,没有逐项确认:

- 每页 **300** 条提交。
- 列表列为 Graph / Description / Date / Author / Commit,与截图一致。
- 分支、`origin/HEAD`、标签以徽章显示;合并提交的文字置灰。
- 「显示远程分支」开关默认开启,与截图一致。
- 当前目录不是 git 仓库时,面板显示一句说明,不报错。
- 在非 desktop surface 下,面板提示「仅支持桌面应用」。
- 详情区有关闭按钮。点击父提交哈希:该提交已加载则滚动到它,否则不可点击。
- 颜色跟随主题,泳道配色循环使用。

## 7. Non-blocking Open Items

- 泳道布局算法的具体实现,可参考 git-bahn/git-graph,代码复用前先核对许可证。
- 每页 300 条的数值,实测后可调。
- 若以后要支持终端或 VS Code,另起迭代。

## 8. Success Criteria

- 在桌面应用里输入 `/git-graph`,面板打开并显示当前仓库的图谱,泳道、徽章、列表列与截图一致。
- 分支下拉能在「Show All」和单个分支之间切换,「显示远程分支」开关生效。
- 超过一页的仓库可以用「加载更多」追加,且泳道不断。
- 点击提交行展开详情区,内容与截图一致;文件列表的增删行数与 `git show --numstat` 一致。
- 整个过程不执行任何会修改仓库的 git 命令。
- 刷新按钮重新读取并更新图谱。
- 在非 git 目录和非 desktop surface 下,给出清晰提示。
- `claude plugin validate`、`tsc` 和 `claude plugin test` 全部通过;用 `git show --numstat` 的输出解析和泳道布局至少有单元测试。
