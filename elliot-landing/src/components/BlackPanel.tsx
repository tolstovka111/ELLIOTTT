import { forwardRef, type ReactNode } from 'react'

type Props = { children: ReactNode }

export const BlackPanel = forwardRef<HTMLDivElement, Props>(function BlackPanel(
  { children },
  ref,
) {
  return (
    <div
      ref={ref}
      id="black-panel"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100%',
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        zIndex: 20,
        transform: 'translateY(100vh)',
        willChange: 'transform',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
})
