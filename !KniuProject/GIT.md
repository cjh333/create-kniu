# Git 操作说明

当前本地分支为 `main`，远程名为 `master`。

### 查看状态
```bash
git status
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

### 拉取远程分支
```bash
git pull origin master
```

### 合并到本地分支
```bash
git merge main
```

### 推送到远程分支
```bash
git push origin main:master
```