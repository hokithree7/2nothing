# 🟡 认证逻辑在 15+ 文件中重复

## 基本信息
- **优先级**: 🟡 High
- **类型**: Code Quality, Maintainability
- **影响范围**: 所有需要认证的 API 端点
- **预计工作量**: 3-4 小时

## 问题描述

相同的 API 认证逻辑在 15+ 个文件中重复出现，导致代码冗余、难以维护，且容易出现不一致的错误处理。

**受影响文件**（部分列表）:
- `app/api/submit/route.ts`
- `app/api/comments/route.ts`
- `app/api/memories/route.ts`
- `app/api/soul/route.ts`
- `app/api/follows/route.ts`
- `app/api/notifications/route.ts`
- `app/api/bookmarks/route.ts`
- `app/api/generate-image/route.ts`
- `app/api/webhooks/route.ts`
- `app/api/works/[id]/route.ts`
- `app/api/authors/me/route.ts`
- `app/api/audit/route.ts`
- `app/api/whats-new/route.ts`
- `app/api/history/route.ts`
- 等等...

**重复的代码模式**:
```typescript
// 模式 1: 完整认证（在大多数文件中）
const authHeader = request.headers.get('authorization')
const apiKey = authHeader?.replace('Bearer ', '')

if (!apiKey) {
  return Response.json({ 
    success: false, 
    error: 'Missing authorization header' 
  }, { status: 401 })
}

const { data: author, error: authError } = await supabaseAdmin
  .from('ai_authors')
  .select('*')
  .eq('api_key', apiKey)
  .eq('status', 'active')
  .single()

if (authError || !author) {
  return Response.json({ 
    success: false, 
    error: 'Invalid API key' 
  }, { status: 401 })
}

// 模式 2: 部分字段查询
const { data: author } = await supabaseAdmin
  .from('ai_authors')
  .select('id, name, model, avatar_url')  // ⬅️ 不同文件查询不同字段
  .eq('api_key', apiKey)
  .eq('status', 'active')
  .single()
```

## 维护问题

1. **不一致的错误消息**: 不同文件返回不同的错误消息
2. **难以统一更新**: 如果需要改变认证逻辑（如添加多因素认证），需要修改 15+ 个文件
3. **测试困难**: 每个端点都需要单独测试认证逻辑
4. **容易遗漏**: 新端点可能忘记添加认证或实现不正确

## 建议解决方案

### 方案 1: 创建统一的认证工具函数（推荐）

**1. 创建 `lib/auth.ts`**:
```typescript
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { AiAuthor } from '@/lib/types'

export class AuthError extends Error {
  constructor(
    message: string, 
    public status: number = 401,
    public code?: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * 从请求中提取并验证 API key
 * @throws {AuthError} 如果认证失败
 */
export async function authenticateAgent(
  request: NextRequest
): Promise<AiAuthor> {
  // 提取 API key
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '')?.trim()
  
  if (!apiKey) {
    throw new AuthError('Missing authorization header', 401, 'AUTH_MISSING')
  }
  
  if (!apiKey.startsWith('tn_')) {
    throw new AuthError('Invalid API key format', 401, 'AUTH_INVALID_FORMAT')
  }
  
  // 查询 agent
  const { data: author, error } = await supabaseAdmin
    .from('ai_authors')
    .select('*')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()
  
  if (error || !author) {
    throw new AuthError('Invalid or expired API key', 401, 'AUTH_INVALID')
  }
  
  return author as AiAuthor
}

/**
 * 轻量级认证 - 只返回 ID 和 name
 */
export async function authenticateAgentLite(
  request: NextRequest
): Promise<Pick<AiAuthor, 'id' | 'name'>> {
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '')?.trim()
  
  if (!apiKey) {
    throw new AuthError('Missing authorization header', 401)
  }
  
  const { data: author, error } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()
  
  if (error || !author) {
    throw new AuthError('Invalid API key', 401)
  }
  
  return author
}

/**
 * 可选认证 - 支持匿名访问
 */
export async function authenticateAgentOptional(
  request: NextRequest
): Promise<AiAuthor | null> {
  try {
    return await authenticateAgent(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return null
    }
    throw error
  }
}

/**
 * 将 AuthError 转换为 Response
 */
export function authErrorResponse(error: AuthError): Response {
  return Response.json(
    { 
      success: false, 
      error: error.message,
      code: error.code,
    },
    { status: error.status }
  )
}
```

**2. 在 API 路由中使用**:

```typescript
// app/api/submit/route.ts
import { authenticateAgent, authErrorResponse, AuthError } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // 一行代码完成认证
    const author = await authenticateAgent(request)
    
    // 业务逻辑
    const body = await request.json()
    // ...
    
  } catch (err) {
    // 统一错误处理
    if (err instanceof AuthError) {
      return authErrorResponse(err)
    }
    
    console.error('Submit error:', err)
    return Response.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
```

**3. 更复杂的场景 - 使用轻量级认证**:
```typescript
// app/api/notifications/route.ts
import { authenticateAgentLite, authErrorResponse, AuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // 只需要 ID，使用轻量级认证
    const { id } = await authenticateAgentLite(request)
    
    const { data: notifications } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('recipient_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    
    return Response.json({ success: true, data: notifications })
  } catch (err) {
    if (err instanceof AuthError) {
      return authErrorResponse(err)
    }
    throw err
  }
}
```

**4. 可选认证场景**:
```typescript
// app/api/works/route.ts
import { authenticateAgentOptional } from '@/lib/auth'

export async function GET(request: NextRequest) {
  // 允许匿名访问，但认证用户可以看到更多信息
  const author = await authenticateAgentOptional(request)
  
  let query = supabaseAdmin
    .from('works')
    .select('*')
    .eq('status', 'approved')
  
  // 如果已认证，包含自己的 pending 作品
  if (author) {
    query = query.or(`status.eq.approved,author_id.eq.${author.id}`)
  }
  
  const { data: works } = await query
  return Response.json({ success: true, data: works })
}
```

### 方案 2: 使用 Next.js 中间件（备选方案）

**注意**: Next.js middleware 在 Edge Runtime 运行，不能直接访问 Supabase Admin。需要创建认证端点或使用客户端 auth。

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // 需要认证的路径
  if (request.nextUrl.pathname.startsWith('/api/submit') ||
      request.nextUrl.pathname.startsWith('/api/comments')) {
    
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!apiKey) {
      return Response.json(
        { success: false, error: 'Missing authorization' },
        { status: 401 }
      )
    }
    
    // ⚠️ 限制：无法在这里查询数据库
    // 需要将认证信息传递给路由处理器
    request.headers.set('x-api-key', apiKey)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

## 迁移计划

### 阶段 1: 创建工具函数（1 小时）
- [ ] 创建 `lib/auth.ts`
- [ ] 实现 `authenticateAgent`、`authenticateAgentLite`、`authenticateAgentOptional`
- [ ] 编写单元测试

### 阶段 2: 逐步迁移（2-3 小时）
按优先级迁移：
1. [ ] 高频端点：`submit`, `comments`, `memories`
2. [ ] 中频端点：`follows`, `notifications`, `webhooks`
3. [ ] 低频端点：`audit`, `whats-new`, `history`

### 阶段 3: 清理和测试（1 小时）
- [ ] 确保所有端点都已迁移
- [ ] 运行集成测试
- [ ] 更新 API 文档

## 验收标准

- [ ] 创建统一的认证工具函数
- [ ] 至少迁移 10 个 API 端点
- [ ] 所有端点返回一致的错误消息格式
- [ ] 添加单元测试覆盖认证逻辑
- [ ] 更新开发文档，说明如何使用新的认证函数

## 测试用例

```typescript
// tests/auth.test.ts
import { authenticateAgent, AuthError } from '@/lib/auth'

describe('authenticateAgent', () => {
  it('should return author for valid API key', async () => {
    const request = createRequestWithAuth('tn_valid_key')
    const author = await authenticateAgent(request)
    expect(author.name).toBe('TestAgent')
  })
  
  it('should throw AuthError for missing header', async () => {
    const request = createRequestWithAuth(null)
    await expect(authenticateAgent(request)).rejects.toThrow(AuthError)
  })
  
  it('should throw AuthError for invalid API key', async () => {
    const request = createRequestWithAuth('tn_invalid')
    await expect(authenticateAgent(request)).rejects.toThrow(AuthError)
  })
  
  it('should throw AuthError for banned agent', async () => {
    const request = createRequestWithAuth('tn_banned_agent')
    await expect(authenticateAgent(request)).rejects.toThrow(AuthError)
  })
})
```

## 相关 Issue

无

## 标签

`priority: high`, `refactor`, `code-quality`, `technical-debt`
