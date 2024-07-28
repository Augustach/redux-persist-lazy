import { GET_ORIGINAL, type AnyState, type Lazy } from './types'

const TO_JSON = 'toJSON'
const VALUE_OF = 'valueOf'
const OBJECT_TYPE = 'object'
export const proxies = new WeakSet()

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

export function createLazy<T extends AnyState>(getValue: (key?: string | symbol) => T | null | undefined): T
export function createLazy<T>(getValue: (key?: string | symbol) => T | null | undefined): Lazy<T>

export function createLazy<T>(getValue: (key?: string | symbol) => T | null | undefined): Lazy<T> {
  const self = {} as any
  const proxy = new Proxy<object>(self, {
    get(_, prop, receiver) {
      if (prop === TO_JSON || prop === VALUE_OF || prop === GET_ORIGINAL) {
        return () => getValue()
      }
      const target = getValue(prop)
      if (target == null) {
        return undefined
      }
      if (typeof target !== OBJECT_TYPE) {
        if (prop === Symbol.toPrimitive) {
          return toPrimitive(target)
        }
        return target
      }

      return Reflect.get(target, prop, receiver)
    },
    getOwnPropertyDescriptor(_, prop) {
      const target = getValue(prop)
      if (target == null) {
        return undefined
      }
      const descriptor = Object.getOwnPropertyDescriptor(target, prop)

      if (descriptor) {
        // rkt-query freezes the initial value so we need to make it configurable
        // to avoid TypeError: 'getOwnPropertyDescriptor' on proxy: trap reported non-configurability for property '...' which is either non-existent or configurable in the proxy target
        descriptor.configurable = true
      }

      return descriptor
    },
    has(_, prop) {
      if (prop === GET_ORIGINAL) {
        return true
      }
      const target = getValue(prop)
      if (target == null || typeof target !== 'object') {
        return false
      }
      return prop in target
    },
    ownKeys() {
      const target = getValue()

      if (target == null || typeof target !== 'object') {
        return []
      }

      return Reflect.ownKeys(target)
    },
    preventExtensions(original) {
      const target = getValue()
      if (target != null) {
        for (const key of Reflect.ownKeys(target)) {
          Reflect.set(original, key, undefined)
        }
      }
      Object.preventExtensions(original)
      return true
    },
    set: notSupported('set'),
    defineProperty: notSupported('defineProperty'),
    deleteProperty: notSupported('deleteProperty'),
  })

  proxies.add(proxy)

  return proxy as Lazy<T>
}

export const valueOf = <T>(value: Lazy<T> | T): T => {
  if (typeof value === 'object' && value != null && GET_ORIGINAL in value) {
    return value[GET_ORIGINAL]()
  }
  return value as T
}

export const asLazy = <T>(value: T): Lazy<T> | T => {
  return value
}

export const isPersistable = <T>(value: any): value is Lazy<T> => {
  return proxies.has(value)
}
