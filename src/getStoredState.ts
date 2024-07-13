import type { AnyState, CompatibleStorage, KeyAccessState, PersistConfig } from './types'
import { buildKey } from './buildKey'
import { DEFAULT_VERSION, PERSIST_KEY } from './constants'

const isCompatibleStorage = (storage: any): storage is CompatibleStorage => typeof storage.getItemSync === 'function'

export default function getStoredState<S extends AnyState>(config: PersistConfig<S>) {
  const { storage, transforms = [] } = config
  const storageKey = buildKey(config)
  const serialized = isCompatibleStorage(storage) ? storage.getItemSync(storageKey) : storage.getItem(storageKey)

  if (!serialized) {
    return null
  }

  const state: KeyAccessState = {}
  const rawState = deserialize(config, serialized)

  for (const key of Object.keys(rawState)) {
    state[key] = transforms.reduceRight(
      (subState, transformer) => transformer.out(subState, key, rawState),
      deserialize(config, rawState[key])
    )
  }

  const persisted = state[PERSIST_KEY] ?? {
    version: DEFAULT_VERSION,
    rehydrated: true,
  }
  persisted.rehydrated = true

  state[PERSIST_KEY] = persisted

  return state
}

function deserialize<S extends AnyState>(config: PersistConfig<S>, value: string): any {
  if (config.deserialize) {
    return config.deserialize(value)
  }

  return JSON.parse(value)
}
