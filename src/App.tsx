import { useState, useEffect, useRef, useCallback } from 'react'

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      maximizeToggle: () => void
      close: () => void
    }
  }
}

type AccountState = 'running' | 'overdue' | 'stopped'

interface Account {
  id: string
  name: string
  notes: string
  state: AccountState
  switchedAt: number | null
  shaking: boolean
}

interface HistoryEntry {
  id: string
  accountName: string
  event: 'added' | 'overdue' | 'confirmed' | 'stopped' | 'resumed' | 'removed'
  timestamp: number
}

const DEFAULT_WINDOW = 5
const DEFAULT_VOLUME = 0.6
const STORAGE_KEY = 'switchboard.accounts.v2'
const WINDOW_STORAGE_KEY = 'switchboard.returnWindow.v1'
const VOLUME_STORAGE_KEY = 'switchboard.volume.v1'
const HEARTBEAT_KEY = 'switchboard.lastActive.v1'
const HISTORY_STORAGE_KEY = 'switchboard.history.v1'
const HISTORY_MAX_ENTRIES = 200
const CLOSE_GRACE_PERIOD_MS = 5 * 60 * 1000 // fixed 5 min — independent of the per-account return window

function loadStoredAccounts(): Account[] {
  try {
    // Was the app closed for longer than the grace period? If so, this was
    // an intentional close (done for the day) — start fresh instead of
    // restoring old accounts/timers.
    const lastActiveRaw = localStorage.getItem(HEARTBEAT_KEY)
    if (lastActiveRaw) {
      const lastActive = parseInt(lastActiveRaw, 10)
      if (!isNaN(lastActive) && Date.now() - lastActive > CLOSE_GRACE_PERIOD_MS) {
        return []
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // never restore mid-shake animation state
    return parsed.map((a: Account) => ({ ...a, shaking: false }))
  } catch {
    return []
  }
}

function loadStoredWindow(): number {
  try {
    const raw = localStorage.getItem(WINDOW_STORAGE_KEY)
    const n = raw ? parseInt(raw, 10) : NaN
    return !isNaN(n) && n >= 1 ? n : DEFAULT_WINDOW
  } catch {
    return DEFAULT_WINDOW
  }
}

function loadStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    const n = raw ? parseFloat(raw) : NaN
    return !isNaN(n) && n >= 0 && n <= 1 ? n : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

function loadStoredHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/* ─── synthesized one-shot bell chime (no external audio file needed) ───
   A single shared AudioContext is created and unlocked the first time the
   user clicks anything in the app (satisfies the browser's autoplay policy,
   which blocks sound that isn't tied to a real user gesture). Every later
   bell — even ones triggered by a background timer — reuses that same
   already-unlocked context, so it can actually produce sound. */
let sharedAudioCtx: AudioContext | null = null
let audioUnlocked = false

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      sharedAudioCtx = new AudioCtx()
    }
    return sharedAudioCtx
  } catch {
    return null
  }
}

function unlockAudio() {
  if (audioUnlocked) return
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ })
  }
  // play a near-silent buffer — fully unlocks audio output on some platforms
  // even when the context reports itself as already "running"
  try {
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // ignore
  }
  audioUnlocked = true
}

function playOverdueBell(volume: number) {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* ignore */ })
    }
    const now = ctx.currentTime

    const tone = (freq: number, startGain: number, duration: number, delay: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      gain.gain.setValueAtTime(0.0001, now + delay)
      gain.gain.exponentialRampToValueAtTime(startGain * volume, now + delay + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + delay)
      osc.stop(now + delay + duration + 0.05)
    }

    const RING_COUNT = 3
    const RING_SPACING = 0.4 // seconds between the start of each ring
    for (let i = 0; i < RING_COUNT; i++) {
      const base = i * RING_SPACING
      tone(1046.5, 0.28, 0.3, base)         // C6
      tone(1568.0, 0.14, 0.2, base + 0.02)  // G6 overtone
    }
  } catch {
    // audio unavailable — fail silently, never block the app
  }
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [active])
  return now
}

/* ─── pixel shadow helper ─── */
const px = (color: string, d = 3) =>
  `${d}px ${d}px 0 ${color}`

/* ─── dither pattern (2×2 checkerboard as data URI) ─── */
const ditherBg = (color: string, alpha: number) => {
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `radial-gradient(circle, rgba(${r},${g},${b},${alpha}) 1px, transparent 1px)`
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>(loadStoredAccounts)
  const [history, setHistory] = useState<HistoryEntry[]>(loadStoredHistory)
  const [nameInput, setNameInput] = useState('')
  const [returnWindow, setReturnWindow] = useState(loadStoredWindow)
  const [windowInput, setWindowInput] = useState(() => String(loadStoredWindow()))
  const [volume, setVolume] = useState(loadStoredVolume)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
      playOverdueBell(volume)
      newlyOverdue.forEach(a => logHistory(a.name, 'overdue'))
    }
  }, [now, returnWindow, logHistory, accounts, volume])

  const overdueCount = accounts.filter(a => a.state === 'overdue').length
  const hasOverdue = overdueCount > 0

  const handleAdd = useCallback(() => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setAccounts(prev => [...prev, {
      id: crypto.randomUUID(),
      name: trimmed,
      notes: '',
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
      notes: '',
      state: 'running',
      switchedAt: Date.now(),
      shaking: false,
    }])
    logHistory(name, 'added')
  }, [logHistory])

  const handleImBack = useCallback((id: string) => {
    setAccounts(prev => prev.map(a => {
      if (a.id !== id) return a
      logHistory(a.name, 'confirmed')
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

  const handleRemove = useCallback((id: string) => {
    setAccounts(prev => {
      const target = prev.find(a => a.id === id)
      if (target) logHistory(target.name, 'removed')
      return prev.filter(a => a.id !== id)
    })
  }, [logHistory])

  const handleClearHistory = useCallback(() => {
    setHistory([])
  }, [])

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
                    fontSize: '11px',
                    lineHeight: 1,
                    opacity: 0.85,
                  }}
                  title="Sound settings"
                >
                  🔊
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
                  onImBack={handleImBack}
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
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

/* ─── Pixel panel wrapper ─── */
function PixelPanel({
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

/* ─── Pixel input ─── */
function PixelInput({ placeholder, value, onChange, onEnter, flex }: {
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

/* ─── Pixel button ─── */
function PixelButton({ label, onClick, disabled, color }: {
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

/* ─── Account card ─── */
function AccountCard({ account, now, returnWindow, onImBack, onStop, onResume, onRemove }: {
  account: Account
  now: number
  returnWindow: number
  onImBack: (id: string) => void
  onStop: (id: string) => void
  onResume: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { id, name, notes, state, switchedAt, shaking } = account
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

        {/* Name + notes */}
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
          {notes ? (
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '10.5px',
              color: '#9A88B0',
              marginTop: '2px',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {notes}
            </div>
          ) : isStopped ? (
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
            <PixelButton label="I'M BACK" onClick={() => onImBack(id)} color="#3D2E52" />
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

/* ─── Title bar window control dot ─── */
function TitleBarDot({ color, icon, onClick, title }: {
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

function PixelIconButton({ onClick }: { onClick: () => void }) {
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

/* ─── relative time formatting ─── */
function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp
  if (diff < 30 * 1000) return 'just now'
  if (diff < 60 * 1000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}d ago`
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

const EVENT_META: Record<HistoryEntry['event'], { label: string; color: string }> = {
  added: { label: 'ADDED', color: '#5A3E9E' },
  overdue: { label: 'OVERDUE', color: '#A23262' },
  confirmed: { label: "I'M BACK", color: '#C98A3E' },
  stopped: { label: 'STOPPED', color: '#8A7BA8' },
  resumed: { label: 'RESUMED', color: '#5A3E9E' },
  removed: { label: 'REMOVED', color: '#B0A0C8' },
}

/* ─── History popup ─── */
function HistoryPanel({ history, activeNames, onClose, onQuickAdd, onClearHistory }: {
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

/* ─── Settings popup (volume) ─── */
function SettingsPanel({ volume, onVolumeChange, onClose }: {
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

/* ─── Decorative pixel berry clusters ─── */
function PixelBerries() {
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