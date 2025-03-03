import { VOCABULARY } from './vocabulary';

/*
IRIS that we use from other vocabularies, that may or may not be explicitly
referenced in a vocabulary/*.trig file
*/
export const EXTERNAL_VOCABULARY = {
  irisByPrefix: {
    rdf: {
      type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    },
    rdfs: {
      label: 'http://www.w3.org/2000/01/rdf-schema#label',
      subClassOf: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
      subPropertyOf: 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf',
    },
    void: {
      vocabulary: 'http://rdfs.org/ns/void#vocabulary',
      Dataset: 'http://rdfs.org/ns/void#Dataset',
    },
  },
};

/*
  Common IRIs that we always shorten in code views
*/
export const STANDARD_PREFIXES = {
  origraph: VOCABULARY.prefixes.origraph,
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  dc: 'http://purl.org/dc/elements/1.1/',
  foaf: 'http://xmlns.com/foaf/0.1/',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  owl: 'http://www.w3.org/2002/07/owl#',
};
