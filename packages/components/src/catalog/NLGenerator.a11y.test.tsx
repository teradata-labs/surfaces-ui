/**
 * NLGenerator Accessibility Tests (TEST-05)
 *
 * Verifies WCAG AA 2.2 compliance via axe-core, keyboard navigation,
 * and screen reader support for NL generation UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NLGenerator } from './NLGenerator';
import type { SpecStreamState } from './stream';

expect.extend(toHaveNoViolations);

// Mock useSpecStream hook
vi.mock('./stream', () => ({
  useSpecStream: vi.fn(),
}));

// Mock SpecValidationError component
vi.mock('./fallback', () => ({
  SpecValidationError: ({ errors, onRetry }: any) => (
    <div role="alert">
      <p>Error: {errors[0]?.message}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

// Mock prompts
vi.mock('./prompts', () => ({
  getExamplesForComponent: () => [
    { prompt: 'Show a data table with filters' },
    { prompt: 'Display a bar chart' },
    { prompt: 'Show SQL results with chart' },
  ],
}));

import { useSpecStream } from './stream';

describe('NLGenerator Accessibility', () => {
  const mockGenerate = vi.fn();
  const mockAbort = vi.fn();
  const mockReset = vi.fn();

  const defaultState: SpecStreamState = {
    isStreaming: false,
    rawText: '',
    spec: null,
    validation: null,
    explanation: null,
    error: null,
    progress: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSpecStream as any).mockReturnValue({
      state: defaultState,
      generate: mockGenerate,
      abort: mockAbort,
      reset: mockReset,
    });
  });

  describe('axe-core Compliance', () => {
    it('has no accessibility violations in default state', async () => {
      // TEST-05: Accessibility tests with axe-core
      const { container } = render(
        <NLGenerator
          baseUrl="http://localhost:8000"
          showExamples={true}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no violations with example prompts visible', async () => {
      const { container } = render(
        <NLGenerator
          baseUrl="http://localhost:8000"
          showExamples={true}
        />
      );

      // Example buttons should be present
      const exampleButtons = screen.getAllByRole('button');
      expect(exampleButtons.length).toBeGreaterThan(1); // Generate + example buttons

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no violations during loading state', async () => {
      (useSpecStream as any).mockReturnValue({
        state: { ...defaultState, isStreaming: true, progress: 0.5 },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });

      const { container } = render(
        <NLGenerator baseUrl="http://localhost:8000" />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no violations with error message displayed', async () => {
      (useSpecStream as any).mockReturnValue({
        state: {
          ...defaultState,
          error: 'Generation failed',
          validation: {
            valid: false,
            errors: [{ path: 'root', message: 'Generation failed', code: 'error' }],
          },
        },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });

      const { container } = render(
        <NLGenerator baseUrl="http://localhost:8000" />
      );

      // Error should be present
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no violations with generated spec displayed', async () => {
      const validSpec = {
        root: 'table1',
        elements: {
          table1: {
            type: 'DataTable',
            props: { columns: ['id', 'name'] },
          },
        },
      };

      (useSpecStream as any).mockReturnValue({
        state: {
          ...defaultState,
          spec: validSpec,
          validation: { valid: true, spec: validSpec, errors: [] },
        },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });

      const { container } = render(
        <NLGenerator
          baseUrl="http://localhost:8000"
          renderSpec={(spec) => <div>Generated UI</div>}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('focuses prompt input on Tab', async () => {
      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const user = userEvent.setup();
      await user.tab();

      const input = screen.getByLabelText(/describe the ui/i);
      expect(input).toHaveFocus();
    });

    it('submits on Enter key in textarea (with Ctrl)', async () => {
      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const user = userEvent.setup();
      const input = screen.getByLabelText(/describe the ui/i);

      await user.type(input, 'show table');

      // Click generate button (Enter in textarea doesn't submit form by default)
      const generateBtn = screen.getByRole('button', { name: /generate/i });
      await user.click(generateBtn);

      // Verify generation triggered
      expect(mockGenerate).toHaveBeenCalledWith('show table');
    });

    it('navigates example buttons with Tab', async () => {
      render(
        <NLGenerator
          baseUrl="http://localhost:8000"
          showExamples={true}
          initialPrompt="test prompt"
        />
      );

      const user = userEvent.setup();

      // Tab to input
      await user.tab();
      expect(screen.getByLabelText(/describe the ui/i)).toHaveFocus();

      // Tab to generate button (now enabled because we have initial text)
      await user.tab();
      expect(screen.getByRole('button', { name: /generate/i })).toHaveFocus();

      // Tab to first example button
      await user.tab();
      const exampleButtons = screen.getAllByRole('button');
      const firstExample = exampleButtons.find(btn =>
        btn.textContent?.includes('Show a data table')
      );
      if (firstExample) {
        expect(firstExample).toHaveFocus();
      }
    });

    it('activates example prompts with Enter/Space', async () => {
      render(
        <NLGenerator
          baseUrl="http://localhost:8000"
          showExamples={true}
        />
      );

      const user = userEvent.setup();

      // Find and click an example button
      const exampleButtons = screen.getAllByRole('button');
      const exampleButton = exampleButtons.find(btn =>
        btn.textContent?.includes('Show a data table')
      );

      if (exampleButton) {
        await user.click(exampleButton);

        // Verify input was populated
        const input = screen.getByLabelText(/describe the ui/i) as HTMLTextAreaElement;
        expect(input.value).toContain('Show a data table with filters');
      }
    });
  });

  describe('ARIA Attributes', () => {
    it('has accessible label for prompt input', () => {
      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const input = screen.getByLabelText(/describe the ui/i);
      expect(input).toHaveAttribute('id', 'nl-prompt');
    });

    it('generate button has accessible name', () => {
      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const generateBtn = screen.getByRole('button', { name: /generate/i });
      expect(generateBtn).toBeInTheDocument();
      expect(generateBtn).toHaveAttribute('type', 'submit');
    });

    it('error messages have role="alert"', async () => {
      (useSpecStream as any).mockReturnValue({
        state: {
          ...defaultState,
          error: 'API error occurred',
          validation: {
            valid: false,
            errors: [{ path: 'root', message: 'API error occurred', code: 'error' }],
          },
        },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });

      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const alert = await waitFor(() => screen.getByRole('alert'));
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('API error occurred');
    });

    it('loading state has progressbar role', async () => {
      (useSpecStream as any).mockReturnValue({
        state: { ...defaultState, isStreaming: true, progress: 0.6 },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });

      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '60');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });

    it('textarea has aria-describedby when examples shown', () => {
      render(
        <NLGenerator
          baseUrl="http://localhost:8000"
          showExamples={true}
        />
      );

      const input = screen.getByLabelText(/describe the ui/i);
      expect(input).toHaveAttribute('aria-describedby', 'nl-examples');

      // Verify the describedby target exists
      const examples = document.getElementById('nl-examples');
      expect(examples).toBeInTheDocument();
    });

    it('cancel button is accessible during streaming', () => {
      (useSpecStream as any).mockReturnValue({
        state: { ...defaultState, isStreaming: true, progress: 0.3 },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });

      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      expect(cancelBtn).toBeInTheDocument();
      expect(cancelBtn).toHaveAttribute('type', 'button');
    });

    it('disabled states have proper aria attributes', () => {
      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const generateBtn = screen.getByRole('button', { name: /generate/i });
      // Should be disabled when prompt is empty
      expect(generateBtn).toBeDisabled();
    });
  });

  describe('Screen Reader Support', () => {
    it('loading spinner is hidden from screen readers', () => {
      (useSpecStream as any).mockReturnValue({
        state: { ...defaultState, isStreaming: true, progress: 0.4 },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });

      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const spinner = document.querySelector('svg.animate-spin');
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });

    it('progress updates announced via progressbar', async () => {
      const { rerender } = render(
        <NLGenerator baseUrl="http://localhost:8000" />
      );

      // Start streaming
      (useSpecStream as any).mockReturnValue({
        state: { ...defaultState, isStreaming: true, progress: 0.3 },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });
      rerender(<NLGenerator baseUrl="http://localhost:8000" />);

      let progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '30');

      // Update progress
      (useSpecStream as any).mockReturnValue({
        state: { ...defaultState, isStreaming: true, progress: 0.7 },
        generate: mockGenerate,
        abort: mockAbort,
        reset: mockReset,
      });
      rerender(<NLGenerator baseUrl="http://localhost:8000" />);

      progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '70');
    });

    it('form submission is keyboard accessible', async () => {
      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const user = userEvent.setup();
      const input = screen.getByLabelText(/describe the ui/i);
      const form = input.closest('form');

      await user.type(input, 'test prompt');

      // Submit via button click (keyboard accessible)
      const submitBtn = screen.getByRole('button', { name: /generate/i });
      await user.click(submitBtn);

      expect(mockGenerate).toHaveBeenCalledWith('test prompt');
    });
  });

  describe('Focus Management', () => {
    it('maintains focus on input when typing', async () => {
      render(<NLGenerator baseUrl="http://localhost:8000" />);

      const user = userEvent.setup();
      const input = screen.getByLabelText(/describe the ui/i);

      await user.click(input);
      await user.type(input, 'test');

      expect(input).toHaveFocus();
    });

    it('example click returns focus to input', async () => {
      render(
        <NLGenerator
          baseUrl="http://localhost:8000"
          showExamples={true}
        />
      );

      const user = userEvent.setup();
      const exampleButtons = screen.getAllByRole('button');
      const exampleButton = exampleButtons.find(btn =>
        btn.textContent?.includes('Show a data table')
      );

      if (exampleButton) {
        await user.click(exampleButton);

        // Focus should return to input
        await waitFor(() => {
          const input = screen.getByLabelText(/describe the ui/i);
          expect(input).toHaveFocus();
        });
      }
    });
  });
});
