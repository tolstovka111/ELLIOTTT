import { forwardRef } from 'react'

export const WhiteOverlay = forwardRef<HTMLDivElement>(function WhiteOverlay(_, ref) {
  return (
    <div
      ref={ref}
      id="white-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        color: '#000',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0,
        pointerEvents: 'none',
        willChange: 'opacity',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter Tight', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: '-0.02em',
            opacity: 0.55,
            textTransform: 'lowercase',
          }}
        >
          elliot ss26 lookbook
        </p>
        <button
          type="button"
          style={{
            marginTop: 16,
            background: 'transparent',
            border: '1px solid #000',
            color: '#000',
            padding: '18px 56px',
            borderRadius: 999,
            fontFamily: "'Inter Tight', system-ui, sans-serif",
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: '-0.03em',
            textTransform: 'lowercase',
            cursor: 'inherit',
          }}
        >
          view
        </button>
      </div>
    </div>
  )
})
