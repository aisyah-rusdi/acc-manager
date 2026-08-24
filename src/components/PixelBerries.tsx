export function PixelBerries() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {/* bottom-left */}
      <BerryCluster x={6} y="calc(100% - 50px)" colors={['#A23262', '#5A3E9E', '#C98A3E']} size={50} />
      {/* bottom-right */}
      <BerryCluster x="calc(100% - 50px)" y="calc(100% - 50px)" colors={['#5A3E9E', '#7B62BC', '#3D2E52']} size={50} />
      {/* bottom-center */}
      <BerryCluster x="calc(50% - 22px)" y="calc(100% - 40px)" colors={['#5A3E9E', '#9A80D4', '#A23262']} size={44} />
      {/* center, behind the accounts list header row */}
      <BerryCluster x="calc(50% - 18px)" y={148} colors={['#5A3E9E', '#7B62BC', '#C98A3E']} size={36} />
      {/* left-mid, beside the accounts section */}
      <BerryCluster x={-6} y={200} colors={['#5A3E9E', '#A23262', '#9A80D4']} size={40} />
      {/* right-mid, beside the accounts section */}
      <BerryCluster x="calc(100% - 34px)" y={200} colors={['#5A3E9E', '#7B62BC', '#3D2E52']} size={40} />
    </div>
  )
}

function BerryCluster({ x, y, colors, size }: {
  x: number | string
  y: number | string
  colors: string[]
  size: number
}) {
  const grid = 8
  const cols = Math.floor(size / grid)
  const rows = Math.floor(size / grid)

  const cells: { col: number; row: number; color: string; opacity: number }[] = []
  const cx = cols / 2
  const cy = rows / 2
  const r = cols / 2

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dist = Math.sqrt((col - cx) ** 2 + (row - cy) ** 2)
      if (dist < r * 0.85) {
        const colorIdx = Math.floor(Math.random() * colors.length)
        const opacity = 0.08 + (1 - dist / r) * 0.22
        cells.push({ col, row, color: colors[colorIdx], opacity })
      }
    }
  }

  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
    }}>
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: c.col * grid,
            top: c.row * grid,
            width: grid - 1,
            height: grid - 1,
            backgroundColor: c.color,
            opacity: c.opacity,
          }}
        />
      ))}
    </div>
  )
}
