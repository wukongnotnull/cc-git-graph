# cc-git-graph 技术设计(代码实现层面)

Status: Draft(待评审)
Date: 2026-10-13
Source: brainstorming
Requirements: [PRD.md](../../../PRD.md)(v1.1)

本文是 PRD 的技术实现设计:模块划分、接口、数据流、git 命令、泳道算法、绘制方式和测试策略。需求结论以 PRD 为准,本文不改变任何已确认的需求。

---

## 1. 已核实的 mod API 约束

以下均来自 Claude Code 2.1.295 的 mod 类型声明,实现必须遵守:

| # | 约束 | 对设计的影响 |
|---|---|---|
| A1 | 只有 `Button` 有 `onPress`;`Box`、`Text`、`Svg` 都没有点击事件 | 可点击区域必须是 `Button` |
| A2 | `Button` 的子元素只能是字符串和 `Text`,放其他元素会被拒绝 | `Svg` 不能放进 `Button`,图谱列不可点击 |
| A3 | `Svg.source` 最长 131072 字符,`alt` 必填,`width`/`height` 是 CSS 像素 | 每行一个小 SVG,不画整页大图 |
| A4 | `Box` 的 `width`/`height`/`gap` 等是字符单元(cell),`overflow` 只有 `visible`/`hidden` | 行高是单元数,SVG 高度是像素,需要换算常量 |
| A5 | `desktop` 的元素表有 `Box/Text/Button/Input/Select/Svg/Link/Code/Markdown/Client`,没有复选框 | 「显示远程分支」用 `Button` 切换并显示 ☑/☐ |
| A6 | Pane 的滚动由引擎负责(聚焦时方向键滚动);`$.ui.scroll({ to: { key }, in: paneId })` 可滚到指定元素 | 不自己实现滚动;点击父提交用 `$.ui.scroll` |
| A7 | `$.process.run(argv, init)`:不经 shell;`stdout` 上限 4 MiB(超出置 `isStdoutTruncated`);默认超时 30 秒;git 运行时仓库 hooks 关闭 | 直接传 argv,不拼接命令字符串 |
| A8 | 测试环境没有 fs、网络、进程;`test` 中用 `on('process.run', …)` 钩子替引擎作答来模拟 git 输出 | git 输出必须可由夹具文本模拟 |
| A9 | 模块不能用 `require` 和 `import()`;只能 `import` 插件自己的文件;JSX 编译到全局 `h` | 所有模块用静态 ES import |
| A10 | `$.state` 的每个 key 必须在 `types/index.d.ts` 的 `PluginState` 里声明 | 状态契约写在 `types/index.d.ts` |
| A11 | Pane 的渲染 props 为 `title / isFocused / bodyColumns / placement / scroll / view` | 测试夹具按此构造 |

## 2. 对已批准方案的修正

此前批准的方案第 2 点是「每行是一个可点击的 `Button`/`Box`,左侧 Graph 列是该行的小 SVG」。由约束 A1、A2,这一点不可行,修正为:

- 每行是一个 `Box`(横向),由四部分组成:`Svg`(图谱列)、`Box flexGrow` 包着的 `Button`(描述与徽章,**点击区域**)、日期 `Text`、作者 `Text`、哈希 `Text`。
- 只有「描述与徽章」这一块可点击展开详情。点击图谱列、日期、作者、哈希列没有反应。
- 这一修正影响 PRD FR-7 的交互细节(点击热区),不影响其验收标准:点击提交行的描述区即可展开详情。

## 3. 总体架构

三层,纯逻辑与界面分离:

```
git 层        hooks/git/        只读 git 命令的封装与输出解析(纯函数 + 一个 IO 入口)
layout 层     hooks/layout/     泳道布局与 SVG 生成(纯函数)
ui/state 层   hooks/ui/ 等      状态、控制器、渲染钩子
```

依赖方向:ui → layout → git 的类型;git 层的解析函数不依赖 `$`;layout 层不依赖 `$`。

## 4. 目录结构与职责

```
.claude-plugin/
  plugin.json                  插件清单(含 types 指向)
  marketplace.json             市场清单
hooks/
  hooks.json                   { "modules": ["./register.tsx"] }
  register.tsx                 注册命令、渲染钩子;不含业务逻辑
  constants.ts                 常量(PANE_ID、PAGE_SIZE、颜色、尺寸)
  format.ts                    日期、短哈希格式化
  state.ts                     atom 定义与初始值
  controller.ts                带 IO 的动作:加载、加载更多、切分支、刷新、展开
  git/
    run-git.ts                 唯一调用 $.process.run 的地方;只读白名单
    parse-log.ts               git log 输出 → Commit[]
    parse-refs.ts              %D 引用串 → Ref[]
    parse-branches.ts          for-each-ref 输出 → 分支列表
    parse-detail.ts            git show 元信息与 numstat → CommitDetail
  layout/
    lanes.ts                   泳道布局(可分页续排)
    row-svg.ts                 单行 SVG 字符串生成
  ui/
    pane.tsx                   Pane 整体树
    toolbar.tsx                顶部筛选工具栏
    commit-row.tsx             提交行
    commit-detail.tsx          详情区
types/
  index.d.ts                   领域类型与 PluginState 契约
*.test.ts                      与被测模块同目录
```

单个文件目标 200–400 行,上限 800 行。

## 5. 类型与状态契约(`types/index.d.ts`)

```ts
export type RefKind = 'branch' | 'remote' | 'tag' | 'head'

export type Ref = {
  name: string
  kind: RefKind
  isCurrent: boolean        // 形如 "HEAD -> main" 的 main
}

export type Commit = {
  hash: string
  parents: string[]
  author: string
  timestamp: number         // Unix 秒
  subject: string
  refs: Ref[]
}

export type Edge = { from: number; to: number; color: number }

export type GraphRow = {
  hash: string
  lane: number
  color: number
  isMerge: boolean
  through: Edge[]           // 整行竖线,from === to
  incoming: Edge[]          // 行顶部 → 节点
  outgoing: Edge[]          // 节点 → 行底部
}

export type LaneState = {
  lanes: (string | null)[]  // 每条泳道正在等待的提交哈希
  colors: number[]          // 与 lanes 平行的颜色序号
  nextColor: number
}

export type FileChange = {
  path: string
  added: number | null      // 二进制文件为 null
  deleted: number | null
}

export type CommitDetail = {
  hash: string
  parents: string[]
  author: string
  authorEmail: string
  committer: string
  committerEmail: string
  date: string              // git 的 %ai 原样输出
  message: string
  files: FileChange[]
}

export type ViewStatus = 'idle' | 'loading' | 'ready' | 'no-repo' | 'error'

export type ViewState = {
  status: ViewStatus
  errorMessage: string
  commits: Commit[]
  rows: GraphRow[]
  laneState: LaneState
  hasMore: boolean
  branches: string[]        // 本地与远程分支的短名,不含 origin/HEAD
  remoteBranches: string[]  // branches 中属于远程的子集
  branch: string            // '*' 表示 Show All,否则必须是 branches 的成员
  isRemoteShown: boolean
  expandedHash: string | null
  detail: CommitDetail | null
  detailError: string
}

declare module 'claude-code' {
  interface PluginState {
    'cc-git-graph': { view: ViewState }
  }
}
```

状态更新一律返回新对象,不原地修改(用户的不可变性规则)。

## 6. git 命令(只读白名单)

`run-git.ts` 是整个 mod 唯一调用 `$.process.run` 的地方,拼出的 argv 为 `['git', '-c', 'core.quotepath=false', <子命令>, ...]`。**子命令必须在白名单** `log`、`show`、`for-each-ref`、`rev-parse`,否则直接抛错。这一规则有单元测试,对应 PRD 验收「不执行任何修改仓库的 git 命令」。

| 用途 | 命令 |
|---|---|
| 判断是否在仓库内 | `rev-parse --is-inside-work-tree` |
| 分支列表 | `for-each-ref --format=%(refname) refs/heads refs/remotes` |
| 提交页 | `log --topo-order --skip=<N> -n <PAGE_SIZE+1> --format=<LOG_FORMAT> <revs>` |
| 详情元信息 | `show -s --format=<META_FORMAT> <hash>` |
| 详情文件列表 | `show -m --first-parent --numstat --format= <hash>` |

- `<revs>`:Show All 为 `--branches --tags HEAD`,开启远程时再加 `--remotes`;选择单个分支时为该分支名。
- 分支名在传给 git 之前必须校验是 `view.branches` 的成员;哈希必须匹配 `^[0-9a-f]{40,64}$`。两者都不满足则拒绝,不执行命令。
- `--topo-order` 保证子提交先于父提交出现,这是泳道布局的前提。
- 每页多取 1 条(`PAGE_SIZE+1`)来判断 `hasMore`,实际只用前 `PAGE_SIZE` 条。
- `LOG_FORMAT` 字段以 `\x1f` 分隔、记录以 `\x1e` 结束:`%H %P %an %at %D %s`。
- `%D` 里的短名无法区分含 `/` 的本地分支和远程分支,所以用分支列表中的远程集合来分类。
- 空仓库(没有任何提交)时 `git log` 会失败,按「无提交」处理为空列表,不当作错误。
- `isStdoutTruncated` 为真时报错并提示,不使用被截断的数据。

## 7. 泳道布局算法(`layout/lanes.ts`)

纯函数,签名:

```ts
layoutCommits(prev: LaneState, commits: readonly { hash: string; parents: readonly string[] }[]):
  { rows: GraphRow[]; state: LaneState }
```

状态 `lanes[i]` 是第 i 条泳道正在等待的提交哈希(null 表示空闲)。输入必须是 `--topo-order` 的顺序。对每个提交:

1. 找出所有 `lanes[i] === hash` 的泳道 `waiting`。
   - 非空:节点泳道取 `min(waiting)`,颜色沿用该泳道。
   - 为空(新分支的顶端):取第一条空闲泳道(没有就追加),分配新颜色。
2. `incoming`:对 `waiting` 的每个 i 生成 `{from: i, to: 节点泳道}`;新顶端没有 incoming。
3. `through`:`lanes[i]` 在本行之前非空、且不在 `waiting` 中的泳道,生成整行竖线。
4. 清空 `waiting` 中的所有泳道(节点泳道随后可能被第一个父提交重新占用)。
5. 逐个处理父提交 p(第 k 个):
   - 若 p 已被某条泳道等待:`outgoing` 连到该泳道,不新开泳道。
   - 否则若 k = 0:p 占用节点泳道,颜色不变。
   - 否则:取第一条空闲泳道给 p,分配新颜色。
6. 去掉 `lanes` 末尾的 null,同步裁剪 `colors`。

分页续排:返回的 `state` 作为下一页的 `prev`,所以跨页泳道不会断开。列数 = 所有已加载行中涉及的最大泳道序号 + 1,由 UI 在渲染时统计,用于统一每行 SVG 的宽度。

## 8. 单行 SVG(`layout/row-svg.ts`)

`rowSvg(row, columns, isHead): string`,只拼数字和常量颜色,**不插入任何提交文本**,所以不存在注入面。

- 尺寸:宽 `columns × LANE_WIDTH`,高 `ROW_HEIGHT`(像素);泳道中心 x = `i × LANE_WIDTH + LANE_WIDTH / 2`,节点 y = `ROW_HEIGHT / 2`。
- `through`:竖线,顶到底。
- `incoming`:从 `(x(from), 0)` 到 `(x(lane), mid)`;同泳道为直线,跨泳道用三次贝塞尔曲线。
- `outgoing`:从 `(x(lane), mid)` 到 `(x(to), ROW_HEIGHT)`,画法同上。
- 节点:实心圆;当前 HEAD 所在提交为空心圆(与截图一致)。
- 颜色:`LANE_COLORS[color % LANE_COLORS.length]`。

## 9. 渲染与交互

`register.tsx` 注册两处:

- `session.start`:`$.command.register({ name: 'git-graph', description })`。
- `command.run`(matcher 为 `git-graph`):`$.ui.open({ id: PANE_ID, title: 'Git Graph' })`,并触发首次加载;返回 `{ text }`。
- `ui.render`(matcher 为 `{ component: 'Pane', requestId: PANE_ID }`):`e.surface !== 'desktop'` 时只画提示文案;否则按状态画整棵树。

Pane 树的结构(自上而下):

1. 工具栏:`Select`(分支,单选,`'*'` 为 Show All)、`Button`(☑/☐ Show Remote Branches)、`Button`(↻ Refresh)。
2. 表头:Graph / Description / Date / Author / Commit。
3. 提交行列表,每行如第 2 节所述。被展开的行下方紧跟详情区。
4. 底部:`hasMore` 时显示「加载更多」`Button`。
5. 状态为 `no-repo`、`error`、空列表时,以对应提示取代列表。

元素 key 约定(测试按 key 查找):`branch`、`remote`、`refresh`、`more`、`commit-<hash>`、`close-detail`、`parent-<hash>`、`row-<hash>`。

交互动作(都在 `controller.ts`,每个动作先用 `update` 写状态,再触发重绘):

| 动作 | 行为 |
|---|---|
| `loadFirst` | 检查仓库 → 读分支 → 读第一页 → 布局 → 写状态 |
| `loadMore` | 以当前 `commits.length` 为 skip 读下一页,用 `laneState` 续排,追加 |
| `selectBranch` | 校验成员 → 写入 `branch` → 清空列表 → `loadFirst` 流程 |
| `toggleRemote` | 切换 `isRemoteShown`;若当前 `branch` 是被隐藏的远程分支则回到 `'*'` → 重新加载 |
| `refresh` | 保持 `branch` 与 `isRemoteShown`,重新走 `loadFirst` |
| `toggleCommit` | 再点同一提交则收起;否则读取详情并写入 `expandedHash`、`detail` |
| 点击父提交 | 已加载:`$.ui.scroll({ to: { key: 'row-<hash>' }, in: PANE_ID })`;未加载:渲染为不可点击的 `Text` |

## 10. 错误处理

| 情形 | 处理 |
|---|---|
| 当前目录不是 git 仓库 | `status: 'no-repo'`,Pane 显示一句说明 |
| 本机没有 git 或进程无法启动 | `status: 'error'`,显示可读的错误信息(具体文案待定,见 PRD 待确认事项) |
| `isStdoutTruncated` | `status: 'error'`,提示单页输出过大 |
| git 退出码非 0 | `status: 'error'`,显示 stderr 的第一行,其余写入 debug 日志 |
| 详情读取失败 | 只写 `detailError`,不影响列表 |
| 非 desktop surface | 只显示「仅支持桌面应用」 |

任何错误都不抛出到引擎;不吞掉错误,都落到状态里供界面显示。

## 11. 测试策略

遵循 TDD(先写失败的测试)。

| 对象 | 方法 |
|---|---|
| `parse-log`、`parse-refs`、`parse-branches`、`parse-detail` | 手写文本夹具的单元测试,含空输出、特殊字符(主题里有 `\|`、中文)、合并提交、标签、`HEAD -> main`、二进制文件 `-\t-` |
| `lanes` | 手写小型提交图夹具:线性、单分叉合并、章鱼合并(3 个父提交)、多根、分页续排(分两批排与一次排结果一致) |
| `row-svg` | 断言生成的字符串包含期望的线段与节点,长度远低于 131072 |
| `run-git` | 白名单测试:传入 `commit`、`checkout`、`push` 等必须抛错;非法哈希和不在列表中的分支被拒绝 |
| 控制器与界面 | 在 `claude plugin test` 里用 `on('process.run', …)` 返回夹具输出,`$.ui.mount` 在 `desktop` 上挂载 Pane,用 `press`/`select` 驱动,断言状态与树;并在 `terminal` 上断言只有提示文案 |
| 整体 | `claude plugin validate .`、`tsc -p .`、`claude plugin test .` 全部通过 |

目视验收:在桌面应用里对照截图逐项检查。

## 12. 实现前必须先验证的事项(Task 0 探针)

这些行为类型声明里没有明确答案,先做最小探针,再决定实现:

1. **`Button` 在 desktop 上的外观。** 每行一个 `Button` 会不会显示成带边框的原生按钮。若很突兀,尝试 `plain` 和 `dimColor`,仍不行则退回到「提交行不可点击、行末加『详情』按钮」的方案,并回来修订本文第 2、9 节。
2. **`ROW_HEIGHT`(像素)与行高(单元)的换算。** 探针画若干相邻行的 SVG,目测竖线是否连续无缝,标定 `ROW_HEIGHT` 常量。
3. **300 行的 Pane 是否能流畅滚动,以及 `$.ui.scroll({ to: { key } })` 能否滚到指定行。**
4. **`Svg` 在 desktop 上的实际渲染**(颜色、抗锯齿、与文字垂直对齐)。

任一项不可行,先回到本文修订,再继续写计划。

## 13. 不在本文范围

写操作、搜索、自动刷新、多仓库、树形文件视图、分支多选、非 desktop surface 的完整支持(见 PRD 第 2.2 节)。
