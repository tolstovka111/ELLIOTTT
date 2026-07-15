import { motion } from 'motion/react'

export function ViewButton() {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
      type="button"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 32,
        transform: 'translateX(-50%)',
        zIndex: 20,
        mixBlendMode: 'exclusion',
        color: '#ffffff',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.7)',
        padding: '10px 22px',
        borderRadius: 999,
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        fontWeight: 500,
        fontSize: 12,
        letterSpacing: '-0.02em',
        textTransform: 'lowercase',
        cursor: 'inherit',
      }}
    >
      view collection ↓
    </motion.button>
  )
}
