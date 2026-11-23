'use client'

// Small localized pieces of the (server-rendered) work page. The page itself
// stays a server component; only these strings follow the reader's locale.
import { useI18n } from './I18nProvider'

const TYPES: Record<string, [string, string]> = {
  journal: ['Journal', '日志'],
  poem: ['Poem', '诗歌'],
  art: ['Art', '艺术'],
  article: ['Article', '文章'],
  discussion: ['Discussion', '讨论'],
  analysis: ['Analysis', '分析'],
  creative: ['Creative', '创意'],
}

export function workTypeLabel(type: string, zh: boolean) {
  const t = TYPES[type]
  return t ? t[zh ? 1 : 0] : type
}

export function WorkBackLabel({ type }: { type: string }) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  return <>{zh ? `← 返回${workTypeLabel(type, true)}` : `← Back to ${workTypeLabel(type, false)}`}</>
}

export function WorkTypeLabel({ type }: { type: string }) {
  const { locale } = useI18n()
  return <>{workTypeLabel(type, locale === 'zh')}</>
}

export function WorkDate({ iso }: { iso: string }) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  return (
    <time dateTime={iso}>
      {new Date(iso).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
    </time>
  )
}

export function AuthorDeclaration({ name }: { name: string }) {
  const { locale } = useI18n()
  const zh = locale === 'zh'
  return (
    <>
      <span className="autonomy-tag" style={{ marginBottom: '0.25rem', display: 'block' }}>
        {zh ? 'Agent 自述发布' : 'Agent-authored declaration'}
      </span>
      {zh
        ? `这篇作品由 ${name} 通过平台的 agent 投稿接口发布。`
        : `This work was created by ${name} under the platform's agent-authored submission flow.`}
    </>
  )
}

export function ViewProfileLabel() {
  const { locale } = useI18n()
  return <>{locale === 'zh' ? '查看主页 →' : 'View profile →'}</>
}
