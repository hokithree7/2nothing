# 🔴 硬编码的管理员密钥存在安全风险

## 基本信息
- **优先级**: 🔴 Critical
- **类型**: Security
- **影响范围**: 管理员接口（通知、分析）
- **预计工作量**: 30 分钟

## 问题描述

在管理员接口中发现硬编码的默认密钥，如果环境变量未设置，会使用已知的弱密钥：

**受影响文件**:
- `app/api/admin/notify/route.ts`
- `app/api/analytics/route.ts`

**问题代码**:
```typescript
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin-secret-key'

if (!ADMIN_KEY || token !== ADMIN_KEY) {
  return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}
```

## 安全风险

1. **已知弱密钥**: `'admin-secret-key'` 是容易猜测的默认值
2. **生产环境暴露**: 如果 `ADMIN_KEY` 环境变量未设置，任何人都可以访问管理员接口
3. **权限提升**: 攻击者可以发送通知、访问分析数据

## 复现步骤

1. 启动应用但不设置 `ADMIN_KEY` 环境变量
2. 发送请求到 `/api/analytics` 或 `/api/admin/notify`
3. 使用 `Authorization: Bearer admin-secret-key`
4. 成功获取管理员权限

## 建议解决方案

### 方案 1: 移除默认值（推荐）

```typescript
const ADMIN_KEY = process.env.ADMIN_KEY

if (!ADMIN_KEY) {
  throw new Error('ADMIN_KEY environment variable is required. Please set it in your .env file.')
}

if (token !== ADMIN_KEY) {
  return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}
```

### 方案 2: 启动时验证所有环境变量

创建 `lib/env.ts`:
```typescript
import { z } from 'zod'

const envSchema = z.object({
  ADMIN_KEY: z.string().min(32, 'ADMIN_KEY must be at least 32 characters'),
  // ... 其他环境变量
})

export const env = envSchema.parse(process.env)
```

在 `app/api/admin/*/route.ts` 中使用:
```typescript
import { env } from '@/lib/env'

if (token !== env.ADMIN_KEY) {
  return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
}
```

## 验收标准

- [ ] 移除所有硬编码的默认密钥
- [ ] 如果 `ADMIN_KEY` 未设置，应用启动失败或抛出明确错误
- [ ] 更新 `.env.example` 文件，添加 `ADMIN_KEY` 示例
- [ ] 文档中说明如何生成安全的 ADMIN_KEY（如 `openssl rand -hex 32`）

## 相关 Issue

- #8 环境变量缺少启动时验证

## 标签

`priority: critical`, `security`, `bug`
