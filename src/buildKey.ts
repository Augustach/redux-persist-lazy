const KEY_PREFIX = 'persist:'

export function buildKey({ key }: { key: string }) {
  return `${KEY_PREFIX}${key}`
}
