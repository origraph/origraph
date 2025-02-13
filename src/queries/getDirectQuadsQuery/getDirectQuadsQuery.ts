import sparql from './getDirectQuadsQuery.sparql?raw';
export const getDirectQuads = ({ iri }: { iri: string }) =>
  sparql.replace(/IRI:/g, `<${iri}>`);
