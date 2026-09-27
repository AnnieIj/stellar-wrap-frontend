import React, { useMemo } from "react";
import type { Decorator } from "@storybook/nextjs";

type StoreApi<T> = { setState: (partial: Partial<T>) => void };

/**
 * Decorator that seeds a Zustand store with mock state before the story renders.
 * The state is applied inside a `useMemo` so it lands synchronously on first
 * paint, letting stories drive store-backed components without a running app.
 */
export function withStore<T>(store: StoreApi<T>, state: Partial<T>): Decorator {
  return function StoreDecorator(Story) {
    useMemo(() => store.setState(state), []);
    return <Story />;
  };
}
