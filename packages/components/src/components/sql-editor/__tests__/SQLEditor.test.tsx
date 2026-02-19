/**
 * SQLEditor Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SQLEditor } from '../SQLEditor';

// Mock the MCP Bridge hook
vi.mock('../../../bridge/hooks', () => ({
  useMcpTool: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Mock ECharts to avoid canvas issues in tests
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  })),
  registerTheme: vi.fn(),
}));

// Mock CodeMirror to avoid jsdom incompatibilities (getClientRects, canvas)
vi.mock('../CodeMirrorSQLInput', () => ({
  CodeMirrorSQLInput: ({ value, onChange, onExecute, disabled, readOnly, placeholder }: any) => (
    <textarea
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
      onKeyDown={(e: any) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          onExecute();
        }
      }}
      disabled={disabled}
      readOnly={readOnly}
      placeholder={placeholder || 'Enter SQL query...'}
      aria-label="SQL input"
    />
  ),
}));

import { useMcpTool } from '../../../bridge/hooks';

describe('SQLEditor', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<SQLEditor />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with custom title', () => {
      render(<SQLEditor title="My SQL Query" />);
      expect(screen.getByText('My SQL Query')).toBeInTheDocument();
    });

    it('renders with initial code', () => {
      render(<SQLEditor initialCode="SELECT * FROM users" />);
      expect(screen.getByRole('textbox')).toHaveValue('SELECT * FROM users');
    });

    it('shows Ready badge by default', () => {
      render(<SQLEditor />);
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  describe('Code Input', () => {
    it('updates code on user input', async () => {
      render(<SQLEditor />);
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, 'SELECT 1');
      expect(textarea).toHaveValue('SELECT 1');
    });

    it('calls onCodeChange when code changes', async () => {
      const handleCodeChange = vi.fn();
      render(<SQLEditor onCodeChange={handleCodeChange} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'SELECT');

      expect(handleCodeChange).toHaveBeenCalled();
    });

    it('is read-only when readOnly prop is true', () => {
      render(<SQLEditor readOnly />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('readonly');
    });
  });

  describe('Execution', () => {
    it('executes SQL on button click', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<SQLEditor initialCode="SELECT 1" />);

      const executeBtn = screen.getByRole('button', { name: /execute sql/i });
      await user.click(executeBtn);

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('executes SQL on Ctrl+Enter', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<SQLEditor initialCode="SELECT 1" />);

      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('shows loading state during execution', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);
      expect(screen.getByText('Executing...')).toBeInTheDocument();
    });

    it('disables execute button during execution', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);
      const executeBtn = screen.getByRole('button', { name: /execute sql/i });
      expect(executeBtn).toBeDisabled();
    });
  });

  describe('Results Display', () => {
    it('shows results table on successful query', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id', 'name'],
          data: [{ id: 1, name: 'Test' }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM users" />);
      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('shows Table and Chart toggle buttons when results exist', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id', 'value'],
          data: [{ id: 1, value: 100 }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM data" />);
      // ViewModeToggle uses buttons with role="tab"
      expect(screen.getByRole('tab', { name: /table/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /chart/i })).toBeInTheDocument();
    });

    it('switches between Table and Chart views', async () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['category', 'amount'],
          data: [{ category: 'A', amount: 50 }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM sales" />);

      // Click the Chart toggle button
      const chartTab = screen.getByRole('tab', { name: /chart/i });
      await user.click(chartTab);

      // Chart view should now be visible (ECharts container)
      expect(chartTab).toHaveAttribute('aria-selected', 'true');
    });

    it('shows empty state message for queries with no results', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: [],
          data: [],
          row_count: 0,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM empty_table" />);
      expect(screen.getByText(/returned no results/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message on query failure', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: false,
          error: 'Syntax error at position 10',
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELEC 1" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Syntax error/)).toBeInTheDocument();
    });

    it('shows Error badge on failure', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: { success: false, error: 'Query failed' },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM nonexistent" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('shows Complete badge on success', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['x'],
          data: [{ x: 1 }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });
  });

  describe('Clear Action', () => {
    it('shows clear button when results exist', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id'],
          data: [{ id: 1 }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);
      expect(screen.getByRole('button', { name: /clear results/i })).toBeInTheDocument();
    });

    it('clears results when clear button is clicked', async () => {
      const { rerender } = render(<SQLEditor initialCode="SELECT 1" />);

      // First show results
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id'],
          data: [{ id: 1 }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });
      rerender(<SQLEditor initialCode="SELECT 1" />);

      const clearBtn = screen.getByRole('button', { name: /clear results/i });
      await user.click(clearBtn);

      // After clear, table should not be visible
      await waitFor(() => {
        expect(screen.queryByRole('grid')).not.toBeInTheDocument();
      });
    });
  });

  describe('Callbacks', () => {
    it('calls onExecutionComplete with result', async () => {
      const handleComplete = vi.fn();
      const mockResult = {
        success: true,
        columns: ['id'],
        data: [{ id: 1 }],
        row_count: 1,
      };

      vi.mocked(useMcpTool).mockReturnValue({
        data: mockResult,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" onExecutionComplete={handleComplete} />);

      await waitFor(() => {
        expect(handleComplete).toHaveBeenCalledWith(mockResult);
      });
    });
  });

  describe('Connection ID', () => {
    it('passes connectionId to MCP hook', () => {
      render(<SQLEditor connectionId="test-connection" />);

      expect(useMcpTool).toHaveBeenCalledWith(
        'execute_sql',
        expect.objectContaining({ connection_id: 'test-connection' }),
        expect.any(Object)
      );
    });
  });

  describe('Extended Props', () => {
    it('passes projectId and context to SQLResultsDisplay', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id'],
          data: [{ id: 1 }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <SQLEditor
          initialCode="SELECT 1"
          projectId="test-project"
          context="mcp-apps"
          teradataBaseUrl="http://localhost:3000"
        />
      );

      // When projectId is provided, "Open in Teradata" button should appear
      expect(screen.getByText('Open in Teradata')).toBeInTheDocument();
    });
  });
});
