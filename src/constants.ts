export const DEFAULT_VERSION = -1
export const ACTION_PREFIX = 'persistV2' as const
export const KEY_PREFIX = 'persist:'
export const FLUSH = `${ACTION_PREFIX}/FLUSH` as const
export const REHYDRATE = `${ACTION_PREFIX}/REHYDRATE` as const
export const PAUSE = `${ACTION_PREFIX}/PAUSE` as const
export const PERSIST = `${ACTION_PREFIX}/PERSIST` as const
export const PURGE = `${ACTION_PREFIX}/PURGE` as const
export const REGISTER = `${ACTION_PREFIX}/REGISTER` as const
export const PERSIST_KEY = '_persist'
export const DEFAULT_DELAY = 100
export const NOT_INITIALIZED = Symbol('NOT_INITIALIZED')
