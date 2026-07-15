import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

function useLogoSize() {
  const [size, setSize] = useState(355)
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w < 640) setSize(124)
      else if (w < 1024) setSize(266)
      else setSize(355)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])
  return size
}

function useLogoOffset() {
  const [offset, setOffset] = useState({ top: 32, left: 32 })
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w < 640) setOffset({ top: 16, left: 16 })
      else setOffset({ top: 32, left: 32 })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])
  return offset
}

export function Logo() {
  const size = useLogoSize()
  const { top, left } = useLogoOffset()
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        position: 'fixed',
        top,
        left,
        width: size,
        pointerEvents: 'none',
        zIndex: 20,
        mixBlendMode: 'exclusion',
      }}
    >
      <svg
        viewBox="0 0 355 110"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        fill="#ffffff"
      >
        <text
          x="0"
          y="85"
          fontFamily="'Inter Tight', system-ui, sans-serif"
          fontWeight="500"
          fontSize="100"
          letterSpacing="-6"
          fill="#ffffff"
        >
          elliot
        </text>
        <text
          x="308"
          y="30"
          fontFamily="'Inter Tight', system-ui, sans-serif"
          fontWeight="500"
          fontSize="22"
          fill="#ffffff"
        >
          ®
        </text>
      </svg>
    </motion.div>
  )
}
