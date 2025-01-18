import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { Missing } from '../Missing/Missing';

const publishedVocabularies = new Set(['/vocabulary/v0.1']);

export const Vocabulary = () => {
  // Fake component that redirects to .trig files
  const [location] = useLocation();

  const isRedirecting = useMemo(() => {
    if (publishedVocabularies.has(location)) {
      globalThis.location.href = location + '.trig';
      return true;
    }
    return false;
  }, [location]);

  return isRedirecting ? <>Redirecting...</> : <Missing />;
};
