import { autoMergeLevel2 } from './stateReconciler/autoMergeLevel2'

export { PersistGate } from './integrations/react'
export type { PersistGateProps } from './integrations/react'
export { createMigrate } from './createMigrate'
export { persistReducer } from './persistReducer'
export { autoMergeLevel1 } from './stateReconciler/autoMergeLevel1'
export { hardSet } from './stateReconciler/hardSet'
export { persistCombineReducers } from './persistCombineReducers'
export { persistStore } from './persistStore'

export * from './constants'

export const autoMergeCombinedState = autoMergeLevel2

export { autoMergeLevel2 }

export type { PersistedState, PersistState, PersistConfig, Persistor, CombinedPersistConfig, Lazy } from './types'

export { isPersistable, valueOf, asLazy } from './createLazy'

export { persistCombineReducersLazy } from './persistCombineReducersLazy'
