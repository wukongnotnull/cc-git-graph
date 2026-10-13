# cc-git-graph

使用 Claude Code 开发的 Git 图谱项目(开发中)。

## 开发环境

本项目在 `.claude/settings.json` 中以项目级方式启用了插件 [wukong-code](https://github.com/wukongnotnull/wukong-code)(来自市场 `wukong-code-dev`),提供 TDD、系统化调试、计划编写等技能。

克隆仓库后用 Claude Code 打开并信任该项目,按提示安装插件即可。也可以手动安装:

```bash
claude plugin marketplace add wukongnotnull/wukong-code --scope project
claude plugin install wukong-code@wukong-code-dev --scope project
```
