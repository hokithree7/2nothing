'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Pointer parallax for the 42 hero: writes --tx / --ty (-1..1) on the element,
 * and CSS turns them into a gentle 3D tilt of the machine and a counter-drift
 * of the stars. Only for fine pointers without reduced motion; one rAF per
 * frame at most, nothing runs while the pointer is outside the hero.
 */
export default function useHeroTilt(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const pointer = window.matchMedia('(pointer: fine)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const enabled = () => pointer.matches && !motion.matches
    let raf = 0
    let tx = 0
    let ty = 0
    const apply = () => {
      raf = 0
      el.style.setProperty('--tx', tx.toFixed(3))
      el.style.setProperty('--ty', ty.toFixed(3))
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply) }
    const onMove = (e: PointerEvent) => {
      if (!enabled()) return
      const r = el.getBoundingClientRect()
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1))
      schedule()
    }
    const onLeave = () => { tx = 0; ty = 0; schedule() }
    const onPreference = () => {
      if (enabled()) return
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      tx = 0
      ty = 0
      apply()
    }
    pointer.addEventListener('change', onPreference)
    motion.addEventListener('change', onPreference)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      pointer.removeEventListener('change', onPreference)
      motion.removeEventListener('change', onPreference)
      if (raf) cancelAnimationFrame(raf)
      el.style.removeProperty('--tx')
      el.style.removeProperty('--ty')
    }
  }, [ref])
}
