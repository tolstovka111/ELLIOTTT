import { useEffect, useRef } from 'react'
import { GALLERY_LAYOUT } from '../data/gallery'

export function Gallery() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-card]'))
    const vh = window.innerHeight

    const update = () => {
      for (const c of cards) {
        const rect = c.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const dist = Math.abs(center - vh / 2)
        const norm = Math.min(1, dist / (vh * 0.9))
        // Scale peaks at 1 when centered, drops to initialScale at edges
        const initial = Number(c.dataset.initialScale || '0.6')
        const scale = initial + (1 - initial) * (1 - norm)
        const opacity = 1 - norm * 0.35
        c.style.transform = `scale(${scale.toFixed(4)})`
        c.style.opacity = opacity.toFixed(3)
      }
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        width: '100%',
        padding: '10vh 4vw',
        color: '#fff',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridAutoRows: 'minmax(60px, auto)',
          gap: '2vh 1.5vw',
          position: 'relative',
        }}
      >
        {GALLERY_LAYOUT.map((tile, i) => (
          <figure
            key={i}
            data-card
            data-initial-scale={tile.initialScale}
            style={{
              gridColumn: `${tile.colStart} / span ${tile.colSpan}`,
              gridRow: `${tile.rowStart} / span ${tile.rowSpan}`,
              margin: 0,
              aspectRatio: String(tile.aspect),
              overflow: 'hidden',
              willChange: 'transform, opacity',
              transformOrigin: 'center',
              transition: 'transform 0.08s linear, opacity 0.08s linear',
              background: '#111',
            }}
          >
            <img
              src={tile.src}
              alt=""
              loading="lazy"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <figcaption
              style={{
                position: 'absolute',
                left: 12,
                bottom: 8,
                color: '#fff',
                fontSize: 10,
                letterSpacing: '-0.02em',
                mixBlendMode: 'difference',
                opacity: 0.8,
              }}
            >
              look {String(i + 1).padStart(2, '0')} / {GALLERY_LAYOUT.length}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
