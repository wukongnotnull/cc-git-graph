@AGENTS.md

# Claude Code 补充说明

项目规范都在上面引用的 [AGENTS.md](AGENTS.md) 里,这里只写 Claude Code 特有的几点。

- 用 `claude plugin validate .` 校验 mod;`claude plugin test .` 需要较新的 Claude Code(桌面应用自带的版本可用,PATH 上的旧版本没有这个子命令)。本机跑不了测试时,以 CI 为准。
- 这个仓库就是被加载的 mod:`~/.claude/settings.json` 的 `CLAUDE_CODE_PLUGIN_DIRS` 指向本仓库后,改动在会话里热重载;改完后让用户重载再看界面效果,不要声称已经在桌面应用里验证过。
- `PRD.md`、`README.md` 和代码要保持一致;改了行为就一起改。
- 合并 PR 需要用户明确要求;合并前先看 CI 状态,没通过或还在跑时要告诉用户。
