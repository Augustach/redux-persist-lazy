import { combineReducers, configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { deserialize, makeMockedStorage, wait } from './utils'
import { persistReducer } from '../persistReducer'
import { persistReducer as rpPersistReducer, persistStore as rpPersistStore } from 'redux-persist'
import { buildKey } from '../buildKey'
import { persistCombineReducers } from '../persistCombineReducers'

type State = { a?: string; b?: string; c?: string }
type SetAction = PayloadAction<{ key: 'a' | 'b' | 'c'; value: string }>

const initialState: State = {}
const delay = 10
const slice = createSlice({
  name: 'slice',
  initialState,
  reducers: {
    set: (state, action: SetAction) => {
      state[action.payload.key] = action.payload.value
    },
  },
})

const other = createSlice({
  name: 'other',
  initialState,
  reducers: {
    set: (state, action: SetAction) => {
      state[action.payload.key] = action.payload.value
    },
  },
})

const obj = {
  str: 'str',
  num: 1,
  bool: true,
}

const holder = createSlice({
  name: 'holder',
  initialState: {
    ...obj,
    obj,
    list: [obj],
  },
  reducers: {},
})

describe('compatibility with redux-persist', () => {
  it('should rehydrate state saved by redux-persist', async () => {
    const storage = makeMockedStorage()
    const asyncStorage = {
      getItem: (key: string) => Promise.resolve(storage.getItem(key)),
      setItem: (key: string, value: string) => Promise.resolve(storage.setItem(key, value)),
      removeItem: (key: string) => Promise.resolve(storage.removeItem(key)),
    }
    const sliceConfig = {
      key: 'slice',
      storage,
      delay,
    } as const
    const rootConfig = {
      key: 'root',
      storage,
      delay,
      combined: true,
      whitelist: [holder.name, 'other'],
    } as const

    const rpStore = configureStore({
      reducer: rpPersistReducer(
        { ...rootConfig, storage: asyncStorage } as any,
        combineReducers({
          slice: rpPersistReducer({ ...sliceConfig, storage: asyncStorage }, slice.reducer),
          other: other.reducer,
          holder: holder.reducer,
        })
      ),
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
        }),
    })

    await new Promise((resolve) => {
      rpPersistStore(rpStore, null, () => {
        resolve(null)
      })
    })

    rpStore.dispatch(slice.actions.set({ key: 'a', value: '1' }))
    rpStore.dispatch(slice.actions.set({ key: 'b', value: '2' }))
    rpStore.dispatch(other.actions.set({ key: 'c', value: '3' }))

    const _persist = { rehydrated: true, version: -1 }

    expect(rpStore.getState()).toStrictEqual({
      other: { c: '3' },
      holder: holder.getInitialState(),
      slice: { a: '1', b: '2', _persist },
      _persist,
    })

    await wait(10)
    expect(deserialize(storage.getItem(buildKey(rootConfig))!)).toStrictEqual({
      other: { c: '3' },
      holder: holder.getInitialState(),
      _persist,
    })
    expect(deserialize(storage.getItem(buildKey(sliceConfig))!)).toStrictEqual({ a: '1', b: '2', _persist })

    const store = configureStore({
      reducer: persistCombineReducers(rootConfig, {
        slice: persistReducer(sliceConfig, slice.reducer),
        other: other.reducer,
        holder: holder.reducer,
      }),
    })

    expect(JSON.stringify(store.getState())).toBe(
      JSON.stringify({
        slice: { a: '1', b: '2' },
        other: { c: '3' },
        holder: holder.getInitialState(),
      })
    )
  })
})
