import { PERSIST_KEY } from '../constants'
import type { KeyAccessState } from '../types'

/*
  https://github.com/rt2zz/redux-persist/blob/master/src/stateReconciler/autoMergeLevel1.ts
  autoMergeLevel1:
    - merges 1 level of substate
    - skips substate if already modified
*/
export function autoMergeLevel1<S extends KeyAccessState>(inboundState: S, originalState: S, reducedState: S): S {
  const newState = { ...reducedState }
  // only rehydrate if inboundState exists and is an object
  if (inboundState && typeof inboundState === 'object') {
    const keys: (keyof S)[] = Object.keys(inboundState)

    for (const key of keys) {
      // ignore _persist data
      if (key === PERSIST_KEY) {
        continue
      }
      // if reducer modifies substate, skip auto rehydration
      if (originalState[key] !== reducedState[key]) {
        continue
      }
      // otherwise hard set the new value
      newState[key] = inboundState[key]
    }
  }

  return newState
}
