import type { Action } from '@reduxjs/toolkit'
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query'
import { makeMockedStorage, serialize, wait } from './utils'
import { persistReducer, persistStore } from '..'
import { buildKey } from '../buildKey'
import { PERSIST_KEY, REHYDRATE } from '../constants'

interface ResponseData {
  data: {
    name: string
    ids: number[]
  }
}

type HydrateAction = Action<typeof REHYDRATE> & {
  key: string
  payload: any
}

function isHydrateAction(action: Action): action is HydrateAction {
  return action.type === REHYDRATE
}

const createCachedState = (persistedData: object, keepUnusedDataFor: number) => ({
  queries: {
    'mock(undefined)': {
      status: 'fulfilled',
      endpointName: 'mock',
      requestId: 'gDuA6m0PQWslS0wIUHFoH',
      startedTimeStamp: Date.now(),
      data: persistedData,
      fulfilledTimeStamp: Date.now(),
    },
  },
  mutations: {},
  provided: {},
  subscriptions: {},
  config: {
    online: true,
    focused: true,
    middlewareRegistered: true,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    refetchOnMountOrArgChange: false,
    keepUnusedDataFor: keepUnusedDataFor,
    reducerPath: 'mock',
    invalidationBehavior: 'delayed',
  },
})

const queryFn = async () => {
  const response = {
    data: {
      name: 'fetch',
      ids: [1, 2, 3],
    },
  }

  return { data: response }
}

describe('rkt query', () => {
  it('should rehydrate the state when persisting the api reducer', async () => {
    const storage = makeMockedStorage()
    const persistedData = {
      data: {
        name: 'persisted',
        ids: [10, 20, 30],
      },
    }
    const keepUnusedDataFor = 1
    const delay = 10
    const KEY = 'mock'
    const version = 1
    const cachedState = createCachedState(persistedData, keepUnusedDataFor)
    storage.setItem(buildKey({ key: KEY }), serialize(cachedState))
    const extractPayload = jest.fn((result) => result)
    const api = createApi({
      reducerPath: KEY,
      keepUnusedDataFor: keepUnusedDataFor,
      baseQuery: fetchBaseQuery({ baseUrl: '/' }),
      extractRehydrationInfo: (action): any => {
        if (isHydrateAction(action)) {
          if (action.key === KEY) {
            return extractPayload(action.payload)
          }

          return extractPayload(action.payload[api.reducerPath])
        }
      },
      endpoints: (builder) => ({
        mock: builder.query<ResponseData, void>({
          queryFn: queryFn,
        }),
      }),
    })
    const store = configureStore({
      reducer: {
        [api.reducerPath]: persistReducer(
          { storage, key: api.reducerPath, version, delay, combined: false },
          api.reducer
        ),
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
        }).concat(api.middleware),
    })

    persistStore(store)

    await wait(10)

    expect(extractPayload).toHaveBeenCalledWith(cachedState)

    await wait(keepUnusedDataFor * 1000) // wait for the data to be removed

    await wait(delay) // wait for the persistor to update the storage

    expect(storage.setItem).toHaveBeenCalled()
    const expectedState = { ...cachedState, [PERSIST_KEY]: { version, rehydrated: false } }
    // @ts-expect-error
    expectedState.queries = {}
    expect(storage.setItem).toHaveBeenLastCalledWith(buildKey({ key: KEY }), serialize(expectedState))
  })

  it('should rehydrate the state when persisting the root reducer', async () => {
    const storage = makeMockedStorage()
    const persistedData = {
      data: {
        name: 'persisted',
        ids: [10, 20, 30],
      },
    }
    const keepUnusedDataFor = 1
    const delay = 10
    const KEY = 'root'
    const reducerPath = 'mock'
    const version = 1
    const cachedState = createCachedState(persistedData, keepUnusedDataFor)
    storage.setItem(
      buildKey({ key: KEY }),
      serialize({
        [reducerPath]: cachedState,
      })
    )
    const extractPayload = jest.fn().mockImplementation((result) => result)
    const api = createApi({
      reducerPath: reducerPath,
      keepUnusedDataFor: keepUnusedDataFor,
      baseQuery: fetchBaseQuery({ baseUrl: '/' }),
      extractRehydrationInfo: (action) => {
        if (isHydrateAction(action)) {
          if (action.key === reducerPath) {
            return extractPayload(action.payload)
          }

          return extractPayload(action.payload[reducerPath])
        }
      },
      endpoints: (builder) => ({
        mock: builder.query<ResponseData, void>({
          queryFn: queryFn,
        }),
      }),
    })
    const rootReducer = combineReducers({
      [api.reducerPath]: api.reducer,
    })
    const store = configureStore({
      reducer: persistReducer({ storage, key: KEY, version, delay, combined: false }, rootReducer),
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
        }).concat(api.middleware),
    })

    persistStore(store)

    await wait(10)

    expect(extractPayload).toHaveBeenCalledWith(cachedState)

    await wait(keepUnusedDataFor * 1000) // wait for the data to be removed

    await wait(delay) // wait for the persistor to update the storage

    expect(storage.setItem).toHaveBeenCalled()
    const expectedState = { [reducerPath]: cachedState, [PERSIST_KEY]: { version, rehydrated: false } }
    // @ts-expect-error
    expectedState[reducerPath].queries = {}
    expect(storage.setItem).toHaveBeenLastCalledWith(buildKey({ key: KEY }), serialize(expectedState))
  })
})
