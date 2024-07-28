import { combineReducers, type Action, type AnyAction, type Reducer } from '@reduxjs/toolkit'
import { autoMergeLevel2 } from './stateReconciler/autoMergeLevel2'

import type { AnyState, Lazy, PersistConfig } from './types'
import { register } from './actions'
import { createHelpers } from './createHelpers'
import { createLazy, isPersistable, proxies, valueOf } from './createLazy'
import { NOT_INITIALIZED } from './constants'

type CanNotBeLazy = string | number | boolean | Date | Array<any> | Map<any, any> | Set<any>

type LazyReducersMapObject<S extends AnyState, A extends Action = Action> = {
  [K in keyof S]: S[K] extends CanNotBeLazy ? Reducer<Lazy<S[K]>, A> : Reducer<S[K], A>
}

type GetOrigin<T> = T extends Lazy<infer V> ? V : T

export type ToState<S extends AnyState> = {
  [K in keyof S]: GetOrigin<S[K]>
}

export function persistCombineReducersLazy<S extends AnyState>(
  config: PersistConfig<S>,
  reducers: LazyReducersMapObject<S, any>
): Reducer<ToState<S>>

export function persistCombineReducersLazy<S extends AnyState, A extends Action = AnyAction>(
  config: PersistConfig<S>,
  reducers: LazyReducersMapObject<S, A>
): Reducer<ToState<S>, A>

export function persistCombineReducersLazy<S extends AnyState>(
  config: PersistConfig<S>,
  reducers: LazyReducersMapObject<S>
): Reducer<ToState<S>> {
  config = { stateReconciler: autoMergeLevel2, ...config }
  type State = ToState<S>
  const { persistoid, restoreItem, getInitialState, isRestored } = createHelpers<State>(config)
  const reducer = combineReducers(reducers)
  let innerProxy: S | typeof NOT_INITIALIZED = NOT_INITIALIZED
  let outerProxy: State | typeof NOT_INITIALIZED = NOT_INITIALIZED
  function getOrCreateProxy() {
    if (innerProxy === NOT_INITIALIZED) {
      const initialState = reducer(undefined, getInitialState) as State
      innerProxy = createInnerProxy<S>(restoreItem(initialState), config, initialState)
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

    if (outerProxy === NOT_INITIALIZED) {
      outerProxy = createOuterProxy(state, config)
    }

    // @ts-expect-error
    const nextState = reducer(state, action) as State

    if (state !== nextState) {
      if (isRestored()) {
        innerProxy = toPlainObject(nextState, config)
        outerProxy = innerProxy
      } else {
        innerProxy = nextState
        outerProxy = createOuterProxy(innerProxy, config)
      }
      persistoid.updateIfChanged(state, innerProxy)
    }

    return outerProxy
  }
}

function toPlainObject<T extends AnyState>(innerProxy: T, config: PersistConfig<T>): T {
  const plain = {} as T
  const whitelist = config.whitelist ?? Object.keys(innerProxy)

  for (const key in innerProxy) {
    if (whitelist.includes(key as keyof T)) {
      plain[key] = valueOf(innerProxy[key])
    } else {
      plain[key] = innerProxy[key]
    }
  }

  return plain
}

export function createInnerProxy<T extends object>(
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

export function createOuterProxy<T extends AnyState>(innerProxy: T, config: PersistConfig<T>): T {
  const whitelist = config.whitelist ?? Object.keys(innerProxy)
  const proxy = new Proxy(innerProxy, {
    get(target, prop, receiver) {
      if (whitelist.includes(prop as keyof T)) {
        return valueOf(Reflect.get(target, prop, receiver))
      }
      return Reflect.get(target, prop, receiver)
    },
  })

  proxies.add(proxy)

  return proxy
}
