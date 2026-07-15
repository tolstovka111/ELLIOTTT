import { useEffect, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

import { CustomCursor } from './components/CustomCursor'
import { Logo } from './components/Logo'
import { Caption } from './components/Caption'
import { HeaderNav } from './components/HeaderNav'
import { ProductInfo } from './components/ProductInfo'
import { ViewButton } from './components/ViewButton'
import { VideoContainer } from './components/VideoContainer'
import { BlackPanel } from './components/BlackPanel'
import { Gallery } from './components/Gallery'
import { WhiteOverlay } from './components/WhiteOverlay'
import { Footer } from './components/Footer'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export default function App() {
  const spacerRef = useRef<HTMLDivElement>(null)
  const heroUIRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const galleryWrapRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const spacer = spacerRef.current
    if (!spacer) return
    spacer.style.height = '500vh'
  }, [])

  useGSAP(
    () => {
      const spacer = spacerRef.current
      const heroUI = heroUIRef.current
      const panel = panelRef.current
      const overlay = overlayRef.current
      const galleryWrap = galleryWrapRef.current
      if (!spacer || !panel || !overlay || !galleryWrap || !heroUI) return

      const vh = () => window.innerHeight

      const resize = () => {
        const galleryHeight = galleryWrap.scrollHeight
        const galleryScroll = Math.max(0, galleryHeight - vh())
        // scroll ranges (in absolute scrollTop):
        //   0 .. vh              → panel slide + hero UI fade
        //   vh .. vh+galleryScroll → gallery scroll
        //   vh+galleryScroll .. vh+galleryScroll+vh → overlay fade
        // Scroll bar max = scrollHeight - viewport, so scrollHeight must be
        // at least (last-end) + vh + a small buffer.
        const lastEnd = vh() + galleryScroll + vh()
        const buffer = vh() * 0.5
        spacer.style.height = `${lastEnd + vh() + buffer}px`
        ScrollTrigger.refresh()
      }

      // Phase 1a: panel slides up 100vh → 0
      gsap.fromTo(
        panel,
        { y: '100vh' },
        {
          y: '0vh',
          ease: 'none',
          scrollTrigger: {
            trigger: spacer,
            start: 'top top',
            end: () => `+=${vh()}`,
            scrub: true,
          },
        },
      )

      // Phase 1b: fade hero UI out as panel covers viewport
      gsap.fromTo(
        heroUI,
        { opacity: 1 },
        {
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: spacer,
            start: () => `${vh() * 0.55} top`,
            end: () => `${vh() * 0.95} top`,
            scrub: true,
          },
        },
      )

      // Phase 2: gallery scroll — translate inner content upward
      const galleryTween = gsap.to(galleryWrap, {
        y: () => -(galleryWrap.scrollHeight - vh()),
        ease: 'none',
        scrollTrigger: {
          trigger: spacer,
          start: () => `${vh()} top`,
          end: () =>
            `${vh() + Math.max(0, galleryWrap.scrollHeight - vh())} top`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })

      // Phase 3: white overlay fades in over last vh of scroll
      const overlayTween = gsap.fromTo(
        overlay,
        { opacity: 0 },
        {
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: spacer,
            start: () =>
              `${vh() + Math.max(0, galleryWrap.scrollHeight - vh())} top`,
            end: () =>
              `${vh() + Math.max(0, galleryWrap.scrollHeight - vh()) + vh()} top`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      )

      resize()
      window.addEventListener('resize', resize)
      const imgs = galleryWrap.querySelectorAll('img')
      imgs.forEach((img) => {
        if (!img.complete) img.addEventListener('load', resize, { once: true })
      })

      return () => {
        window.removeEventListener('resize', resize)
        galleryTween.scrollTrigger?.kill()
        overlayTween.scrollTrigger?.kill()
      }
    },
    { scope: spacerRef },
  )

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'auto'
  }, [])

  return (
    <div id="scroll-spacer" ref={spacerRef}>
      <VideoContainer />

      {/* Hero UI overlay — fades out during panel slide-up */}
      <div
        ref={heroUIRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 15,
          pointerEvents: 'none',
          willChange: 'opacity',
        }}
      >
        <Logo />
        <Caption />
        <HeaderNav />
        <ProductInfo />
        <ViewButton />
      </div>

      {/* Black panel z-index above hero UI so it physically covers */}
      <BlackPanel ref={panelRef}>
        <div ref={galleryWrapRef} style={{ willChange: 'transform' }}>
          <Gallery />
          <Footer />
        </div>
      </BlackPanel>

      <WhiteOverlay ref={overlayRef} />

      {/* Cursor on top of everything */}
      <CustomCursor />
    </div>
  )
}
