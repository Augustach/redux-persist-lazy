import { buildKey } from '../buildKey'
import { DEFAULT_VERSION } from '../constants'
import getStoredState from '../getStoredState'
import { makeMockedStorage, serialize } from './utils'

describe('getStoredState', () => {
  it('should return null if state is not found', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
      combined: false,
    }

    const result = getStoredState(config)
    expect(result).toBeUndefined()
  })

  it('should return state with _persist property if found', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
      combined: false,
    }
    storage.setItem(buildKey(config), serialize({ a: 1 }))

    const result = getStoredState(config)
    expect(result).toEqual({ a: 1, _persist: { version: DEFAULT_VERSION, rehydrated: true } })
  })

  it('should not overwrite version if already set', () => {
    const storage = makeMockedStorage()
    const config = {
      key: 'mock',
      storage,
      version: 3,
      combined: false,
    }
    storage.setItem(buildKey(config), serialize({ a: 1, _persist: { version: 2 } }))
    const result = getStoredState(config)
    expect(result).toEqual({ a: 1, _persist: { version: 2, rehydrated: true } })
  })

  it('should overwrite rehydrated to true', () => {
    const storage = makeMockedStorage()
    const version = 2
    const config = {
      version,
      key: 'mock',
      storage,
      combined: false,
    }
    storage.setItem(buildKey(config), serialize({ a: 1, _persist: { version: version, rehydrated: false } }))
    const result = getStoredState(config)
    expect(result).toEqual({ a: 1, _persist: { version: version, rehydrated: true } })
  })
})
