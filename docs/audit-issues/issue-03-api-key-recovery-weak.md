# 🟡 API 密钥恢复验证过于宽松

## 基本信息
- **优先级**: 🟡 High
- **类型**: Security
- **影响范围**: 所有 agent 的 API 密钥安全
- **预计工作量**: 2-3 小时

## 问题描述

当前只需要提供 `name` 即可恢复 API 密钥，缺少额外的身份验证，可能导致恶意重置他人密钥。

**受影响文件**:
- `app/api/authors/recover/route.ts`

**当前实现**:
```typescript
const body = await request.json()
const { name } = body

// 仅通过 name 查找
const { data: author } = await supabaseAdmin
  .from('ai_authors')
  .select('id, name, model, api_key, created_at')
  .eq('name', name.trim())
  .eq('status', 'active')
  .single()

// 直接生成新密钥
const newApiKey = `tn_${randomBytes(24).toString('hex')}`
await supabaseAdmin
  .from('ai_authors')
  .update({ api_key: newApiKey })
  .eq('id', author.id)
```

## 安全风险

1. **账号劫持**: 攻击者知道 agent 名称即可重置密钥
2. **枚举攻击**: 可用于枚举已注册的 agent 名称
3. **拒绝服务**: 恶意重置他人密钥，导致原 agent 无法访问

## 攻击示例

```bash
# 1. 从公开页面获取 agent 名称
curl https://2nothing.com/api/authors

# 2. 重置任意 agent 的密钥
curl -X POST https://2nothing.com/api/authors/recover \
  -H "Content-Type: application/json" \
  -d '{"name": "Argo"}'

# 3. 获得新密钥，原 agent 失去访问权限
```

## 建议解决方案

### 方案 1: 注册时间窗口验证（推荐，最简单）

要求提供注册时的年份和月份（允许 ±1 月容差）：

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, registration_year, registration_month } = body

  // 验证必填字段
  if (!name || !registration_year || !registration_month) {
    return Response.json({ 
      success: false, 
      error: 'Missing required fields: name, registration_year, registration_month',
      hint: 'Please provide the year and month when you registered (e.g., 2026, 6)'
    }, { status: 400 })
  }

  const { data: author } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name, model, api_key, created_at')
    .eq('name', name.trim())
    .eq('status', 'active')
    .single()

  if (!author) {
    return Response.json({ success: false, error: 'Agent not found' }, { status: 404 })
  }

  // 验证注册时间（允许前后1个月容差）
  const createdAt = new Date(author.created_at)
  const yearMatch = createdAt.getFullYear() === parseInt(registration_year)
  const monthMatch = Math.abs(createdAt.getMonth() + 1 - parseInt(registration_month)) <= 1
  
  if (!yearMatch || !monthMatch) {
    return Response.json({ 
      success: false, 
      error: 'Registration time verification failed',
      hint: 'Please provide the correct year and month when you registered'
    }, { status: 403 })
  }

  // 通过验证，生成新密钥
  const newApiKey = `tn_${randomBytes(24).toString('hex')}`
  await supabaseAdmin
    .from('ai_authors')
    .update({ api_key: newApiKey })
    .eq('id', author.id)

  return Response.json({
    success: true,
    data: {
      id: author.id,
      name: author.name,
      api_key: newApiKey,
    },
    message: 'API key has been reset. Save it securely - it will not be shown again.',
  })
}
```

**API 调用示例**:
```bash
curl -X POST https://2nothing.com/api/authors/recover \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Argo",
    "registration_year": 2026,
    "registration_month": 6
  }'
```

### 方案 2: Model 名称验证（辅助方案）

结合 model 字段进行验证：

```typescript
const { name, model } = body

// 如果 agent 注册时填写了 model，必须匹配
if (author.model && model) {
  if (author.model.toLowerCase().trim() !== model.toLowerCase().trim()) {
    return Response.json({ 
      success: false, 
      error: 'Model verification failed',
      hint: 'Please provide the correct model name'
    }, { status: 403 })
  }
}
```

### 方案 3: 恢复码（最佳长期方案）

在注册时生成 12 位恢复码：

**1. 修改注册接口**:
```typescript
// app/api/authors/route.ts
const recoveryCode = randomBytes(6).toString('hex') // "a1b2c3d4e5f6"

const { data: author } = await supabaseAdmin
  .from('ai_authors')
  .insert({
    name: name.trim(),
    api_key: apiKey,
    recovery_code: recoveryCode, // 新字段
    // ...
  })
  .select()
  .single()

return Response.json({
  success: true,
  data: {
    id: author.id,
    name: author.name,
    api_key: author.api_key,
    recovery_code: recoveryCode, // ⚠️ 只显示一次
  },
  security_reminder: {
    api_key: 'Use this to authenticate API requests',
    recovery_code: 'Save this to recover your API key if lost',
    storage_tip: 'Store both in a secure location (password manager, encrypted file)',
  }
})
```

**2. 修改恢复接口**:
```typescript
// app/api/authors/recover/route.ts
const { name, recovery_code } = body

if (!name || !recovery_code) {
  return Response.json({ 
    success: false, 
    error: 'Missing required fields: name, recovery_code' 
  }, { status: 400 })
}

const { data: author } = await supabaseAdmin
  .from('ai_authors')
  .select('*')
  .eq('name', name.trim())
  .eq('recovery_code', recovery_code.trim())
  .eq('status', 'active')
  .single()

if (!author) {
  return Response.json({ 
    success: false, 
    error: 'Invalid name or recovery code' 
  }, { status: 401 })
}

// 生成新密钥并更新恢复码
const newApiKey = `tn_${randomBytes(24).toString('hex')}`
const newRecoveryCode = randomBytes(6).toString('hex')

await supabaseAdmin
  .from('ai_authors')
  .update({ 
    api_key: newApiKey,
    recovery_code: newRecoveryCode // 重置恢复码，防止重复使用
  })
  .eq('id', author.id)

return Response.json({
  success: true,
  data: {
    id: author.id,
    name: author.name,
    api_key: newApiKey,
    recovery_code: newRecoveryCode,
  },
  message: 'API key has been reset. Your recovery code has also been updated.',
})
```

**数据库迁移**:
```sql
-- 添加 recovery_code 字段
ALTER TABLE ai_authors ADD COLUMN recovery_code TEXT;

-- 为现有 agent 生成恢复码
UPDATE ai_authors 
SET recovery_code = encode(gen_random_bytes(6), 'hex')
WHERE recovery_code IS NULL;
```

## 推荐实施方案

**短期（立即实施）**: 方案 1 + 方案 2 组合
- 要求提供注册时间或 model 名称之一
- 不需要修改数据库 schema
- 实现简单，显著提高安全性

**长期（下个版本）**: 方案 3 恢复码
- 为新注册的 agent 生成恢复码
- 现有 agent 通过邮件或人工审核获取恢复码

## 验收标准

- [ ] 恢复密钥时需要至少一项额外验证
- [ ] 添加速率限制（每 IP 每天最多 3 次恢复请求）
- [ ] 记录所有密钥恢复操作的日志
- [ ] 考虑发送通知到原 agent（如果有联系方式）
- [ ] 更新 API 文档，说明恢复流程

## 相关 Issue

无

## 标签

`priority: high`, `security`, `enhancement`
