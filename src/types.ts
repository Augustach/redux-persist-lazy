import type { Action, CombinedState, Store } from '@reduxjs/toolkit'

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

export interface Persistoid<State> extends Persistor {
  update(state: State): void
  setStore(store: Store): void
  dispatch(action: Action): void
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

type IsCombinedState<S> = S extends CombinedState<unknown> ? true : false

type Combined<S extends AnyState> =
  IsCombinedState<S> extends true
    ? {
        /**
         * Should be set to `true` if you are using`combineReducer` otherwise state will be rehydrated during store initialization
         *
         * NOTE: `combineReducer` invokes properties of state during initialization so we need to create a proxy for each property
         */
        combined: boolean
      }
    : { combined?: boolean }

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
  /**
   * Should be set to `true` if you are using`combineReducer` otherwise state will be rehydrated during store initialization
   *
   * NOTE: `combineReducer` invokes properties of state during initialization so we need to create a proxy for each property
   */
} & Combined<State>
