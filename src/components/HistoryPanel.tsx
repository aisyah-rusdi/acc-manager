import { useState, useEffect } from 'react'
import type { HistoryEntry } from '../types'
import { formatRelativeTime } from '../lib/format'

const EVENT_META: Record<HistoryEntry['event'], { label: string; color: string }> = {
  added: { label: 'ADDED', color: '#5A3E9E' },
  overdue: { label: 'OVERDUE', color: '#A23262' },
  confirmed: { label: "I'M BACK", color: '#C98A3E' },
  stopped: { label: 'STOPPED', color: '#8A7BA8' },
  resumed: { label: 'RESUMED', color: '#5A3E9E' },
  removed: { label: 'REMOVED', color: '#B0A0C8' },
}

export function HistoryPanel({ history, activeNames, onClose, onQuickAdd, onClearHistory }: {
  history: HistoryEntry[]
  activeNames: Set<string>
  onClose: () => void
  onQuickAdd: (name: string) => void
  onClearHistory: () => void
}) {
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

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
          maxHeight: '100%',
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
            HISTORY
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

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 10px' }}>
          {history.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '24px 12px',
              color: '#C0B0D8',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '8px',
              letterSpacing: '0.06em',
              lineHeight: 2,
            }}>
              NO HISTORY YET.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {history.map(entry => {
                const meta = EVENT_META[entry.event]
                const isActive = activeNames.has(entry.accountName)
                return (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 8px',
                    border: '1px solid #E0D0F0',
                    backgroundColor: '#FAF3E6',
                  }}>
                    <div style={{ width: '6px', height: '6px', flexShrink: 0, backgroundColor: meta.color }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '10.5px',
                        fontWeight: 500,
                        color: '#3D2E52',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {entry.accountName}
                      </div>
                      <div style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '8.5px',
                        color: meta.color,
                        letterSpacing: '0.05em',
                        marginTop: '1px',
                      }}>
                        {meta.label} · {formatRelativeTime(entry.timestamp, nowTick)}
                      </div>
                    </div>
                    {!isActive && (
                      <button
                        onClick={() => onQuickAdd(entry.accountName)}
                        title={`Add "${entry.accountName}" again`}
                        style={{
                          flexShrink: 0,
                          width: '22px', height: '22px',
                          border: '2px solid #5A3E9E',
                          backgroundColor: 'transparent',
                          color: '#5A3E9E',
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div style={{
            borderTop: '1px solid #E0D0F0',
            padding: '7px 10px',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            <button
              onClick={onClearHistory}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '9.5px',
                color: '#A23262',
                letterSpacing: '0.05em',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              CLEAR HISTORY
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
