import type { Action, ReducersMapObject, StateFromReducersMapObject, Store } from '@reduxjs/toolkit'

export interface Storage {
  getItem(key: string): string | null | undefined
  setItem(key: string, value: string): unknown
  removeItem(key: string): unknown
}

export type CompatibleStorage = Omit<Storage, 'getItem'> & {
  getItem(key: string): Promise<string | null | undefined>
  getItemSync(key: string): string | null | undefined
}

type Any = any
export type AnyState = Record<string, Any>

export interface PersistState {
  version: number
  rehydrated: boolean
}

export type PersistedState =
  | ({
      _persist: PersistState
    } & AnyState)
  | undefined

export type PersistMigrate = (state: PersistedState, currentVersion: number) => PersistedState

export interface MigrationManifest {
  [key: string]: (state: PersistedState) => PersistedState
}

export interface Persistor {
  flush(): void
  pause(): void
  purge(): void
  persist(): void
}

export type ReduxStore = Pick<Store, 'dispatch'>

export interface OnRehydratePayload {
  key: string
}

export interface PersistoidSharedStore extends ReduxStore {
  onRehydrate(payload: OnRehydratePayload): void
}

export interface Persistoid<State> extends Persistor {
  update(state: State): void
  updateIfChanged(prev: State, next: State): void
  setStore(store: PersistoidSharedStore): void
  dispatch(action: Action): void
  rehydrate(reconciledState: State): void
}

export interface KeyAccessState {
  [key: string]: any
}

export type TransformInbound<SubState, EndSubState, State = AnyState> = (
  subState: SubState,
  key: keyof State,
  state: State
) => EndSubState

export type TransformOutbound<SubState, HydratedSubState, RawState = AnyState> = (
  state: SubState,
  key: keyof RawState,
  rawState: SubState
) => HydratedSubState

export interface Transform<HydratedSubState, EndSubState, State = any, RawState = AnyState> {
  in: TransformInbound<HydratedSubState, EndSubState, State>
  out: TransformOutbound<EndSubState, HydratedSubState, RawState>
}

type WhiteOrBacklist<State extends AnyState> =
  | {
      whitelist?: ReadonlyArray<keyof State>
      blacklist?: never
    }
  | {
      whitelist?: never
      blacklist?: ReadonlyArray<keyof State>
    }

export type StateReconciler<State extends AnyState> = (
  inboundState: any,
  state: State,
  reducedState: State,
  config: PersistConfig<State>
) => State

export const GET_ORIGINAL = Symbol('GET_ORIGINAL')
export type Lazy<T> = { readonly [GET_ORIGINAL]: () => T }

export type ToObject<T> = T extends AnyState ? T : Lazy<T>

export type PersistConfig<
  State extends AnyState,
  RawState = Any,
  HydratedSubState = Any,
  EndSubState = Any,
> = WhiteOrBacklist<State> & {
  key: string
  version?: number
  storage: Storage | CompatibleStorage
  deserialize?: (x: string) => unknown
  serialize?: (x: unknown) => string
  migrate?: PersistMigrate
  stateReconciler?: StateReconciler<State>
  transforms?: Array<Transform<HydratedSubState, EndSubState, State, RawState>>
  /**
   * Delay between persisting state
   */
  delay?: number
}

export type CombinedPersistConfig<S> =
  S extends ReducersMapObject<any, any>
    ? PersistConfig<StateFromReducersMapObject<S>>
    : S extends object
      ? PersistConfig<S>
      : never
