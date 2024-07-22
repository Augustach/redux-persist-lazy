import type { AnyState, Storage } from '../types'

export const makeMockedStorage = (): Storage => {
  const map = new Map<string, any>()
  return {
    getItem: jest.fn().mockImplementation((key: string) => {
      return map.get(key) ?? null
    }),
    setItem: jest.fn().mockImplementation((key: string, newValue: string) => {
      map.set(key, newValue)
    }),
    removeItem: jest.fn().mockImplementation((key: string) => {
      map.delete(key)
    }),
  }
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const deserialize = (json: string): AnyState => {
  const result = JSON.parse(json)

  for (const key of Object.keys(result)) {
    result[key] = JSON.parse(result[key])
  }

  return result
}

export const serialize = (state: AnyState): string => {
  const result: Record<string, string> = {}

  for (const key of Object.keys(state)) {
    result[key] = JSON.stringify(state[key])
  }

  return JSON.stringify(result)
}
