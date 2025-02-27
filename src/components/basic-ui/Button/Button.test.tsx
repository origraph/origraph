import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  IncrementalButton,
  IncrementalButtonTestId,
} from './ButtonTestWrappers';

describe('Button pure vitest', async () => {
  it('increment button starts at zero, and adds one when clicked', async () => {
    /*
    This example test file is redundant w.r.t. what the stories cover; just an
    example of how to add additional vitests
    */
    render(<IncrementalButton />);

    const button = screen.getByTestId(IncrementalButtonTestId);
    expect(button.textContent).toBe(`Current count is 0`);

    act(() => {
      button.click();
    });
    await waitFor(() => {
      expect(button.textContent).toBe(`Current count is 1`);
    });

    act(() => {
      button.click();
    });
    await waitFor(() => {
      expect(button.textContent).toBe(`Current count is 2`);
    });
  });
});
