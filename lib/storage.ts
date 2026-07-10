import { normalizeCharacter, type Character } from './types'

const STORAGE_KEY = 'reino-dos-gastos-v1'
const BACKUP_VERSION = 1

export interface AppState {
  userName: string
  isLoggedIn: boolean
  characters: Character[]
  lastOpenedAt: string
}

export interface BackupFile {
  app: 'reino-dos-gastos'
  version: number
  exportedAt: string
  state: AppState
}

const DEFAULT_STATE: AppState = {
  userName: '',
  isLoggedIn: false,
  characters: [],
  lastOpenedAt: new Date().toISOString(),
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as AppState
    return {
      ...DEFAULT_STATE,
      ...parsed,
      characters: (parsed.characters ?? []).map(normalizeCharacter),
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      lastOpenedAt: new Date().toISOString(),
    }))
  } catch {
    // localStorage full or unavailable
  }
}

export function clearState(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function createBackup(state: AppState): BackupFile {
  return {
    app: 'reino-dos-gastos',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state: {
      ...DEFAULT_STATE,
      ...state,
      characters: state.characters ?? [],
      lastOpenedAt: state.lastOpenedAt || new Date().toISOString(),
    },
  }
}

export function parseBackup(raw: string): AppState {
  const parsed = JSON.parse(raw) as Partial<BackupFile> | Partial<AppState>
  const state = 'state' in parsed ? parsed.state : parsed

  if (!state || typeof state !== 'object') {
    throw new Error('Arquivo de backup inválido.')
  }

  const maybeState = state as Partial<AppState>
  if (!Array.isArray(maybeState.characters)) {
    throw new Error('Backup sem personagens válidos.')
  }

  return {
    ...DEFAULT_STATE,
    userName: typeof maybeState.userName === 'string' ? maybeState.userName : DEFAULT_STATE.userName,
    isLoggedIn: Boolean(maybeState.isLoggedIn || maybeState.userName),
    characters: maybeState.characters.map(normalizeCharacter),
    lastOpenedAt: typeof maybeState.lastOpenedAt === 'string' ? maybeState.lastOpenedAt : new Date().toISOString(),
  }
}
