import sparql from './getDirectQuadsQuery.sparql?raw';
export const getDirectQuadsQuery = ({ iri }: { iri: string }) =>
  sparql.replace(/IRI:/g, `<${iri}>`);
