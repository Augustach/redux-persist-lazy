import { PERSIST_KEY } from '../constants'
import type { KeyAccessState } from '../types'

/*
  https://github.com/rt2zz/redux-persist/blob/master/src/stateReconciler/autoMergeLevel2.ts
  autoMergeLevel2:
    - merges 2 level of substate
    - skips substate if already modified
    - this is essentially redux-perist v4 behavior
*/
export function autoMergeLevel2<S extends KeyAccessState>(inboundState: S, originalState: S, reducedState: S): S {
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
      if (isPlainEnoughObject(reducedState[key])) {
        // if object is plain enough shallow merge the new values (hence "Level2")
        newState[key] = { ...newState[key], ...inboundState[key] }
        continue
      }
      // otherwise hard set the new value
      newState[key] = inboundState[key]
    }
  }

  return newState
}

function isPlainEnoughObject(o: unknown) {
  return o !== null && !Array.isArray(o) && typeof o === 'object'
}

export const autoMergeCombinedState = autoMergeLevel2
