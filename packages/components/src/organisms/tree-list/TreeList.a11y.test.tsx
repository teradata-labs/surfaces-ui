import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TreeList } from './TreeList';

expect.extend(toHaveNoViolations);

describe('TreeList a11y', () => {
  it('has no violations', async () => {
    const { container } = render(
      <TreeList
        nodes={[
          {
            id: 'folder',
            label: 'Folder',
            children: [
              { id: 'file1', label: 'File 1' },
              { id: 'file2', label: 'File 2' },
            ],
          },
          { id: 'file3', label: 'File 3' },
        ]}
        expandedIds={new Set(['folder'])}
        onToggle={() => {}}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
