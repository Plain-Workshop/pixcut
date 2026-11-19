import { createContext, createElement, useContext, type ReactNode } from 'react';

/**
 * A context for a value that App already computes (the result of a hook, say),
 * so deep components read it directly instead of receiving each field as a prop.
 */
export function createValueContext<T>(name: string) {
  const Context = createContext<T | null>(null);
  function Provider({ value, children }: { value: T; children?: ReactNode }) {
    return createElement(Context.Provider, { value }, children);
  }
  function useValue(): T {
    const value = useContext(Context);
    if (value === null) throw new Error(`use${name} needs a ${name}Provider.`);
    return value;
  }
  return { Provider, useValue };
}
