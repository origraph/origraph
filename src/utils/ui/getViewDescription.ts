import { VOCABULARY } from '../../constants/vocabulary';
import { ViewDescription } from '../../state/Perspectives';

export const getViewDescription = ({
  newDescription,
  previousDescription,
  perspectiveIri,
  aspectIri,
}: {
  newDescription?: Partial<ViewDescription>;
  previousDescription?: Partial<ViewDescription>;
  perspectiveIri: string;
  aspectIri: string;
}): ViewDescription => ({
  title:
    newDescription?.title ||
    previousDescription?.title ||
    VOCABULARY.labelsByIri[perspectiveIri] ||
    'Untitled Perspective',
  subtitle:
    newDescription?.subtitle ||
    previousDescription?.subtitle ||
    VOCABULARY.labelsByIri[aspectIri] ||
    'Unknown Aspect',
});
