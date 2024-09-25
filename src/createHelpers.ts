import type { AnyState, PersistConfig } from './types'
import getStoredState from './getStoredState'
import { createPersistoid } from './createPersistoid'
import { ACTION_PREFIX, DEFAULT_VERSION } from './constants'
import { autoMergeLevel1 } from './stateReconciler/autoMergeLevel1'

const NOT_INITIALIZED = Symbol('NOT_INITIALIZED')

export function createHelpers<S extends AnyState>(config: PersistConfig<S>) {
  const version = config.version ?? DEFAULT_VERSION
  const persistoid = createPersistoid(config)
  const whitelist = config.whitelist
  let isRestored = false
  let reconciledState: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  const getInitialState = {
    type: `${ACTION_PREFIX}/__GET_EMPTY_STATE`, // It is supposed that this action will never be matched by any reducer
  } as any
  const { stateReconciler = autoMergeLevel1 } = config
  const restoreItem =
    (state: S) =>
    (key?: string | symbol): S => {
      if (reconciledState !== NOT_INITIALIZED) {
        return reconciledState
      }
      if (key && whitelist && !whitelist.includes(key as keyof S)) {
        return state
      }
      const restoredState = getStoredState(config)
      const migratedState = config.migrate ? config.migrate(restoredState, version) : restoredState
      reconciledState = stateReconciler<S>(migratedState, state, state, config)
      persistoid.rehydrate(reconciledState) // compatibility with redux-persist
      isRestored = true

      return reconciledState ?? state
    }

  return {
    persistoid,
    getInitialState,
    restoreItem,
    isRestored() {
      return isRestored
    },
  }
}
