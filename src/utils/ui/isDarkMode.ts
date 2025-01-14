export const isDarkMode = () =>
  Boolean(globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
