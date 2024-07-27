import type { Action, Reducer } from '@reduxjs/toolkit'
import { createLazy } from './createLazy'
import type { AnyState, PersistConfig } from './types'
import { register } from './actions'
import { createHelpers } from './createHelpers'
import { NOT_INITIALIZED } from './constants'

type StateFromReducer<R> = R extends Reducer<infer S> ? S : never

export function persistReducer<R extends Reducer>(config: PersistConfig<StateFromReducer<R>>, reducer: R): R

export function persistReducer<S extends AnyState, A extends Action = Action>(
  config: PersistConfig<S>,
  reducer: Reducer<S, A>
): Reducer<S, A> {
  const { persistoid, restoreItem, getInitialState } = createHelpers<S>(config)

  let proxy: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  function getOrCreateProxy() {
    if (proxy === NOT_INITIALIZED) {
      const initialState = reducer(undefined, getInitialState)
      proxy = createLazy<S>(restoreItem(initialState))
    }

    return proxy
  }
  return (state, action) => {
    if (register.match(action)) {
      action.payload.register(persistoid)
    }

    if (state === undefined) {
      state = getOrCreateProxy()
    }

    const nextState = reducer(state, action)
    persistoid.updateIfChanged(state, nextState)

    return nextState
  }
}
