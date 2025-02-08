import { useRef } from 'react';

export const useMutable = <T>(value: T) => {
  const ref = useRef<T>(value);
  ref.current = value;
  return () => ref.current;
};
