import {
  isImmutableDefault,
  type ImmutableStateInvariantMiddlewareOptions,
  type SerializableStateInvariantMiddlewareOptions,
} from '@reduxjs/toolkit'
import { isPersistable } from './createLazy'
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE } from './constants'

interface GetDefaultMiddlewareOptions {
  immutableCheck?: boolean | ImmutableStateInvariantMiddlewareOptions
  serializableCheck?: boolean | SerializableStateInvariantMiddlewareOptions
}

const getIgnoredActions = (config?: boolean | SerializableStateInvariantMiddlewareOptions): string[] => {
  if (config === false) {
    return []
  }
  if (config === true) {
    return []
  }
  return config?.ignoredActions ?? []
}

const persistedActions = [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]

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
            ignoredActions: [...getIgnoredActions(config.serializableCheck), ...persistedActions],
            getEntries: (value: any) => (isPersistable(value) ? [] : getEntries(value)),
          },
  }
}
