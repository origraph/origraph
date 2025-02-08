import { VOCABULARY } from '../../constants/vocabulary';
import sparql from './perspectiveMetadata.sparql?raw';

export const getPerspectiveMetadataQuery = ({
  perspectiveIri,
}: {
  perspectiveIri: string;
}) =>
  sparql
    .replace(/PERSPECTIVE:/, VOCABULARY.constants.basePerspectiveIri)
    .replace(/IRI:/g, `<${perspectiveIri}>`);
