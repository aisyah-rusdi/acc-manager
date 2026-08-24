import type { Account, HistoryEntry, SoundChoice } from '../types'

export const DEFAULT_WINDOW = 5
export const DEFAULT_VOLUME = 0.6
export const DEFAULT_SOUND: SoundChoice = 'bell'
export const STORAGE_KEY = 'switchboard.accounts.v2'
export const WINDOW_STORAGE_KEY = 'switchboard.returnWindow.v1'
export const VOLUME_STORAGE_KEY = 'switchboard.volume.v1'
export const SOUND_STORAGE_KEY = 'switchboard.sound.v1'
export const HEARTBEAT_KEY = 'switchboard.lastActive.v1'
export const HISTORY_STORAGE_KEY = 'switchboard.history.v1'
export const HISTORY_MAX_ENTRIES = 200
export const CLOSE_GRACE_PERIOD_MS = 5 * 60 * 1000 // fixed 5 min — independent of the per-account return window

export function loadStoredAccounts(): Account[] {
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

export function loadStoredWindow(): number {
  try {
    const raw = localStorage.getItem(WINDOW_STORAGE_KEY)
    const n = raw ? parseInt(raw, 10) : NaN
    return !isNaN(n) && n >= 1 ? n : DEFAULT_WINDOW
  } catch {
    return DEFAULT_WINDOW
  }
}

export function loadStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
    const n = raw ? parseFloat(raw) : NaN
    return !isNaN(n) && n >= 0 && n <= 1 ? n : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

export function loadStoredHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadStoredSound(): SoundChoice {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY)
    return raw === 'sparkle' ? 'sparkle' : DEFAULT_SOUND
  } catch {
    return DEFAULT_SOUND
  }
}