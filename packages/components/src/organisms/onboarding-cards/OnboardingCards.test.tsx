import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingCards } from './OnboardingCards';
import type { OnboardingCard } from './OnboardingCards';

const cards: OnboardingCard[] = [
  { id: 'setup', title: 'Setup Account', description: 'Configure your profile and preferences.', ctaLabel: 'Start' },
  { id: 'connect', title: 'Connect Data', description: 'Link your data sources.', ctaLabel: 'Connect' },
  { id: 'explore', title: 'Explore Dashboard', description: 'Tour the key features.', ctaLabel: 'Tour' },
  { id: 'invite', title: 'Invite Team', description: 'Add collaborators to your workspace.', ctaLabel: 'Invite' },
];

const completedCards: OnboardingCard[] = cards.map((c) => ({ ...c, state: 'complete' as const }));

describe('OnboardingCards', () => {
  it('renders heading', () => {
    render(<OnboardingCards cards={cards} heading="Getting started" />);
    expect(screen.getByText('Getting started')).toBeDefined();
  });

  it('renders all card titles', () => {
    render(<OnboardingCards cards={cards} />);
    expect(screen.getByText('Setup Account')).toBeDefined();
    expect(screen.getByText('Connect Data')).toBeDefined();
    expect(screen.getByText('Explore Dashboard')).toBeDefined();
    expect(screen.getByText('Invite Team')).toBeDefined();
  });

  it('renders card descriptions', () => {
    render(<OnboardingCards cards={cards} />);
    expect(screen.getByText('Configure your profile and preferences.')).toBeDefined();
  });

  it('shows completion count', () => {
    const mixed: OnboardingCard[] = [
      { ...cards[0]!, state: 'complete' },
      cards[1]!,
      cards[2]!,
      cards[3]!,
    ];
    render(<OnboardingCards cards={mixed} />);
    expect(screen.getByText('1/4 complete')).toBeDefined();
  });

  it('renders CTA button for incomplete cards', () => {
    render(<OnboardingCards cards={cards} />);
    expect(screen.getByText('Start')).toBeDefined();
    expect(screen.getByText('Connect')).toBeDefined();
  });

  it('fires CTA callback when clicked', () => {
    const onCtaClick = vi.fn();
    const cardsWithCb: OnboardingCard[] = [
      { ...cards[0]!, onCtaClick },
    ];
    render(<OnboardingCards cards={cardsWithCb} />);
    fireEvent.click(screen.getByText('Start'));
    expect(onCtaClick).toHaveBeenCalledTimes(1);
  });

  it('shows "Complete" text for complete cards', () => {
    render(<OnboardingCards cards={completedCards} completed />);
    const completeTexts = screen.getAllByText('Complete');
    expect(completeTexts.length).toBe(completedCards.length);
  });

  it('shows completion banner when completed', () => {
    render(<OnboardingCards cards={completedCards} completed />);
    expect(screen.getByText('You completed all onboarding setup')).toBeDefined();
  });

  it('shows custom completion message', () => {
    render(
      <OnboardingCards
        cards={completedCards}
        completed
        completionMessage="All done!"
      />,
    );
    expect(screen.getByText('All done!')).toBeDefined();
  });

  it('shows Skip all button and fires callback', () => {
    const onSkipAll = vi.fn();
    render(<OnboardingCards cards={cards} onSkipAll={onSkipAll} />);
    fireEvent.click(screen.getByText('Skip all'));
    expect(onSkipAll).toHaveBeenCalledTimes(1);
  });

  it('hides Skip all when not provided', () => {
    render(<OnboardingCards cards={cards} />);
    expect(screen.queryByText('Skip all')).toBeNull();
  });

  it('shows Dismiss button when completed with callback', () => {
    const onDismiss = vi.fn();
    render(<OnboardingCards cards={completedCards} completed onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('hides cards when collapsed', () => {
    render(<OnboardingCards cards={cards} collapsed />);
    // Card titles should not be visible
    expect(screen.queryByText('Setup Account')).toBeNull();
    // Heading should still be visible
    expect(screen.getByText('Get started')).toBeDefined();
  });

  it('fires onToggleCollapse callback', () => {
    const onToggle = vi.fn();
    render(<OnboardingCards cards={cards} onToggleCollapse={onToggle} />);
    fireEvent.click(screen.getByLabelText('Collapse'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows expand button when collapsed', () => {
    const onToggle = vi.fn();
    render(<OnboardingCards cards={cards} collapsed onToggleCollapse={onToggle} />);
    expect(screen.getByLabelText('Expand')).toBeDefined();
  });

  it('has scroll buttons', () => {
    render(<OnboardingCards cards={cards} />);
    expect(screen.getByLabelText('Scroll left')).toBeDefined();
    expect(screen.getByLabelText('Scroll right')).toBeDefined();
  });

  it('has region role with label', () => {
    render(<OnboardingCards cards={cards} heading="My onboarding" />);
    expect(screen.getByRole('region', { name: 'My onboarding' })).toBeDefined();
  });

  it('renders cards as list items', () => {
    render(<OnboardingCards cards={cards} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
  });

  it('renders card icons when provided', () => {
    const cardsWithIcons: OnboardingCard[] = [
      { ...cards[0]!, icon: <span data-testid="card-icon">🔧</span> },
    ];
    render(<OnboardingCards cards={cardsWithIcons} />);
    expect(screen.getByTestId('card-icon')).toBeDefined();
  });

  it('accepts custom className', () => {
    const { container } = render(<OnboardingCards cards={cards} className="my-cards" />);
    expect(container.firstElementChild?.className).toContain('my-cards');
  });
});
