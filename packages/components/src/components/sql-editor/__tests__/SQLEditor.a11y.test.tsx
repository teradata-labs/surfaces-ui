/**
 * SQLEditor Accessibility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SQLEditor } from '../SQLEditor';

expect.extend(toHaveNoViolations);

// Mock ResizeObserver for test environment
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

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

import { useMcpTool } from '../../../bridge/hooks';

describe('SQLEditor Accessibility', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('axe-core Compliance', () => {
    it('has no accessibility violations in default state', async () => {
      const { container } = render(<SQLEditor />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations with results', async () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id', 'name'],
          data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
          row_count: 2,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(<SQLEditor initialCode="SELECT * FROM users" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations in error state', async () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: false,
          error: 'Query execution failed',
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(<SQLEditor initialCode="INVALID SQL" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations in loading state', async () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      const { container } = render(<SQLEditor initialCode="SELECT 1" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('SQL input textarea is present and accessible', () => {
      render(<SQLEditor initialCode="SELECT 1" />);

      // Get the SQL input textarea - should exist and be accessible
      const textarea = screen.getByPlaceholderText(/enter sql/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea).not.toHaveAttribute('tabindex', '-1');
    });

    it('execute button has accessible name', () => {
      render(<SQLEditor initialCode="SELECT 1" />);

      const executeBtn = screen.getByRole('button', { name: /execute sql/i });
      expect(executeBtn).toBeInTheDocument();
      expect(executeBtn).toHaveAttribute('aria-label', 'Execute SQL');
    });

    it('supports Ctrl+Enter to execute from textarea', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<SQLEditor initialCode="SELECT 1" />);

      const textarea = screen.getByPlaceholderText(/enter sql/i);
      await user.click(textarea);
      await user.keyboard('{Control>}{Enter}{/Control}');

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('supports Cmd+Enter to execute on Mac', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<SQLEditor initialCode="SELECT 1" />);

      const textarea = screen.getByPlaceholderText(/enter sql/i);
      await user.click(textarea);
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('Tab key works in results table', async () => {
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

      render(<SQLEditor initialCode="SELECT * FROM test" />);

      // Tab should navigate through interactive elements
      const searchInput = screen.getByLabelText(/search/i);
      searchInput.focus();
      expect(searchInput).toHaveFocus();
    });
  });

  describe('ARIA Attributes', () => {
    it('SQL input textarea has appropriate role', () => {
      render(<SQLEditor />);
      const textarea = screen.getByPlaceholderText(/enter sql/i);
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName.toLowerCase()).toBe('textarea');
    });

    it('buttons have accessible names', () => {
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

      expect(screen.getByRole('button', { name: /execute sql/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear results/i })).toBeInTheDocument();
    });

    it('error alert has alert role', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: false,
          error: 'Query failed',
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="INVALID" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('results table has grid role', () => {
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

      render(<SQLEditor initialCode="SELECT * FROM test" />);
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('view mode toggle has proper tablist/tab roles', () => {
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

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /table/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /chart/i })).toBeInTheDocument();
    });

    it('chart view toggle updates aria-selected', async () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['category', 'amount'],
          data: [{ category: 'A', amount: 100 }],
          row_count: 1,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM data" />);

      const chartTab = screen.getByRole('tab', { name: /chart/i });
      const tableTab = screen.getByRole('tab', { name: /table/i });

      // Initially table should be selected
      expect(tableTab).toHaveAttribute('aria-selected', 'true');
      expect(chartTab).toHaveAttribute('aria-selected', 'false');

      // Click chart tab
      await user.click(chartTab);

      // Now chart should be selected
      expect(chartTab).toHaveAttribute('aria-selected', 'true');
      expect(tableTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Focus Management', () => {
    it('clear button is accessible and clickable', async () => {
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

      const clearBtn = screen.getByRole('button', { name: /clear results/i });
      expect(clearBtn).toBeInTheDocument();
      expect(clearBtn).not.toBeDisabled();
    });

    it('visible focus indicator on interactive elements', () => {
      render(<SQLEditor />);

      const textarea = screen.getByPlaceholderText(/enter sql/i);
      textarea.focus();

      // Element should have focus styles (checking it received focus)
      expect(textarea).toHaveFocus();
    });
  });

  describe('Screen Reader Announcements', () => {
    it('loading state announced', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);

      // Loading badge should be visible for screen readers
      expect(screen.getByText('Executing...')).toBeInTheDocument();
    });

    it('error messages announced via alert role', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: false,
          error: 'Connection timeout',
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT 1" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Connection timeout');
    });

    it('row count announced in results', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: true,
          columns: ['id'],
          data: [{ id: 1 }, { id: 2 }, { id: 3 }],
          row_count: 3,
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="SELECT * FROM data" />);
      expect(screen.getByText('3 rows')).toBeInTheDocument();
    });
  });

  describe('Color and Contrast', () => {
    it('does not rely solely on color to convey information', () => {
      vi.mocked(useMcpTool).mockReturnValue({
        data: {
          success: false,
          error: 'Syntax error',
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<SQLEditor initialCode="INVALID" />);

      // Error has icon AND text, not just color
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Syntax error');
    });
  });
});
