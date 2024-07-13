import { configureStore, createSlice } from '@reduxjs/toolkit'
import { makeMockedStorage, serialize, wait } from './utils'
import { persistCombineReducers, persistReducer } from '../'
import { buildKey } from '../buildKey'

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
      storage,
    }
    const persistedReducer = persistCombineReducers(config, {
      a: a.reducer,
      b: b.reducer,
    })
    const store = configureStore({
      reducer: persistedReducer,
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
      reducer: persistCombineReducers({ ...rootConfig } as any, {
        a: persistReducer(sliceConfig, a.reducer),
        b: b.reducer,
      }),
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
})
