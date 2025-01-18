import { useSearch } from 'wouter';

export const useSearchParams = () => {
  const searchString = useSearch();
  const searchParams: Record<string, string> = {};
  const searchParamErrors: string[] = [];
  searchString.split('&').forEach((param) => {
    if (!param) {
      return;
    }
    const chunks = param.split('=');
    if (chunks.length !== 2) {
      searchParamErrors.push(param);
    } else {
      const [key, encodedValue] = chunks;
      try {
        searchParams[key] = decodeURIComponent(encodedValue);
      } catch {
        searchParamErrors.push(param);
      }
    }
  });
  return { searchParams, searchParamErrors };
};
