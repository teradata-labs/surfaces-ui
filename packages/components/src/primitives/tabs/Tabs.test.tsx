import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';

describe('Tabs', () => {
  const renderTabs = (defaultValue = 'tab1') => {
    return render(
      <Tabs defaultValue={defaultValue}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          <TabsTrigger value="tab3" disabled>Tab 3</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
        <TabsContent value="tab3">Content 3</TabsContent>
      </Tabs>,
    );
  };

  it('renders all tab triggers', () => {
    renderTabs();
    expect(screen.getByText('Tab 1')).toBeDefined();
    expect(screen.getByText('Tab 2')).toBeDefined();
    expect(screen.getByText('Tab 3')).toBeDefined();
  });

  it('renders the correct default content', () => {
    renderTabs();
    expect(screen.getByText('Content 1')).toBeDefined();
    expect(screen.queryByText('Content 2')).toBeNull();
  });

  it('switches tab content on click', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByText('Tab 2'));
    expect(screen.getByText('Content 2')).toBeDefined();
    expect(screen.queryByText('Content 1')).toBeNull();
  });

  it('renders tablist role', () => {
    renderTabs();
    expect(screen.getByRole('tablist')).toBeDefined();
  });

  it('renders tab role for triggers', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
  });

  it('marks active tab with aria-selected', () => {
    renderTabs();
    const tab1 = screen.getByText('Tab 1');
    expect(tab1.getAttribute('aria-selected')).toBe('true');
    const tab2 = screen.getByText('Tab 2');
    expect(tab2.getAttribute('aria-selected')).toBe('false');
  });

  it('applies active underline styling via data-state', () => {
    renderTabs();
    const tab1 = screen.getByText('Tab 1');
    expect(tab1.getAttribute('data-state')).toBe('active');
    const tab2 = screen.getByText('Tab 2');
    expect(tab2.getAttribute('data-state')).toBe('inactive');
  });

  it('disabled tab cannot be clicked', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByText('Tab 3'));
    // Content 1 should still be visible (no switch)
    expect(screen.getByText('Content 1')).toBeDefined();
  });

  it('navigates with keyboard arrows', async () => {
    const user = userEvent.setup();
    renderTabs();

    const tab1 = screen.getByText('Tab 1');
    tab1.focus();
    await user.keyboard('{ArrowRight}');

    // Tab 2 should be focused
    expect(screen.getByText('Tab 2')).toEqual(document.activeElement);
  });

  it('accepts custom className on TabsList', () => {
    render(
      <Tabs defaultValue="t1">
        <TabsList className="my-tabs-list">
          <TabsTrigger value="t1">T1</TabsTrigger>
        </TabsList>
        <TabsContent value="t1">C1</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tablist').className).toContain('my-tabs-list');
  });

  it('accepts custom className on TabsTrigger', () => {
    render(
      <Tabs defaultValue="t1">
        <TabsList>
          <TabsTrigger value="t1" className="my-trigger">T1</TabsTrigger>
        </TabsList>
        <TabsContent value="t1">C1</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tab').className).toContain('my-trigger');
  });
});
