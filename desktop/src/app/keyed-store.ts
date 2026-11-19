import { createContext, createElement, useContext, useRef, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from 'react';

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

/**
 * A keyed store with its context, provider and hooks, so a new group of editor
 * state needs only its initial values and a name.
 */
export function createStoreKit<S extends object>(name: string, initial: S) {
  const Context = createContext<KeyedStore<S> | null>(null);
  const create = () => createKeyedStore(initial);
  function Provider({ store, children }: { store: KeyedStore<S>; children?: ReactNode }) {
    return createElement(Context.Provider, { value: store }, children);
  }
  /** Creates a store that lives as long as the calling component. */
  function useCreate(): KeyedStore<S> {
    const ref = useRef<KeyedStore<S> | null>(null);
    ref.current ??= create();
    return ref.current;
  }
  /** Subscribes to the whole state and returns it with the stable setters. */
  function useStore(store?: KeyedStore<S>): S & KeyedSetters<S> {
    const context = useContext(Context);
    const active = store ?? context;
    if (!active) throw new Error(`use${name} needs a ${name}Provider or a store.`);
    const state = useSyncExternalStore(active.subscribe, active.get, active.get);
    return { ...state, ...active.setters };
  }
  return { create, Provider, useCreate, useStore };
}
