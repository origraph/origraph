import { useContext } from 'react';
import { EditorContext } from '../../pages/Editor/Editor';

export const useViewContext = (viewIri: string) =>
  useContext(EditorContext).viewStates.find(
    (viewState) => viewState.viewIri === viewIri
  );
