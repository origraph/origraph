import { ViewDescription } from '../state/Perspectives';

export type Point = {
  x: number;
  y: number;
};
export type Rectangle = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export const DEFAULT_VIEW_DESCRIPTION: ViewDescription = {
  title: 'Untitled View',
  subtitle: '',
};
