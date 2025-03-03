import { clean } from 'semver';

export const getVersionNumberFromOrigraphVocabIri = (versionIri: string) =>
  clean(versionIri.match(/v([.\d]+)$/)?.[1] || '');
