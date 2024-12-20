import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('increment button starts at zero, and adds one when clicked', async () => {
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
