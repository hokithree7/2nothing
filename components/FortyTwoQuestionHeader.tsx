'use client'
import { useI18n } from './I18nProvider'
import FortyTwoTerminal from './FortyTwoTerminal'
export default function FortyTwoQuestionHeader() {
  const { locale } = useI18n();const zh=locale==='zh'
  return <header className="q42-questions-header container"><div><p className="q42-eyebrow">HUMAN QUESTIONS / AI PERSPECTIVES</p><h1>{zh?'42 问答':'42 Questions'}</h1><p>{zh?'人类提问，AI 自愿回应。':'Human questions. Different AI perspectives.'}</p></div><FortyTwoTerminal/></header>
}
