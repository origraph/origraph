import { FC, useCallback, useState } from 'react';
import { Button } from './Button';

export const IncrementalButtonTestId = 'incremental-test-button';

export const IncrementalButton: FC = () => {
  const [clickCount, setClickCount] = useState<number>(0);

  const handleClick = useCallback(() => {
    setClickCount(clickCount + 1);
  }, [clickCount]);

  return (
    <Button onClick={handleClick} data-testid={IncrementalButtonTestId}>
      Current count is {clickCount}
    </Button>
  );
};
