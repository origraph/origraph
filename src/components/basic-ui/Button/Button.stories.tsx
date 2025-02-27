import type { Meta, StoryObj } from '@storybook/react';

import { expect, fireEvent, within } from '@storybook/test';
import { ButtonProps } from './Button';
import {
  IncrementalButton,
  IncrementalButtonTestId,
} from './ButtonTestWrappers';

const meta = {
  component: IncrementalButton,
} satisfies Meta<ButtonProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId(IncrementalButtonTestId);

    await step('Click the button once', async () => {
      expect(button.textContent).toBe(`Current count is 0`);
      fireEvent.click(button);
    });
    await step('Click the button again', async () => {
      expect(button.textContent).toBe(`Current count is 1`);
      fireEvent.click(button);
    });
    expect(button.textContent).toBe(`Current count is 2`);
  },
};
