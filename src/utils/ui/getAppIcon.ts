import { isDarkMode } from './isDarkMode';

export const getAppIcon = () =>
  isDarkMode() ? '/icon.svg' : '/icon_borderless.svg';
