import {
  isImmutableDefault,
  type ImmutableStateInvariantMiddlewareOptions,
  type SerializableStateInvariantMiddlewareOptions,
} from '@reduxjs/toolkit'
import { isPersistable } from './createLazy'

interface GetDefaultMiddlewareOptions {
  immutableCheck?: boolean | ImmutableStateInvariantMiddlewareOptions
  serializableCheck?: boolean | SerializableStateInvariantMiddlewareOptions
}

export const withPerist = <Config extends GetDefaultMiddlewareOptions>(config: Config): Config => {
  const isImmutable = typeof config?.immutableCheck === 'function' ? config.immutableCheck : isImmutableDefault
  const getEntries =
    typeof config?.serializableCheck === 'function' ? config.serializableCheck : (value: any) => Object.entries(value)
  return {
    ...config,
    immutableCheck:
      config?.immutableCheck === false
        ? (false as const)
        : {
            isImmutable: (value: any) => isPersistable(value) || isImmutable(value),
          },
    serializableCheck:
      config?.serializableCheck === false
        ? (false as const)
        : {
            getEntries: (value: any) => (isPersistable(value) ? [] : getEntries(value)),
          },
  }
}
