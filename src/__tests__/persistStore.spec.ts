import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { makeMockedStorage } from './utils'
import { buildKey } from '../buildKey'
import { withPerist } from '../getDefaultMiddleware'
import { persistReducer } from '../persistReducer'
import { persistStore } from '../persistStore'
import { persistCombineReducersLazy } from '../persistCombineReducersLazy'

const initialList: unknown[] = []

const slice = createSlice({
  name: 'slice',
  initialState: {
    list: initialList,
  },
  reducers: {
    push: (state, action: PayloadAction<number>) => {
      state.list.push(action.payload)
    },
  },
})

describe('persistStore', () => {
  it('should reset state and caches', async () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
    }
    const reducer = persistReducer(config, slice.reducer)
    const store = configureStore({
      reducer: {
        [slice.name]: reducer,
      },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })
    const persistor = persistStore(store)
    store.dispatch(slice.actions.push(1))
    store.dispatch(slice.actions.push(2))

    expect(store.getState()).toEqual({
      slice: {
        list: [1, 2],
      },
    })
    persistor.purge()
    expect(storage.getItem(buildKey(config))).toBeNull()
  })

  it('should reset state for new store', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
    }
    const reducer = persistCombineReducersLazy(config, {
      [slice.name]: slice.reducer,
    })
    const prevStore = configureStore({
      reducer: reducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })
    const persistor = persistStore(prevStore)
    prevStore.dispatch(slice.actions.push(1))
    prevStore.dispatch(slice.actions.push(2))
    persistor.purge()

    const store = configureStore({
      reducer: reducer,
      middleware: (getDefaultMiddleware) => getDefaultMiddleware(withPerist({})),
    })

    expect(store.getState()).toEqual({
      slice: {
        list: [],
      },
    })
    expect(storage.getItem(buildKey(config))).toBeNull()
  })
})
