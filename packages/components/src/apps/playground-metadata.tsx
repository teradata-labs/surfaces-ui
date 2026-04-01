/**
 * Playground Metadata Panel
 *
 * Renders component documentation from ComponentSchema:
 * - Usage guidance (when/whenNot/dos/donts)
 * - Design tokens
 * - Composition rules
 * - Domain context
 */

import * as React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs';
import { Badge } from '../primitives/badge';
import type { ComponentSchema } from '../catalog/component-schemas';
import { CheckCircle, XCircle, Lightbulb, Layers, Palette, Link } from 'lucide-react';

interface MetadataPanelProps {
  schema: ComponentSchema;
}

export function MetadataPanel({ schema }: MetadataPanelProps) {
  return (
    <Tabs defaultValue="usage" className="w-full">
      <TabsList>
        <TabsTrigger value="usage">Usage</TabsTrigger>
        <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
        <TabsTrigger value="composition">Composition</TabsTrigger>
      </TabsList>

      <TabsContent value="usage" className="mt-4">
        <UsageTab schema={schema} />
      </TabsContent>

      <TabsContent value="guidelines" className="mt-4">
        <GuidelinesTab schema={schema} />
      </TabsContent>

      <TabsContent value="tokens" className="mt-4">
        <TokensTab schema={schema} />
      </TabsContent>

      <TabsContent value="composition" className="mt-4">
        <CompositionTab schema={schema} />
      </TabsContent>
    </Tabs>
  );
}

// ── Usage Tab ─────────────────────────────────────────────────────────────

function UsageTab({ schema }: { schema: ComponentSchema }) {
  return (
    <div className="space-y-5">
      <MetaSection icon={<CheckCircle className="h-4 w-4 text-positive" />} title="When to use">
        <ul className="space-y-1.5">
          {schema.usage.when.map((item, i) => (
            <li key={i} className="text-sm text-on-surface-variant flex gap-2">
              <span className="text-positive mt-0.5 shrink-0">+</span>
              {item}
            </li>
          ))}
        </ul>
      </MetaSection>

      <MetaSection icon={<XCircle className="h-4 w-4 text-error" />} title="When NOT to use">
        <ul className="space-y-1.5">
          {schema.usage.whenNot.map((item, i) => (
            <li key={i} className="text-sm text-on-surface-variant flex gap-2">
              <span className="text-error mt-0.5 shrink-0">-</span>
              {item}
            </li>
          ))}
        </ul>
      </MetaSection>

      {schema.usage.alternatives.length > 0 && (
        <MetaSection icon={<Link className="h-4 w-4 text-primary" />} title="Alternatives">
          <div className="flex flex-wrap gap-2">
            {schema.usage.alternatives.map((alt, i) => (
              <Badge key={i} variant="outline" className="text-xs">{alt}</Badge>
            ))}
          </div>
        </MetaSection>
      )}

      {schema.usage.domainContext && (
        <MetaSection icon={<Lightbulb className="h-4 w-4 text-warning" />} title="Domain Context">
          <p className="text-sm text-on-surface-variant">{schema.usage.domainContext}</p>
        </MetaSection>
      )}
    </div>
  );
}

// ── Guidelines Tab ────────────────────────────────────────────────────────

function GuidelinesTab({ schema }: { schema: ComponentSchema }) {
  return (
    <div className="space-y-5">
      <MetaSection icon={<CheckCircle className="h-4 w-4 text-positive" />} title="Do">
        <ul className="space-y-1.5">
          {schema.usage.dos.map((item, i) => (
            <li key={i} className="text-sm text-on-surface-variant flex gap-2">
              <span className="text-positive mt-0.5 shrink-0">&#10003;</span>
              {item}
            </li>
          ))}
        </ul>
      </MetaSection>

      <MetaSection icon={<XCircle className="h-4 w-4 text-error" />} title="Don't">
        <ul className="space-y-1.5">
          {schema.usage.donts.map((item, i) => (
            <li key={i} className="text-sm text-on-surface-variant flex gap-2">
              <span className="text-error mt-0.5 shrink-0">&#10007;</span>
              {item}
            </li>
          ))}
        </ul>
      </MetaSection>

      {schema.usage.patterns.length > 0 && (
        <MetaSection icon={<Layers className="h-4 w-4 text-primary" />} title="Common Patterns">
          <div className="space-y-3">
            {schema.usage.patterns.map((pattern, i) => (
              <div key={i} className="border border-su-outline-variant rounded-lg p-3">
                <p className="text-sm font-medium text-foreground">{pattern.name}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{pattern.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pattern.components.map((c, j) => (
                    <Badge key={j} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </MetaSection>
      )}
    </div>
  );
}

// ── Tokens Tab ────────────────────────────────────────────────────────────

function TokensTab({ schema }: { schema: ComponentSchema }) {
  if (schema.designTokens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No design tokens defined for this component.</p>
    );
  }

  return (
    <MetaSection icon={<Palette className="h-4 w-4 text-primary" />} title="Design Tokens">
      <div className="space-y-2">
        {schema.designTokens.map((token, i) => (
          <div key={i} className="flex items-center gap-3">
            <TokenSwatch token={token} />
            <code className="text-xs font-mono text-foreground">{token}</code>
          </div>
        ))}
      </div>
    </MetaSection>
  );
}

function TokenSwatch({ token }: { token: string }) {
  return (
    <div
      className="w-6 h-6 rounded border border-su-outline-variant shrink-0"
      style={{ backgroundColor: `var(${token}, transparent)` }}
      title={token}
    />
  );
}

// ── Composition Tab ───────────────────────────────────────────────────────

function CompositionTab({ schema }: { schema: ComponentSchema }) {
  const hasComposition = schema.composedOf?.length || schema.composableWith?.length || schema.subComponents?.length;

  if (!hasComposition) {
    return (
      <p className="text-sm text-muted-foreground italic">No composition rules defined.</p>
    );
  }

  return (
    <div className="space-y-5">
      {schema.composedOf && schema.composedOf.length > 0 && (
        <MetaSection icon={<Layers className="h-4 w-4 text-primary" />} title="Composed Of">
          <div className="flex flex-wrap gap-2">
            {schema.composedOf.map((c, i) => (
              <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This component internally uses these sub-components.
          </p>
        </MetaSection>
      )}

      {schema.composableWith && schema.composableWith.length > 0 && (
        <MetaSection icon={<Link className="h-4 w-4 text-primary" />} title="Composable With">
          <div className="flex flex-wrap gap-2">
            {schema.composableWith.map((c, i) => (
              <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Often used alongside these components.
          </p>
        </MetaSection>
      )}

      {schema.subComponents && schema.subComponents.length > 0 && (
        <MetaSection icon={<Layers className="h-4 w-4 text-primary" />} title="Sub-Components">
          <div className="flex flex-wrap gap-2">
            {schema.subComponents.map((c, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Exports these related sub-components.
          </p>
        </MetaSection>
      )}
    </div>
  );
}

// ── Shared Section Layout ─────────────────────────────────────────────────

function MetaSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

// ── Props Table ───────────────────────────────────────────────────────────

export function PropsTable({ schema }: { schema: ComponentSchema }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-su-outline-variant">
            <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Prop</th>
            <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Type</th>
            <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground">Default</th>
            <th className="text-left py-2 text-xs font-medium text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody>
          {schema.props.map(prop => (
            <tr key={prop.name} className="border-b border-su-outline-variant/50">
              <td className="py-2 pr-4">
                <code className="text-xs font-mono text-primary">{prop.name}</code>
                {prop.required && <span className="text-error text-[10px] ml-1">required</span>}
              </td>
              <td className="py-2 pr-4">
                <code className="text-xs font-mono text-on-surface-variant">
                  {prop.type === 'enum' && prop.values
                    ? prop.values.map(v => `'${v}'`).join(' | ')
                    : prop.type}
                </code>
              </td>
              <td className="py-2 pr-4">
                <code className="text-xs font-mono text-muted-foreground">{prop.default || '-'}</code>
              </td>
              <td className="py-2 text-xs text-on-surface-variant">{prop.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
