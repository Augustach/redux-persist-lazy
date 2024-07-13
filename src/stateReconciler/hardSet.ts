/*
  https://github.com/rt2zz/redux-persist/blob/master/src/stateReconciler/hardSet.ts
  hardSet:
    - hard set incoming state
*/
export function hardSet<S>(inboundState: S): S {
  return inboundState
}
