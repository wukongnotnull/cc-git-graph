# AGENTS.md

cc-git-graph:Claude Code mod,在桌面应用里显示只读的 Git 图谱面板。需求见 [PRD.md](PRD.md),安装和使用见 [README.md](README.md);改了行为要同步更新这两份。

## 验证

`claude plugin validate .`、`claude plugin test .`、`tsc -p . --noEmit`。CI 跑前两项。`plugin test` 要较新的 Claude Code,本机常跑不了,以 CI 为准;`tsc` 缺引擎类型时有已知的 `TS7006`、`TS6046`,只看新增的错误。没在桌面应用里看过的界面效果,要如实说没验证。

## 实测出来的约束

- **只读 git**:只能 `log`、`show`、`for-each-ref`、`rev-parse`(`hooks/git/run-git.ts` 有白名单)。每次调用 10 秒超时;每页 50 条,300 条一页会让 `$.process.run` 不返回。
- **面板内容上限约 20 万字符**,超出的行不画。所以列表按窗口显示(`hooks/layout/window.ts`,预算在 `constants.ts`),diff 限 3 万字符。每行新增内容要计入窗口的开销估计。
- **桌面端渲染**:`Button` 把子元素压成纯文本、丢样式,要样式的画在按钮外;带边框的 `Box` 上下各占一行,要和按钮等高就用 SVG;`Svg` 不要设 `isInteractive`(沙盒框每次重画都重载,滚动时闪);没有 tooltip;面板宽度由应用管理,`$.ui.open` 的 `columns` 只是请求,列按 `bodyColumns` 自适应。
- **`hooks/register.tsx` 里的 `$`** 不能跨 import,控制器拿到的是 `engineOf($)` 转发的对象,新增调用要写进去且**参数完整转发**(丢参数会让超时之类悄悄失效)。状态引用的 `plugin`、`key` 必须是字面量。`ui.render` 里只读状态不写。不要在渲染钩子里用 `$.clock.now()`,测试环境没有,整个钩子会被跳过。
- 写进 SVG 的文本要 XML 转义。

## 测试

叶子元素(`Svg`)查不到 `key`,按 `alt` 找。同一个 `Pane` 的状态跨挂载保留,下一次挂载前先收起上一次展开的状态。`expect` 没有 `toBeCloseTo`。git 输出用 `hooks/testing/fixtures.ts` 的 `serveGit` 模拟。

## 流程

不直接推 `main`,从 `main` 切分支开 PR。提交信息 `<类型>: <描述>`。
