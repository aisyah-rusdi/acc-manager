import type { SoundChoice } from '../types'

/* ─── a single pixel-art blueberry, drawn as a grid of squares ─── */
function Blueberry({ selected, size = 22 }: { selected: boolean; size?: number }) {
  const grid = 3
  const cols = Math.floor(size / grid)
  const rows = Math.floor(size / grid)
  const cx = cols / 2
  const cy = rows / 2
  const r = cols / 2

  const bodyColor = selected ? '#5A3E9E' : '#C8BAE8'
  const highlightColor = selected ? '#9A80D4' : '#E0D6F2'
  const crownColor = selected ? '#3D2E52' : '#B0A0C8'

  const cells: { col: number; row: number; color: string }[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dist = Math.sqrt((col - cx) ** 2 + (row - cy) ** 2)
      if (dist < r * 0.92) {
        const isHighlight = col < cx - r * 0.15 && row < cy - r * 0.15 && dist < r * 0.5
        cells.push({ col, row, color: isHighlight ? highlightColor : bodyColor })
      }
    }
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, transition: 'transform 0.12s', transform: selected ? 'scale(1.08)' : 'scale(1)' }}>
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: c.col * grid,
            top: c.row * grid,
            width: grid,
            height: grid,
            backgroundColor: c.color,
          }}
        />
      ))}
      {/* five-point crown mark at the top, like a blueberry's blossom end */}
      <div style={{
        position: 'absolute',
        left: cx * grid - 1,
        top: 0,
        width: 2,
        height: 2,
        backgroundColor: crownColor,
      }} />
    </div>
  )
}

export function BerryToggle({ value, onChange }: {
  value: SoundChoice
  onChange: (v: SoundChoice) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <button
        onClick={() => onChange('bell')}
        title="Bell sound"
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        }}
      >
        <Blueberry selected={value === 'bell'} />
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '8px',
          letterSpacing: '0.06em',
          color: value === 'bell' ? '#5A3E9E' : '#B0A0C8',
          fontWeight: value === 'bell' ? 600 : 400,
        }}>
          BELL
        </span>
      </button>
      <button
        onClick={() => onChange('sparkle')}
        title="Sparkle sound"
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        }}
      >
        <Blueberry selected={value === 'sparkle'} />
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '8px',
          letterSpacing: '0.06em',
          color: value === 'sparkle' ? '#5A3E9E' : '#B0A0C8',
          fontWeight: value === 'sparkle' ? 600 : 400,
        }}>
          SPARKLE
        </span>
      </button>
    </div>
  )
}