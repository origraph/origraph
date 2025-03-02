import { isDarkMode } from './isDarkMode';

export const getAppIcon = () =>
  isDarkMode()
    ? '/logos/origraph/Logo Dark Background.svg'
    : '/logos/origraph/Logo Light Background.svg';
