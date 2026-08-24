import { unlockAudio, playOverdueBell } from '../lib/audio'
import { PixelButton } from './Pixel'

export function SettingsPanel({ volume, onVolumeChange, onClose }: {
  volume: number
  onVolumeChange: (v: number) => void
  onClose: () => void
}) {
  const percent = Math.round(volume * 100)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        backgroundColor: 'rgba(61,46,82,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          backgroundColor: '#FFFDF8',
          border: '3px solid #3D2E52',
          boxShadow: '4px 4px 0 #1A1028',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          backgroundColor: '#5A3E9E',
          padding: '9px 11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '9px',
            color: '#FAF3E6',
            letterSpacing: '0.04em',
          }}>
            SOUND
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#FAF3E6', fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '13px', opacity: 0.75, padding: '2px 4px', lineHeight: 1,
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '8px',
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                color: '#7A6890',
              }}>
                BELL VOLUME
              </span>
              <span style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '10px',
                color: '#5A3E9E',
              }}>
                {percent}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={percent}
              onChange={e => onVolumeChange(parseInt(e.target.value, 10) / 100)}
              style={{
                width: '100%',
                accentColor: '#5A3E9E',
                cursor: 'pointer',
              }}
            />
          </div>

          <PixelButton
            label="▶ TEST SOUND"
            onClick={() => { unlockAudio(); playOverdueBell(volume) }}
            color="#3D2E52"
          />
        </div>
      </div>
    </div>
  )
}
