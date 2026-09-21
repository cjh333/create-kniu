# Git 操作说明

当前本地分支为 `main`，远程名为 `origin`。提交前先检查状态和差异，确认没有把 `dist/`、运行时数据或其他用户改动一并提交。

### 查看状态
```bash
git status --short
git diff --check
```
### 添加
```bash
git add .
```
### 备注
```bash
git commit -m "XXX"
```
### 拉取远程 main
```bash
git pull --rebase origin main
```

### 合并其它分支
```bash
git merge <branch-name>
```

### 推送当前 main
```bash
git push origin main
```

除非明确确认远程历史和覆盖范围，否则不要使用强制推送。