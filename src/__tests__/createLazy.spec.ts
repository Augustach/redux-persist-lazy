import { createLazy, valueOf } from '../createLazy'

describe('createLazy', () => {
  it('should handle hasOwnProperty of null', () => {
    const proxy = createLazy(() => null)

    const hasProperty = Object.prototype.hasOwnProperty.call(proxy, '__wrapped__')

    expect(hasProperty).toBe(false)
  })

  it('should handle hasOwnProperty of empty object', () => {
    const proxy = createLazy(() => ({}))

    const hasProperty = Object.prototype.hasOwnProperty.call(proxy, '__wrapped__')

    expect(hasProperty).toBe(false)
  })

  it('should handle primitive values', () => {
    expect(Number(createLazy(() => 42))).toBe(42)
    expect(Boolean(createLazy(() => 42))).toBe(true)
    expect(!!createLazy(() => 0).valueOf()).toBe(false)
    expect(Boolean(createLazy(() => 0).valueOf())).toBe(false)
    expect(Boolean(valueOf(createLazy(() => false)))).toBe(false)
    expect(valueOf(createLazy(() => 42)) + 1).toBe(43)
    expect(createLazy(() => 42) + '1').toBe('421')
    expect(valueOf(createLazy(() => '42')) + 1).toBe('421')
    expect(!createLazy(() => true)).toBe(false)
    // @ts-expect-error
    expect(createLazy(() => true) + 1).toBe(2)
    expect(+createLazy(() => true)).toBe(1)
    expect(+createLazy(() => '10')).toBe(10)
  })

  it('ownKeys should return keys of value', () => {
    const proxy = createLazy(() => ({ a: 1, b: 2 }))
    const keys = Reflect.ownKeys(proxy)

    expect(keys).toEqual(['a', 'b'])

    const proxy2 = createLazy(() => Object.freeze({ a: 1, b: 2 }))
    const keys2 = Reflect.ownKeys(proxy2)

    expect(keys2).toEqual(['a', 'b'])
  })
})
