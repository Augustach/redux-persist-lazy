import { combineReducers } from '@reduxjs/toolkit'
import type { ReducersMapObject, StateFromReducersMapObject } from '@reduxjs/toolkit'
import { persistReducer } from './persistReducer'
import { autoMergeLevel2 } from './stateReconciler/autoMergeLevel2'

import type { PersistConfig } from './types'

export function persistCombineReducers<Reducers extends ReducersMapObject>(
  config: PersistConfig<StateFromReducersMapObject<Reducers>>,
  reducers: Reducers
): ReturnType<typeof combineReducers<Reducers>> {
  config = { stateReconciler: autoMergeLevel2, combined: true, ...config }
  const combinedReducer = combineReducers(reducers)
  // @ts-expect-error
  return persistReducer(config, combinedReducer)
}
