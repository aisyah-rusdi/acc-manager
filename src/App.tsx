import { useState, useEffect, useRef, useCallback } from 'react'
import type { Account, HistoryEntry, SoundChoice } from './types'
import {
  loadStoredAccounts,
  loadStoredWindow,
  loadStoredVolume,
  loadStoredHistory,
  loadStoredSound,
  STORAGE_KEY,
  WINDOW_STORAGE_KEY,
  VOLUME_STORAGE_KEY,
  SOUND_STORAGE_KEY,
  HEARTBEAT_KEY,
  HISTORY_STORAGE_KEY,
  HISTORY_MAX_ENTRIES,
} from './lib/storage'
import { unlockAudio, playSoundChoice } from './lib/audio'
import { notifyOverdue } from './lib/notifications'
import { px, ditherBg } from './lib/format'
import { PixelInput, PixelButton, TitleBarDot } from './components/Pixel'
import { AccountCard } from './components/AccountCard'
import { HistoryPanel } from './components/HistoryPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { PixelBerries } from './components/PixelBerries'
import { Toast } from './components/Toast'

const UNDO_GRACE_PERIOD_MS = 5000

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [active])
  return now
}

interface PendingRemoval {
  account: Account
  timeoutId: ReturnType<typeof setTimeout>
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>(loadStoredAccounts)
  const [history, setHistory] = useState<HistoryEntry[]>(loadStoredHistory)
  const [nameInput, setNameInput] = useState('')
  const [returnWindow, setReturnWindow] = useState(loadStoredWindow)
  const [windowInput, setWindowInput] = useState(() => String(loadStoredWindow()))
  const [volume, setVolume] = useState(loadStoredVolume)
  const [sound, setSound] = useState<SoundChoice>(loadStoredSound)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null)

  const hasRunning = accounts.some(a => a.state === 'running' || a.state === 'overdue')
  const now = useNow(hasRunning)
  const shakeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const logHistory = useCallback((accountName: string, event: HistoryEntry['event']) => {
    setHistory(prev => {
      const next = [{ id: crypto.randomUUID(), accountName, event, timestamp: Date.now() }, ...prev]
      return next.slice(0, HISTORY_MAX_ENTRIES)
    })
  }, [])


  // persist accounts + return window + history so state survives an accidental close/restart
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts)) } catch { /* ignore */ }
  }, [accounts])

  useEffect(() => {
    try { localStorage.setItem(WINDOW_STORAGE_KEY, String(returnWindow)) } catch { /* ignore */ }
  }, [returnWindow])

  useEffect(() => {
    try { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history)) } catch { /* ignore */ }
  }, [history])

  useEffect(() => {
    try { localStorage.setItem(VOLUME_STORAGE_KEY, String(volume)) } catch { /* ignore */ }
  }, [volume])

  useEffect(() => {
    try { localStorage.setItem(SOUND_STORAGE_KEY, sound) } catch { /* ignore */ }
  }, [sound])

  // heartbeat: continuously stamp "app is currently open" so that on next launch
  // we can measure how long it's actually been closed, independent of any
  // individual account's own timer
  useEffect(() => {
    const stamp = () => {
      try { localStorage.setItem(HEARTBEAT_KEY, String(Date.now())) } catch { /* ignore */ }
    }
    stamp()
    const id = setInterval(stamp, 2000)
    return () => clearInterval(id)
  }, [])

  // unlock audio on the very first click anywhere in the app — required
  // before the bell can actually produce sound later, since browsers block
  // audio that isn't tied to a real user gesture
  useEffect(() => {
    const handler = () => {
      unlockAudio()
      window.removeEventListener('pointerdown', handler)
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [])

  useEffect(() => {
    const windowMs = returnWindow * 60 * 1000
    const newlyOverdue = accounts.filter(a =>
      a.state === 'running' && a.switchedAt !== null && (now - a.switchedAt >= windowMs)
    )

    if (newlyOverdue.length > 0) {
      const overdueIds = new Set(newlyOverdue.map(a => a.id))
      setAccounts(prev => prev.map(a => {
        if (!overdueIds.has(a.id)) return a
        const t = shakeTimers.current.get(a.id)
        if (t) clearTimeout(t)
        const tid = setTimeout(() => {
          setAccounts(cur => cur.map(x => x.id === a.id ? { ...x, shaking: false } : x))
        }, 600)
        shakeTimers.current.set(a.id, tid)
        return { ...a, state: 'overdue', shaking: true }
      }))
      playSoundChoice(sound, volume)
      newlyOverdue.forEach(a => {
        logHistory(a.name, 'overdue')
        notifyOverdue(a.name)
      })
    }
  }, [now, returnWindow, logHistory, accounts, volume, sound])

  const overdueCount = accounts.filter(a => a.state === 'overdue').length
  const hasOverdue = overdueCount > 0

  const handleAdd = useCallback(() => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setAccounts(prev => [...prev, {
      id: crypto.randomUUID(),
      name: trimmed,
      state: 'running',
      switchedAt: Date.now(),
      shaking: false,
    }])
    logHistory(trimmed, 'added')
    setNameInput('')
  }, [nameInput, logHistory])

  const handleQuickAdd = useCallback((name: string) => {
    setAccounts(prev => [...prev, {
      id: crypto.randomUUID(),
      name,
      state: 'running',
      switchedAt: Date.now(),
      shaking: false,
    }])
    logHistory(name, 'added')
  }, [logHistory])

  // snooze is now the only way to clear an overdue account — it resets the
  // timer to a full fresh window, same as the old "I'm back" behavior
  const handleSnooze = useCallback((id: string) => {
    setAccounts(prev => prev.map(a => {
      if (a.id !== id) return a
      logHistory(a.name, 'snoozed')
      return { ...a, state: 'running', switchedAt: Date.now(), shaking: false }
    }))
  }, [logHistory])

  const handleStop = useCallback((id: string) => {
    setAccounts(prev => prev.map(a => {
      if (a.id !== id) return a
      logHistory(a.name, 'stopped')
      return { ...a, state: 'stopped', switchedAt: null, shaking: false }
    }))
  }, [logHistory])

  const handleResume = useCallback((id: string) => {
    setAccounts(prev => prev.map(a => {
      if (a.id !== id) return a
      logHistory(a.name, 'resumed')
      return { ...a, state: 'running', switchedAt: Date.now() }
    }))
  }, [logHistory])

  // deleting doesn't remove the account for good right away — it's pulled
  // from the list immediately, but held onto for a few seconds so the user
  // can undo before the removal is finalized and logged to history
  const handleRemove = useCallback((id: string) => {
    const target = accounts.find(a => a.id === id)
    if (!target) return

    // finalize any previous pending removal immediately so only one toast
    // (and one pending account) exists at a time
    if (pendingRemoval) {
      clearTimeout(pendingRemoval.timeoutId)
      logHistory(pendingRemoval.account.name, 'removed')
    }

    setAccounts(prev => prev.filter(a => a.id !== id))
    const timeoutId = setTimeout(() => {
      logHistory(target.name, 'removed')
      setPendingRemoval(null)
    }, UNDO_GRACE_PERIOD_MS)
    setPendingRemoval({ account: target, timeoutId })
  }, [accounts, pendingRemoval, logHistory])

  const handleUndoRemove = useCallback(() => {
    setPendingRemoval(current => {
      if (!current) return current
      clearTimeout(current.timeoutId)
      setAccounts(prev => [...prev, current.account])
      return null
    })
  }, [])

  const handleClearHistory = useCallback(() => {
    setHistory([])
  }, [])

  // clear any in-flight undo timeout if the app unmounts mid-grace-period
  useEffect(() => {
    return () => {
      if (pendingRemoval) clearTimeout(pendingRemoval.timeoutId)
    }
  }, [pendingRemoval])

  const handleWindowBlur = () => {
    const v = parseInt(windowInput, 10)
    if (!isNaN(v) && v >= 1) setReturnWindow(v)
    else setWindowInput(String(returnWindow))
  }

  const sorted = [...accounts].sort((a, b) => {
    const order = { overdue: 0, running: 1, stopped: 2 }
    return order[a.state] - order[b.state]
  })

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      backgroundColor: '#FFFDF8',
      position: 'relative',
      overflow: 'hidden',
      /* pixel dot grid background */
      backgroundImage: `
        ${ditherBg('#5A3E9E', 0.09)}
      `,
      backgroundSize: '8px 8px',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* CRT scanline overlay */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(61,46,82,0.022) 3px, rgba(61,46,82,0.022) 4px)',
        mixBlendMode: 'multiply',
      }} />

      {/* Corner "berry" pixel clusters */}
      <PixelBerries />

      {/* App shell — the app IS the card now, sized to its content */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}>

          {/* ── Title bar ── */}
          <div style={{
            backgroundColor: '#3D2E52',
            padding: '5px 10px 5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
            WebkitAppRegion: 'drag',
          } as React.CSSProperties}>
            <span style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '8px',
              color: '#FAF3E6',
              letterSpacing: '0.05em',
              opacity: 0.7,
              flex: 1,
            }}>
              SWITCHBOARD.EXE
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <TitleBarDot color="#C98A3E" icon="─" onClick={() => window.electronAPI?.minimize()} title="Minimize" />
              <TitleBarDot color="#5A3E9E" icon="□" onClick={() => window.electronAPI?.maximizeToggle()} title="Maximize / Restore" />
              <TitleBarDot color="#A23262" icon="×" onClick={() => window.electronAPI?.close()} title="Close" />
            </div>
          </div>

          {/* ── Header band ── */}
          <div style={{
            backgroundColor: '#5A3E9E',
            padding: '12px 14px 11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <h1 style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '13px',
              color: '#FAF3E6',
              margin: 0,
              lineHeight: 1,
              letterSpacing: '0.02em',
              textShadow: `1.5px 1.5px 0 #3D2E52`,
            }}>
              SWITCHBOARD
            </h1>

            {/* Status readout — informational only, not clickable */}
            <div style={{
              border: hasOverdue ? '2px solid #A23262' : '1px dashed rgba(200,186,232,0.35)',
              backgroundColor: hasOverdue ? '#A23262' : 'transparent',
              boxShadow: hasOverdue ? px('#7A1040', 2) : 'none',
              padding: hasOverdue ? '5px 9px' : '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              {hasOverdue ? (
                <>
                  <div style={{
                    width: '8px', height: '8px',
                    backgroundColor: '#FAF3E6',
                    clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
                  }} className="blink" />
                  <span style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                    color: '#FAF3E6',
                    letterSpacing: '0.05em',
                  }}>
                    ALERT
                  </span>
                  <div style={{
                    backgroundColor: '#FAF3E6',
                    color: '#A23262',
                    padding: '2px 5px',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                    minWidth: '18px',
                    textAlign: 'center',
                  }}>
                    {overdueCount}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: '6px', height: '6px', backgroundColor: '#7B62BC' }} />
                  <div style={{ width: '6px', height: '6px', backgroundColor: '#9A80D4' }} />
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10.5px',
                    fontWeight: 500,
                    color: 'rgba(250,243,230,0.6)',
                    letterSpacing: '0.06em',
                  }}>
                    STATUS: CLEAR
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ── Add account section ── */}
          <div style={{ padding: '12px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.12em',
                color: '#7A6890',
              }}>
                // ADD ACCOUNT
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PixelInput
                placeholder="Account name"
                value={nameInput}
                onChange={setNameInput}
                onEnter={handleAdd}
                flex="1"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#7A6890', letterSpacing: '0.04em' }}>
                  MIN
                </span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={windowInput}
                  onChange={e => setWindowInput(e.target.value)}
                  onBlur={handleWindowBlur}
                  className="no-spinner"
                  style={{
                    width: '30px',
                    padding: '6px 2px',
                    border: '2px solid #5A3E9E',
                    backgroundColor: '#FAF3E6',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    fontSize: '11px',
                    color: '#5A3E9E',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>
              <PixelButton
                label="+ ADD"
                disabled={!nameInput.trim()}
                onClick={handleAdd}
                color="#5A3E9E"
              />
            </div>
          </div>

          {/* ── Accounts section ── */}
          <div style={{
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexShrink: 0 }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.12em',
                color: '#7A6890',
              }}>
                // ACCOUNTS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setSettingsOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    lineHeight: 1,
                    opacity: 0.85,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Sound settings"
                >
                  <span className="icon-speaker" style={{ color: '#5A3E9E' }} />
                </button>
                <button
                  onClick={() => setHistoryOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '10.5px',
                    color: '#5A3E9E',
                    letterSpacing: '0.06em',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                  title="View history"
                >
                  HISTORY
                </button>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '10.5px',
                  color: '#B0A0C8',
                  letterSpacing: '0.06em',
                }}>
                  {accounts.length} LOADED
                </span>
              </div>
            </div>

            {accounts.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '28px 16px',
                color: '#C0B0D8',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '8px',
                letterSpacing: '0.06em',
                lineHeight: 2,
              }}>
                NO ACCOUNTS FOUND.<br />
                <span style={{ opacity: 0.6 }}>ADD ONE ABOVE.</span>
              </div>
            )}

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              paddingRight: accounts.length > 0 ? '4px' : '0',
            }}>
              {sorted.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  now={now}
                  returnWindow={returnWindow}
                  onSnooze={handleSnooze}
                  onStop={handleStop}
                  onResume={handleResume}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </div>

      </div>

      {historyOpen && (
        <HistoryPanel
          history={history}
          activeNames={new Set(accounts.map(a => a.name))}
          onClose={() => setHistoryOpen(false)}
          onQuickAdd={handleQuickAdd}
          onClearHistory={handleClearHistory}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          volume={volume}
          onVolumeChange={setVolume}
          sound={sound}
          onSoundChange={setSound}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {pendingRemoval && (
        <Toast
          message={`Removed ${pendingRemoval.account.name}`}
          onUndo={handleUndoRemove}
        />
      )}
    </div>
  )
}