import * as React from "react";

type AnyFunction = (...args: never[]) => unknown;

type CacheFn = <T extends AnyFunction>(fn: T) => T;

// React.cache existe en el runtime de Next.js (React canary) pero no en
// react estable, que es el que resuelve tsx --test. Sin memoización el
// comportamiento sigue siendo correcto, solo se pierde la deduplicación
// por request.
export const cache: CacheFn =
  (React as { cache?: CacheFn }).cache ?? ((fn) => fn);
