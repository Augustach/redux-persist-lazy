import type { AnyState, Lazy } from './types'

const TO_JSON = 'toJSON'
const VALUE_OF = 'valueOf'
const OBJECT_TYPE = 'object'
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

export const valueOf = <T>(value: any): T => {
  if (!value) {
    return value
  }
  if (typeof value === OBJECT_TYPE || Array.isArray(value)) {
    return value?.valueOf() as T
  }
  return value as T
}

export function createLazy<T extends AnyState>(getValue: (key?: string | symbol) => T | null | undefined): T
export function createLazy<T>(getValue: (key?: string | symbol) => T | null | undefined): Lazy<T>

export function createLazy<T>(getValue: (key?: string | symbol) => T | null | undefined): Lazy<T> {
  const self = {} as any
  const proxy = new Proxy<object>(self, {
    get(_, prop, receiver) {
      if (prop === TO_JSON || prop === VALUE_OF) {
        return () => getValue()
      }
      const value = getValue(prop)
      if (value == null) {
        return undefined
      }
      if (typeof value !== OBJECT_TYPE) {
        if (prop === Symbol.toPrimitive) {
          return toPrimitive(value)
        }
        return value
      }

      return valueOf(Reflect.get(value, prop, receiver))
    },
    getOwnPropertyDescriptor(_, prop) {
      const persisted = getValue(prop)
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
      const value = getValue(prop)
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
      const value = getValue()
      if (value != null) {
        for (const key of Reflect.ownKeys(value)) {
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

  return proxy as Lazy<T>
}

export const asLazy = <T>(value: T): Lazy<T> => {
  if (typeof value?.[VALUE_OF] === 'function') {
    return value as Lazy<T>
  }
  return {
    [VALUE_OF]: () => value,
  }
}

export const isPersistable = <T>(value: any): value is Lazy<T> => {
  return proxies.has(value)
}
