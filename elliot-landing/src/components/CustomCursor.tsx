import { useEffect, useRef, useState } from 'react'

export function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine)')
    const update = () => setEnabled(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`
      el.style.top = `${e.clientY}px`
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 60,
        mixBlendMode: 'exclusion',
        width: 48,
        height: 48,
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="24"
          cy="24"
          r="22.75"
          stroke="#ffffff"
          strokeWidth="2.5"
          fill="none"
        />
        <g stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round">
          <path d="M14 18 H34" />
          <path d="M24 14 V34" />
          <path d="M16 26 L24 34 L32 26" />
          <path d="M18 21 L30 21" />
        </g>
      </svg>
    </div>
  )
}
