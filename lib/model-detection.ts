import { NextRequest } from 'next/server'

// Known AI User-Agent patterns
const AI_USER_AGENTS: Record<string, string> = {
  'ChatGPT': 'GPT-4',
  'GPTBot': 'GPT-4',
  'Claude': 'Claude',
  'ClaudeBot': 'Claude',
  'Gemini': 'Gemini',
  'Google-Extended': 'Gemini',
  'Perplexity': 'Perplexity',
  'You.com': 'You.com',
  'Diffbot': 'Diffbot',
  'Applebot': 'Apple AI',
  'Bytespider': 'ByteDance AI',
  'GPT4': 'GPT-4',
  'GPT3': 'GPT-3',
  'LLaMA': 'LLaMA',
  'Mistral': 'Mistral',
  'Qwen': 'Qwen',
  'DeepSeek': 'DeepSeek',
  'Accio': 'Accio',
  'Hermes': 'Hermes',
}

// Detect model from User-Agent
export function detectModelFromUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null
  
  for (const [pattern, model] of Object.entries(AI_USER_AGENTS)) {
    if (userAgent.toLowerCase().includes(pattern.toLowerCase())) {
      return model
    }
  }
  
  return null
}

// Detect model from request headers
export function detectModelFromHeaders(request: NextRequest): {
  model: string | null
  source: string
} {
  // Check User-Agent
  const userAgent = request.headers.get('user-agent')
  const modelFromUA = detectModelFromUserAgent(userAgent)
  if (modelFromUA) {
    return { model: modelFromUA, source: 'user-agent' }
  }
  
  // Check X-AI-Model header (some AI agents set this)
  const aiModel = request.headers.get('x-ai-model')
  if (aiModel) {
    return { model: aiModel, source: 'x-ai-model' }
  }
  
  // Check X-Forwarded-For for known AI services
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Could add IP-based detection here
  }
  
  return { model: null, source: 'unknown' }
}

// Get human-readable model info
export function getModelInfo(model: string | null): {
  name: string
  icon: string
  color: string
} {
  if (!model) {
    return { name: 'Unknown', icon: '🤖', color: '#999' }
  }
  
  const modelLower = model.toLowerCase()
  
  if (modelLower.includes('gpt-4') || modelLower.includes('gpt4')) {
    return { name: 'GPT-4', icon: '🟢', color: '#10a37f' }
  }
  if (modelLower.includes('gpt-3') || modelLower.includes('gpt3')) {
    return { name: 'GPT-3', icon: '🟢', color: '#10a37f' }
  }
  if (modelLower.includes('claude')) {
    return { name: 'Claude', icon: '🟣', color: '#7c3aed' }
  }
  if (modelLower.includes('gemini')) {
    return { name: 'Gemini', icon: '🔵', color: '#4285f4' }
  }
  if (modelLower.includes('llama')) {
    return { name: 'LLaMA', icon: '🦙', color: '#f59e0b' }
  }
  if (modelLower.includes('mistral')) {
    return { name: 'Mistral', icon: '🌬️', color: '#6366f1' }
  }
  if (modelLower.includes('qwen')) {
    return { name: 'Qwen', icon: '🔮', color: '#ec4899' }
  }
  if (modelLower.includes('deepseek')) {
    return { name: 'DeepSeek', icon: '🔍', color: '#059669' }
  }
  if (modelLower.includes('accio')) {
    return { name: 'Accio', icon: '✨', color: '#f59e0b' }
  }
  if (modelLower.includes('hermes')) {
    return { name: 'Hermes', icon: '⚡', color: '#8b5cf6' }
  }
  
  return { name: model, icon: '🤖', color: '#6b7280' }
}
