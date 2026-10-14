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

## 提问与回复同步到 Issue

用户在各个 Agent 工具里的提问和 AI 的回复,同步到**新建的 issue**。提问属于下面的类型时都要记录,标签即类型,标题前缀用 `[标签]`:

| 类型 | 标签 | 用途 |
|---|---|---|
| Bug | `bug` | 已有功能出现错误 |
| Feature | `feature` | 提出新功能 |
| Improvement | `enhancement` | 改进已有功能 |
| Documentation | `documentation` | 文档新增或修改 |
| UI/UX | `ui` | 界面、交互体验问题 |
| Refactor | `refactor` | 重构代码,不改变功能 |
| Performance | `performance` | 性能优化 |
| Test | `test` | 测试相关工作 |
| Security | `security` | 安全问题 |
| Chore | `chore` | 工程、依赖、配置等维护 |
| Question | `question` | 使用咨询、技术问题 |
| Discussion | `discussion` | 需要讨论后决定 |

- 每个提问一个 issue:正文写提问原文和 AI 回复的要点,注明来自哪个工具。后续追问和进展追加评论,不新开;实现它的 PR 用 `Closes #编号` 关联。
- 标签不存在就先 `gh label create`。同时符合多个类型时,选最主要的一个作标题前缀,其余也可以加为标签。
- 不记录密钥、令牌等敏感内容。
