import type { AnyState, PersistConfig } from './types'
import { createPersistoid } from './createPersistoid'

export function createHelpers<S extends AnyState>(config: PersistConfig<S>) {
  const persistoid = createPersistoid(config)
  return {
    persistoid,
  }
}
