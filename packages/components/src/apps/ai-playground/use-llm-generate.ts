/**
 * React hook for LLM-based UI generation
 *
 * Wraps the streaming LLM client with React state management.
 * Handles: streaming accumulation, JSON extraction, spec validation, and error recovery.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { streamGenerate } from './llm-client';
import { validateGeneratedSpec, attemptAutoFix } from '../../catalog/validation';
import type { LLMProviderConfig, GenerationState } from './types';

const INITIAL_STATE: GenerationState = {
  status: 'idle',
  rawText: '',
  spec: null,
  error: null,
  progress: 0,
  explanation: null,
};

interface UseLLMGenerateOptions {
  /** Called when a valid spec is generated */
  onSpecGenerated?: (spec: Record<string, unknown>) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

export function useLLMGenerate(options: UseLLMGenerateOptions = {}) {
  const { onSpecGenerated, onError } = options;
  const [state, setState] = useState<GenerationState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const generate = useCallback(async (
    config: LLMProviderConfig,
    systemPrompt: string,
    userPrompt: string,
  ) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: 'generating',
      rawText: '',
      spec: null,
      error: null,
      progress: 0,
      explanation: null,
    });

    let accumulated = '';

    try {
      const stream = streamGenerate(config, systemPrompt, userPrompt, controller.signal);

      for await (const chunk of stream) {
        if (!mountedRef.current) return;

        accumulated += chunk;
        // Estimate progress based on typical spec size
        const progress = Math.min(accumulated.length / 3000, 0.95);

        setState(prev => ({
          ...prev,
          rawText: accumulated,
          progress,
        }));
      }

      if (!mountedRef.current) return;

      // ── Parse & Validate ──
      setState(prev => ({ ...prev, status: 'validating', progress: 0.96 }));

      // Extract JSON from the response (LLM might wrap it in markdown code blocks)
      const jsonStr = extractJSON(accumulated);

      if (!jsonStr) {
        const preview = accumulated.trim().slice(0, 300);
        const err = `Could not extract valid JSON from LLM response.\n\nRaw output (first 300 chars):\n${preview}`;
        setState(prev => ({ ...prev, status: 'error', error: err, progress: 0 }));
        onError?.(err);
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        const err = `JSON parse error: ${e instanceof Error ? e.message : 'Unknown error'}`;
        setState(prev => ({ ...prev, status: 'error', error: err, progress: 0 }));
        onError?.(err);
        return;
      }

      // Normalize alternate spec formats (smaller models often produce these)
      parsed = normalizeSpec(parsed);

      // Validate against json-render spec schema
      const validation = validateGeneratedSpec(parsed);

      if (validation.valid && validation.spec) {
        const spec = validation.spec as Record<string, unknown>;
        setState({
          status: 'complete',
          rawText: accumulated,
          spec,
          error: null,
          progress: 1,
          explanation: null,
        });
        onSpecGenerated?.(spec);
      } else {
        // Try auto-fix
        const fixed = attemptAutoFix(parsed, validation.errors);
        if (fixed) {
          const spec = fixed as Record<string, unknown>;
          setState({
            status: 'complete',
            rawText: accumulated,
            spec,
            error: null,
            progress: 1,
            explanation: 'Auto-fixed validation errors in the generated spec.',
          });
          onSpecGenerated?.(spec);
        } else {
          // The data-viz-only validator doesn't know about our extended UI registry
          // (Box, Card, StatCard, Heading, Text, Divider, FormInput, FormSelect).
          // Filter out unknown_component errors — our extended registry handles those.
          const nonRegistryErrors = validation.errors.filter(
            e => e.code !== 'unknown_component'
          );

          // Also filter out prop-level validation errors on elements whose type is unknown
          // (the validator can't validate props for types it doesn't know about)
          const knownTypeErrors = nonRegistryErrors.filter(e => {
            // Prop errors look like "elements.foo.props.bar" — check if the parent element
            // has an unknown_component error
            const match = e.path.match(/^elements\.([^.]+)\.props\./);
            if (!match) return true; // structural error, keep it
            const elementId = match[1];
            return !validation.errors.some(
              ue => ue.code === 'unknown_component' && ue.path === `elements.${elementId}.type`
            );
          });

          // If only prop-level issues remain on known components, accept with a warning
          // (the renderer will use defaults for invalid prop values)
          const hasOnlyPropErrors = knownTypeErrors.every(
            e => e.path.includes('.props.')
          );

          if (knownTypeErrors.length === 0 || hasOnlyPropErrors) {
            const warning = knownTypeErrors.length > 0
              ? `Minor prop warnings: ${knownTypeErrors.map(e => `${e.path}: ${e.message}`).join('; ')}`
              : null;
            setState({
              status: 'complete',
              rawText: accumulated,
              spec: parsed,
              error: null,
              progress: 1,
              explanation: warning,
            });
            onSpecGenerated?.(parsed);
          } else {
            const errMsg = knownTypeErrors.map(e => `${e.path}: ${e.message}`).join('; ');
            setState({
              status: 'error',
              rawText: accumulated,
              spec: parsed, // Still provide the spec for manual editing
              error: `Validation failed: ${errMsg}`,
              progress: 0,
              explanation: null,
            });
            onError?.(errMsg);
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!mountedRef.current) return;

      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg,
        progress: 0,
      }));
      onError?.(errorMsg);
    }
  }, [onSpecGenerated, onError]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    if (mountedRef.current) {
      setState(prev => ({ ...prev, status: 'idle' }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (mountedRef.current) {
      setState(INITIAL_STATE);
    }
  }, []);

  /** Update the spec directly (for JSON editor) */
  const setSpec = useCallback((spec: Record<string, unknown>) => {
    setState(prev => ({ ...prev, spec, status: 'complete', error: null }));
  }, []);

  return { state, generate, abort, reset, setSpec };
}

// ── Spec Normalization ───────────────────────────────────────────────────────

/** Map generic/lowercase type names → our registry component names */
const TYPE_ALIASES: Record<string, string> = {
  container: 'Box',
  box: 'Box',
  flex: 'Box',
  grid: 'Box',
  layout: 'Box',
  row: 'Box',
  column: 'Box',
  stack: 'Box',
  section: 'Box',
  div: 'Box',
  card: 'Card',
  panel: 'Card',
  text: 'Text',
  paragraph: 'Text',
  label: 'Text',
  span: 'Text',
  heading: 'Heading',
  title: 'Heading',
  h1: 'Heading',
  h2: 'Heading',
  h3: 'Heading',
  h4: 'Heading',
  statcard: 'StatCard',
  stat: 'StatCard',
  kpi: 'StatCard',
  metric: 'StatCard',
  divider: 'Divider',
  separator: 'Divider',
  hr: 'Divider',
  table: 'DataTable',
  datatable: 'DataTable',
  datagrid: 'DataTable',
  chart: 'Chart',
  graph: 'Chart',
  input: 'FormInput',
  forminput: 'FormInput',
  textfield: 'FormInput',
  select: 'FormSelect',
  formselect: 'FormSelect',
  dropdown: 'FormSelect',
  filter: 'Filter',
  tablewithfilters: 'TableWithFilters',
  chartwithcontrols: 'ChartWithControls',
};

/** Named size → pixel value */
const SIZE_MAP: Record<string, number> = {
  none: 0, xs: 4, small: 8, sm: 8, medium: 16, md: 16,
  large: 24, lg: 24, xl: 32, xxl: 48,
};

function resolveSize(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return SIZE_MAP[v.toLowerCase()];
  return undefined;
}

/**
 * Normalize alternate spec shapes produced by smaller / local models into
 * the canonical json-render format:
 *   { root: string, elements: Record<string, { type, props, children? }>, state? }
 *
 * Handles:
 * 1. root is an inline object instead of a string ID
 * 2. elements is an array instead of a keyed record
 * 3. children are inline objects instead of string refs
 * 4. data lives at top level instead of state.data
 * 5. Generic/lowercase type names → registry component names
 * 6. Layout props (layout, gap, padding) → Box props
 * 7. Text variant → Heading vs Text
 * 8. Orphaned elements → attached to root children
 * 9. Props at element root → moved into props object
 */
function normalizeSpec(raw: Record<string, unknown>): Record<string, unknown> {
  try {
    const spec = { ...raw };
    let elements: Record<string, Record<string, unknown>> =
      spec.elements && typeof spec.elements === 'object' && !Array.isArray(spec.elements)
        ? { ...(spec.elements as Record<string, Record<string, unknown>>) }
        : {};

    let counter = 0;
    const nextId = (prefix: string) => `${prefix}-${++counter}`;

    // ── Handle elements as array ──
    if (Array.isArray(spec.elements)) {
      const arr = spec.elements as Record<string, unknown>[];
      elements = {};
      for (const item of arr) {
        if (item && typeof item === 'object') {
          const id = (typeof item.id === 'string' ? item.id : null)
            || (typeof item.name === 'string' ? item.name : null)
            || nextId(typeof item.type === 'string' ? item.type.toLowerCase() : 'el');
          const { id: _id, name: _name, ...rest } = item;
          elements[id] = rest as Record<string, unknown>;
        }
      }
      spec.elements = elements;
    }

    // ── Handle root as inline object ──
    if (spec.root && typeof spec.root === 'object' && !Array.isArray(spec.root)) {
      const rootObj = spec.root as Record<string, unknown>;
      const rootId = (typeof rootObj.id === 'string' ? rootObj.id : null)
        || nextId(typeof rootObj.type === 'string' ? rootObj.type.toLowerCase() : 'root');
      const { id: _id, ...rest } = rootObj;
      flattenInlineChildren(rest as Record<string, unknown>, elements, nextId);
      elements[rootId] = rest as Record<string, unknown>;
      spec.root = rootId;
      spec.elements = elements;
    }

    // ── Flatten any remaining inline children in elements ──
    for (const [, el] of Object.entries(elements)) {
      if (el && Array.isArray(el.children)) {
        flattenInlineChildren(el, elements, nextId);
      }
    }

    // ── Move top-level data into state.data ──
    if (spec.data && !spec.state) {
      spec.state = { data: spec.data };
      delete spec.data;
    }

    // ── Map component types & transform props ──
    for (const [, el] of Object.entries(elements)) {
      mapElementType(el);
    }

    // ── Attach orphaned elements to root ──
    if (typeof spec.root === 'string') {
      const rootEl = elements[spec.root];
      if (rootEl) {
        attachOrphans(spec.root, elements);
      }
    }

    // ── Resolve dataSource references ──
    // Models often put data in state.data.tableName and reference it via dataSource prop.
    // Inline the data into the element props so DataTable can render it.
    const stateData = (spec.state as Record<string, unknown> | undefined)?.data;
    if (stateData && typeof stateData === 'object') {
      for (const [, el] of Object.entries(elements)) {
        const props = el.props as Record<string, unknown> | undefined;
        if (props?.dataSource && typeof props.dataSource === 'string') {
          // state.data is a keyed object like { tables: [...] }
          const dataRef = (stateData as Record<string, unknown>)[props.dataSource];
          if (Array.isArray(dataRef)) {
            props.data = dataRef;
            delete props.dataSource;
          }
        }
      }
      // Also flatten state.data if it's keyed — pick the first array value
      // so that state.data is an array (which the spec schema expects)
      if (!Array.isArray(stateData)) {
        const firstArray = Object.values(stateData as Record<string, unknown>).find(Array.isArray);
        if (firstArray) {
          (spec.state as Record<string, unknown>).data = firstArray;
        }
      }
    }

    spec.elements = elements;
    return spec;
  } catch {
    return raw;
  }
}

/**
 * If an element's children array contains inline objects,
 * extract them into the elements map and replace with string IDs.
 */
function flattenInlineChildren(
  element: Record<string, unknown>,
  elements: Record<string, Record<string, unknown>>,
  nextId: (prefix: string) => string,
): void {
  if (!Array.isArray(element.children)) return;

  const newChildren: string[] = [];

  for (const child of element.children as unknown[]) {
    if (typeof child === 'string') {
      newChildren.push(child);
    } else if (child && typeof child === 'object') {
      const childObj = child as Record<string, unknown>;
      const childId = (typeof childObj.id === 'string' ? childObj.id : null)
        || nextId(typeof childObj.type === 'string' ? childObj.type.toLowerCase() : 'child');
      const { id: _id, ...rest } = childObj;
      flattenInlineChildren(rest as Record<string, unknown>, elements, nextId);
      elements[childId] = rest as Record<string, unknown>;
      newChildren.push(childId);
    }
  }

  element.children = newChildren;
}

/**
 * Map a generic element type to a registry component and transform its props.
 * Mutates the element in place.
 */
function mapElementType(el: Record<string, unknown>): void {
  const rawType = typeof el.type === 'string' ? el.type : '';
  const mapped = TYPE_ALIASES[rawType.toLowerCase()] ?? rawType;

  // Ensure props object exists — move non-structural keys into it
  if (!el.props || typeof el.props !== 'object') {
    const { type, children, ...rest } = el;
    // Strip keys that aren't real props (styles, id, name)
    const { styles: _s, id: _id, name: _n, ...propFields } = rest as Record<string, unknown>;
    el.props = propFields;
    // Clean up moved keys from element root
    for (const key of Object.keys(rest)) {
      delete el[key];
    }
    el.type = type;
    if (children !== undefined) el.children = children;
  }

  const props = el.props as Record<string, unknown>;

  // ── Box / Container mapping ──
  if (mapped === 'Box') {
    el.type = 'Box';
    if (props.layout) {
      const layout = String(props.layout).toLowerCase();
      if (layout === 'horizontal' || layout === 'row') props.direction = 'row';
      else props.direction = 'column';
      delete props.layout;
    }
    const gap = resolveSize(props.gap);
    if (gap !== undefined) props.gap = gap;
    const padding = resolveSize(props.padding);
    if (padding !== undefined) props.padding = padding;
    // Remove style-only props our Box doesn't support
    delete props.styles;
    delete props.backgroundColor;
    delete props.minHeight;
    return;
  }

  // ── Text / Heading mapping ──
  if (mapped === 'Text' || mapped === 'Heading') {
    const variant = typeof props.variant === 'string' ? props.variant.toLowerCase() : '';
    const headingMatch = variant.match(/^h([1-4])$/);

    if (headingMatch || mapped === 'Heading') {
      el.type = 'Heading';
      const level = headingMatch ? parseInt(headingMatch[1]!, 10) : (typeof props.level === 'number' ? props.level : 2);
      const text = props.content ?? props.text ?? '';
      el.props = { text, level };
    } else {
      el.type = 'Text';
      const content = props.content ?? props.text ?? '';
      const muted = variant === 'caption' || variant === 'muted' || variant === 'subtitle';
      const size = variant === 'caption' ? 'sm' : (variant === 'lg' || variant === 'large') ? 'lg' : 'base';
      el.props = { content: String(content), size, muted };
    }
    return;
  }

  // ── Card mapping ──
  if (mapped === 'Card') {
    el.type = 'Card';
    const padding = resolveSize(props.padding);
    el.props = {
      ...(props.title ? { title: props.title } : {}),
      ...(props.description ? { description: props.description } : {}),
      ...(padding !== undefined ? { padding: padding <= 8 ? 'sm' : padding <= 16 ? 'md' : 'lg' } : {}),
    };
    return;
  }

  // ── StatCard mapping ──
  if (mapped === 'StatCard') {
    el.type = 'StatCard';
    el.props = {
      label: props.label ?? props.title ?? '',
      value: props.value ?? '',
      ...(props.change ? { change: props.change } : {}),
      ...(props.trend ? { trend: props.trend } : {}),
    };
    return;
  }

  // ── DataTable mapping ──
  if (mapped === 'DataTable') {
    el.type = 'DataTable';
    // Map columns: normalize to { key, header }
    const cols = Array.isArray(props.columns) ? props.columns : [];
    const columns = cols.map((c: Record<string, unknown>) => ({
      key: c.key ?? c.field ?? c.accessor ?? '',
      header: c.header ?? c.title ?? c.label ?? c.key ?? '',
    }));
    // Try to resolve data from dataSource reference or inline data
    el.props = {
      columns,
      ...(props.data ? { data: props.data } : {}),
      ...(props.dataSource ? { dataSource: props.dataSource } : {}),
    };
    return;
  }

  // ── Divider mapping ──
  if (mapped === 'Divider') {
    el.type = 'Divider';
    el.props = {};
    return;
  }

  // ── Default: just fix the type name ──
  el.type = mapped;
}

/**
 * Find elements that no parent references and attach them as children of root.
 */
function attachOrphans(
  rootId: string,
  elements: Record<string, Record<string, unknown>>,
): void {
  const rootEl = elements[rootId];
  if (!rootEl) return;

  // Collect all referenced child IDs
  const referenced = new Set<string>();
  for (const [, el] of Object.entries(elements)) {
    if (Array.isArray(el.children)) {
      for (const c of el.children as string[]) {
        referenced.add(c);
      }
    }
  }

  // Find orphans (not root, not referenced by any parent)
  const orphans = Object.keys(elements).filter(
    id => id !== rootId && !referenced.has(id),
  );

  if (orphans.length > 0) {
    const existing = Array.isArray(rootEl.children) ? (rootEl.children as string[]) : [];
    rootEl.children = [...existing, ...orphans];
  }
}

// ── JSON Extraction Utilities ────────────────────────────────────────────────

/**
 * Extract a JSON object from LLM output.
 * Handles common patterns:
 * - Raw JSON
 * - JSON wrapped in ```json ... ``` code blocks
 * - JSON with surrounding text
 * - Malformed JSON from smaller models (trailing commas, comments, etc.)
 */
function extractJSON(text: string): string | null {
  const trimmed = text.trim();

  // Try direct parse first
  if (isValidJSON(trimmed)) return trimmed;

  // Try extracting from markdown code block (greedy — last closing fence)
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*)\n?```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const inner = codeBlockMatch[1].trim();
    if (isValidJSON(inner)) return inner;
    // Try repairing the code block content
    const repaired = repairJSON(inner);
    if (repaired) return repaired;
  }

  // Try finding the first { ... } block (greedy, outermost)
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    if (isValidJSON(candidate)) return candidate;
    // Try repairing
    const repaired = repairJSON(candidate);
    if (repaired) return repaired;
  }

  // Last resort: repair entire input
  const repaired = repairJSON(trimmed);
  if (repaired) return repaired;

  return null;
}

/**
 * Attempt to fix common JSON issues from smaller / local models:
 * - Trailing commas before } or ]
 * - Single-line // comments
 * - Block comments
 * - Unquoted property names
 * - Single-quoted strings
 */
function repairJSON(text: string): string | null {
  try {
    let fixed = text;

    // Strip single-line comments (// ...) — but not inside strings
    fixed = fixed.replace(/^\s*\/\/.*$/gm, '');

    // Strip block comments (/* ... */)
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove trailing commas before } or ] (with optional whitespace/newlines)
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Try parsing after basic fixes
    if (isValidJSON(fixed)) return fixed;

    // Replace single-quoted strings with double-quoted strings
    // This is a best-effort heuristic: replace ' at word boundaries
    fixed = fixed.replace(
      /(?<=[:,[\]{\s])'/g, '"'
    ).replace(
      /'(?=[,\]}:\s])/g, '"'
    );

    if (isValidJSON(fixed)) return fixed;

    // Try quoting unquoted keys: {foo: "bar"} → {"foo": "bar"}
    fixed = fixed.replace(
      /(?<=[{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g,
      '"$1"$2'
    );

    if (isValidJSON(fixed)) return fixed;

    return null;
  } catch {
    return null;
  }
}

function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
