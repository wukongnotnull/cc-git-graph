# AGENTS.md

给所有 AI 编码助手的项目规范。Claude Code 通过 [CLAUDE.md](CLAUDE.md) 引用本文件。

## 项目概览

cc-git-graph 是一个 Claude Code **mod**:在桌面应用里显示只读的 Git 提交图谱面板(泳道、提交列表、详情、文件 diff),并在输入框上方显示打开按钮、当前分支和用量。

- 需求:[PRD.md](PRD.md)(行为变化要同步更新);使用与安装:[README.md](README.md)。
- 技术设计和实施计划:`docs/wukong-code/specs`、`docs/wukong-code/plans`。
- 仓库根目录就是 mod:`.claude-plugin/`(`plugin.json`、`marketplace.json`)、`hooks/`、`types/`。

## 目录结构

| 目录 | 内容 |
|---|---|
| `hooks/register.tsx` | mod 入口:注册命令、钩子、状态引用 |
| `hooks/controller.ts` | 加载、翻页、窗口、详情、文件 diff 等状态变更 |
| `hooks/git/` | 只读 git 调用(`run-git.ts`)和输出解析 |
| `hooks/layout/` | 泳道布局、SVG 绘制(行、徽章、圆环、图标)、窗口预算 |
| `hooks/ui/` | 面板、行、详情、工具栏、按钮条的渲染,以及纯逻辑(徽章分组、列规划、颜色) |
| `hooks/testing/` | 测试夹具(`serveGit` 等) |
| `types/index.d.ts` | 状态类型和 `PluginState` 契约 |

纯逻辑放在 `git/`、`layout/`、`ui/` 下的小模块里,每个模块旁边放同名的 `*.test.ts`。

## 命令与验证

```bash
claude plugin validate .
claude plugin test .
tsc -p . --noEmit
```

- CI(`.github/workflows/ci.yml`)对每个 PR 运行 `validate` 和 `plugin test`,必须通过才能合并。
- `plugin test` 需要带这个子命令的 Claude Code;PATH 上的旧版本没有。本机跑不了测试时,以 CI 的结果为准,不要把没跑过的测试说成通过。
- `tsc` 需要引擎类型(`.claude-plugin/types/`,由引擎加载 mod 时生成);缺类型时会有 `TS7006`、`TS6046` 之类的已知报错,只关注新增的错误。

## 硬性约束(都来自实测,别绕过)

**只读 git**
- 只能执行 `log`、`show`、`for-each-ref`、`rev-parse`,`run-git.ts` 里有白名单,其他子命令会抛错。不要加写操作。
- 每次调用带 10 秒超时(`GIT_TIMEOUT_MS`)。每页 50 条(`PAGE_SIZE`):300 条一页(约 50KB 输出)时 `$.process.run` 会不返回。
- 取文件 diff 前,路径必须是该提交文件列表里的;文件列表用 `--no-renames`,保证路径可直接当路径规格。

**面板内容上限**
- 引擎对一个面板的内容总量有约 20 万字符的上限,超出的行不画(100 行即触顶)。所以列表按窗口显示(`ROW_WINDOW_CHARS` = 14 万,`hooks/layout/window.ts`),diff 限制 3 万字符(`DIFF_MAX_CHARS`)。新增每行都画的内容时,要同步估算它的字符数并更新窗口的开销估计。

**桌面端渲染的坑**
- `Button` 会把子元素压成纯文本、丢掉样式:要样式的内容画在按钮外面(徽章就是这样)。
- 带边框的 `Box` 上下各占一行,单行文字变三行高;要和按钮等高的元素用 SVG。
- 不要给 `Svg` 设 `isInteractive`:它放进沙盒框,面板每次重画(滚动)都会重新加载而闪烁。
- 没有 tooltip;完整名称放在详情里。
- 面板宽度由应用管理,`$.ui.open` 的 `columns` 只是请求,不要依赖;列按 `bodyColumns` 自适应。
- 不依赖引擎时钟:按钮条里用 `new Date()`,`$.clock.now()` 在测试环境不可用,会让整个钩子被跳过。

**钩子加载器的限制(`hooks/register.tsx`)**
- `$` 只能在同一文件声明的函数里传递,不能跨 import、不能展开或返回。控制器和动作拿到的是 `engineOf($)` 转发出来的对象;新增要转发的调用要写进 `engineOf`,并且**参数要完整转发**(丢参数会让超时之类的设置悄悄失效)。
- 状态引用的 `plugin` 和 `key` 必须是写在使用处的字面量;状态的类型在 `types/index.d.ts` 的 `PluginState` 里声明。
- `ui.render` 钩子里只读状态,不写;写状态放在事件钩子或按钮的处理函数里。

## 编码规范

- TypeScript,语言用中文写文档和面向用户的文案(面板里的按钮和提示),代码标识符和注释用英文,风格和周围代码保持一致。
- **不可变**:返回新对象,不要原地修改(状态更新用展开语法)。
- 文件聚焦:典型 200 到 400 行,最多 800 行;函数小于 50 行;用提前返回,避免超过 4 层嵌套。
- 布尔值用 `is`、`has`、`should`、`can` 前缀;常量用 `UPPER_SNAKE_CASE`,放在 `hooks/constants.ts`;不要散落魔法数字。
- 在系统边界校验外部数据(git 输出、路径、用户输入);错误要显式处理并给出用户能看懂的提示,不要吞掉。
- 不留 `console.log` 和调试代码;不提交密钥或凭据。
- 提交内容、分支名、文件名按纯文本渲染;写进 SVG 的文本要做 XML 转义(见 `chip-svg.ts`)。

## 测试

- 新功能和修复先写测试(先看到失败,再实现)。纯逻辑写单元测试,渲染用 `$.ui.mount` 挂载后按 `key`、文本或 `Svg` 的 `alt` 查找。
- 叶子元素(如 `Svg`)在测试里查不到 `key`,按 `alt` 找;同一个 `Pane` 的状态跨挂载保留,多个挂载之间要先关闭上一次展开的状态。
- 测试库的 `expect` 没有 `toBeCloseTo`;git 输出用 `hooks/testing/fixtures.ts` 的 `serveGit` 模拟。
- 测试名描述行为("falls back to…"、"returns … when …"),结构用 Arrange、Act、Assert。

## Git 工作流

- 提交信息:`<类型>: <描述>`,类型为 `feat`、`fix`、`refactor`、`docs`、`test`、`chore`、`perf`、`ci`;正文说明为什么。
- 不直接推送 `main`:从 `main` 切分支,开 PR,等 CI 通过后合并;PR 描述写清楚改了什么、怎么验证、哪些没验证。
- 一个 PR 做一件事;改了行为,同步改 `PRD.md` 和 `README.md`。
- 不要在没有被要求时强推或改写历史。

## 对 AI 助手的工作方式

- 先读相关代码和这里的约束再动手;改完说清楚哪些验证过、哪些没验证(尤其是没在桌面应用里看过的界面效果)。
- 没把握的 API 行为先查类型定义和文档,不要凭猜测写;遇到引擎限制,优先找绕过的实现而不是放宽限制。
- 发现需求或设计和代码不一致时,指出来,不要悄悄改文档或代码去掩盖。
