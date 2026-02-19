/**
 * SQLEditor MCP Integration Tests
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

describe('SQLEditor MCP Integration', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MCP Hook Configuration', () => {
    it('calls useMcpTool with correct tool name', () => {
      render(<SQLEditor />);

      expect(useMcpTool).toHaveBeenCalledWith(
        'execute_sql',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('passes query parameter to MCP hook', () => {
      render(<SQLEditor initialCode="SELECT * FROM users" />);

      expect(useMcpTool).toHaveBeenCalledWith(
        'execute_sql',
        expect.objectContaining({ query: 'SELECT * FROM users' }),
        expect.any(Object)
      );
    });

    it('passes connection_id to MCP hook', () => {
      render(<SQLEditor connectionId="conn-123" />);

      expect(useMcpTool).toHaveBeenCalledWith(
        'execute_sql',
        expect.objectContaining({ connection_id: 'conn-123' }),
        expect.any(Object)
      );
    });

    it('initializes with enabled: false (manual trigger)', () => {
      render(<SQLEditor />);

      expect(useMcpTool).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when MCP call is pending', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);
      expect(screen.getByText('Executing...')).toBeInTheDocument();
    });

    it('disables textarea during loading', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);
      // Textarea should be disabled via the disabled prop on SQLInput
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('shows spinner icon during loading', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);
      // Check for animated spinner (Loader2 with animate-spin class)
      const executeBtn = screen.getByRole('button', { name: /execute sql/i });
      expect(executeBtn.querySelector('svg')).toHaveClass('animate-spin');
    });
  });

  describe('Success State', () => {
    it('renders data from successful MCP response', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id', 'name', 'email'],
          data: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' },
          ],
          row_count: 2,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM users" />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    it('displays column headers from MCP response', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['product_id', 'product_name', 'price'],
          data: [{ product_id: 1, product_name: 'Widget', price: 9.99 }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM products" />);

      // Columns are shown in table header cells
      expect(screen.getByText('product_id')).toBeInTheDocument();
      expect(screen.getByText('product_name')).toBeInTheDocument();
      expect(screen.getByText('price')).toBeInTheDocument();
    });

    it('shows row count from MCP response', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id'],
          data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
          row_count: 5,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT id FROM data" />);
      // Row count appears in both the CollapsibleTrigger and SQLResultsDisplay Badge
      const matches = screen.getAllByText(/5 rows/);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('handles null values in response data', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id', 'optional_field'],
          data: [
            { id: 1, optional_field: null },
            { id: 2, optional_field: 'has value' },
          ],
          row_count: 2,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM test" />);

      // Null values should be displayed (with italic styling)
      expect(screen.getByText('null')).toBeInTheDocument();
      expect(screen.getByText('has value')).toBeInTheDocument();
    });

    it('calls onExecutionComplete callback with result', async () => {
      const handleComplete = vi.fn();
      const mockResult = {
        success: true,
        columns: ['count'],
        data: [{ count: 42 }],
        row_count: 1,
      };

      vi.mocked(useMcpTool).mockReturnValue({
        data: mockResult,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor onExecutionComplete={handleComplete} />);

      await waitFor(() => {
        expect(handleComplete).toHaveBeenCalledWith(mockResult);
      });
    });
  });

  describe('Error State', () => {
    it('displays error from response data', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: false,
          error: 'Teradata Error 3706: Syntax error: expected something',
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELEC 1" />);
      expect(screen.getByText(/Teradata Error 3706/)).toBeInTheDocument();
    });

    it('shows Error badge on failure', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: false,
          error: 'Query timeout',
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM huge_table" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('does not show results table on error', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: false,
          error: 'Permission denied',
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM restricted" />);
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  describe('Refetch Behavior', () => {
    it('calls refetch when execute button is clicked', async () => {
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

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('does not refetch if query is empty', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<SQLEditor initialCode="" />);

      const executeBtn = screen.getByRole('button', { name: /execute sql/i });
      await user.click(executeBtn);

      expect(mockRefetch).not.toHaveBeenCalled();
    });

    it('does not refetch while already loading', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: mockRefetch,
      });

      render(<SQLEditor initialCode="SELECT 1" />);

      const executeBtn = screen.getByRole('button', { name: /execute sql/i });
      await user.click(executeBtn);

      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe('Auto Execute', () => {
    it('automatically executes when autoExecute is true', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<SQLEditor initialCode="SELECT 1" autoExecute />);

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('does not auto-execute if code is empty', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<SQLEditor initialCode="" autoExecute />);

      // Wait a bit and verify refetch was not called
      await new Promise((r) => setTimeout(r, 200));
      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  describe('Query Updates', () => {
    it('updates query parameter when code changes', async () => {
      const { rerender } = render(<SQLEditor initialCode="SELECT 1" />);

      rerender(<SQLEditor initialCode="SELECT 2" />);

      // useMcpTool is called for both execute_sql and get_last_result,
      // so check that execute_sql was called with the updated query
      expect(useMcpTool).toHaveBeenCalledWith(
        'execute_sql',
        expect.objectContaining({ query: 'SELECT 2' }),
        expect.any(Object)
      );
    });
  });

  describe('Chart View', () => {
    it('shows chart view when Chart toggle is clicked', async () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['category', 'sales'],
          data: [
            { category: 'Electronics', sales: 1500 },
            { category: 'Clothing', sales: 800 },
          ],
          row_count: 2,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM sales" />);

      // Switch to chart view
      const chartTab = screen.getByRole('tab', { name: /chart/i });
      await user.click(chartTab);

      // Chart toggle should now be selected
      expect(chartTab).toHaveAttribute('aria-selected', 'true');
    });
  });
});
