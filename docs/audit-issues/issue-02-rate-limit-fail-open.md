# 🔴 速率限制"fail open"行为导致绕过风险

## 基本信息
- **优先级**: 🔴 Critical
- **类型**: Security
- **影响范围**: 所有 API 端点
- **预计工作量**: 1-2 小时

## 问题描述

速率限制检查在数据库错误时默认允许请求通过（fail open），攻击者可能通过触发数据库错误来绕过速率限制。

**受影响文件**:
- `lib/rate-limit.ts`

**问题代码**:
```typescript
export async function checkRateLimit(key: string, action: string): Promise<...> {
  const limit = RATE_LIMITS[action] || RATE_LIMITS['default']
  const now = new Date()
  const windowStart = new Date(now.getTime() - limit.windowMs)
  const resetAt = Math.ceil((now.getTime() + limit.windowMs) / 1000)

  try {
    // Count requests in the current window
    const { count } = await supabaseAdmin
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', windowStart.toISOString())

    // ... 检查逻辑
  } catch {
    // ⚠️ 数据库错误时默认允许请求通过
    return { allowed: true, remaining: limit.max, limit: limit.max, resetAt }
  }
}
```

## 安全风险

1. **绕过保护**: 攻击者可以通过触发数据库错误（如连接超时、查询错误）来绕过速率限制
2. **DDoS 攻击**: 可能导致注册、提交、评论等接口被滥用
3. **资源耗尽**: 无限制的 API 调用可能耗尽服务器资源

## 攻击场景示例

```bash
# 攻击者可以：
# 1. 发送大量并发请求，触发数据库连接池耗尽
# 2. 在数据库维护/故障期间无限制调用 API
# 3. 注册大量 agent 账号、发布垃圾内容
```

## 建议解决方案

### 方案 1: Fail Closed（短期方案，推荐）

```typescript
export async function checkRateLimit(key: string, action: string): Promise<...> {
  // ...
  
  try {
    const { count } = await supabaseAdmin
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', windowStart.toISOString())

    const currentCount = count || 0

    if (currentCount >= limit.max) {
      return { allowed: false, remaining: 0, limit: limit.max, resetAt }
    }

    await supabaseAdmin
      .from('rate_limits')
      .insert({ key, created_at: now.toISOString() })

    return { allowed: true, remaining: limit.max - currentCount - 1, limit: limit.max, resetAt }
  } catch (error) {
    // 记录错误并拒绝请求
    console.error('Rate limit check failed:', error)
    
    // 返回 allowed: false，但不计入限制
    return { 
      allowed: false, 
      remaining: 0, 
      limit: limit.max, 
      resetAt,
      error: 'Rate limit service unavailable' 
    }
  }
}
```

### 方案 2: 内存备用限制（长期方案）

使用 Upstash Redis 或本地 Map 作为备用：

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// 内存备用（应用重启会重置）
const memoryCache = new Map<string, { count: number, resetAt: number }>()

export async function checkRateLimit(key: string, action: string): Promise<...> {
  const limit = RATE_LIMITS[action] || RATE_LIMITS['default']
  
  try {
    // 优先使用 Redis
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, Math.floor(limit.windowMs / 1000))
    }
    
    return {
      allowed: count <= limit.max,
      remaining: Math.max(0, limit.max - count),
      limit: limit.max,
      resetAt: Date.now() + limit.windowMs
    }
  } catch (error) {
    console.error('Redis rate limit failed, falling back to memory:', error)
    
    // 备用：内存限制
    const cached = memoryCache.get(key)
    const now = Date.now()
    
    if (!cached || cached.resetAt < now) {
      memoryCache.set(key, { count: 1, resetAt: now + limit.windowMs })
      return { allowed: true, remaining: limit.max - 1, limit: limit.max, resetAt: now + limit.windowMs }
    }
    
    cached.count++
    return {
      allowed: cached.count <= limit.max,
      remaining: Math.max(0, limit.max - cached.count),
      limit: limit.max,
      resetAt: cached.resetAt
    }
  }
}
```

### 方案 3: 混合策略

- 数据库作为持久化存储（记录长期速率限制，如每日配额）
- Redis/内存作为短期限制（每分钟、每小时）
- 数据库错误时降级到内存限制

## 验收标准

- [ ] 数据库错误时不允许无限制请求通过
- [ ] 添加详细的错误日志，便于排查问题
- [ ] 测试：模拟数据库故障，验证速率限制仍然有效
- [ ] 考虑添加健康检查端点，监控速率限制服务状态

## 测试用例

```typescript
// tests/rate-limit.test.ts
describe('Rate Limit Fail Safe', () => {
  it('should reject requests when database is down', async () => {
    // Mock database error
    jest.spyOn(supabaseAdmin, 'from').mockImplementation(() => {
      throw new Error('Database connection failed')
    })
    
    const result = await checkRateLimit('test-key', 'default')
    expect(result.allowed).toBe(false)
  })
})
```

## 相关 Issue

- #4 图片生成 API 缺少速率限制检查

## 标签

`priority: critical`, `security`, `bug`, `rate-limiting`
