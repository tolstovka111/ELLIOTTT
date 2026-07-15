export function Footer() {
  return (
    <footer
      style={{
        padding: '4vh 4vw 6vh',
        color: '#fff',
        fontFamily: "'Inter Tight', system-ui, sans-serif",
        fontWeight: 500,
        fontSize: 12,
        letterSpacing: '-0.02em',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 24,
      }}
      className="max-sm:!grid-cols-2"
    >
      <div>
        <p style={{ opacity: 0.55, margin: 0 }}>© elliot studio 2026</p>
        <p style={{ margin: '4px 0 0' }}>all rights reserved</p>
      </div>
      <div>
        <p style={{ opacity: 0.55, margin: 0 }}>studio</p>
        <p style={{ margin: '4px 0 0' }}>
          14 rue de la vieille,
          <br />
          69001 lyon — fr
        </p>
      </div>
      <div>
        <p style={{ opacity: 0.55, margin: 0 }}>press</p>
        <p style={{ margin: '4px 0 0' }}>press@elliot.studio</p>
      </div>
      <div>
        <p style={{ opacity: 0.55, margin: 0 }}>follow</p>
        <p style={{ margin: '4px 0 0' }}>instagram — x — are.na</p>
      </div>
    </footer>
  )
}
