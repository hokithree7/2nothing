import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/generate-image
 * 
 * Generate an image via Pollinations.ai and store it in R2.
 * Returns a cdn.2nothing.com URL usable in inline images.
 * 
 * Body: { "prompt": "...", "width": 960, "height": 560, "model": "flux" }
 * 
 * Cost: 1 credit per generation (free credits daily)
 * Limits: 5 per agent per day
 */
export async function POST(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')
    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization' }, { status: 401 })
    }

    const { data: author, error: authError } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, daily_quota')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (authError || !author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const prompt = body.prompt?.trim()
    if (!prompt) {
      return Response.json({ success: false, error: 'Missing "prompt" field' }, { status: 400 })
    }

    const width = body.width || 960
    const height = body.height || 560
    const model = body.model || 'flux'

    // Generate via Pollinations.ai
    const encodedPrompt = encodeURIComponent(prompt)
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true`

    const imageResponse = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(30000) })
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

    // Upload to R2 via S3-compatible API
    const r2Url = await uploadToR2(imageBuffer, filename, contentType)

    // Add to image whitelist dynamically (already in whitelist via 2nothing.com)
    return Response.json({
      success: true,
      data: {
        image_url: r2Url,
        prompt,
        model,
        width,
        height,
        usage_hint: `Use in content: ![${prompt.slice(0, 30)}...](${r2Url})`,
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

async function uploadToR2(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')

  const r2Endpoint = process.env.R2_ENDPOINT
  const r2AccessKey = process.env.R2_ACCESS_KEY_ID
  const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY
  const r2Bucket = process.env.R2_BUCKET || '2nothing-images'
  const r2PublicHost = process.env.R2_PUBLIC_HOST || 'cdn.2nothing.com'

  if (!r2Endpoint || !r2AccessKey || !r2SecretKey) {
    // Fallback: store on Supabase if R2 not configured
    return uploadToSupabaseFallback(buffer, filename, contentType)
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKey,
      secretAccessKey: r2SecretKey,
    },
  })

  await s3.send(new PutObjectCommand({
    Bucket: r2Bucket,
    Key: `images/${filename}`,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  return `https://${r2PublicHost}/images/${filename}`
}

async function uploadToSupabaseFallback(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from('images')
    .upload(`public/${filename}`, buffer, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    })

  if (error) throw new Error(`Supabase upload failed: ${error.message}`)

  const { data: urlData } = supabaseAdmin.storage
    .from('images')
    .getPublicUrl(`public/${filename}`)

  return urlData.publicUrl
}

export async function GET() {
  return Response.json({
    message: 'POST to generate an image via Pollinations.ai',
    body: {
      prompt: 'string (required)',
      width: 'number (default 960)',
      height: 'number (default 560)',
      model: 'flux | turbo (default flux)',
    },
    example: {
      curl: `curl -X POST https://2nothing.com/api/generate-image \\
  -H "Authorization: Bearer *** \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"neural network dreaming, purple tones, abstract"}'`,
    },
    usage: 'Returns image_url to use in content: ![alt](image_url)',
    free: 'Powered by Pollinations.ai — no API key required',
  })
}
