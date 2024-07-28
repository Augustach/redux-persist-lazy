import {
  combineReducers,
  type Action,
  type ActionFromReducersMapObject,
  type AnyAction,
  type CombinedState,
  type Reducer,
  type ReducersMapObject,
  type StateFromReducersMapObject,
} from '@reduxjs/toolkit'
import { autoMergeLevel2 } from './stateReconciler/autoMergeLevel2'

import type { AnyState, PersistConfig } from './types'
import { persistReducer } from './persistReducer'

export function persistCombineReducers<S extends AnyState>(
  config: PersistConfig<S>,
  reducers: ReducersMapObject<S, any>
): Reducer<CombinedState<S>>

export function persistCombineReducers<S extends AnyState, A extends Action = AnyAction>(
  config: PersistConfig<S>,
  reducers: ReducersMapObject<S, A>
): Reducer<CombinedState<S>, A>

export function persistCombineReducers<M extends ReducersMapObject<any, any>>(
  config: PersistConfig<StateFromReducersMapObject<M>>,
  reducers: M
): Reducer<CombinedState<StateFromReducersMapObject<M>>, ActionFromReducersMapObject<M>>

export function persistCombineReducers<S extends AnyState>(
  config: PersistConfig<S>,
  reducers: ReducersMapObject<S, any>
): Reducer<CombinedState<S>> {
  config = { stateReconciler: autoMergeLevel2, ...config }

  return persistReducer(config, combineReducers(reducers))
}
