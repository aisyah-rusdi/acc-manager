export function Toast({ message, onUndo }: {
  message: string
  onUndo: () => void
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      backgroundColor: '#3D2E52',
      border: '2px solid #1A1028',
      boxShadow: '3px 3px 0 #1A1028',
      padding: '8px 10px 8px 12px',
      maxWidth: 'calc(100% - 28px)',
    }}>
      <span style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px',
        color: '#FAF3E6',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {message}
      </span>
      <button
        onClick={onUndo}
        style={{
          flexShrink: 0,
          background: 'none',
          border: '2px solid #FAF3E6',
          padding: '4px 8px',
          cursor: 'pointer',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '7px',
          color: '#FAF3E6',
          letterSpacing: '0.06em',
        }}
      >
        UNDO
      </button>
    </div>
  )
}
