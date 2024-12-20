import type { Meta, StoryObj } from '@storybook/react';

import { expect } from '@storybook/test';
import { fireEvent, within } from '@testing-library/react';
import App from './App';

const meta = {
  component: App,
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const incrementButton = canvas.getByTestId('App-increment');

    await step('Click the button once', async () => {
      expect(incrementButton.textContent).toBe(`Current count is 0`);
      fireEvent.click(incrementButton);
    });
    await step('Click the button again', async () => {
      expect(incrementButton.textContent).toBe(`Current count is 1`);
      fireEvent.click(incrementButton);
    });
    expect(incrementButton.textContent).toBe(`Current count is 2`);
  },
};
