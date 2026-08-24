import { useState } from 'react'

export function PixelPanel({
  label,
  accent,
  children,
  style,
  headerRight,
}: {
  label: string
  accent: string
  children: React.ReactNode
  style?: React.CSSProperties
  headerRight?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '0', ...style }}>
      <div style={{
        border: `3px solid ${accent}`,
        boxShadow: `4px 4px 0 ${accent === '#3D2E52' ? '#1A1028' : '#3D2E52'}`,
        backgroundColor: '#FFFDF8',
      }}>
        {/* panel header */}
        <div style={{
          backgroundColor: accent,
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: '#FAF3E6',
            opacity: 0.85,
          }}>
            {label}
          </span>
          {headerRight}
        </div>
        {/* panel body */}
        <div style={{ padding: '18px 18px' }}>
          {children}
        </div>
      </div>
      <div style={{ height: '4px', backgroundColor: '#3D2E52', marginLeft: '4px', marginRight: '-4px', opacity: 0.25 }} />
    </div>
  )
}

export function PixelInput({ placeholder, value, onChange, onEnter, flex }: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  flex: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onEnter()}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flex: `${flex} 1 0`,
        minWidth: 0,
        padding: '7px 9px',
        border: `2px solid ${focused ? '#5A3E9E' : '#C8BAE8'}`,
        boxShadow: focused ? `2px 2px 0 #5A3E9E` : `2px 2px 0 #C8BAE8`,
        backgroundColor: focused ? '#FFFDF8' : '#FAF3E6',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '11px',
        color: '#3D2E52',
        outline: 'none',
        transition: 'border-color 0.08s, box-shadow 0.08s',
        borderRadius: 0,
      }}
    />
  )
}

export function PixelButton({ label, onClick, disabled, color }: {
  label: string
  onClick: () => void
  disabled?: boolean
  color: string
}) {
  const [pressed, setPressed] = useState(false)
  const bg = disabled ? '#C8BAE8' : color
  const shadow = disabled ? '#A898C8' : '#3D2E52'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        padding: '7px 12px',
        border: `2px solid ${disabled ? '#A898C8' : '#3D2E52'}`,
        backgroundColor: bg,
        color: '#FAF3E6',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '8px',
        letterSpacing: '0.05em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: pressed || disabled ? 'none' : `2px 2px 0 ${shadow}`,
        transform: pressed && !disabled ? 'translate(2px, 2px)' : 'none',
        transition: 'transform 0.06s, box-shadow 0.06s',
        whiteSpace: 'nowrap',
        borderRadius: 0,
        userSelect: 'none',
      }}
    >
      {label}
    </button>
  )
}

export function PixelIconButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      title="Remove"
      style={{
        width: '22px', height: '22px',
        border: `2px solid ${hovered ? '#A23262' : '#E0D0F0'}`,
        backgroundColor: hovered ? '#A23262' : 'transparent',
        color: hovered ? '#FAF3E6' : '#C0B0D8',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '9px',
        boxShadow: pressed ? 'none' : hovered ? `2px 2px 0 #7A1040` : 'none',
        transform: pressed ? 'translate(2px, 2px)' : 'none',
        transition: 'all 0.06s',
        borderRadius: 0,
        userSelect: 'none',
      }}
    >
      ×
    </button>
  )
}

export function TitleBarDot({ color, icon, onClick, title }: {
  color: string
  icon: string
  onClick: () => void
  title: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        width: '18px', height: '18px',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0,
      }}
    >
      <div style={{
        width: '13px', height: '13px',
        backgroundColor: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: hovered ? 'scale(1.15)' : 'scale(1)',
        boxShadow: hovered ? `0 0 0 2px rgba(250,243,230,0.25)` : 'none',
        transition: 'transform 0.1s, box-shadow 0.1s',
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px',
          fontWeight: 700,
          lineHeight: 1,
          color: 'rgba(0,0,0,0.55)',
          marginTop: icon === '─' ? '-3px' : '0',
        }}>
          {icon}
        </span>
      </div>
    </button>
  )
}
