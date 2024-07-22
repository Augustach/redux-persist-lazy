import type { AnyState, PersistConfig } from './types'

const TO_JSON = 'toJSON'
const proxies = new WeakSet()

const notSupported = (method: string) => () => {
  if (process.env.NODE_ENV === 'development') {
    throw new Error(`${method} is not supported`)
  }
  return false
}

const toPrimitive = (value: any) => (hint: string) => {
  if (hint === 'number') {
    return Number(value)
  }
  if (hint === 'string') {
    return String(value)
  }
  return value
}

export function createLazy<T>(getValue: () => T): T {
  const self = {} as any
  const proxy = new Proxy<object>(self, {
    get(_, prop, receiver) {
      if (prop === TO_JSON) {
        return getValue
      }
      const value = getValue()
      if (value == null) {
        return undefined
      }
      if (typeof value !== 'object') {
        if (prop === Symbol.toPrimitive) {
          return toPrimitive(value)
        }
        return value
      }

      return Reflect.get(value, prop, receiver)
    },
    getOwnPropertyDescriptor(_, prop) {
      const persisted = getValue()
      if (persisted == null) {
        return undefined
      }
      const descriptor = Object.getOwnPropertyDescriptor(persisted, prop)

      if (descriptor) {
        // rkt-query freezes the initial value so we need to make it configurable
        // to avoid TypeError: 'getOwnPropertyDescriptor' on proxy: trap reported non-configurability for property '...' which is either non-existent or configurable in the proxy target
        descriptor.configurable = true
      }

      return descriptor
    },
    has(_, prop) {
      const value = getValue()
      if (value == null || typeof value !== 'object') {
        return false
      }
      return prop in value
    },
    ownKeys() {
      const value = getValue()

      if (value == null || typeof value !== 'object') {
        return []
      }

      return Reflect.ownKeys(value)
    },
    preventExtensions(target) {
      const persisted = getValue()
      if (persisted != null) {
        for (const key of Reflect.ownKeys(persisted)) {
          Reflect.set(target, key, undefined)
        }
      }
      Object.preventExtensions(target)
      return true
    },
    set: notSupported('set'),
    defineProperty: notSupported('defineProperty'),
    deleteProperty: notSupported('deleteProperty'),
  })

  proxies.add(proxy)

  return proxy as T
}

export function createCombinedProxy<T extends object>(
  getValue: () => T,
  config: PersistConfig<T>,
  initialState: AnyState
): T {
  const getPersisted = (): AnyState => getValue() ?? initialState
  const combined = {} as AnyState
  const keys = Object.keys(initialState)
  const { whitelist } = config

  for (const key of keys) {
    const value = initialState[key]
    if (isPersistable(value)) {
      combined[key] = value
    } else if (!whitelist) {
      combined[key] = createLazy(() => {
        const target = getPersisted()
        return target?.[key] ?? value
      })
    } else {
      if (whitelist.includes(key as keyof T)) {
        combined[key] = createLazy(() => {
          const target = getPersisted()
          return target?.[key] ?? value
        })
      } else {
        combined[key] = value
      }
    }
  }

  return combined as T
}

export const isPersistable = (value: any) => {
  return proxies.has(value)
}
