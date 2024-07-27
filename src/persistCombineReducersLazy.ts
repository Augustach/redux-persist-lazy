import { combineReducers, type Action, type AnyAction, type Reducer } from '@reduxjs/toolkit'
import { autoMergeLevel2 } from './stateReconciler/autoMergeLevel2'

import type { AnyState, Lazy, PersistConfig } from './types'
import { register } from './actions'
import { createHelpers } from './createHelpers'
import { createLazy, isPersistable } from './createLazy'
import { NOT_INITIALIZED } from './constants'

type CanNotBeLazy = string | number | boolean | Date | Array<any> | Map<any, any> | Set<any>

type LazyReducersMapObject<S extends AnyState, A extends Action = Action> = {
  [K in keyof S]: S[K] extends CanNotBeLazy ? Reducer<Lazy<S[K]>, A> : Reducer<S[K], A>
}

type GetOrigin<T> = T extends Lazy<infer V> ? V : T

export type ToState<S extends AnyState> = {
  [K in keyof S]: GetOrigin<S[K]>
}

// export function lazyPersistCombineReducers<S extends AnyState>(
//   config: PersistConfig<S>,
//   reducers: LazyReducersMapObject<S, any>
// ): Reducer<CombinedState<S>>

export function persistCombineReducersLazy<S extends AnyState, A extends Action = AnyAction>(
  config: PersistConfig<S>,
  reducers: LazyReducersMapObject<S, A>
): Reducer<ToState<S>, A>

// export function lazyPersistCombineReducers<M extends LazyReducersMapObject<any, any>>(
//   config: PersistConfig<StateFromReducersMapObject<M>>,
//   reducers: M
// ): Reducer<CombinedState<StateFromReducersMapObject<M>>, ActionFromReducersMapObject<M>>

export function persistCombineReducersLazy<S extends AnyState>(
  config: PersistConfig<S>,
  reducers: LazyReducersMapObject<S>
): Reducer<ToState<S>> {
  config = { stateReconciler: autoMergeLevel2, ...config }
  type State = ToState<S>
  const { persistoid, restoreItem, getInitialState } = createHelpers<State>(config)
  const reducer = combineReducers(reducers)
  let innerProxy: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  let outerProxy: State | typeof NOT_INITIALIZED = NOT_INITIALIZED
  function getOrCreateProxy() {
    if (innerProxy === NOT_INITIALIZED) {
      const initialState = reducer(undefined, getInitialState) as State
      innerProxy = createCombinedProxy<S>(restoreItem(initialState), config, initialState)
      outerProxy = createLazy<State>(restoreItem(initialState))
    }

    return innerProxy
  }
  return (state, action) => {
    if (register.match(action)) {
      action.payload.register(persistoid)
    }

    if (state === undefined) {
      state = getOrCreateProxy()
    }

    if (state === outerProxy) {
      state = getOrCreateProxy()
    }

    // @ts-expect-error
    const nextState = reducer(state, action) as State

    if (state !== nextState) {
      innerProxy = nextState
      outerProxy = createLazy<State>(() => nextState)
      persistoid.updateIfChanged(state, nextState)
    }

    if (outerProxy === NOT_INITIALIZED) {
      outerProxy = createLazy<State>(() => nextState)
    }

    return outerProxy
  }
}

export function createCombinedProxy<T extends object>(
  getValue: () => T,
  config: PersistConfig<T>,
  initialState: AnyState
): T {
  const getPersisted = (): AnyState => getValue() ?? initialState
  const combined = {} as AnyState
  const keys = Object.keys(initialState)
  const { whitelist } = config

  const createPropProxy = (key: string) =>
    createLazy(() => {
      const target = getPersisted()
      return target?.[key] ?? initialState[key]
    })

  for (const key of keys) {
    const value = initialState[key]
    if (isPersistable(value)) {
      combined[key] = value
    } else if (!whitelist) {
      combined[key] = createPropProxy(key)
    } else if (whitelist.includes(key as keyof T)) {
      combined[key] = createPropProxy(key)
    } else {
      combined[key] = value
    }
  }

  return combined as T
}
