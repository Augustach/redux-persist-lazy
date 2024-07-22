import type { Action, Reducer } from '@reduxjs/toolkit'
import { createCombinedProxy, createLazy } from './persistableProxy'
import type { AnyState, PersistConfig } from './types'
import getStoredState from './getStoredState'
import { createPersistoid } from './createPersistoid'
import { ACTION_PREFIX, DEFAULT_VERSION } from './constants'
import { autoMergeLevel1 } from './stateReconciler/autoMergeLevel1'
import { register, rehydrate } from './actions'

type StateFromReducer<R> = R extends Reducer<infer S> ? S : never

const NOT_INITIALIZED = Symbol('NOT_INITIALIZED')

export function persistReducer<R extends Reducer>(config: PersistConfig<StateFromReducer<R>>, reducer: R): R
export function persistReducer<S extends AnyState, A extends Action = Action>(
  config: PersistConfig<S>,
  reducer: Reducer<S, A>
): Reducer<S, A>

export function persistReducer<S extends AnyState, A extends Action = Action>(
  config: PersistConfig<S>,
  reducer: Reducer<S, A>
): Reducer<S, A> {
  const { stateReconciler = autoMergeLevel1 } = config
  const version = config.version ?? DEFAULT_VERSION
  const persistoid = createPersistoid(config)
  let reconciledState: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  const getInitialState = {
    type: `${ACTION_PREFIX}/__GET_EMPTY_STATE`, // It is supposed that this action will never be matched by any reducer
  } as A

  const restoreItem = (state: S) => (): S => {
    if (reconciledState !== NOT_INITIALIZED) {
      return reconciledState
    }
    const restoredState = getStoredState(config)
    const migratedState = config.migrate ? config.migrate(restoredState, version) : restoredState
    reconciledState = stateReconciler<S>(migratedState, state, state, config)
    persistoid.dispatch(rehydrate(config.key, reconciledState)) // compatibility with redux-persist

    return reconciledState ?? state
  }

  let proxy: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  function getOrCreateProxy() {
    if (proxy === NOT_INITIALIZED) {
      const initialState = reducer(undefined, getInitialState)
      // combineReducer invokes properties of state during initialization so we need to create a proxy for each property
      const createProxy = config.combined ? createCombinedProxy : createLazy
      proxy = createProxy<S>(restoreItem(initialState), config, initialState)
    }

    return proxy
  }

  function updateIfChanged(prev: S, next: S) {
    if (prev === next) {
      return
    }
    if (config.whitelist) {
      for (const key of config.whitelist) {
        if (prev[key] !== next[key]) {
          persistoid.update(next)
          return
        }
      }
    } else {
      persistoid.update(next)
    }
  }

  return (state, action) => {
    if (register.match(action)) {
      action.payload.register(persistoid)
    }

    if (state === undefined) {
      state = getOrCreateProxy()
    }

    const nextState = reducer(state, action)

    updateIfChanged(state, nextState)

    return nextState
  }
}
