import type { Store } from '@reduxjs/toolkit'
import type { OnRehydratePayload, Persistoid, Persistor } from './types'
import { flush, pause, persist, purge, register } from './actions'

type BoostrappedCb = () => void

interface PersistorOptions {
  onRehydrate?: (payload: OnRehydratePayload) => void
}

export function persistStore(store: Store, options?: PersistorOptions | null, callback?: BoostrappedCb): Persistor {
  const persistors: Persistor[] = []
  callback?.()

  store.dispatch(
    register({
      register: (persistor: Persistoid<unknown>) => {
        persistor.setStore({
          dispatch: store.dispatch,
          onRehydrate: (config) => {
            options?.onRehydrate?.(config)
          },
        })
        persistors.push(persistor)
      },
    })
  )

  return {
    persist() {
      for (const persistor of persistors) {
        persistor.persist()
      }
      store.dispatch(persist())
    },
    flush: () => {
      for (const persistor of persistors) {
        persistor.flush()
      }
      store.dispatch(flush())
    },
    purge() {
      for (const persistor of persistors) {
        persistor.purge()
      }
      store.dispatch(purge())
    },
    pause: () => {
      for (const persistor of persistors) {
        persistor.pause()
      }
      store.dispatch(pause())
    },
  }
}
