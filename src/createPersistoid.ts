import type { Action } from '@reduxjs/toolkit'
import { buildKey } from './buildKey'
import { DEFAULT_DELAY, DEFAULT_VERSION, PERSIST_KEY } from './constants'
import type { AnyState, PersistConfig, Persistoid, PersistoidSharedStore } from './types'
import { valueOf } from './createLazy'
import { rehydrate } from './actions'

export function createPersistoid<State extends AnyState>(config: PersistConfig<State>): Persistoid<State> {
  let timerId: ReturnType<typeof setTimeout> | null = null
  const { delay = DEFAULT_DELAY, storage, blacklist, whitelist, version = DEFAULT_VERSION, transforms = [] } = config
  const storageKey = buildKey(config)
  let lastState: State | null = null
  let isPaused = false
  let store: PersistoidSharedStore | null = null
  const pendingActions: Action[] = []

  const setItem = (state: State) => {
    let serializedState: AnyState = {}
    const keys = whitelist || Object.keys(state).filter((key) => blacklist?.includes(key as keyof State) !== true)
    for (const key of keys) {
      const endState = transforms.reduce((subState, transformer) => {
        return transformer.in(subState, key, state)
      }, valueOf(state[key]))

      if (endState !== undefined) {
        serializedState[key as string] = serialize(config, endState)
      }
    }
    serializedState[PERSIST_KEY] = serialize(config, { version, rehydrated: false })
    const value = serialize(config, serializedState)
    storage.setItem(storageKey, value)
    lastState = null
  }

  const cancelPendingSetState = () => {
    timerId && clearTimeout(timerId)
    timerId = null
  }

  const asyncDispatch = ({ dispatch }: PersistoidSharedStore, action: Action) => {
    setTimeout(() => {
      dispatch(action)
    }, 0)
  }

  const update = (state: State) => {
    lastState = state
    if (isPaused) {
      return
    }
    cancelPendingSetState()
    timerId = setTimeout(() => {
      setItem(state)
    }, delay)
  }

  const dispatch: Persistoid<State>['dispatch'] = (action) => {
    if (store) {
      asyncDispatch(store, action)
    } else {
      pendingActions.push(action)
    }
  }

  return {
    setStore(nextStore) {
      store = nextStore
      for (const action of pendingActions) {
        asyncDispatch(store, action)
      }
      pendingActions.length = 0
    },
    dispatch,
    update: update,
    updateIfChanged(prev: State, next: State) {
      if (prev === next) {
        return
      }
      const prevKeys = whitelist ?? Object.keys(prev)
      const nextKeys = whitelist ?? Object.keys(next)
      if (prevKeys.length !== nextKeys.length) {
        update(next)
        return
      }
      for (const key of nextKeys) {
        if (prev[key] !== next[key]) {
          update(next)
          return
        }
      }
    },
    flush() {
      cancelPendingSetState()
      lastState && setItem(lastState)
    },
    pause() {
      cancelPendingSetState()
      isPaused = true
    },
    purge() {
      cancelPendingSetState()
      storage.removeItem(storageKey)
    },
    persist() {
      cancelPendingSetState()
      isPaused = false
      lastState && setItem(lastState)
    },
    rehydrate(reconciledState: State) {
      dispatch(rehydrate(config.key, reconciledState)) // compatibility with redux-persist
      store?.onRehydrate({ key: config.key })
    },
  }
}

function serialize<State extends object>(config: PersistConfig<State>, value: AnyState): string {
  if (config.serialize) {
    return config.serialize(value)
  }

  return JSON.stringify(value)
}
