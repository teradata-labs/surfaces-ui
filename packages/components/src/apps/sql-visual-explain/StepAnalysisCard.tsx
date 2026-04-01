/**
 * StepAnalysisCard - Structured metadata display for EXPLAIN steps
 * Based on wireframe design from visual-explain-app.html
 */

import * as React from 'react';
import { Lock, Sigma, ArrowUpDown, CornerDownLeft, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeradataStep, StepType, ConfidenceLevel } from './teradata-types';
import { executePromptAction, buildExplainStepPrompt, buildOptimizeStepPrompt } from './send-prompt-utils';

export interface StepAnalysisCardProps {
  /** Step data to display */
  step: TeradataStep;

  /** Step index (0-based) */
  stepIndex: number;

  /** Raw EXPLAIN text for full context */
  rawExplain: string;

  /** SQL text for optimization prompts */
  sql: string;

  /** Handler for "Compare all" action */
  onCompareAll?: () => void;
}

/** Icon mapping by step type */
const STEP_ICONS: Record<StepType, React.ComponentType<{ className?: string }>> = {
  lock: Lock,
  agg: Sigma,
  sort: ArrowUpDown,
  return: CornerDownLeft,
  retrieve: Database,
  scan: Database,
};

/** Step type badge variants */
const STEP_TYPE_VARIANTS: Record<StepType, string> = {
  lock: 'bg-[#f1efe8] text-[#5f5e5a] dark:bg-[#5f5e5a] dark:text-[#f1efe8]',
  agg: 'bg-[#eeedfe] text-[#534ab7] dark:bg-[#534ab7] dark:text-[#eeedfe]',
  sort: 'bg-[#e1f5ee] text-[#0f6e56] dark:bg-[#0f6e56] dark:text-[#e1f5ee]',
  return: 'bg-[#eaf3de] text-[#3b6d11] dark:bg-[#3b6d11] dark:text-[#eaf3de]',
  retrieve: 'bg-[#e6f1fb] text-[#185fa5] dark:bg-[#185fa5] dark:text-[#e6f1fb]',
  scan: 'bg-[#e6f1fb] text-[#185fa5] dark:bg-[#185fa5] dark:text-[#e6f1fb]',
};

/** Confidence badge variants */
const CONFIDENCE_VARIANTS: Record<ConfidenceLevel, string> = {
  '': '',
  none: 'bg-[#fcebeb] text-[#a32d2d] dark:bg-[#a32d2d] dark:text-[#fcebeb]',
  low: 'bg-[#faeeda] text-[#854f0b] dark:bg-[#854f0b] dark:text-[#faeeda]',
  moderate: 'bg-[#e1f5ee] text-[#0f6e56] dark:bg-[#0f6e56] dark:text-[#e1f5ee]',
  high: 'bg-[#eaf3de] text-[#3b6d11] dark:bg-[#3b6d11] dark:text-[#eaf3de]',
};

/** Confidence label mapping */
const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  '': '',
  none: 'No confidence',
  low: 'Low confidence',
  moderate: 'Moderate',
  high: 'High confidence',
};

/** Step type labels */
const STEP_TYPE_LABELS: Record<StepType, string> = {
  lock: 'Lock',
  agg: 'Aggregate',
  sort: 'Sort',
  return: 'Return',
  retrieve: 'Retrieve',
  scan: 'Scan',
};

export function StepAnalysisCard({
  step,
  stepIndex,
  rawExplain,
  sql,
  onCompareAll,
}: StepAnalysisCardProps) {
  const Icon = STEP_ICONS[step.type] || Lock;
  const hasMetrics = !!(step.rows || step.bytes || step.time || step.scanType);

  const handleExplainStep = () => {
    const prompt = buildExplainStepPrompt(stepIndex, step, rawExplain);
    executePromptAction(prompt);
  };

  const handleOptimizeStep = () => {
    const prompt = buildOptimizeStepPrompt(step, sql);
    executePromptAction(prompt);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Icon className="h-[18px] w-[18px] text-foreground flex-shrink-0" />
        <h3 className="text-sm font-medium text-foreground">
          Step {stepIndex + 1} — {step.label}
        </h3>
        <span
          className={cn(
            'text-[11px] px-2 py-0.5 rounded-full font-medium',
            STEP_TYPE_VARIANTS[step.type],
          )}
        >
          {STEP_TYPE_LABELS[step.type]}
        </span>
        {step.confidence && (
          <span
            className={cn(
              'text-[11px] px-2 py-0.5 rounded-full font-medium',
              CONFIDENCE_VARIANTS[step.confidence],
            )}
          >
            {CONFIDENCE_LABELS[step.confidence]}
          </span>
        )}
      </div>

      {/* Metrics Grid */}
      {hasMetrics && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {step.rows && (
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="text-[11px] text-muted-foreground mb-0.5">Spool rows</div>
              <div className="text-sm font-medium text-foreground">{step.rows}</div>
            </div>
          )}
          {step.bytes && (
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="text-[11px] text-muted-foreground mb-0.5">Spool size</div>
              <div className="text-sm font-medium text-foreground">{step.bytes} B</div>
            </div>
          )}
          {step.time && (
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="text-[11px] text-muted-foreground mb-0.5">Est. time</div>
              <div className="text-sm font-medium text-foreground">{step.time}</div>
            </div>
          )}
          {step.scanType && (
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="text-[11px] text-muted-foreground mb-0.5">Scan type</div>
              <div className="text-xs font-medium text-foreground">{step.scanType}</div>
            </div>
          )}
        </div>
      )}

      {/* Optimizer Rewrites */}
      {step.rewrites && step.rewrites.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Optimizer rewrites
          </div>
          {step.rewrites.map((rewrite, idx) => (
            <div
              key={idx}
              className="font-mono text-[11px] px-2 py-1 bg-[rgba(238,237,254,0.5)] text-[#534ab7] dark:bg-[rgba(83,74,183,0.2)] dark:text-[#eeedfe] rounded mb-1"
            >
              ℹ️ {rewrite}
            </div>
          ))}
        </div>
      )}

      {/* Observations */}
      {step.obs && step.obs.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Observations
          </div>
          <div className="flex flex-col gap-1">
            {step.obs.map((obs, idx) => {
              // Determine observation severity
              let obsClass = 'border-l-2 border-border bg-muted/50';
              if (step.confidence === 'none' && idx === 1) {
                // Warning for low confidence observations
                obsClass = 'border-l-2 border-[#ba7517] bg-[rgba(250,238,218,0.35)]';
              } else if (step.rewrites && step.rewrites.length && idx === 0) {
                // Info for optimizer rewrites
                obsClass = 'border-l-2 border-[#185fa5] bg-[rgba(230,241,251,0.35)]';
              }

              return (
                <div
                  key={idx}
                  className={cn('text-xs text-foreground px-2 py-1.5 rounded-r', obsClass)}
                >
                  {obs}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap mt-1">
        <button
          onClick={handleExplainStep}
          className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors"
        >
          Explain this step ↗
        </button>
        <button
          onClick={handleOptimizeStep}
          className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors"
        >
          Optimize ↗
        </button>
        {onCompareAll && (
          <button
            onClick={onCompareAll}
            className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors"
          >
            Compare all steps ↗
          </button>
        )}
      </div>
    </div>
  );
}
