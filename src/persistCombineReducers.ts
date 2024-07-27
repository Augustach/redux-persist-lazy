import {
  combineReducers,
  type Action,
  type ActionFromReducersMapObject,
  type AnyAction,
  type CombinedState,
  type Reducer,
  type ReducersMapObject,
  type StateFromReducersMapObject,
} from '@reduxjs/toolkit'
import { autoMergeLevel2 } from './stateReconciler/autoMergeLevel2'

import type { AnyState, Lazy, PersistConfig } from './types'
import { register } from './actions'
import { createHelpers } from './createHelpers'
import { createLazy, isPersistable } from './createLazy'
import { NOT_INITIALIZED } from './constants'
import { persistReducer } from './persistReducer'

type LazyPersistConfig<S extends AnyState> = PersistConfig<S> & {
  lazy: boolean
}

export function persistCombineReducers<S extends AnyState>(
  config: LazyPersistConfig<S>,
  reducers: ReducersMapObject<CombinedLazy<S>, any>
): Reducer<CombinedState<S>>

export function persistCombineReducers<S extends AnyState, A extends Action = AnyAction>(
  config: LazyPersistConfig<S>,
  reducers: ReducersMapObject<CombinedLazy<S>, A>
): Reducer<CombinedState<S>, A>

export function persistCombineReducers<S extends AnyState>(
  config: PersistConfig<S>,
  reducers: ReducersMapObject<S, any>
): Reducer<CombinedState<S>>

export function persistCombineReducers<S extends AnyState, A extends Action = AnyAction>(
  config: PersistConfig<S>,
  reducers: ReducersMapObject<S, A>
): Reducer<CombinedState<S>, A>

export function persistCombineReducers<M extends ReducersMapObject<any, any>>(
  config: PersistConfig<StateFromReducersMapObject<M>>,
  reducers: M
): Reducer<CombinedState<StateFromReducersMapObject<M>>, ActionFromReducersMapObject<M>>

export function persistCombineReducers<S extends AnyState>(
  config: PersistConfig<S>,
  reducers: ReducersMapObject<S, any>
): Reducer<CombinedState<S>> {
  config = { stateReconciler: autoMergeLevel2, ...config }

  if (!isCombinedLazyConfig(config)) {
    return persistReducer(config, combineReducers(reducers))
  }

  const { persistoid, restoreItem, getInitialState } = createHelpers<S>(config)
  const reducer = combineReducers(reducers)
  let innerProxy: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  let outerProxy: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  function getOrCreateProxy() {
    if (innerProxy === NOT_INITIALIZED) {
      const initialState = reducer(undefined, getInitialState)
      innerProxy = createCombinedProxy<S>(restoreItem(initialState), config, initialState) as S
      outerProxy = createLazy<S>(restoreItem(initialState))
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

    const nextState = reducer(state, action)

    if (state !== nextState) {
      innerProxy = nextState
      outerProxy = createLazy<S>(() => nextState)
      persistoid.updateIfChanged(state, nextState)
    }

    if (outerProxy === NOT_INITIALIZED) {
      outerProxy = createLazy<S>(() => nextState)
    }

    return outerProxy
  }
}

type CombinedLazy<T extends object, Properties extends keyof T = keyof T> = {
  [K in keyof T]: K extends Properties
    ? T[K] extends Array<any>
      ? Lazy<T[K]>
      : T[K] extends object
        ? T[K]
        : Lazy<T[K]>
    : T[K]
}

const isCombinedLazyConfig = <T extends object>(config: PersistConfig<T>): config is LazyPersistConfig<T> =>
  (config as LazyPersistConfig<T>).lazy === true

export function createCombinedProxy<T extends object>(
  getValue: () => T,
  config: PersistConfig<T>,
  initialState: AnyState
): CombinedLazy<T> {
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

  return combined as CombinedLazy<T>
}
