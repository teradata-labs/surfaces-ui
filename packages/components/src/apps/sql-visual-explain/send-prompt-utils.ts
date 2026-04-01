/**
 * sendPrompt Utilities with Graceful Degradation
 *
 * Handles AI prompt actions in Claude Desktop (sendPrompt) with
 * fallback to clipboard copy for other MCP clients.
 */

import type { TeradataStep, TeradataQuery } from './teradata-types';

interface WindowWithSendPrompt extends Window {
  sendPrompt?: (prompt: string) => void;
}

/**
 * Check if sendPrompt is available (Claude Desktop artifact feature)
 */
export function isSendPromptAvailable(): boolean {
  return typeof (window as WindowWithSendPrompt).sendPrompt === 'function';
}

/**
 * Execute an AI prompt action with graceful degradation
 */
export async function executePromptAction(prompt: string): Promise<void> {
  if (isSendPromptAvailable()) {
    // Claude Desktop: Native integration
    (window as WindowWithSendPrompt).sendPrompt?.(prompt);
  } else {
    // Other clients: Copy to clipboard
    try {
      await navigator.clipboard.writeText(prompt);
      showNotification('Prompt copied to clipboard', 'Paste in your AI assistant to analyze');
    } catch (err) {
      // Clipboard API failed (no HTTPS, permissions, etc.)
      console.error('Clipboard write failed:', err);
      showPromptModal(prompt);
    }
  }
}

/**
 * Show toast notification
 */
function showNotification(title: string, message: string): void {
  // Simple toast implementation - could be replaced with UI library toast
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-card border border-border rounded-lg p-4 shadow-lg z-50 max-w-sm';
  toast.innerHTML = `
    <div class="font-semibold text-sm text-foreground mb-1">${escapeHtml(title)}</div>
    <div class="text-xs text-muted-foreground">${escapeHtml(message)}</div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Show modal with prompt text (fallback for clipboard failure)
 */
function showPromptModal(prompt: string): void {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-foreground">AI Prompt</h3>
        <button class="text-muted-foreground hover:text-foreground" onclick="this.closest('.fixed').remove()">✕</button>
      </div>
      <p class="text-sm text-muted-foreground mb-3">
        Copy this prompt and paste it into your AI assistant:
      </p>
      <textarea
        readonly
        class="w-full h-64 p-3 bg-muted border border-border rounded text-xs font-mono resize-none"
        onclick="this.select()"
      >${escapeHtml(prompt)}</textarea>
      <div class="mt-4 flex justify-end gap-2">
        <button
          class="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
          onclick="navigator.clipboard.writeText(this.parentElement.previousElementSibling.value).then(() => { this.textContent = 'Copied!'; setTimeout(() => this.closest('.fixed').remove(), 1000); })"
        >
          Copy to Clipboard
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

/**
 * Escape HTML for safe injection
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Prompt Builders ────────────────────────────────────────────────────────

/**
 * Build prompt for running EXPLAIN via MCP
 */
export function buildRunExplainPrompt(sql: string): string {
  return `Run EXPLAIN on this SQL using the Teradata MCP server (teradata-community:base_readQuery) and break down each step:

${sql}`;
}

/**
 * Build prompt for explaining a specific step
 */
export function buildExplainStepPrompt(
  stepIndex: number,
  step: TeradataStep,
  rawExplain: string,
): string {
  return `Explain step ${stepIndex + 1} of this Teradata EXPLAIN plan in detail and what it means for performance:

Step type: ${step.label}
Confidence: ${step.confidence || 'N/A'}
Observations: ${step.obs.join('; ')}

Full EXPLAIN:
${rawExplain}`;
}

/**
 * Build prompt for optimizing a query
 */
export function buildOptimizeQueryPrompt(sql: string): string {
  return `Optimize this Teradata SQL. Identify anti-patterns, missing statistics, and rewrite recommendations:

${sql}`;
}

/**
 * Build prompt for optimizing a specific step
 */
export function buildOptimizeStepPrompt(step: TeradataStep, sql: string): string {
  return `How can I optimize the "${step.label}" step in this Teradata query?
Focus on: ${step.obs.join(', ')}

SQL:
${sql}`;
}

/**
 * Build prompt for CTE rewrite
 */
export function buildCTERewritePrompt(sql: string): string {
  return `Rewrite this Teradata SQL using a CTE to eliminate GROUP BY ordinal references and reduce repeated expression evaluation:

${sql}`;
}

/**
 * Build prompt for COLLECT STATISTICS suggestions
 */
export function buildCollectStatsPrompt(sql: string): string {
  return `What COLLECT STATISTICS statements should I run before executing this query on Teradata? Base your answer on the columns used in GROUP BY, ORDER BY, WHERE, and JOIN:

${sql}`;
}

/**
 * Build prompt for comparing all steps
 */
export function buildCompareStepsPrompt(query: TeradataQuery): string {
  return `Analyze the full execution plan for this Teradata query. Compare all ${query.steps.length} steps, identify the most expensive step, and give me 3 concrete optimization recommendations:

SQL:
${query.sql}

Full EXPLAIN:
${query.raw}`;
}
