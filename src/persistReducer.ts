import type { Action, Reducer } from '@reduxjs/toolkit'
import { createLazy } from './createLazy'
import type { AnyState, PersistConfig } from './types'
import { getInitialState, purge, register } from './actions'
import { NOT_INITIALIZED } from './constants'
import { createPersistoid } from './createPersistoid'

type StateFromReducer<R> = R extends Reducer<infer S> ? S : never

export function persistReducer<R extends Reducer>(config: PersistConfig<StateFromReducer<R>>, reducer: R): R

export function persistReducer<S extends AnyState, A extends Action = Action>(
  config: PersistConfig<S>,
  reducer: Reducer<S, A>
): Reducer<S, A> {
  const persistoid = createPersistoid(config)

  let proxy: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  function getOrCreateProxy() {
    if (proxy === NOT_INITIALIZED) {
      const initialState = reducer(undefined, getInitialState)
      proxy = createLazy<S>(persistoid.restore(initialState))
    }

    return proxy
  }
  return (state, action) => {
    if (register.match(action)) {
      action.payload.register(persistoid)
    } else if (purge.match(action)) {
      proxy = NOT_INITIALIZED
    }

    if (state === undefined) {
      state = getOrCreateProxy()
    }

    const nextState = reducer(state, action)
    persistoid.updateIfChanged(state, nextState)

    return nextState
  }
}
