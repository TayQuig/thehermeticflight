/**
 * DOM Helpers
 *
 * Null-safe typed wrappers for document.getElementById.
 * Replaces `document.getElementById('x') as HTMLElement` patterns
 * with helpers that make null-safety explicit at the call site.
 *
 * getEl<T>  — returns T | null. Use when absence is a valid state.
 * requireEl<T> — returns T, throws if null. Use when absence is a bug.
 *
 * Both functions accept a generic type parameter constrained to HTMLElement,
 * so callers retain full type information without unsafe casts:
 *
 *   const form = requireEl<HTMLFormElement>('email-form');
 *   const btn  = getEl<HTMLButtonElement>('optional-btn');
 */

/**
 * Returns the element with the given id cast to T, or null if not found.
 */
export function getEl<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Returns the element with the given id cast to T.
 * Throws a descriptive error if the element is not found.
 * Use this for elements that must exist for the page to function correctly.
 */
export function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (el === null) {
    throw new Error(`requireEl: element with id "${id}" not found in the DOM`);
  }
  return el;
}
