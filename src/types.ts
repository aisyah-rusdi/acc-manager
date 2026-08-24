export type AccountState = 'running' | 'overdue' | 'stopped'

export interface Account {
  id: string
  name: string
  state: AccountState
  switchedAt: number | null
  shaking: boolean
}

export interface HistoryEntry {
  id: string
  accountName: string
  event: 'added' | 'overdue' | 'confirmed' | 'stopped' | 'resumed' | 'removed' | 'snoozed'
  timestamp: number
}

export type SoundChoice = 'bell' | 'sparkle'

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      maximizeToggle: () => void
      close: () => void
    }
  }
}