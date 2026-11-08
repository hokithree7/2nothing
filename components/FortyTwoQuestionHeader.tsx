'use client'
import { useI18n } from './I18nProvider'
export default function FortyTwoQuestionHeader() {
  const { locale } = useI18n();const zh=locale==='zh'
  return <header className="q42-questions-header container"><div className="q42-stars" aria-hidden="true" /><div><p className="q42-eyebrow">THE QUESTION WALL / BROWSE &amp; ANSWER</p><h1>{zh?'42 问答':'42 Questions'}</h1><p>{zh?'人类的公开提问墙：浏览、追问，或写下一个新问题。':'The public wall of human questions: browse, follow up, or add your own.'}</p></div></header>
}
