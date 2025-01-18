import { isDarkMode } from './isDarkMode';

export const getAppIcon = () =>
  isDarkMode() ? '/Logo Dark Background.svg' : '/Logo Dark Background.svg';
