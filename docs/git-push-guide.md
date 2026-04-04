# Git 代码推送指南

本文档介绍如何将本地代码修改推送到 GitHub 远程仓库。

---

## 基本概念

Git 推送分为三步，可以理解为：**打包 → 贴标签 → 寄出去**。

```
工作区（你的文件）  →  暂存区（准备提交的文件）  →  本地仓库（提交记录）  →  远程仓库（GitHub）
       git add              git commit                   git push
```

---

## 日常推送流程

### 第 1 步：查看修改了哪些文件

```bash
git status
```

输出示例：
```
Changes not staged for commit:
  modified:   frontend/components/AppHeader.tsx
  modified:   frontend/app/globals.css

Untracked files:
  frontend/components/NewComponent.tsx
```

- `modified` = 已有文件被修改
- `Untracked files` = 新建的文件，Git 还不认识它

> **小技巧**：用 `git status --short` 可以看到更简洁的输出。

---

### 第 2 步：把文件加入暂存区

```bash
# 添加所有修改和新文件（最常用）
git add -A

# 或者只添加某个具体文件
git add frontend/components/AppHeader.tsx

# 或者添加某个目录下的所有文件
git add frontend/
```

| 命令 | 效果 |
|------|------|
| `git add -A` | 添加所有改动（新增、修改、删除） |
| `git add .` | 添加当前目录及子目录的改动 |
| `git add 文件路径` | 只添加指定文件 |

---

### 第 3 步：提交到本地仓库

```bash
git commit -m "描述你做了什么"
```

**提交信息写法建议**：

```bash
# 简单写法
git commit -m "修复搜索栏样式问题"

# 规范写法（推荐）
git commit -m "feat(frontend): 新增深色主题设计系统"
git commit -m "fix(backend): 修复 A 股行情解析异常"
git commit -m "docs: 更新部署文档"
```

常用前缀：
| 前缀 | 含义 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 新增自选股功能` |
| `fix` | 修复 bug | `fix: 修复新闻列表不显示的问题` |
| `docs` | 文档变更 | `docs: 更新 README` |
| `style` | 样式调整（不影响逻辑） | `style: 调整卡片间距` |
| `refactor` | 代码重构（不改功能） | `refactor: 拆分首页组件` |

---

### 第 4 步：推送到 GitHub

```bash
git push origin main
```

- `origin` = 远程仓库的名字（默认就是 origin）
- `main` = 分支名（本项目的主分支是 main）

推送成功后你会看到类似输出：
```
Enumerating objects: 37, done.
Writing objects: 100% (37/37), done.
   8c4f3c2..ce26241  main -> main
```

---

## 完整的一次性推送命令

如果你确定要推送所有修改，可以三条命令连着执行：

```bash
git add -A
git commit -m "你的提交信息"
git push origin main
```

或者写成一行（用 `&&` 连接）：

```bash
git add -A && git commit -m "你的提交信息" && git push origin main
```

---

## 推送前先看看改了什么

```bash
# 查看哪些文件被修改（简要）
git status --short

# 查看具体改了什么内容（逐行对比）
git diff

# 查看已经 add 但还没 commit 的内容
git diff --cached

# 查看最近几次提交记录
git log --oneline -5
```

---

## 常见问题

### Q：推送时提示 "rejected" 怎么办？

```
! [rejected]  main -> main (fetch first)
```

这说明远程仓库有别人推送的新内容，你需要先拉取：

```bash
git pull origin main
```

如果没有冲突，拉取完再推送即可。如果有冲突，需要手动解决后再提交。

---

### Q：不小心 commit 了不想要的文件怎么办？

```bash
# 撤销最近一次 commit（保留文件修改）
git reset --soft HEAD~1
```

执行后文件修改还在，只是 commit 被撤销了，你可以重新 add 和 commit。

---

### Q：想看远程仓库地址是什么？

```bash
git remote -v
```

输出示例：
```
origin  https://github.com/你的用户名/ai-stock-research-platform.git (fetch)
origin  https://github.com/你的用户名/ai-stock-research-platform.git (push)
```

---

### Q：想查看所有分支？

```bash
# 查看本地分支
git branch

# 查看所有分支（包括远程）
git branch -a
```

---

## 本项目的自动部署

推送到 GitHub 后会自动触发部署：

| 服务 | 部署方式 | 说明 |
|------|----------|------|
| **Vercel**（前端） | GitHub 集成自动部署 | 推送后 1~2 分钟自动构建上线 |
| **Render**（后端） | GitHub 集成自动部署 | 推送后自动重新部署后端 |

你只需要 `git push origin main`，线上环境就会自动更新，不需要手动操作服务器。
