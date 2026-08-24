import type { Account } from '../types'
import { formatCountdown } from '../lib/format'
import { PixelButton, PixelIconButton } from './Pixel'

export function AccountCard({ account, now, returnWindow, onSnooze, onStop, onResume, onRemove }: {
  account: Account
  now: number
  returnWindow: number
  onSnooze: (id: string) => void
  onStop: (id: string) => void
  onResume: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { id, name, state, switchedAt, shaking } = account
  const windowMs = returnWindow * 60 * 1000
  const remaining = switchedAt ? Math.max(0, windowMs - (now - switchedAt)) : windowMs
  const progress = switchedAt ? Math.min(1, (now - switchedAt) / windowMs) : 0

  const isRunning = state === 'running'
  const isOverdue = state === 'overdue'
  const isStopped = state === 'stopped'
  const isDimmed = isOverdue || isStopped

  const borderColor = isOverdue ? '#A23262' : isRunning ? '#C98A3E' : '#C8BAE8'
  const shadowColor = isOverdue ? '#7A1040' : isRunning ? '#8A5010' : '#A898C8'

  return (
    <div
      className={shaking ? 'shake' : ''}
      style={{
        border: `2px solid ${borderColor}`,
        boxShadow: `3px 3px 0 ${shadowColor}`,
        backgroundColor: '#FFFDF8',
        opacity: isDimmed ? 0.55 : 1,
        filter: isDimmed ? 'saturate(0.4)' : 'none',
        transition: 'opacity 0.2s, filter 0.2s',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Top progress bar while running */}
      {isRunning && (
        <div style={{ height: '3px', backgroundColor: 'rgba(201,138,62,0.2)', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: '#C98A3E',
            transition: 'width 0.5s linear',
          }} />
        </div>
      )}
      {/* Overdue top stripe (pixel dashes) */}
      {isOverdue && (
        <div style={{
          height: '4px',
          backgroundImage: 'repeating-linear-gradient(90deg, #A23262 0px, #A23262 8px, transparent 8px, transparent 12px)',
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px' }}>

        {/* LED dot — pixel square */}
        <div style={{
          width: '9px', height: '9px', flexShrink: 0,
          backgroundColor: isOverdue ? '#A23262' : isRunning ? '#C98A3E' : '#5A3E9E',
          opacity: isStopped ? 0.45 : 1,
          boxShadow: isOverdue
            ? `0 0 0 2px #FAF3E6, 0 0 0 3px #A23262`
            : isRunning
            ? `0 0 0 2px #FAF3E6, 0 0 0 3px #C98A3E`
            : 'none',
        }} />

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '11px',
            fontWeight: 500,
            color: '#3D2E52',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {name}
          </div>
          {isStopped ? (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10.5px',
              color: '#B0A0C8',
              marginTop: '2px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              stopped
            </div>
          ) : null}
        </div>

        {/* Overdue badge */}
        {isOverdue && (
          <div style={{
            border: '2px solid #A23262',
            backgroundColor: '#A23262',
            padding: '2px 6px',
            flexShrink: 0,
          }} className="blink">
            <span style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '6px',
              color: '#FAF3E6',
              letterSpacing: '0.08em',
            }}>
              !!! OVERDUE
            </span>
          </div>
        )}

        {/* Countdown */}
        {isRunning && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '12px',
              color: '#C98A3E',
              letterSpacing: '0.03em',
              lineHeight: 1,
              textShadow: `1px 1px 0 rgba(201,138,62,0.4)`,
            }}>
              {formatCountdown(remaining)}
            </div>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '7px',
              color: '#D4A870',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginTop: '2px',
              opacity: 0.7,
            }}>
              remaining
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isRunning && (
            <PixelButton label="■ STOP" onClick={() => onStop(id)} color="#3D2E52" />
          )}
          {isOverdue && (
            <PixelButton label="SNOOZE" onClick={() => onSnooze(id)} color="#3D2E52" />
          )}
          {isStopped && (
            <PixelButton label="RESUME >" onClick={() => onResume(id)} color="#5A3E9E" />
          )}
          <PixelIconButton onClick={() => onRemove(id)} />
        </div>
      </div>
    </div>
  )
}