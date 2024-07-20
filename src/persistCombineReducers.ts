import { combineReducers } from '@reduxjs/toolkit'
import type { ReducersMapObject, StateFromReducersMapObject } from '@reduxjs/toolkit'
import { persistReducer } from './persistReducer'
import { autoMergeLevel2 } from './stateReconciler/autoMergeLevel2'

import type { PersistConfig } from './types'

export function persistCombineReducers<Reducers extends ReducersMapObject>(
  config: Omit<PersistConfig<StateFromReducersMapObject<Reducers>>, 'combined'>,
  reducers: Reducers
): ReturnType<typeof combineReducers<Reducers>> {
  // @ts-expect-error
  const combinedConfig: PersistConfig<StateFromReducersMapObject<Reducers>> = {
    stateReconciler: autoMergeLevel2<StateFromReducersMapObject<Reducers>>,
    combined: true,
    ...config,
  }
  const combinedReducer = combineReducers(reducers)
  return persistReducer(combinedConfig, combinedReducer)
}
