export const encodeSearchParams = (
  searchParams: Record<string, string | string[]>
) =>
  Object.entries(searchParams)
    .reduce(
      (agg, [key, valueOrValues]) =>
        `${agg}&${encodeURIComponent(key)}=${encodeURIComponent(valueOrValues instanceof Array ? valueOrValues.join(',') : valueOrValues)}`,
      ''
    )
    .replace(/&/, '?'); // Replace the first & from the .reduce() with a ?
