import { createAction } from '@reduxjs/toolkit'
import type { Persistoid } from './types'
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE } from './constants'

export const flush = createAction(FLUSH)
export const rehydrate = (key: string, payload: object) => ({
  type: REHYDRATE,
  key,
  payload,
})
export const pause = createAction(PAUSE)
export const persist = createAction(PERSIST)
export const purge = createAction(PURGE)
export const register = createAction<{ register: (persistoid: Persistoid<unknown>) => void }>(REGISTER)
