import { combineReducers, configureStore, createReducer, createSlice } from '@reduxjs/toolkit'
import { makeMockedStorage, serialize, wait } from './utils'
import { asLazy, autoMergeLevel1, isPersistable, persistCombineReducersLazy, persistReducer, valueOf } from '..'
import { buildKey } from '../buildKey'
import { withPerist } from '../getDefaultMiddleware'

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

describe('persistCombineReducersLazy', () => {
  it('should be lazy', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'combined',
      storage,
    }
    const persistedReducer = persistCombineReducersLazy(config, {
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
      storage,
      whitelist: ['c'],
    } as const
    const aConfig = {
      key: 'a',
      storage,
    } as const
    const bConfig = {
      key: 'b',
      storage,
      whitelist: ['c', 'd'],
    } as const
    const eConfig = {
      key: 'e',
      storage,
    }
    const root = persistReducer(
      rootConfig,
      combineReducers({
        a: persistReducer(
          aConfig,
          createReducer({ value: 0 }, (builder) => builder)
        ),
        b: persistCombineReducersLazy(bConfig, {
          c: createReducer(asLazy<number>(0), (builder) => builder),
          d: createReducer(asLazy<boolean>(true), (builder) => builder),
          e: persistReducer(
            eConfig,
            createReducer({ value: 0 }, (builder) => builder)
          ),
        }),
        c: createReducer({ value: 0 }, (builder) => builder),
      })
    )
    const store = configureStore({
      reducer: root,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    const state = store.getState()

    expect(state.c.value).toBe(0)
    expect(storage.getItem).toHaveBeenCalledTimes(1)
    expect(storage.getItem).toHaveBeenLastCalledWith(buildKey(rootConfig))

    expect(state.a.value).toBe(0)
    expect(storage.getItem).toHaveBeenCalledTimes(2)
    expect(storage.getItem).toHaveBeenLastCalledWith(buildKey(aConfig))

    expect(state.b.c).toBe(0)
    expect(storage.getItem).toHaveBeenCalledTimes(3)
    expect(storage.getItem).toHaveBeenLastCalledWith(buildKey(bConfig))

    expect(state.b.d).toBe(true)
    expect(storage.getItem).toHaveBeenCalledTimes(3)

    expect(state.b.e.value).toBe(0)
    expect(storage.getItem).toHaveBeenCalledTimes(4)
    expect(storage.getItem).toHaveBeenLastCalledWith(buildKey(eConfig))
  })

  it('deep nested reducers', () => {
    const storage = makeMockedStorage()
    const rootConfig = {
      key: 'root',
      storage,
    }
    const persistedReducer = persistCombineReducersLazy(rootConfig, {
      level1: persistCombineReducersLazy(
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
      delay,
      whitelist: ['b'],
    } as const

    const store = configureStore({
      reducer: persistCombineReducersLazy({ ...rootConfig } as any, {
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
      whilelist: [innerSlice.name],
    } as const
    const store = configureStore({
      reducer: persistCombineReducersLazy(config, {
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
      whitelist: ['b'],
    } as const

    const primitive = createSlice({
      name: 'primitive',
      initialState: asLazy(0),
      reducers: {
        increment: (state) => valueOf(state) + 1,
      },
    })

    const store = configureStore({
      reducer: persistCombineReducersLazy({ ...rootConfig } as any, {
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
      whitelist: ['b'],
    } as const

    const primitive = createSlice({
      name: 'primitive',
      initialState: asLazy(0),
      reducers: {
        increment: (state) => valueOf(state) + 1,
      },
    })

    const store = configureStore({
      reducer: persistCombineReducersLazy({ ...rootConfig } as any, {
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
      storage,
    }
    const numberReducer = (state = asLazy(0)) => state
    const stringReducer = (state = asLazy('str')) => state
    const boolReducer = (state = asLazy(true)) => state
    const objectReducer = (state = { a: 0 }) => state
    const listReducer = (state = asLazy([1, 2, 3])) => state
    const persistedReducer = persistCombineReducersLazy(config, {
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
      storage,
    }
    const numberReducer = (state = asLazy(0)) => state
    const stringReducer = (state = asLazy('str')) => state
    const boolReducer = (state = asLazy(true)) => state
    const objectSlice = createSlice({
      name: 'object',
      initialState: { a: 0 },
      reducers: {
        increment: (state) => {
          state.a += 1
        },
      },
    })
    const persistedReducer = persistCombineReducersLazy(config, {
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

  it('should return plain object after dispatch', () => {
    const storage = makeMockedStorage()
    const numberSlice = createSlice({
      name: 'number',
      initialState: asLazy<number>(0),
      reducers: {
        increment: (state) => valueOf(state) + 1,
      },
    })
    const objectSlice = createSlice({
      name: 'object',
      initialState: { a: 0 },
      reducers: {
        increment: (state) => {
          state.a += 1
        },
      },
    })
    const config = {
      key: 'root',
      storage,
      whitelist: [objectSlice.name, numberSlice.name],
    } as const
    storage.setItem(buildKey(config), serialize({ object: { a: 0 }, number: 10 }))
    const persistedSliceConfig = {
      key: 'persisted',
      storage,
    }
    const peristedSlice = createSlice({
      name: 'persisted',
      initialState: { value: 0 },
      reducers: {
        increment: (state) => {
          state.value += 1
        },
      },
    })
    storage.setItem(buildKey(persistedSliceConfig), serialize({ value: 11 }))
    const persistedReducer = persistCombineReducersLazy(config, {
      [numberSlice.name]: numberSlice.reducer,
      [objectSlice.name]: objectSlice.reducer,
      [peristedSlice.name]: persistReducer(persistedSliceConfig, peristedSlice.reducer),
    })
    const store = configureStore({
      reducer: persistedReducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    expect(isPersistable(store.getState())).toBe(true)

    store.dispatch(objectSlice.actions.increment())

    expect(isPersistable(store.getState())).toBe(false)

    const state = store.getState()

    expect(state.object.a).toBe(1)

    expect(isPersistable(state[peristedSlice.name])).toBe(true)
    expect(state[peristedSlice.name].value).toBe(11)
  })

  it.only('should not restore persisted reducer if not in whitelist', () => {
    const storage = makeMockedStorage()
    const numberSlice = createSlice({
      name: 'number',
      initialState: asLazy<number>(0),
      reducers: {
        increment: (state) => valueOf(state) + 1,
      },
    })
    const config = {
      key: 'root',
      storage,
      whitelist: [numberSlice.name],
    } as const
    storage.setItem(buildKey(config), serialize({ number: 10 }))
    const persistedSliceConfig = {
      key: 'persisted',
      storage,
    }
    const peristedSlice = createSlice({
      name: 'persisted',
      initialState: { value: 0 },
      reducers: {
        increment: (state) => {
          state.value += 1
        },
      },
    })
    storage.setItem(buildKey(persistedSliceConfig), serialize({ value: 11 }))
    const persistedReducer = persistCombineReducersLazy(config, {
      [numberSlice.name]: numberSlice.reducer,
      [peristedSlice.name]: persistReducer(persistedSliceConfig, peristedSlice.reducer),
    })
    const store = configureStore({
      reducer: persistedReducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    let state = store.getState()
    expect(state.number).toBe(10)
    expect(isPersistable(state[peristedSlice.name])).toBe(true)

    store.dispatch(peristedSlice.actions.increment())

    state = store.getState()

    expect(isPersistable(state[peristedSlice.name])).toBe(false)
    expect(state[peristedSlice.name].value).toBe(12)
  })
})
