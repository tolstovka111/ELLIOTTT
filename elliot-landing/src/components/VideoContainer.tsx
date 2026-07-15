import { useEffect, useRef, useState } from 'react'
import { VIDEO_LEFT, VIDEO_RIGHT } from '../data/gallery'

const DEAD_ZONE = 50

export function VideoContainer() {
  const leftRef = useRef<HTMLVideoElement>(null)
  const rightRef = useRef<HTMLVideoElement>(null)
  const lastActiveRef = useRef<'left' | 'right'>('left')
  const [active, setActive] = useState<'left' | 'right'>('left')

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const cx = window.innerWidth / 2
      const dx = e.clientX - cx
      if (Math.abs(dx) <= DEAD_ZONE) {
        // Dead zone: keep both at 0, show last active
        setActive(lastActiveRef.current)
        const l = leftRef.current
        const r = rightRef.current
        if (l) l.currentTime = 0
        if (r) r.currentTime = 0
        return
      }
      const next = dx < 0 ? 'left' : 'right'
      if (next !== lastActiveRef.current) {
        lastActiveRef.current = next
        setActive(next)
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    // Autoplay both muted videos so switch is instant
    const l = leftRef.current
    const r = rightRef.current
    l?.play().catch(() => {})
    r?.play().catch(() => {})
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <video
        ref={leftRef}
        src={VIDEO_LEFT}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: active === 'left' ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      />
      <video
        ref={rightRef}
        src={VIDEO_RIGHT}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: active === 'right' ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      />
    </div>
  )
}
