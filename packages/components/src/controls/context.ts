/**
 * Something a person did in a component, told to whoever keeps an agent's
 * context: which view they added, which field they changed, what they
 * filtered by, what they picked. It is a note, not a request: it starts no
 * turn and asks for nothing. Every component that a person can change takes
 * `onContext` and sends these, so an agent knows what happened between its
 * turns and not only where things ended up.
 */
export interface ContextNote {
  /** What kind of thing, as a dotted word: "view.added", "field.changed", "filter.changed", "point.selected". */
  kind: string;
  /** The same in a sentence, as the component told the person. */
  summary: string;
  /** What it was about, as plain data: a pill, a tile's shelves, a filter list. Names and settings, and a value only where the person chose it. */
  subject?: Record<string, unknown>;
}

export type OnContext = (note: ContextNote) => void;
