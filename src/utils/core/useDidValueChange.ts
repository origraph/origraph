import { default as lodashIsEqual } from 'lodash.isequal';
import usePrevious from './usePrevious';

export const useDidValueChange = <T>({
  value,
  isEqual = lodashIsEqual,
}: {
  value: T;
  isEqual?: (oldValue: T, newValue: T) => boolean;
}) => {
  const previous = usePrevious(value);
  return !isEqual(value, previous);
};
