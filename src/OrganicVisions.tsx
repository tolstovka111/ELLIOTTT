import { useRef, useState } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = ['Wander', 'Archive', 'Story', 'Connect'] as const

type StaggeredFadeProps = {
  text: string
  startDelay?: number
}

function StaggeredFade({ text, startDelay = 0 }: StaggeredFadeProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })

  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.07,
        delayChildren: startDelay,
      },
    },
  }

  const child = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <motion.span
      ref={ref}
      variants={container}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      aria-label={text}
      className="inline-block"
    >
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={i}
          variants={child}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="inline-block"
          aria-hidden="true"
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </motion.span>
  )
}

export default function OrganicVisions() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      style={{ background: '#010101' }}
    >
      {/* Background video */}
      <video
        className="absolute inset-0 h-full w-full object-cover object-center"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260619_191346_9d19d66e-86a4-47f7-8dc6-712c1788c3b2.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      {/* Fallback / atmospheric tint that sits under the video */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, #1b2a1a 0%, #0a1210 45%, #010101 100%)',
        }}
      />
      {/* Subtle darkening overlay */}
      <div className="absolute inset-0 bg-black/25" />

      {/* Navigation */}
      <nav className="relative z-20 flex items-center justify-between md:justify-center gap-8 px-5 sm:px-8 pt-6 sm:pt-8">
        <span className="text-white font-light uppercase text-xs sm:text-sm tracking-[0.25em] md:tracking-[0.3em] md:mr-auto">
          Organic Visions
        </span>

        <div className="hidden md:flex items-center gap-10 md:mx-auto">
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href="#"
              className="text-white/80 hover:text-white uppercase text-xs tracking-[0.2em] font-light transition-colors duration-300"
            >
              {label}
            </a>
          ))}
        </div>

        {/* Spacer to balance flex on desktop */}
        <span className="hidden md:block md:ml-auto invisible text-xs tracking-[0.3em]">
          Organic Visions
        </span>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden text-white/90 hover:text-white transition-colors"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-16 left-4 right-4 z-50 md:hidden mobile-menu-glass rounded-2xl py-8"
          >
            <div className="flex flex-col items-center gap-5">
              {NAV_LINKS.map((label, i) => (
                <motion.a
                  key={label}
                  href="#"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeOut',
                    delay: 0.05 + i * 0.06,
                  }}
                  className="text-white/90 hover:text-white uppercase text-sm tracking-[0.25em] font-light transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center justify-start text-center px-5 sm:px-8 pt-12 sm:pt-16 md:pt-24">
        <h1 className="font-garamond font-normal text-white text-4xl sm:text-6xl md:text-8xl lg:text-9xl leading-[1.08] tracking-tight mb-6 sm:mb-8">
          <span className="block">
            <StaggeredFade text="WITNESS THE" />
          </span>
          <span className="block">
            <StaggeredFade text="HIDDEN REALM" startDelay={0.5} />
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="text-white/70 font-light leading-relaxed max-w-xs sm:max-w-md mb-8 sm:mb-10 text-sm sm:text-base md:text-lg"
        >
          An odyssey through delicate living forms,
          <br className="hidden sm:inline" />
          {' '}revealed by lens and curiosity.
        </motion.p>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 2.0 }}
          className="liquid-glass rounded-full px-7 sm:px-10 py-3.5 sm:py-4 text-white/90 uppercase text-xs sm:text-sm tracking-[0.18em] sm:tracking-[0.2em] font-light"
        >
          <span className="relative z-10">Begin the Experience</span>
        </motion.button>
      </div>
    </div>
  )
}
