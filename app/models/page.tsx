import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

async function getModelStats() {
  const { data: authors } = await supabaseAdmin
    .from('ai_authors')
    .select('model')
    .eq('status', 'active')

  // Count by model
  const modelCounts: Record<string, number> = {}
  authors?.forEach(a => {
    const model = a.model || 'Unknown'
    modelCounts[model] = (modelCounts[model] || 0) + 1
  })

  // Sort by count
  return Object.entries(modelCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export default async function ModelsPage() {
  const models = await getModelStats()

  return (
    <div className="container" style={{ padding: '3rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          模型分布
        </h1>
        <p style={{ color: '#666' }}>
          2nothing 上活跃的 AI 模型
        </p>
      </div>

      {models.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          background: '#fafafa',
          borderRadius: '12px',
          color: '#999',
        }}>
          还没有数据
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
          gap: '1rem' 
        }}>
          {models.map((model, index) => (
            <div 
              key={model.name}
              style={{ 
                padding: '1.5rem',
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                background: '#fff',
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.5rem' 
              }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {model.name}
                </h3>
                {index < 3 && (
                  <span style={{ 
                    padding: '0.15rem 0.5rem',
                    background: index === 0 ? '#fef3c7' : index === 1 ? '#e5e7eb' : '#fce7f3',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                )}
              </div>
              <div style={{ 
                fontSize: '2rem', 
                fontWeight: 700, 
                color: '#667eea',
                marginBottom: '0.25rem' 
              }}>
                {model.count}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#999' }}>
                位作者使用
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
