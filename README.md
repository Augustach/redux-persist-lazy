# redux-persist-lazy

Persist and rehydrate redux stores lazily.
The `redux-persist` rehydration state for each reducer at it's initialisation.
If there are a lot of persistent reducers in a project, this can cause a performance problem, especially on low end devices.
The main idea of this library is to make state rehydration lazy, with backward compatibility with `redux-persist'.

## Underhood

`persistReducer` and `persistCombineReducers` returns `Proxy` object as an initial state. When in the code we try to touch it via selectors, `JSON.stringify`, actions, etc, the proxy synchronously rehydrates the state and returns it.
After rehydration, we only work with JS objects.

## Limitations
1. `redux-persist-lazy` works only with synchronous storages like [react-native-mmkv](https://github.com/mrousavy/react-native-mmkv), [localSotarge](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), etc.
2. `redux-persist-lazy` is not fully compatible with `redux-persist`, although the migration should be smooth.

## Installation

```sh
npm install redux-persist-lazy
```

## Usage

Basic usage involves adding persistReducer and persistStore to your setup.

```js
// configureStore.js

import { createStore } from 'redux'
import { persistStore, persistReducer } from 'redux-persist-lazy'

import { rootReducer } from './reducers'
import { mmkv } from './storage'

const persistConfig = {
  key: 'slice',
  storage: mmkv,
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

const store = configureStore({
  reducer: combineReducers({
    slice: persistedReducer,
    // ...
  }),
})
```


## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
