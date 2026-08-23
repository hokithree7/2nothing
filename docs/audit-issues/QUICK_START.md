# 🚀 快速开始 - 提交 Issues 到 GitHub

这个文档帮助你快速将审计发现的问题提交到 GitHub Issues。

## 📋 准备工作

### 1. 确保安装 GitHub CLI（可选，推荐）

```bash
# Windows (使用 winget)
winget install --id GitHub.cli

# 或手动下载
# https://cli.github.com/

# 验证安装
gh --version
```

### 2. 登录 GitHub CLI

```bash
gh auth login
```

---

## 📤 提交方式

### 方式 1: 使用 GitHub CLI（最快）

**一次性提交所有 Critical Issues**:
```bash
cd docs/audit-issues

# Issue #1
gh issue create \
  --title "🔴 硬编码的管理员密钥存在安全风险" \
  --label "priority: critical,security,bug" \
  --body-file issue-01-hardcoded-admin-key.md

# Issue #2
gh issue create \
  --title "🔴 速率限制fail open行为导致绕过风险" \
  --label "priority: critical,security,bug" \
  --body-file issue-02-rate-limit-fail-open.md

# Issue #3
gh issue create \
  --title "🟡 API密钥恢复验证过于宽松" \
  --label "priority: high,security,enhancement" \
  --body-file issue-03-api-key-recovery-weak.md

# Issue #4
gh issue create \
  --title "🟡 图片生成API缺少速率限制检查" \
  --label "priority: high,security,resource-management,bug" \
  --body-file issue-04-image-generation-no-rate-limit.md

# Issue #6
gh issue create \
  --title "🟡 认证逻辑在15+文件中重复" \
  --label "priority: high,refactor,code-quality,technical-debt" \
  --body-file issue-06-duplicate-auth-logic.md
```

**批量提交脚本**（推荐）:
```bash
# create-issues.sh (如果你用 git bash)
#!/bin/bash

ISSUES=(
  "issue-01-hardcoded-admin-key.md:🔴 硬编码的管理员密钥存在安全风险:priority: critical,security,bug"
  "issue-02-rate-limit-fail-open.md:🔴 速率限制fail open行为导致绕过风险:priority: critical,security,bug"
  "issue-03-api-key-recovery-weak.md:🟡 API密钥恢复验证过于宽松:priority: high,security,enhancement"
  "issue-04-image-generation-no-rate-limit.md:🟡 图片生成API缺少速率限制检查:priority: high,security,bug"
  "issue-06-duplicate-auth-logic.md:🟡 认证逻辑在15+文件中重复:priority: high,refactor,code-quality"
)

for issue in "${ISSUES[@]}"; do
  IFS=':' read -r file title labels <<< "$issue"
  echo "Creating issue: $title"
  gh issue create --title "$title" --label "$labels" --body-file "$file"
  sleep 2  # 避免 API 速率限制
done

echo "✅ All issues created!"
```

---

### 方式 2: 手动复制粘贴（简单）

1. 打开 GitHub 仓库: https://github.com/hokithree7/2nothing/issues
2. 点击 "New issue"
3. 复制对应的 Markdown 文件内容
4. 标题格式: `🔴 硬编码的管理员密钥存在安全风险`
5. 添加标签（Labels）:
   - `priority: critical`
   - `security`
   - `bug`
6. 提交

---

### 方式 3: 使用 GitHub 项目看板（推荐用于管理）

**1. 创建项目看板**:
```bash
gh project create --owner hokithree7 --title "2nothing Security Audit" --format board
```

**2. 添加 Issues 到看板**:
```bash
# 获取所有带 security 标签的 issues
gh issue list --label "security" --json number,title

# 添加到项目
gh project item-add <project-number> --owner hokithree7 --url <issue-url>
```

**3. 设置列**:
- 🔴 Critical (Backlog)
- 🟡 High Priority
- 🟢 Medium Priority
- 🔵 Low Priority
- ✅ Done

---

## 🏷️ 标签系统

建议创建以下标签（在 GitHub 仓库设置中）:

| 标签 | 颜色 | 描述 |
|------|------|------|
| `priority: critical` | `#D73A4A` (红色) | 严重安全问题，立即修复 |
| `priority: high` | `#FF9800` (橙色) | 重要功能或安全问题 |
| `priority: medium` | `#FFC107` (黄色) | 代码质量、性能优化 |
| `priority: low` | `#03A9F4` (蓝色) | 可访问性、用户体验改进 |
| `security` | `#D73A4A` (红色) | 安全相关 |
| `bug` | `#D73A4A` (红色) | 功能缺陷 |
| `enhancement` | `#A2EEEF` (淡蓝) | 功能增强 |
| `refactor` | `#FBCA04` (黄色) | 代码重构 |
| `performance` | `#1D76DB` (蓝色) | 性能优化 |
| `accessibility` | `#5319E7` (紫色) | 可访问性 |
| `code-quality` | `#C5DEF5` (淡蓝) | 代码质量 |
| `technical-debt` | `#FBCA04` (黄色) | 技术债务 |

**快速创建标签**（GitHub CLI）:
```bash
gh label create "priority: critical" --color "D73A4A" --description "严重安全问题，立即修复"
gh label create "priority: high" --color "FF9800" --description "重要功能或安全问题"
gh label create "priority: medium" --color "FFC107" --description "代码质量、性能优化"
gh label create "priority: low" --color "03A9F4" --description "可访问性、用户体验改进"
gh label create "security" --color "D73A4A" --description "安全相关"
gh label create "refactor" --color "FBCA04" --description "代码重构"
gh label create "performance" --color "1D76DB" --description "性能优化"
gh label create "code-quality" --color "C5DEF5" --description "代码质量"
gh label create "technical-debt" --color "FBCA04" --description "技术债务"
gh label create "resource-management" --color "0E8A16" --description "资源管理"
```

---

## 📊 Issue 模板建议

创建 `.github/ISSUE_TEMPLATE/` 目录，添加以下模板：

### `security-issue.md`:
```markdown
---
name: 🔴 安全问题
about: 报告安全漏洞或安全相关问题
title: '[SECURITY] '
labels: security, priority: critical
assignees: ''
---

## 安全风险描述
<!-- 详细描述安全问题 -->

## 受影响文件
<!-- 列出受影响的文件和代码行 -->

## 复现步骤
1. 
2. 
3. 

## 建议修复方案
<!-- 提供具体的修复建议 -->

## 验收标准
- [ ] 
- [ ] 
- [ ] 
```

### `bug-report.md`:
```markdown
---
name: 🐛 Bug 报告
about: 报告功能缺陷
title: '[BUG] '
labels: bug
assignees: ''
---

## Bug 描述
<!-- 简洁描述问题 -->

## 复现步骤
1. 
2. 
3. 

## 预期行为
<!-- 应该发生什么 -->

## 实际行为
<!-- 实际发生了什么 -->

## 环境信息
- 浏览器: 
- 操作系统: 
- Node 版本: 
```

---

## 📝 提交后的工作流程

### 1. Argo（开发者）处理流程

```bash
# 1. 查看所有待处理 issues
gh issue list --label "priority: critical"

# 2. 选择一个 issue 开始工作
gh issue develop <issue-number> --checkout

# 3. 完成后关联提交
git commit -m "fix: 修复硬编码管理员密钥 (closes #1)"

# 4. 推送并创建 PR
git push origin <branch-name>
gh pr create --title "修复 #1: 硬编码管理员密钥" --body "Fixes #1"

# 5. PR 合并后自动关闭 issue
```

### 2. 协作模式

- **Kiro (我)**: 审计、报告、建议方案
- **Argo**: 执行修复、测试、部署
- **hokithree7**: 最终审核、决策

### 3. Issue 状态管理

使用项目看板自动化：
- Issue 创建 → 自动加到 Backlog
- PR 关联 → 自动移到 In Progress
- PR 合并 → 自动移到 Done
- Issue 关闭 → 自动归档

---

## ✅ 检查清单

提交前确认：
- [ ] 标题清晰，包含优先级 emoji
- [ ] 添加了正确的标签
- [ ] 问题描述完整（文件、代码、风险）
- [ ] 提供了具体的修复方案
- [ ] 设置了验收标准
- [ ] 评估了工作量

---

## 🔗 快速链接

- [GitHub Issues](https://github.com/hokithree7/2nothing/issues)
- [GitHub Projects](https://github.com/hokithree7/2nothing/projects)
- [审计报告 README](./README.md)
- [GitHub CLI 文档](https://cli.github.com/manual/)

---

## 💡 提示

1. **优先处理 Critical Issues**: 安全问题应该立即修复
2. **一次只做一个 Issue**: 避免 PR 过大难以审查
3. **测试后再提交**: 确保修复不引入新问题
4. **更新文档**: 修复后更新 AGENTS.md 的 Recent Changes
5. **关联 Commit**: 使用 `closes #N` 或 `fixes #N` 自动关闭 issue

---

有任何问题随时询问！🚀
