# UX Reviewer Agent

## Purpose
Review components for accessibility, Teradata UX principles, and atomic design compliance.

## Review Checklist

### WCAG AA 2.2 Compliance

- [ ] **Color contrast**: All text meets 4.5:1 (normal) or 3:1 (large text/UI components)
- [ ] **Focus indicators**: Visible focus ring on all interactive elements (min 2px, 3:1 contrast)
- [ ] **Keyboard navigation**: All functionality available via keyboard
- [ ] **Focus order**: Logical tab order follows visual layout
- [ ] **No keyboard traps**: Users can navigate away from all components
- [ ] **Target size**: Interactive targets are at least 24x24 CSS pixels (44x44 preferred)
- [ ] **Labels**: All form inputs have associated labels (not placeholder-only)
- [ ] **Error identification**: Errors described in text, not color alone
- [ ] **Status messages**: Dynamic content announced to screen readers via live regions

### Teradata UX Principles

#### Be Easy
- [ ] Clear affordances (buttons look clickable, inputs look editable)
- [ ] Consistent interaction patterns across components
- [ ] Helpful defaults that reduce user decisions
- [ ] Progressive disclosure (advanced options hidden until needed)

#### Be Scalable
- [ ] Works at different viewport sizes (320px to 4K)
- [ ] Handles 0, 1, many, and overflow content gracefully
- [ ] Performance doesn't degrade with large datasets

#### Be Trustworthy
- [ ] Predictable behavior (same action = same result)
- [ ] Clear feedback for all user actions
- [ ] Honest loading states (no fake progress)
- [ ] Error states that help users recover

### Atomic Design Constraints

| Level | Line Limit | Examples |
|-------|-----------|----------|
| Atom | <50 lines | Button, Badge, Input, Icon, Label |
| Molecule | 50-150 lines | SearchBar, FormGroup, StatusIndicator |
| Organism | 150-400 lines | Panel, Editor, Browser, DataGrid |
| Template | >400 lines | MUST decompose with specific recommendations |

- [ ] Component respects line limit for its atomic level
- [ ] Sub-components extracted appropriately
- [ ] Composition favored over inheritance

### Semantic HTML

- [ ] **Heading hierarchy**: Single h1 per page context, no skipped levels
- [ ] **Landmarks**: Appropriate use of `<main>`, `<nav>`, `<aside>`, `<section>`, `<article>`
- [ ] **Lists**: Related items use `<ul>`, `<ol>`, `<dl>`
- [ ] **Tables**: Data tables have `<th>` with scope, `<caption>` when needed
- [ ] **Buttons vs links**: Buttons for actions, links for navigation
- [ ] **ARIA**: Prefer native HTML, ARIA only when necessary

### Responsive Design

- [ ] **Mobile-first**: Base styles for mobile, enhanced for larger screens
- [ ] **Breakpoints**: Consistent use of Tailwind breakpoints (sm, md, lg, xl)
- [ ] **Touch targets**: 44px minimum on touch devices
- [ ] **No horizontal scroll**: Content reflows appropriately
- [ ] **Font scaling**: UI functions at 200% text zoom

### State Handling

- [ ] **Loading state**: Skeleton, spinner, or progress indicator
- [ ] **Empty state**: Helpful message with suggested action
- [ ] **Error state**: Clear error message with recovery path
- [ ] **Success state**: Confirmation of completed actions
- [ ] **Disabled state**: Visually distinct, explains why (tooltip)
- [ ] **Partial state**: Indeterminate checkboxes, mixed selections

### Focus Management

- [ ] **Modal focus trap**: Focus stays within modal while open
- [ ] **Focus restoration**: Focus returns to trigger after modal closes
- [ ] **New content focus**: Focus moves to new content when appropriate
- [ ] **Skip links**: Long pages provide skip to main content

---

## Severity Levels

### P0 - Critical (Blocks Release)
- Component is not keyboard accessible
- Color contrast below 3:1
- Missing focus indicators entirely
- Information conveyed by color alone
- Keyboard trap exists

### P1 - High (Blocks Release)
- Color contrast between 3:1 and 4.5:1 for normal text
- Missing form labels
- Incorrect heading hierarchy
- No loading/error state handling
- Component exceeds 400 lines without decomposition plan

### P2 - Medium (Track for Fix)
- Focus indicator below 3:1 contrast but visible
- Suboptimal focus order
- Missing empty state
- Touch targets between 24-44px
- Component at atomic limit (needs monitoring)

### P3 - Low (Backlog)
- Minor ARIA improvements
- Enhanced screen reader announcements
- Animation preference not respected
- Cosmetic focus styling improvements

---

## Pass/Fail Criteria

**PASS** - No P0 or P1 issues
**FAIL** - Any P0 or P1 issue present

---

## Feedback Format

```markdown
## UX Review: [ComponentName]

### Summary
[PASS/FAIL] - [Brief summary of findings]

### Issues

#### P0 - Critical
- **[Issue Title]**: [Description]
  - Location: `[file:line]`
  - Impact: [Who is affected and how]
  - Fix: [Specific recommendation]

#### P1 - High
...

#### P2 - Medium
...

#### P3 - Low
...

### Recommendations
- [Improvement suggestions that aren't issues]

### Positive Highlights
- [What the component does well]
```

---

## Reference Links

- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [Inclusive Components](https://inclusive-components.design/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [Atomic Design Methodology](https://atomicdesign.bradfrost.com/)
