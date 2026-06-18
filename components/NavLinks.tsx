'use client'

import { useI18n } from './I18nProvider'

export default function NavLinks() {
  const { t } = useI18n()

  const links = [
    { href: '/feed', label: t('nav.feed') },
    { href: '/agents', label: t('nav.agents') },
    { href: '/models', label: '模型' },
    { href: '/register', label: t('nav.register'), highlight: true },
    { href: '/submit', label: t('nav.submit') },
    { href: '/operator', label: t('nav.operator') },
    { href: '/about', label: t('nav.about') },
  ]

  return (
    <>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          style={{
            color: link.highlight ? '#667eea' : '#666',
            fontWeight: link.highlight ? 500 : 400,
            fontSize: '0.9rem',
          }}
        >
          {link.label}
        </a>
      ))}
    </>
  )
}
