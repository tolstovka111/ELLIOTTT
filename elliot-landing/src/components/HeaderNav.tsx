import { motion } from 'motion/react'

const NAV_ITEMS = ['index', 'archive', 'stockists', 'journal', 'contact'] as const

export function HeaderNav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        position: 'fixed',
        top: 32,
        right: 32,
        display: 'flex',
        gap: 24,
        zIndex: 20,
        mixBlendMode: 'exclusion',
        color: '#ffffff',
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        fontWeight: 500,
        fontSize: 12,
        letterSpacing: '-0.02em',
      }}
      className="max-sm:!top-4 max-sm:!right-4 max-sm:!gap-3 max-sm:!text-[10px]"
    >
      {NAV_ITEMS.map((item, i) => (
        <a
          key={item}
          href={`#${item}`}
          style={{
            color: '#ffffff',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <span>{item}</span>
        </a>
      ))}
    </motion.nav>
  )
}
