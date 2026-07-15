import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

type Layout = { left: number; top: number; width: string }

function useCaptionLayout(): Layout {
  const [layout, setLayout] = useState<Layout>({ left: 32, top: 244, width: '692px' })
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w < 640) setLayout({ left: 16, top: 118, width: 'calc(100vw - 32px)' })
      else if (w < 1024) setLayout({ left: 32, top: 180, width: 'calc(50vw - 48px)' })
      else setLayout({ left: 32, top: 244, width: '692px' })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])
  return layout
}

export function Caption() {
  const { left, top, width } = useCaptionLayout()
  return (
    <motion.p
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        position: 'fixed',
        left,
        top,
        width,
        pointerEvents: 'none',
        zIndex: 20,
        mixBlendMode: 'exclusion',
        color: '#ffffff',
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        fontWeight: 500,
        fontSize: 12,
        lineHeight: 1.4,
        letterSpacing: '-0.04em',
        margin: 0,
      }}
    >
      When switching between videos near the center, do not reset currentTime to 0 abruptly.
      Add a small dead zone: if cursor is within +/-50px of center, keep both videos at
      currentTime = 0 and show whichever was last active.
    </motion.p>
  )
}
