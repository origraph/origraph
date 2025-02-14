import { FC, useEffect } from 'react';

export const Redirect404: FC = () => {
  useEffect(() => {
    window.location.href = '/site/404.html';
  }, []);
  return <>Page not found; redirecting...</>;
};
