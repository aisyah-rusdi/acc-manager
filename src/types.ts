export type AccountState = 'running' | 'overdue' | 'stopped'

export interface Account {
  id: string
  name: string
  notes: string
  state: AccountState
  switchedAt: number | null
  shaking: boolean
}

export interface HistoryEntry {
  id: string
  accountName: string
  event: 'added' | 'overdue' | 'confirmed' | 'stopped' | 'resumed' | 'removed'
  timestamp: number
}

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      maximizeToggle: () => void
      close: () => void
    }
  }
}
