import type { PayloadAction } from '@reduxjs/toolkit'
import { combineReducers, configureStore, createSlice } from '@reduxjs/toolkit'
import { makeMockedStorage, serialize, wait } from './utils'
import { persistReducer } from '../persistReducer'
import { buildKey } from '../buildKey'

type State = Record<string, string> & {
  a: string
}

const level1InitialState: State = {
  a: '0',
}
const delay = 10
const slice = createSlice({
  name: 'slice',
  initialState: level1InitialState,
  reducers: {
    add: (state, action: PayloadAction<{ key: string; value: string }>) => {
      state[action.payload.key] = action.payload.value
    },
  },
})

const otherInitialState: { inner: Record<string, string> } = {
  inner: {},
}
const other = createSlice({
  name: 'other',
  initialState: otherInitialState,
  reducers: {
    add: (state, action: PayloadAction<{ key: string; value: string }>) => {
      state.inner[action.payload.key] = action.payload.value
    },
  },
})

describe('whiteBlackList', () => {
  it('should persist only keys from whitelist', async () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
      delay,
      whitelist: ['a', 'b'],
    }
    const persistedReducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
      }),
    })
    store.dispatch(slice.actions.add({ key: 'a', value: '1' }))
    store.dispatch(slice.actions.add({ key: 'b', value: '2' }))
    store.dispatch(slice.actions.add({ key: 'c', value: '3' }))
    store.dispatch(slice.actions.add({ key: 'd', value: '4' }))

    await wait(delay)

    const expectedState = { a: '1', b: '2', _persist: { version: -1, rehydrated: false } }
    expect(storage.getItem(buildKey(config))).toBe(serialize(expectedState))
  })

  it('should not persist keys from blacklist', async () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
      delay,
      blacklist: ['c', 'd'],
    }
    const persistedReducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
      }),
    })
    store.dispatch(slice.actions.add({ key: 'a', value: '1' }))
    store.dispatch(slice.actions.add({ key: 'b', value: '2' }))
    store.dispatch(slice.actions.add({ key: 'c', value: '3' }))
    store.dispatch(slice.actions.add({ key: 'd', value: '4' }))

    await wait(delay)

    const expectedState = { a: '1', b: '2', _persist: { version: -1, rehydrated: false } }
    expect(storage.getItem(buildKey(config))).toBe(serialize(expectedState))
  })

  it('whitelist should take precedence over blacklist', async () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
      delay,
      whitelist: ['a', 'b'],
      blacklist: ['c', 'd'],
    }
    // @ts-expect-error blacklist should not be set
    const persistedReducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: combineReducers({
        [slice.name]: persistedReducer,
      }),
    })
    store.dispatch(slice.actions.add({ key: 'a', value: '1' }))
    store.dispatch(slice.actions.add({ key: 'b', value: '2' }))
    store.dispatch(slice.actions.add({ key: 'c', value: '3' }))
    store.dispatch(slice.actions.add({ key: 'd', value: '4' }))

    await wait(delay)

    const expectedState = { a: '1', b: '2', _persist: { version: -1, rehydrated: false } }
    expect(storage.getItem(buildKey(config))).toBe(serialize(expectedState))
  })

  it('should persist only keys from whitelist in nested state', async () => {
    const storage = makeMockedStorage()
    const sliceConfig = {
      key: 'slice',
      storage,
      delay,
      whitelist: ['c', 'd'],
    } as const
    const rootConfig = {
      key: 'root',
      storage,
      delay,
      combined: true,
      whitelist: ['other'],
    } as const
    const combinedReducer = combineReducers({
      slice: persistReducer(sliceConfig, slice.reducer),
      other: other.reducer,
    })
    const persistedReducer = persistReducer(rootConfig, combinedReducer)
    const store = configureStore({
      reducer: persistedReducer,
    })
    store.dispatch(slice.actions.add({ key: 'a', value: '1' }))
    store.dispatch(slice.actions.add({ key: 'b', value: '2' }))
    store.dispatch(slice.actions.add({ key: 'c', value: '3' }))
    store.dispatch(slice.actions.add({ key: 'd', value: '4' }))

    store.dispatch(other.actions.add({ key: 'a', value: '1' }))
    store.dispatch(other.actions.add({ key: 'b', value: '2' }))
    store.dispatch(other.actions.add({ key: 'c', value: '3' }))
    store.dispatch(other.actions.add({ key: 'd', value: '4' }))

    await wait(delay)

    const expectedRootState = {
      other: { inner: { a: '1', b: '2', c: '3', d: '4' } },
      _persist: { version: -1, rehydrated: false },
    }
    expect(storage.getItem(buildKey(rootConfig))).toBe(serialize(expectedRootState))

    const expectedSliceState = { c: '3', d: '4', _persist: { version: -1, rehydrated: false } }

    expect(storage.getItem(buildKey(sliceConfig))).toBe(serialize(expectedSliceState))
  })
})
