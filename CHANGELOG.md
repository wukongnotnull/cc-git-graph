# Changelog

本文件记录每个发布版本的变化,格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。tag 名为 `cc-git-graph--v<版本>`。

## [Unreleased]

### Added

- Codex 的 **Git Graph** 用户技能:通过 `/git-graph` 选择或 `$git-graph` 调用,自动启动/复用当前仓库的本地服务并打开浏览器侧边页(#51)。

- Codex 项目环境提供顶部 **Git Graph** Action,在集成终端安装依赖、构建并启动当前仓库的图谱服务(#51)。
- Codex 桌面端的 Git 图谱网页入口:本地只读服务、分支筛选、分页、提交详情和文件 diff,可在内置浏览器侧边页打开(#51)。

### Fixed

- 分支(含远程)超过 63 个的仓库,打开面板是空白:引擎的下拉最多 64 个选项,超出就拒绝画整个面板。现在下拉最多列 62 个分支,末尾提示还有几个(#49)。
- 展开改动文件很多或说明很长的提交时,超出面板内容上限,列表尾部和「Load more」消失。详情现在最多列 50 个文件、说明最多显示 4000 字符,超出时有提示(#49)。

## [0.2.0] - 2026-10-14

### Changed

- 面板文字统一为英文:「Load more」「↑ Newer commits」「✕ Close diff」,以及空仓库、非仓库、仅支持桌面应用和读取失败的提示(#43)。
- 展开提交详情时,提交信息和文件列表两次 `git show` 并行读取(#42)。

### Fixed

- git 以中文等其他语言输出时,「不是 Git 仓库」「没有提交」被当成一般错误;现在 git 一律以 `LC_ALL=C` 运行(#42)。
- git 无法启动(多半是没装)时显示 `Could not start git. Is it installed?`,超时显示 `git did not answer within 10 seconds.`,不再是引擎的原始报错(#44)。

### Development

- CI 锁定 Claude Code 2.1.299(#44),并用提交进仓库的引擎声明快照跑 `tsc`(#45)。

## [0.1.0] - 2026-10-14

首个版本(补发,对应提交 `f7f2173`)。

### Added

- `/git-graph` 命令和输入框上方的「Git Graph」按钮,打开只读的 Git 图谱面板。
- 泳道图和提交列表,色盲友好配色;分支和 tag 徽章,本地分支与同名远程分支合并显示。
- 分支筛选和「Show Remote Branches」开关;刷新。
- 分页加载,按窗口显示长列表(引擎对面板内容有约 20 万字符的上限)。
- 提交详情:哈希、父提交、作者、提交者、日期、完整说明、改动文件和增删行数;点文件名查看该文件的 diff。
- 输入框上方显示当前分支,以及 Session、Week 用量窗口、上下文占用和会话花费。
- 列按面板宽度自适应。

[0.2.0]: https://github.com/wukongnotnull/cc-git-graph/compare/cc-git-graph--v0.1.0...cc-git-graph--v0.2.0
[0.1.0]: https://github.com/wukongnotnull/cc-git-graph/releases/tag/cc-git-graph--v0.1.0
