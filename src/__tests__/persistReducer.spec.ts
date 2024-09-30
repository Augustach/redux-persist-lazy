import { combineReducers, configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { persistReducer } from '../persistReducer'
import { makeMockedStorage, serialize, wait } from './utils'
import { buildKey } from '../buildKey'
import { withReduxPersist } from '../getDefaultMiddleware'
import { persistStore } from '../persistStore'

const cached = {
  holder: {
    a: {
      value: 10,
    },
    b: {
      value: 20,
    },
  },
}

const other = createSlice({
  name: 'other',
  initialState: {
    value: 0,
  },
  reducers: {
    increment: (state) => {
      state.value += 1
    },
  },
})

const sliceInitialState: {
  holder: Record<string, { value: number }>
} = {
  holder: {},
}

const slice = createSlice({
  name: 'slice',
  initialState: sliceInitialState,
  reducers: {
    increment: (state, action: PayloadAction<string>) => {
      const item = state.holder[action.payload]
      if (!item) {
        state.holder[action.payload] = {
          value: 1,
        }
        return
      }
      item.value += 1
    },
  },
})

describe('persistReducer', () => {
  it('should handle JSON.stringify method', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
    }
    storage.setItem(buildKey(config), serialize(cached))
    const persistedReducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
        [other.name]: other.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    const json = JSON.stringify(store.getState())
    expect(storage.getItem).toHaveBeenCalledTimes(1)

    expect(json).toBe('{"slice":{"holder":{"a":{"value":10},"b":{"value":20}}},"other":{"value":0}}')
  })

  it('should extract persisted state on dispatching', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
    }
    storage.setItem(buildKey(config), serialize(cached))
    const persistedReducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
        [other.name]: other.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    store.dispatch(slice.actions.increment('a'))
    store.dispatch(slice.actions.increment('b'))
    store.dispatch(slice.actions.increment('c'))

    expect(storage.getItem).toHaveBeenCalledTimes(1)
    expect(store.getState()).toEqual({
      slice: {
        holder: {
          a: {
            value: 11,
          },
          b: {
            value: 21,
          },
          c: {
            value: 1,
          },
        },
      },
      other: {
        value: 0,
      },
    })
  })

  it('should not extract persisted state if action is dispatched for other slice', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
    }
    storage.setItem(buildKey(config), serialize(cached))
    const persistedReducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
        [other.name]: other.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    store.dispatch(other.actions.increment())

    expect(storage.getItem).not.toHaveBeenCalled()
  })

  it('should extract persisted state if state was selected', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
    }
    storage.setItem(buildKey(config), serialize(cached))
    const persistedReducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
        [other.name]: other.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    type State = ReturnType<(typeof store)['getState']>
    const selector = (key: string) => (state: State) => state.slice.holder[key]?.value

    expect(selector('a')(store.getState())).toBe(10)
    expect(selector('b')(store.getState())).toBe(20)
    expect(storage.getItem).toHaveBeenCalledTimes(1)
  })

  it('should not extract state on getState if state was not selected', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
    }
    storage.setItem(buildKey(config), serialize(cached))
    const persistedReducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
        [other.name]: other.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    store.getState()
    expect(storage.getItem).not.toHaveBeenCalled()
  })

  it('should return initial state if storage is empty', () => {
    const storage = makeMockedStorage()
    const persistedReducer = persistReducer(
      {
        key: 'mock',
        storage,
      },
      slice.reducer
    )
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
        [other.name]: other.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    const state = store.getState()

    expect(state.slice.holder).toEqual({})
  })

  it('should not persist initial state', async () => {
    const storage = makeMockedStorage()
    const delay = 10
    const sliceConfig = {
      key: 'slice',
      storage,
      delay,
    } as const
    const otherConfig = {
      key: 'other',
      storage,
      delay,
    } as const

    const store = configureStore({
      reducer: combineReducers({
        slice: persistReducer(sliceConfig, slice.reducer),
        other: persistReducer(otherConfig, other.reducer),
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    await wait(delay)
    expect(storage.getItem(buildKey(otherConfig))).toBe(null)
    expect(storage.getItem(buildKey(sliceConfig))).toBe(null)

    store.dispatch(slice.actions.increment('a'))

    await wait(delay)

    expect(storage.getItem(buildKey(sliceConfig))).toBe(
      serialize({
        holder: {
          a: { value: 1 },
        },
        _persist: { version: -1, rehydrated: false },
      })
    )
    expect(storage.getItem(buildKey(otherConfig))).toBe(null)
  })

  it('should handle nullable initial state', () => {
    const storage = makeMockedStorage()
    const delay = 10
    type State = { value: number } | null
    const innerSlice = createSlice({
      name: 'slice',
      initialState: null as State,
      reducers: {},
    })
    const config = {
      key: 'slice',
      storage,
      delay,
    } as const
    const store = configureStore({
      reducer: {
        [slice.name]: persistReducer(config, innerSlice.reducer),
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    const value = store.getState()[innerSlice.name]?.value
    expect(value).toBe(undefined)
  })

  it('should not be rehydrated unless a persisted properly requested', async () => {
    const storage = makeMockedStorage()
    const simple = createSlice({
      name: 'simple',
      initialState: {
        a: 1,
        b: 2,
      },
      reducers: {
        increment: (state, action: PayloadAction<'a' | 'b'>) => {
          state[action.payload] += 1
        },
      },
    })
    const delay = 10
    const config = {
      key: 'root',
      storage,
      delay,
      whitelist: ['a'],
    } as const
    const reducer = persistReducer(config, simple.reducer)
    const store = configureStore({
      reducer: reducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withReduxPersist({})),
    })
    persistStore(store)

    expect(store.getState().b === 2).toBe(true)
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(storage.getItem(buildKey(config))).toBe(null)

    store.dispatch(simple.actions.increment('b'))

    expect(store.getState().b).toBe(3)
    expect(store.getState().a).toBe(1)
    expect(storage.getItem).toHaveBeenCalledTimes(2)
  })
})
