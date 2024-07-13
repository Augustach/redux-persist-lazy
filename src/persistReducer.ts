import type { Action, Reducer } from '@reduxjs/toolkit'
import { createCombinedProxy, createPersistableProxy, isPersisted } from './persistableProxy'
import type { AnyState, Combined, PersistConfig } from './types'
import getStoredState from './getStoredState'
import { createPersistoid } from './createPersistoid'
import { ACTION_PREFIX, DEFAULT_VERSION } from './constants'
import { autoMergeLevel1 } from './stateReconciler/autoMergeLevel1'
import { register, rehydrate } from './actions'

type StateFromReducer<R> = R extends Reducer<infer S, any, any> ? S : never
type IsCombinedState<R> = R extends Reducer<infer S, any, infer PS> ? (PS extends S ? false : true) : never

type Config<R extends Reducer> =
  // combineReducer invokes properties of state during initialization so we need to be sure
  // that the users define the `combined` flag explicitly
  IsCombinedState<R> extends true ? PersistConfig<StateFromReducer<R>> & Combined : PersistConfig<StateFromReducer<R>>

export function persistReducer<R extends Reducer>(config: Config<R>, reducer: R): R

export function persistReducer<S extends AnyState, A extends Action = Action>(
  config: PersistConfig<S>,
  reducer: Reducer<S, A>
): Reducer<S, A> {
  const { stateReconciler = autoMergeLevel1 } = config
  const version = config.version ?? DEFAULT_VERSION
  const persistoid = createPersistoid(config)
  let reconciledState: S | undefined

  const restoreItem = (state: S) => (): S => {
    if (reconciledState !== undefined) {
      return reconciledState
    }
    const restoredState = getStoredState(config)
    const migratedState = config.migrate ? config.migrate(restoredState, version) : restoredState
    reconciledState = stateReconciler<S>(migratedState, state, state, config)
    persistoid.dispatch(rehydrate(config.key, reconciledState)) // compatibility with redux-persist

    return reconciledState
  }

  const getInitialState = {
    type: `${ACTION_PREFIX}/__GET_EMPTY_STATE`, // It is supposed that this action will never be matched by any reducer
  } as A

  return (state, action) => {
    if (register.match(action)) {
      action.payload.register(persistoid)
    }

    if (state !== undefined) {
      reconciledState = undefined
      const newState = reducer(state, action)

      if (newState !== state) {
        persistoid.update(newState)
      }

      return newState
    }

    const initialState = reducer(state, getInitialState)

    // combineReducer invokes properties of state during initialization so we need to create a proxy for each property
    const createProxy = config.combined ? createCombinedProxy : createPersistableProxy
    const proxyState = createProxy<S>(initialState, restoreItem(initialState))
    const newState = reducer(proxyState, action)

    // combineReducer transforms the state to a plain object
    // so our passed proxy object transforms to a plain object with proxy properties
    if (config.combined && Object.values(newState).every(isPersisted)) {
      return newState
    }

    if (newState !== proxyState) {
      persistoid.update(newState)
    }

    return newState
  }
}
