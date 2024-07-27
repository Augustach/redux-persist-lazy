import { configureStore, createSlice } from '@reduxjs/toolkit'
import { makeMockedStorage, serialize, wait } from './utils'
import { asLazy, autoMergeLevel1, persistCombineReducers, persistReducer } from '../'
import { buildKey } from '../buildKey'
import { withPerist } from '../getDefaultMiddleware'
import type { Lazy } from '../types'

const a = createSlice({
  name: 'a',
  initialState: {
    value: 0,
  },
  reducers: {
    increment: (state) => {
      state.value += 1
    },
  },
})

const b = createSlice({
  name: 'b',
  initialState: {
    value: 0,
  },
  reducers: {
    increment: (state) => {
      state.value += 1
    },
  },
})

describe('persistCombineReducers', () => {
  it('should be lazy', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'combined',
      lazy: true,
      storage,
    }
    const persistedReducer = persistCombineReducers(config, {
      a: a.reducer,
      b: b.reducer,
    })
    const store = configureStore({
      reducer: persistedReducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    expect(storage.getItem).not.toHaveBeenCalled()

    const state = store.getState()

    expect(state.a.value).toBe(0)
    expect(state.b.value).toBe(0)
    expect(storage.getItem).toHaveBeenCalledTimes(1)
    expect(storage.getItem).toHaveBeenCalledWith(buildKey(config))
  })

  it('should be lazy for peristed nested reducers', () => {
    const storage = makeMockedStorage()
    const rootConfig = {
      key: 'root',
      lazy: true,
      storage,
    }
    const aConfig = {
      key: 'a',
      storage,
    }
    const persistedReducer = persistCombineReducers(rootConfig, {
      a: persistReducer(aConfig, a.reducer),
      b: b.reducer,
    })
    const store = configureStore({
      reducer: persistedReducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    expect(storage.getItem).not.toHaveBeenCalled()

    const state = store.getState()

    expect(state.b.value).toBe(0)
    expect(storage.getItem).toHaveBeenCalledTimes(1)
    expect(storage.getItem).toHaveBeenLastCalledWith(buildKey(rootConfig))

    expect(state.a.value).toBe(0)
    expect(storage.getItem).toHaveBeenCalledTimes(2)
    expect(storage.getItem).toHaveBeenLastCalledWith(buildKey(aConfig))
  })

  it('deep nested reducers', () => {
    const storage = makeMockedStorage()
    const rootConfig = {
      key: 'root',
      lazy: true,
      storage,
    }
    const persistedReducer = persistCombineReducers(rootConfig, {
      level1: persistCombineReducers(
        {
          key: 'level1',
          storage,
        },
        {
          persistedA: persistReducer(
            {
              key: 'persistedA',
              storage,
            },
            a.reducer
          ),
          reducer: a.reducer,
        }
      ),
      persistedA: persistReducer(
        {
          key: 'persistedA',
          storage,
        },
        a.reducer
      ),
      reducer: a.reducer,
    })

    const store = configureStore({
      reducer: persistedReducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    expect(JSON.stringify(store.getState())).toBe(
      JSON.stringify({
        level1: {
          persistedA: { value: 0 },
          reducer: { value: 0 },
        },
        persistedA: { value: 0 },
        reducer: { value: 0 },
      })
    )
  })

  it('should not persist initial state', async () => {
    const storage = makeMockedStorage()
    const delay = 10
    const sliceConfig = {
      key: 'slice',
      storage,
      delay,
    } as const
    const rootConfig = {
      key: 'root',
      storage,
      lazy: true,
      delay,
      whitelist: ['b'],
    } as const

    const store = configureStore({
      reducer: persistCombineReducers({ ...rootConfig } as any, {
        a: persistReducer(sliceConfig, a.reducer),
        b: b.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    await wait(delay)
    expect(storage.getItem(buildKey(rootConfig))).toBe(null)
    expect(storage.getItem(buildKey(sliceConfig))).toBe(null)

    store.dispatch(b.actions.increment())

    await wait(delay)

    expect(storage.getItem(buildKey(rootConfig))).toBe(
      serialize({
        b: { value: 1 },
        _persist: { version: -1, rehydrated: false },
      })
    )
    expect(storage.getItem(buildKey(sliceConfig))).toBe(null)
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
      key: 'root',
      storage,
      delay,
      stateReconciler: autoMergeLevel1,
      lazy: true,
      whilelist: [innerSlice.name],
    } as const
    const store = configureStore({
      reducer: persistCombineReducers(config, {
        [innerSlice.name]: innerSlice.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    const value = store.getState()[innerSlice.name]?.value
    expect(value).toBe(undefined)
  })

  it('should not restore data if only reducer with primitive value touched', async () => {
    const storage = makeMockedStorage()
    const delay = 10
    const sliceConfig = {
      key: 'slice',
      storage,
      delay,
    } as const
    const rootConfig = {
      key: 'root',
      storage,
      delay,
      lazy: true,
      whitelist: ['b'],
    } as const

    const primitive = createSlice({
      name: 'primitive',
      initialState: 0,
      reducers: {
        increment: (state) => state + 1,
      },
    })

    const store = configureStore({
      reducer: persistCombineReducers({ ...rootConfig } as any, {
        a: persistReducer(sliceConfig, a.reducer),
        b: b.reducer,
        [primitive.name]: primitive.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    const value = store.getState()[primitive.name]

    expect(value).toBe(0)
    expect(storage.getItem).toHaveBeenCalledTimes(0)
    expect(storage.getItem(buildKey(rootConfig))).toBe(null)
    expect(storage.getItem(buildKey(sliceConfig))).toBe(null)
  })

  it('should not persist data if not persisted reducer dispatched', async () => {
    const storage = makeMockedStorage()
    const delay = 10
    const sliceConfig = {
      key: 'slice',
      storage,
      delay,
    } as const
    const rootConfig = {
      key: 'root',
      storage,
      delay,
      lazy: true,
      whitelist: ['b'],
    } as const

    const primitive = createSlice({
      name: 'primitive',
      initialState: 0,
      reducers: {
        increment: (state) => state + 1,
      },
    })

    const store = configureStore({
      reducer: persistCombineReducers({ ...rootConfig } as any, {
        a: persistReducer(sliceConfig, a.reducer),
        b: b.reducer,
        [primitive.name]: primitive.reducer,
      }),
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    store.dispatch(primitive.actions.increment())

    await wait(delay)

    expect(storage.getItem).toHaveBeenCalledTimes(0)
    expect(storage.setItem).toHaveBeenCalledTimes(0)
    expect(storage.getItem(buildKey(rootConfig))).toBe(null)
    expect(storage.getItem(buildKey(sliceConfig))).toBe(null)
  })

  it('should return primitives as is', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'combined',
      lazy: true,
      storage,
    }
    const numberReducer = (state: Lazy<number> = 0) => state
    const stringReducer = (state: Lazy<string> = 'str') => state
    const boolReducer = (state: Lazy<boolean> = true) => state
    const objectReducer = (state: { a: number } = { a: 0 }) => state
    const listReducer = (state: Lazy<number[]> = asLazy([1, 2, 3])) => state
    const persistedReducer = persistCombineReducers(config, {
      number: numberReducer,
      string: stringReducer,
      bool: boolReducer,
      list: listReducer,
      objectReducer: objectReducer,
    })
    const store = configureStore({
      reducer: persistedReducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    const state = store.getState()

    expect(state.number).toBe(0)
    expect(typeof state.number).toBe('number')

    expect(state.string).toBe('str')
    expect(typeof state.string).toBe('string')

    expect(state.bool).toBe(true)
    expect(typeof state.bool).toBe('boolean')

    expect(state.objectReducer).toEqual({ a: 0 })
    expect(typeof state.objectReducer).toBe('object')

    expect(state.list).toEqual([1, 2, 3])
    expect(Array.isArray(state.list)).toBe(true)
  })

  it('should return correct state after dispatch', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'combined',
      lazy: true,
      storage,
    }
    const numberReducer = (state: Lazy<number> = 0) => state
    const stringReducer = (state: Lazy<string> = 'str') => state
    const boolReducer = (state: Lazy<boolean> = true) => state
    const objectSlice = createSlice({
      name: 'object',
      initialState: { a: 0 },
      reducers: {
        increment: (state) => {
          state.a += 1
        },
      },
    })
    const persistedReducer = persistCombineReducers(config, {
      number: numberReducer,
      string: stringReducer,
      bool: boolReducer,
      [objectSlice.name]: objectSlice.reducer,
    })
    const store = configureStore({
      reducer: persistedReducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    store.dispatch(objectSlice.actions.increment())

    const state = store.getState()

    expect(state.number).toBe(0)
    expect(typeof state.number).toBe('number')

    expect(state.string).toBe('str')
    expect(typeof state.string).toBe('string')
  })
})
