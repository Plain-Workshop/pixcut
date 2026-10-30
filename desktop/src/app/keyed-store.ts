import type { Dispatch, SetStateAction } from 'react';

/** `{ a, b }` → `{ setA, setB }`, each shaped like useState's setter. */
export type KeyedSetters<S> = { [K in keyof S & string as `set${Capitalize<K>}`]: Dispatch<SetStateAction<S[K]>> };

export type KeyedStore<S> = {
  get: () => S;
  subscribe: (listener: () => void) => () => void;
  /** Stable setters: they take a value or an updater, and do nothing when the value is unchanged. */
  setters: KeyedSetters<S>;
  /** Back to the state the store was created with. */
  reset: () => void;
};

/**
 * A small external store for a flat state object. Each key gets a `useState`-shaped
 * setter, so a component can subscribe to the store instead of receiving the values
 * and their setters as props. The state object only changes identity when a value does.
 */
export function createKeyedStore<S extends object>(initial: S): KeyedStore<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of [...listeners]) listener(); };
  const setters = {} as Record<string, (value: unknown) => void>;
  for (const key of Object.keys(initial) as (keyof S & string)[]) {
    setters[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value: unknown) => {
      const next = typeof value === 'function' ? (value as (previous: S[typeof key]) => S[typeof key])(state[key]) : value as S[typeof key];
      if (Object.is(next, state[key])) return;
      state = { ...state, [key]: next };
      emit();
    };
  }
  return {
    get: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setters: setters as KeyedSetters<S>,
    reset() {
      if (state === initial) return;
      state = initial;
      emit();
    },
  };
}
