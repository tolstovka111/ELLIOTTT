import { motion } from 'motion/react'

const baseStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 20,
  mixBlendMode: 'exclusion',
  color: '#ffffff',
  fontFamily: "'Inter Tight', system-ui, sans-serif",
  fontWeight: 500,
  fontSize: 12,
  lineHeight: 1.4,
  letterSpacing: '-0.02em',
  pointerEvents: 'none',
  margin: 0,
}

export function ProductInfo() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ ...baseStyle, left: 32, bottom: 32, maxWidth: 320 }}
        className="max-sm:!left-4 max-sm:!bottom-4"
      >
        <p style={{ opacity: 0.6, marginBottom: 6 }}>SS26 — look 04 / 22</p>
        <p style={{ fontSize: 14, letterSpacing: '-0.03em' }}>
          Cropped shell jacket
          <br />
          in bonded technical wool.
        </p>
        <p style={{ opacity: 0.6, marginTop: 6 }}>€ 1,280.00 EUR</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          ...baseStyle,
          right: 32,
          bottom: 32,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
        className="max-sm:!right-4 max-sm:!bottom-4"
      >
        <p style={{ opacity: 0.6 }}>N 45.7640° / E 4.8357°</p>
        <p style={{ opacity: 0.6 }}>lyon — 15:04:22 CET</p>
      </motion.div>
    </>
  )
}
