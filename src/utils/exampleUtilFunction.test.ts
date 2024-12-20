import { describe, expect, it } from 'vitest';
import { exampleUtilFunction } from './exampleUtilFunction';

describe('Squares numbers', () => {
  it('works for positive numbers', () => {
    expect(exampleUtilFunction(2)).toEqual(4);
  });
  it('works for negative numbers', () => {
    expect(exampleUtilFunction(-3)).toEqual(9);
  });
});
