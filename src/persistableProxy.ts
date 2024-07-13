import type { AnyState } from './types'

const PERSISTED = Symbol('persisted')
const COMBINED = Symbol('combined')
const TO_JSON = 'toJSON'

export function createPersistableProxy<T extends object>(initialState: any, getItem: () => T | null): T {
  const getPersisted = (): T => {
    let persisted = getItem()
    if (persisted == null) {
      persisted = initialState
      return initialState
    }

    return persisted
  }
  const self = {} as any
  const proxy = new Proxy<T>(self, {
    get: function (_, prop, receiver) {
      if (prop === TO_JSON) {
        return getPersisted
      }
      if (prop === PERSISTED) {
        return self[PERSISTED]
      }
      const target = getPersisted()
      return Reflect.get(target, prop, receiver)
    },
    getOwnPropertyDescriptor: function (_, prop) {
      const target = getPersisted()
      const descriptor = Object.getOwnPropertyDescriptor(target, prop)

      return {
        ...descriptor,
        // rkt-query freezes the initial value so we need to make it configurable
        // to avoid TypeError: 'getOwnPropertyDescriptor' on proxy: trap reported non-configurability for property '...' which is either non-existent or configurable in the proxy target
        configurable: true,
      }
    },
    has: function (_, prop) {
      return prop in getPersisted()
    },
    set: function (_, prop, value, receiver) {
      const target = getPersisted()
      return Reflect.set(target, prop, value, receiver)
    },
  })

  self[PERSISTED] = true

  return proxy
}

export function createCombinedProxy<T extends object>(initialState: any, getItem: () => T | null) {
  const getPersisted = (): AnyState => {
    let persisted = getItem()
    if (persisted == null) {
      return initialState
    }

    return persisted
  }
  const proxies: Record<string | symbol, ReturnType<typeof createPersistableProxy>> = {}
  const self = {} as any
  const proxy = new Proxy<T>(self, {
    get: function (_, prop, receiver) {
      if (prop === TO_JSON) {
        return getPersisted
      }
      if (prop === COMBINED) {
        return self[COMBINED]
      }
      if (prop === PERSISTED) {
        return self[PERSISTED]
      }
      if (typeof prop === 'symbol') {
        const target = getPersisted()
        return Reflect.get(target, prop, receiver)
      }
      let propProxy = proxies[prop]
      if (propProxy !== undefined) {
        return propProxy
      }
      const initialProp = initialState[prop]
      if (initialProp && typeof initialProp === 'object' && initialProp[PERSISTED]) {
        proxies[prop] = initialProp
      } else {
        proxies[prop] = createPersistableProxy(initialProp, () => {
          const target = getPersisted()
          return target[prop]
        })
      }

      propProxy = proxies[prop]

      return propProxy
    },
    getOwnPropertyDescriptor: function (_, prop) {
      const target = getPersisted()
      const descriptor = Object.getOwnPropertyDescriptor(target, prop)

      return descriptor
    },
    has: function (_, prop) {
      return prop in getPersisted()
    },
    set: function (_, prop, value, receiver) {
      const target = getPersisted()
      return Reflect.set(target, prop, value, receiver)
    },
  })

  self[COMBINED] = true
  self[PERSISTED] = true

  return proxy
}

export const isPersisted = (obj: any) => obj[PERSISTED] === true
