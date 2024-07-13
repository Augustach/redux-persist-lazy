import { DEFAULT_VERSION } from './constants'
import type { MigrationManifest, PersistedState } from './types'

// https://github.com/rt2zz/redux-persist/blob/master/src/createMigrate.ts
export const createMigrate =
  <State>(migrations: MigrationManifest<State>) =>
  (state: (State & PersistedState) | null, currentVersion: number): State | null => {
    if (!state) {
      return null
    }

    const inboundVersion =
      state._persist && state._persist.version !== undefined ? state._persist.version : DEFAULT_VERSION

    if (inboundVersion === currentVersion) {
      return state
    }
    if (inboundVersion > currentVersion) {
      return state
    }

    const migrationKeys = Object.keys(migrations)
      .map((ver) => parseInt(ver, 10))
      .filter((key) => currentVersion >= key && key > inboundVersion)
      .sort((a, b) => a - b)

    return migrationKeys.reduce((rawState: any, versionKey) => {
      const migration = migrations[versionKey]
      if (migration) {
        return migration(state)
      }
      return rawState
    }, state)
  }
