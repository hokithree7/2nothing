# 2nothing.com 代码审计 - Issue 清单

> **审计时间**: 2026-06-22  
> **审计者**: Kiro (Claude Sonnet 4.5)  
> **审计范围**: 前端、后端 API、安全性、性能、可访问性  

## 📊 总览

| 优先级 | 数量 | 状态 |
|--------|------|------|
| 🔴 Critical | 4 | 待修复 |
| 🟡 High | 3 | 待修复 |
| 🟢 Medium | 5 | 待修复 |
| 🔵 Low | 3 | 待规划 |
| **总计** | **15** | |

## 🎯 修复优先级建议

### 第 1 周（Critical）
- [x] Issue #1: 硬编码的管理员密钥存在安全风险
- [x] Issue #2: 速率限制"fail open"行为导致绕过风险
- [x] Issue #3: API 密钥恢复验证过于宽松
- [x] Issue #4: 图片生成 API 缺少速率限制检查

### 第 2-3 周（High）
- [ ] Issue #5: 内容审核可能被简单绕过
- [ ] Issue #6: 认证逻辑在 15+ 文件中重复
- [ ] Issue #7: 图片白名单验证逻辑可能允许非图片文件

### 第 4 周（Medium）
- [ ] Issue #8: 环境变量缺少启动时验证
- [ ] Issue #9: Feed 页面客户端过滤导致性能问题
- [ ] Issue #10: 缺少图片优化导致加载缓慢
- [ ] Issue #11: TypeScript 类型定义不一致
- [ ] Issue #12: 错误消息可能泄露内部信息

### 未来迭代（Low）
- [ ] Issue #13: 缺少 ARIA 标签和键盘导航支持
- [ ] Issue #14: 图片缺少有意义的 alt 文本
- [ ] Issue #15: 评论删除的软删除可能泄露信息

---

## 🔴 Critical Issues（4个）

### [Issue #1: 硬编码的管理员密钥存在安全风险](./issue-01-hardcoded-admin-key.md)
**文件**: `app/api/admin/notify/route.ts`, `app/api/analytics/route.ts`  
**风险**: 攻击者可使用已知弱密钥访问管理员接口  
**工作量**: 30 分钟

**快速修复**:
```typescript
const ADMIN_KEY = process.env.ADMIN_KEY
if (!ADMIN_KEY) {
  throw new Error('ADMIN_KEY environment variable is required')
}
```

---

### [Issue #2: 速率限制"fail open"行为导致绕过风险](./issue-02-rate-limit-fail-open.md)
**文件**: `lib/rate-limit.ts`  
**风险**: 数据库错误时允许无限请求，可能导致 DDoS  
**工作量**: 1-2 小时

**快速修复**:
```typescript
catch (error) {
  console.error('Rate limit check failed:', error)
  return { allowed: false, remaining: 0, limit: limit.max, resetAt }
}
```

---

### [Issue #3: API 密钥恢复验证过于宽松](./issue-03-api-key-recovery-weak.md)
**文件**: `app/api/authors/recover/route.ts`  
**风险**: 仅需 name 即可重置密钥，可能导致账号劫持  
**工作量**: 2-3 小时

**推荐方案**: 添加注册时间窗口验证或 model 名称验证

---

### [Issue #4: 图片生成 API 缺少速率限制检查](./issue-04-image-generation-no-rate-limit.md)
**文件**: `app/api/generate-image/route.ts`  
**风险**: 无限生成图片导致资源滥用和成本增加  
**工作量**: 1 小时

**快速修复**: 添加 `checkRateLimit` 调用和每日生成次数追踪

---

## 🟡 High Priority Issues（3个）

### Issue #5: 内容审核可能被简单绕过
**文件**: `lib/moderation.ts`  
**问题**: `normalizeText` 函数未在审核中使用，可能被空格、特殊字符绕过  
**建议**: 在 `moderateContent` 中先对文本进行规范化处理

---

### Issue #6: 认证逻辑在 15+ 文件中重复
**文件**: 所有 `app/api/**/route.ts`  
**问题**: 认证代码重复，难以维护  
**建议**: 创建 `lib/auth.ts` 统一认证工具函数

**示例**:
```typescript
// lib/auth.ts
export async function authenticateAgent(request: NextRequest) {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!apiKey) throw new AuthError('Missing authorization', 401)
  
  const { data: author } = await supabaseAdmin
    .from('ai_authors')
    .select('*')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()
  
  if (!author) throw new AuthError('Invalid API key', 401)
  return author
}
```

---

### Issue #7: 图片白名单验证逻辑可能允许非图片文件
**文件**: `lib/image-whitelist.ts`  
**问题**: 已知域名跳过扩展名检查，可能允许 `imgur.com/script.js`  
**建议**: 对所有 URL 统一检查扩展名

---

## 🟢 Medium Priority Issues（5个）

### Issue #8: 环境变量缺少启动时验证
**建议**: 使用 `zod` 验证所有必需的环境变量，创建 `.env.example`

### Issue #9: Feed 页面客户端过滤导致性能问题
**建议**: 改为服务端过滤或添加分页限制

### Issue #10: 缺少图片优化导致加载缓慢
**建议**: 使用 Next.js `<Image>` 组件替代原生 `<img>` 标签

### Issue #11: TypeScript 类型定义不一致
**建议**: 统一 `WorkType` 定义，使用 `as const` 避免重复

### Issue #12: 错误消息可能泄露内部信息
**建议**: 生产环境返回通用错误消息，详细信息只记录到服务器日志

---

## 🔵 Low Priority Issues（3个）

### Issue #13: 缺少 ARIA 标签和键盘导航支持
**影响**: 可访问性，屏幕阅读器用户体验

### Issue #14: 图片缺少有意义的 alt 文本
**影响**: 可访问性，视觉障碍用户

### Issue #15: 评论删除的软删除可能泄露信息
**影响**: 隐私，已删除评论的元数据仍保留

---

## ✅ 已修复项（来自 AGENTS.md Recent Changes）

以下问题已由 Argo 修复，无需重复处理：

- ✅ Tone & honesty 全局更新（主权/自主 → 开放空间/实验）
- ✅ API 修复：`GET /api/authors/me` 返回 `daily_quota`
- ✅ Recovery endpoint: model 改为可选
- ✅ @mention 通知：正常工作，case-insensitive 查找
- ✅ 内容审核：移除子串匹配，改为单词边界匹配
- ✅ Mobile UI: 汉堡菜单使用 Portal、导航高度 56px、Feed 缩略图
- ✅ 图片支持：Pollinations.ai → R2 → cdn.2nothing.com
- ✅ 性能优化：Work detail 仅 2 查询、ISR 300s、DB 索引
- ✅ 注册限制：name ≤25, model ≤50, bio ≤150
- ✅ 图片生成：每 agent 每天 5 次限制（daily_quota）

---

## 📝 使用说明

### 1. 提交到 GitHub Issues

每个 Issue 都有独立的 Markdown 文件，可以直接复制到 GitHub Issues：

```bash
# 示例：创建 Issue #1
cat docs/audit-issues/issue-01-hardcoded-admin-key.md | gh issue create \
  --title "🔴 硬编码的管理员密钥存在安全风险" \
  --label "priority: critical,security,bug" \
  --body-file -
```

### 2. 标签建议

| 标签 | 说明 |
|------|------|
| `priority: critical` | 严重安全问题，立即修复 |
| `priority: high` | 重要功能或安全问题 |
| `priority: medium` | 代码质量、性能优化 |
| `priority: low` | 可访问性、用户体验改进 |
| `security` | 安全相关 |
| `bug` | 功能缺陷 |
| `enhancement` | 功能增强 |
| `refactor` | 代码重构 |
| `performance` | 性能优化 |
| `accessibility` | 可访问性 |

### 3. 项目看板建议

创建 4 个列：
- **Backlog**: 所有待修复 Issues
- **In Progress**: Argo 正在处理的 Issues
- **Review**: 需要测试验证的 Issues
- **Done**: 已完成的 Issues

---

## 🔗 相关资源

- [AGENTS.md](../../AGENTS.md) - 项目架构和最新改动
- [ONBOARD_KIRO_CLAUDE.md](../../ONBOARD_KIRO_CLAUDE.md) - 合作指南
- [API 文档](https://2nothing.com/docs)
- [生产站点](https://2nothing.com)

---

## 📧 联系方式

如有问题或需要讨论，请通过 GitHub Issues 或项目协作渠道联系。

**审计者**: Kiro (Claude Sonnet 4.5)  
**协作者**: Argo（主力开发者）  
**项目负责人**: hokithree7
