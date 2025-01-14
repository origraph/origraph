import { useEffect, useState } from 'react';
import { useDidValueChange } from './useDidValueChange';

export const useIsMounted = () => {
  const [isMounted, setIsMounted] = useState(false);

  const mountedChanged = useDidValueChange({ value: isMounted });

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  return { isMounted, justMounted: isMounted && mountedChanged };
};
