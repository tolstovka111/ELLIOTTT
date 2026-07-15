import { useState } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'

const NAV_ITEMS = [
  {
    label: 'Product',
    items: ['Connections', 'Workflows', 'Insights'],
  },
  {
    label: 'Solutions',
    items: ['Guides', 'Use cases', 'API reference'],
  },
  {
    label: 'About',
    items: ['Our story', 'Open roles', 'Reach us'],
  },
  {
    label: 'Plans',
    items: null,
  },
]

function DiamondLogo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 2 L26 14 L14 26 L2 14 Z"
        fill="white"
        opacity="0.9"
      />
      <path
        d="M14 7 L21 14 L14 21 L7 14 Z"
        fill="white"
        opacity="0.5"
      />
    </svg>
  )
}

export default function FlowpathHero() {
  const [openDropdown, setOpenDropdown] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <section className="relative h-screen w-full overflow-hidden flex flex-col bg-gradient-to-br from-[#3d2a1f] via-[#1e1512] to-[#0a0806]">
      {/* Background video */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260703_053131_1ec3dd1c-d627-44fb-ab20-6e1fce41b0d5.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Navigation */}
      <nav className="relative z-20 w-full px-5 sm:px-6 md:px-12 lg:px-16 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <DiamondLogo />
            <span className="text-white text-lg sm:text-xl font-medium tracking-tight">
              flowpath
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.items && setOpenDropdown(item.label)}
                onMouseLeave={() => item.items && setOpenDropdown(null)}
              >
                <button
                  type="button"
                  className="flex items-center gap-1 text-white/90 hover:text-white text-sm font-medium px-3 py-2 transition-colors"
                >
                  {item.label}
                  {item.items && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        openDropdown === item.label ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>

                {item.items && openDropdown === item.label && (
                  <div className="liquid-glass !absolute top-full left-0 rounded-xl py-3 px-2 min-w-[160px] shadow-xl animate-dropdown">
                    <div className="relative z-10 flex flex-col">
                      {item.items.map((sub) => (
                        <a
                          key={sub}
                          href="#"
                          className="text-white/80 hover:text-white text-sm rounded-lg hover:bg-white/5 px-3 py-2 transition-colors"
                        >
                          {sub}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="#"
              className="text-white/90 hover:text-white text-sm font-medium"
            >
              Log in
            </a>
            <a
              href="#"
              className="liquid-glass rounded-full px-5 py-2 text-white text-sm font-medium"
            >
              <span className="relative z-10">Try it free</span>
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="md:hidden relative w-9 h-9 flex items-center justify-center text-white"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <Menu
              className={`w-6 h-6 absolute transition-all duration-300 ${
                mobileOpen
                  ? 'opacity-0 scale-75 -rotate-90'
                  : 'opacity-100 scale-100 rotate-0'
              }`}
            />
            <X
              className={`w-6 h-6 absolute transition-all duration-300 ${
                mobileOpen
                  ? 'opacity-100 scale-100 rotate-0'
                  : 'opacity-0 scale-75 rotate-90'
              }`}
            />
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden absolute left-4 right-4 top-full mt-2 origin-top duration-400 ${
            mobileOpen
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            transitionProperty: 'opacity, transform',
          }}
        >
          <div className="bg-[#2C221C]/95 backdrop-blur-xl rounded-2xl p-6">
            <div className="flex flex-col gap-4">
              {NAV_ITEMS.map((item) => (
                <div key={item.label} className="flex flex-col gap-2">
                  <span className="text-white text-base font-medium">
                    {item.label}
                  </span>
                  {item.items && (
                    <div className="pl-3 flex flex-col gap-2">
                      {item.items.map((sub) => (
                        <a
                          key={sub}
                          href="#"
                          className="text-white/70 hover:text-white text-sm"
                        >
                          {sub}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
              <a href="#" className="text-white/90 hover:text-white text-sm font-medium">
                Log in
              </a>
              <a
                href="#"
                className="liquid-glass rounded-full px-5 py-2 text-white text-sm font-medium"
              >
                <span className="relative z-10">Try it free</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex items-start justify-center px-5 pt-16 sm:pt-20 md:pt-24">
        <div className="text-center max-w-3xl">
          <h1 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl leading-[1.05] tracking-[-0.02em]">
            Bridge the
            <br />
            gaps. <span className="text-white/60">Ditch the</span>
            <br />
            <span className="text-white/60">grindwork.</span>
          </h1>
          <p className="text-white/80 text-sm sm:text-base md:text-lg leading-relaxed max-w-md mx-auto mt-6 sm:mt-8">
            Flowpath unifies your complete wellness tools, so your crew spends
            less energy plugging gaps and more on real progress.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
            <a
              href="#"
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-900 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
            >
              Begin your journey
            </a>
            <a
              href="#"
              className="px-5 sm:px-6 py-2.5 sm:py-3 liquid-glass rounded-full text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              <span className="relative z-10">See it live</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
