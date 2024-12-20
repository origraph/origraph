import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App pure vitest', async () => {
  it('increment button starts at zero, and adds one when clicked', async () => {
    /*
    This example test file is redundant w.r.t. what the stories cover; just an
    example of how to add additional vitests
    */
    render(<App />);

    const incrementButton = screen.getByTestId('App-increment');
    expect(incrementButton.textContent).toBe(`Current count is 0`);

    act(() => {
      incrementButton.click();
    });
    await waitFor(() => {
      expect(incrementButton.textContent).toBe(`Current count is 1`);
    });

    act(() => {
      incrementButton.click();
    });
    await waitFor(() => {
      expect(incrementButton.textContent).toBe(`Current count is 2`);
    });
  });
});
