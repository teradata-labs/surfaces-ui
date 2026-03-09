/**
 * Playground Controls — Auto-Generated Prop Controls
 *
 * Reads ComponentSchema.props and generates interactive UI controls
 * using SurfacesUI components with FormField wrappers:
 * - enum → Select dropdown (compact density)
 * - boolean → Switch toggle (inline with label)
 * - string → Text input
 * - number → Slider + number input
 * - ReactNode → Text input (rendered as children)
 */

import * as React from 'react';
import { Input } from '../primitives/input';
import { Switch } from '../primitives/switch';
import { Slider } from '../primitives/slider';
import { Label } from '../primitives/label';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '../primitives/select';
import { FormField } from '../molecules/form-field';
import { CodeSnippet } from '../molecules/code-snippet';
import type { PropDefinition } from '../catalog/component-schemas';

interface PlaygroundControlsProps {
  props: PropDefinition[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
}

export function PlaygroundControls({ props, values, onChange }: PlaygroundControlsProps) {
  // Filter to controllable props (skip complex types like ReactNode)
  const controllable = props.filter(p =>
    ['enum', 'boolean', 'string', 'number', 'ReactNode'].includes(p.type)
  );

  if (controllable.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No controllable props</p>
    );
  }

  return (
    <div className="space-y-4">
      {controllable.map(prop => (
        <PropControl
          key={prop.name}
          prop={prop}
          value={values[prop.name]}
          onChange={(val) => onChange(prop.name, val)}
        />
      ))}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatHelper(prop: PropDefinition): string | undefined {
  const parts: string[] = [];
  if (prop.description) parts.push(prop.description);
  if (prop.default) parts.push(`Default: ${prop.default}`);
  return parts.length > 0 ? parts.join(' | ') : undefined;
}

// ── Individual Prop Control ───────────────────────────────────────────────

interface PropControlProps {
  prop: PropDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}

function PropControl({ prop, value, onChange }: PropControlProps) {
  const id = `prop-${prop.name}`;

  // Boolean: keep inline Switch layout (FormField clone pattern doesn't suit Switch)
  if (prop.type === 'boolean') {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor={id} className="text-xs font-medium">
            {prop.name}
            {prop.required && <span className="text-error ml-0.5">*</span>}
          </Label>
          <Switch
            id={id}
            checked={value as boolean ?? false}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      </div>
    );
  }

  // Enum: Select dropdown (density from global context)
  if (prop.type === 'enum' && prop.values) {
    return (
      <FormField
        label={prop.name}
        htmlFor={id}
        required={prop.required}
        helperText={formatHelper(prop)}
      >
        <Select value={value as string ?? ''} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder={`Select ${prop.name}`} />
          </SelectTrigger>
          <SelectContent>
            {prop.values.map(v => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    );
  }

  // String: text input
  if (prop.type === 'string') {
    return (
      <FormField
        label={prop.name}
        htmlFor={id}
        required={prop.required}
        helperText={formatHelper(prop)}
      >
        <Input
          id={id}
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.description}
        />
      </FormField>
    );
  }

  // ReactNode: text input for content
  if (prop.type === 'ReactNode') {
    return (
      <FormField
        label={prop.name}
        htmlFor={id}
        required={prop.required}
        helperText={formatHelper(prop)}
      >
        <Input
          id={id}
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Text content"
        />
      </FormField>
    );
  }

  // Number: slider + number input
  if (prop.type === 'number') {
    return (
      <FormField
        label={prop.name}
        htmlFor={id}
        required={prop.required}
        helperText={formatHelper(prop)}
      >
        <div className="flex items-center gap-2">
          <Slider
            value={value as number ?? 0}
            onValueChange={(v) => onChange(v)}
            min={0}
            max={prop.name.includes('height') ? 600 : prop.name === 'value' ? 100 : 500}
            step={1}
            className="flex-1"
          />
          <Input
            id={id}
            type="number"
            value={value as number ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-16 text-center"
          />
        </div>
      </FormField>
    );
  }

  return null;
}

// ── Code Generation & Parsing ─────────────────────────────────────────────

/** Generate JSX code string from prop values */
function generateCode(
  componentName: string,
  values: Record<string, unknown>,
  defaultProps: Record<string, unknown>,
): string {
  const propEntries = Object.entries(values).filter(([key, val]) => {
    if (val === defaultProps[key]) return false;
    if (val === '' || val === undefined || val === null) return false;
    return true;
  });

  const childrenVal = values.children as string | undefined;
  const nonChildProps = propEntries.filter(([key]) => key !== 'children');

  let result = `<${componentName}`;

  for (const [key, val] of nonChildProps) {
    if (typeof val === 'boolean') {
      result += val ? `\n  ${key}` : `\n  ${key}={false}`;
    } else if (typeof val === 'number') {
      result += `\n  ${key}={${val}}`;
    } else {
      result += `\n  ${key}="${val}"`;
    }
  }

  if (childrenVal) {
    if (nonChildProps.length > 0) {
      result += `\n>\n  ${childrenVal}\n</${componentName}>`;
    } else {
      result += `>${childrenVal}</${componentName}>`;
    }
  } else {
    result += nonChildProps.length > 0 ? `\n/>` : ` />`;
  }

  return result;
}

/**
 * Parse the generated JSX format back into prop values.
 * Handles:  prop="str"  prop={123}  prop={false}  prop (boolean true)
 *           >children</Component>
 */
function parseCode(
  code: string,
  componentName: string,
): Record<string, unknown> | null {
  try {
    const parsed: Record<string, unknown> = {};

    // Extract children: >content</ComponentName>
    const childrenMatch = code.match(
      new RegExp(`>([\\s\\S]*?)</${componentName}>`)
    );
    if (childrenMatch?.[1]) {
      parsed.children = childrenMatch[1].trim();
    }

    // Remove the children + closing tag portion so we only parse the opening tag
    const openTag = childrenMatch
      ? code.slice(0, code.indexOf(childrenMatch[0]))
      : code;

    // String props: name="value"
    const stringRe = /(\w+)="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = stringRe.exec(openTag)) !== null) {
      if (m[1]) parsed[m[1]] = m[2] ?? '';
    }

    // Number props: name={123}  or name={-123.5}
    const numberRe = /(\w+)=\{(-?[\d.]+)\}/g;
    while ((m = numberRe.exec(openTag)) !== null) {
      if (m[1]) parsed[m[1]] = Number(m[2]);
    }

    // Boolean false: name={false}
    const boolFalseRe = /(\w+)=\{false\}/g;
    while ((m = boolFalseRe.exec(openTag)) !== null) {
      if (m[1]) parsed[m[1]] = false;
    }

    // Boolean true: standalone name (no = sign, not already captured)
    // Match lines like "  disabled" or "  checked" — word at start of trimmed line with no =
    const lines = openTag.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip the opening <Component tag line and self-closing />
      if (trimmed.startsWith('<') || trimmed === '/>' || trimmed === '>') continue;
      // Standalone identifier with no = sign → boolean true
      if (/^(\w+)$/.test(trimmed) && !parsed.hasOwnProperty(trimmed)) {
        parsed[trimmed] = true;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

// ── CodeView Component ────────────────────────────────────────────────────

interface CodeViewProps {
  componentName: string;
  values: Record<string, unknown>;
  defaultProps: Record<string, unknown>;
  /** Called when the user edits code — parsed values pushed back */
  onValuesChange?: (values: Record<string, unknown>) => void;
}

export function CodeView({ componentName, values, defaultProps, onValuesChange }: CodeViewProps) {
  const generatedCode = React.useMemo(
    () => generateCode(componentName, values, defaultProps),
    [componentName, values, defaultProps],
  );

  const [code, setCode] = React.useState(generatedCode);

  // Sync local state when generated code changes (prop controls updated)
  React.useEffect(() => {
    setCode(generatedCode);
  }, [generatedCode]);

  const handleCodeChange = React.useCallback((newCode: string) => {
    setCode(newCode);

    // Parse edited code back into prop values
    if (onValuesChange) {
      const parsed = parseCode(newCode, componentName);
      if (parsed) {
        // Merge with defaults so cleared props revert to defaults
        onValuesChange({ ...defaultProps, ...parsed });
      }
    }
  }, [onValuesChange, componentName, defaultProps]);

  return (
    <CodeSnippet
      code={code}
      language="tsx"
      copyable
      editable
      onCodeChange={handleCodeChange}
    />
  );
}
