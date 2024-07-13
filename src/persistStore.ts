import type { Store } from '@reduxjs/toolkit'
import type { Persistoid, Persistor } from './types'
import { flush, pause, persist, purge, register } from './actions'

type BoostrappedCb = () => void

interface PersistorOptions {}

export function persistStore(store: Store, _options?: PersistorOptions, callback?: BoostrappedCb): Persistor<unknown> {
  const persistors: Persistor<unknown>[] = []
  callback?.()

  store.dispatch(
    register({
      register: (persistor: Persistoid<unknown>) => {
        persistor.setStore(store)
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
    update: (_state) => {
      // noop
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
