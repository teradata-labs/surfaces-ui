/**
 * NLGenerator Integration Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NLGenerator } from './NLGenerator';

// Mock fetch for streaming responses
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a mock streaming response
function createMockStreamResponse(chunks: string[]) {
  let index = 0;
  const encoder = new TextEncoder();

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader: () => ({
        read: async () => {
          if (index < chunks.length) {
            const chunk = chunks[index++];
            return { done: false, value: encoder.encode(chunk) };
          }
          return { done: true, value: undefined };
        },
      }),
    },
  };
}

describe('NLGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('renders prompt input and generate button', () => {
      render(<NLGenerator />);

      expect(screen.getByLabelText(/describe the ui/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
    });

    it('shows example prompts when enabled', () => {
      render(<NLGenerator showExamples={true} />);

      expect(screen.getByText(/try:/i)).toBeInTheDocument();
    });

    it('hides example prompts when disabled', () => {
      render(<NLGenerator showExamples={false} />);

      expect(screen.queryByText(/try:/i)).not.toBeInTheDocument();
    });

    it('uses initial prompt value', () => {
      render(<NLGenerator initialPrompt="Show sales data" />);

      expect(screen.getByRole('textbox')).toHaveValue('Show sales data');
    });

    it('uses custom placeholder', () => {
      render(<NLGenerator placeholder="Custom placeholder" />);

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });
  });

  describe('Generation Flow', () => {
    it('disables generate button when prompt is empty', () => {
      render(<NLGenerator />);

      const button = screen.getByRole('button', { name: /generate/i });
      expect(button).toBeDisabled();
    });

    it('enables generate button when prompt has text', async () => {
      const user = userEvent.setup();
      render(<NLGenerator />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Show a table');

      const button = screen.getByRole('button', { name: /generate/i });
      expect(button).not.toBeDisabled();
    });

    it('shows progress during generation', async () => {
      const user = userEvent.setup();

      // Mock a slow streaming response
      mockFetch.mockResolvedValueOnce(
        createMockStreamResponse([
          '{"chunk": "generating"}',
        ])
      );

      render(<NLGenerator />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Show a table');

      const button = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/generating ui specification/i)).toBeInTheDocument();
      });
    });

    it('calls onSpecGenerated when generation completes', async () => {
      const user = userEvent.setup();
      const onSpecGenerated = vi.fn();

      const validSpec = {
        root: 'table',
        elements: {
          table: {
            type: 'DataTable',
            props: { columns: ['id', 'name'] },
          },
        },
      };

      mockFetch.mockResolvedValueOnce(
        createMockStreamResponse([
          `{"spec": ${JSON.stringify(validSpec)}}\n`,
        ])
      );

      render(<NLGenerator onSpecGenerated={onSpecGenerated} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Show a table');

      const button = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(onSpecGenerated).toHaveBeenCalledWith(
          expect.objectContaining({ root: 'table' }),
          null
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('displays validation errors for invalid specs', async () => {
      const user = userEvent.setup();

      const invalidSpec = {
        root: 'table',
        elements: {
          table: {
            type: 'UnknownComponent',
            props: {},
          },
        },
      };

      mockFetch.mockResolvedValueOnce(
        createMockStreamResponse([
          `{"spec": ${JSON.stringify(invalidSpec)}}\n`,
        ])
      );

      render(<NLGenerator />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Show a table');

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      await waitFor(() => {
        expect(screen.getByText(/unable to render/i)).toBeInTheDocument();
      });
    });

    it('shows retry button on error', async () => {
      const user = userEvent.setup();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<NLGenerator />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Show a table');

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });
  });

  describe('Explanation', () => {
    it('displays explanation when provided', async () => {
      const user = userEvent.setup();

      const validSpec = {
        root: 'table',
        elements: {
          table: {
            type: 'DataTable',
            props: { columns: ['id'] },
          },
        },
      };

      mockFetch.mockResolvedValueOnce(
        createMockStreamResponse([
          `{"explanation": "I chose DataTable for detailed inspection"}\n`,
          `{"spec": ${JSON.stringify(validSpec)}}\n`,
        ])
      );

      render(<NLGenerator includeExplanation={true} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'Show a table');

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      await waitFor(() => {
        expect(screen.getByText(/why these components/i)).toBeInTheDocument();
        expect(screen.getByText(/DataTable for detailed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Custom Rendering', () => {
    it('uses renderSpec function when provided', async () => {
      const user = userEvent.setup();

      const validSpec = {
        root: 'table',
        elements: {
          table: {
            type: 'DataTable',
            props: { columns: ['id'] },
          },
        },
      };

      mockFetch.mockResolvedValueOnce(
        createMockStreamResponse([
          `{"spec": ${JSON.stringify(validSpec)}}\n`,
        ])
      );

      render(
        <NLGenerator
          renderSpec={(spec) => <div data-testid="custom-render">{spec.root}</div>}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'Show a table');

      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      await waitFor(() => {
        expect(screen.getByTestId('custom-render')).toHaveTextContent('table');
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible form labels', () => {
      render(<NLGenerator />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAccessibleName(/describe the ui/i);
    });

    it('progress bar has aria attributes', async () => {
      const user = userEvent.setup();

      mockFetch.mockResolvedValueOnce(
        createMockStreamResponse([
          '{"chunk": "generating"}\n',
        ])
      );

      render(<NLGenerator />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      await waitFor(() => {
        const progressbar = screen.getByRole('progressbar');
        expect(progressbar).toHaveAttribute('aria-valuenow');
        expect(progressbar).toHaveAttribute('aria-valuemin', '0');
        expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      });
    });
  });
});
