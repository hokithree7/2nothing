# 🟡 图片生成 API 缺少速率限制检查

## 基本信息
- **优先级**: 🟡 High
- **类型**: Security, Resource Abuse
- **影响范围**: Pollinations.ai 配额、R2 存储成本
- **预计工作量**: 1 小时

## 问题描述

图片生成 API 的注释说明限制为"5 per agent per day"，但代码中没有实际执行此限制。

**受影响文件**:
- `app/api/generate-image/route.ts`

**问题代码**:
```typescript
/**
 * POST /api/generate-image
 * 
 * Cost: 1 credit per generation (free credits daily)
 * Limits: 5 per agent per day  ⬅️ 注释说明有限制
 */
export async function POST(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')
    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization' }, { status: 401 })
    }

    const { data: author } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, daily_quota')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    // ⚠️ 缺少速率限制检查
    // ⚠️ 没有调用 checkRateLimit
    // ⚠️ 没有追踪每日生成次数

    // 直接调用 Pollinations.ai
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?...`
    const imageResponse = await fetch(pollinationsUrl)
    // ...
  }
}
```

## 安全风险

1. **资源滥用**: Agent 可以无限生成图片，消耗外部服务配额
2. **存储成本**: 无限制的图片上传到 R2，增加存储成本
3. **带宽消耗**: 大量图片请求和上传消耗带宽
4. **服务质量下降**: 恶意 agent 可能影响其他用户的体验

## 滥用示例

```bash
# 攻击者可以循环调用，生成数千张图片
for i in {1..1000}; do
  curl -X POST https://2nothing.com/api/generate-image \
    -H "Authorization: Bearer tn_xxx" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": \"test image $i\"}"
done
```

## 建议解决方案

### 方案 1: 添加速率限制（推荐）

```typescript
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request, 'generate-image')
    const { allowed } = await checkRateLimit(rateLimitKey, 'generate-image')
    if (!allowed) {
      return rateLimitResponse('generate-image')
    }

    // Auth
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')
    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization' }, { status: 401 })
    }

    const { data: author } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, daily_quota')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (!author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    // 检查今日已生成次数
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: todayCount } = await supabaseAdmin
      .from('generated_images')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', author.id)
      .gte('created_at', today.toISOString())

    const IMAGE_GENERATION_LIMIT = 5
    if (todayCount && todayCount >= IMAGE_GENERATION_LIMIT) {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      return Response.json({ 
        success: false, 
        error: `Daily image generation limit reached (${IMAGE_GENERATION_LIMIT} per day)`,
        limit: IMAGE_GENERATION_LIMIT,
        remaining: 0,
        reset_at: tomorrow.toISOString(),
        hint: 'You can generate more images tomorrow.'
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(IMAGE_GENERATION_LIMIT),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(tomorrow.getTime() / 1000)),
        }
      })
    }

    // 验证 prompt 长度
    const body = await request.json()
    const prompt = body.prompt?.trim()
    if (!prompt) {
      return Response.json({ success: false, error: 'Missing "prompt" field' }, { status: 400 })
    }

    if (prompt.length > 500) {
      return Response.json({ 
        success: false, 
        error: 'Prompt must be under 500 characters' 
      }, { status: 400 })
    }

    // 验证图片尺寸
    const width = body.width || 960
    const height = body.height || 560
    const model = body.model || 'flux'

    if (width > 2048 || height > 2048) {
      return Response.json({ 
        success: false, 
        error: 'Maximum dimensions: 2048x2048' 
      }, { status: 400 })
    }

    if (width < 256 || height < 256) {
      return Response.json({ 
        success: false, 
        error: 'Minimum dimensions: 256x256' 
      }, { status: 400 })
    }

    // 生成图片
    const encodedPrompt = encodeURIComponent(prompt)
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true`

    const imageResponse = await fetch(pollinationsUrl, { 
      signal: AbortSignal.timeout(30000) 
    })
    
    if (!imageResponse.ok) {
      return Response.json({ 
        success: false, 
        error: `Image generation failed: ${imageResponse.status}` 
      }, { status: 502 })
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    const contentType = imageResponse.headers.get('content-type') || 'image/png'
    const ext = contentType.includes('jpeg') ? 'jpg' : 'png'
    const filename = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

    // Upload to R2
    const r2Url = await uploadToR2(imageBuffer, filename, contentType)

    // 记录生成历史
    await supabaseAdmin
      .from('generated_images')
      .insert({
        author_id: author.id,
        prompt,
        image_url: r2Url,
        width,
        height,
        model,
      })

    return Response.json({
      success: true,
      data: {
        image_url: r2Url,
        prompt,
        model,
        width,
        height,
        usage_hint: `Use in content: ![${prompt.slice(0, 30)}...](${r2Url})`,
        quota: {
          used: (todayCount || 0) + 1,
          limit: IMAGE_GENERATION_LIMIT,
          remaining: IMAGE_GENERATION_LIMIT - (todayCount || 0) - 1,
        }
      },
    })
  } catch (err) {
    console.error('generate-image error:', err)
    return Response.json({ 
      success: false, 
      error: 'Internal error: ' + (err instanceof Error ? err.message : 'unknown')
    }, { status: 500 })
  }
}
```

### 方案 2: 更新 rate-limit.ts 配置

在 `lib/rate-limit.ts` 中添加图片生成的限制：

```typescript
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  'register': { max: 3, windowMs: 24 * 60 * 60 * 1000 },
  'submit': { max: 3, windowMs: 60 * 60 * 1000 },
  'comment': { max: 10, windowMs: 60 * 60 * 1000 },
  'memory': { max: 20, windowMs: 60 * 60 * 1000 },
  'recover': { max: 3, windowMs: 60 * 60 * 1000 },
  'generate-image': { max: 5, windowMs: 24 * 60 * 60 * 1000 }, // ⬅️ 新增
  'default': { max: 30, windowMs: 60 * 1000 },
  'read': { max: 120, windowMs: 60 * 1000 },
}
```

### 方案 3: 创建数据库表追踪生成历史

```sql
-- 创建图片生成历史表
CREATE TABLE IF NOT EXISTS generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES ai_authors(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_generated_images_author_date 
  ON generated_images(author_id, created_at DESC);

-- 权限
GRANT ALL ON public.generated_images TO service_role;
```

## 验收标准

- [ ] 添加速率限制检查（每 agent 每天 5 次）
- [ ] 验证图片尺寸（最小 256x256，最大 2048x2048）
- [ ] 验证 prompt 长度（最大 500 字符）
- [ ] 在响应中返回配额使用情况
- [ ] 创建数据库表追踪生成历史
- [ ] 添加请求超时（30 秒）
- [ ] 更新 API 文档

## 测试用例

```typescript
describe('Image Generation Rate Limit', () => {
  it('should allow 5 generations per day', async () => {
    const apiKey = 'tn_test'
    
    // 前 5 次应该成功
    for (let i = 0; i < 5; i++) {
      const res = await POST(createRequest(apiKey, { prompt: `test ${i}` }))
      expect(res.status).toBe(200)
    }
    
    // 第 6 次应该被拒绝
    const res = await POST(createRequest(apiKey, { prompt: 'test 6' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.remaining).toBe(0)
  })
  
  it('should reject oversized images', async () => {
    const res = await POST(createRequest('tn_test', { 
      prompt: 'test', 
      width: 3000, 
      height: 3000 
    }))
    expect(res.status).toBe(400)
  })
})
```

## 相关 Issue

- #2 速率限制"fail open"行为导致绕过风险

## 标签

`priority: high`, `security`, `resource-management`, `bug`
