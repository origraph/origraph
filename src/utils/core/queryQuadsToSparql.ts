import { Quad } from 'n3';

export const queryQuadsToSparql = (quads: Quad[]) => {
  // TODO: filter quads to just the ones that are relevant to a query, and then
  // generate a SPARQL query string

  // TODO: still unclear if it'd be best to generate the SPARQL ourselves
  // (directly from the list of quads), or use a combination of these (may be
  // more):

  // SPARQL generators:
  // https://github.com/tpluscode/sparql-builder
  // https://github.com/rdf-ext/rdf-sparql-builder

  // SPARQL parsers:
  // https://github.com/joachimvh/SPARQLAlgebra.js
  // https://github.com/RubenVerborgh/SPARQL.js/

  // Would be nice if there was a library that converted both ways... it's
  // possible that some combination of the above speak the same language /
  // conform to the same standard on the JS side, but I still need to read /
  // experiment more deeply

  // (Would be REALLY nice if the intermediate JS side also translated nicely
  // into standardized and/or human-comprehensible triples... e.g. SPIN or
  // Meta-SPARQL, but as far as human-comprehensibility goes, semantic web nerds
  // are unlikely to have translated their shit into words that normal people
  // use. We'll probably need to research this, to create a query builder
  // vocabulary that people actually understand intuitively)

  console.log(
    'queryQuadsToSparql',
    JSON.stringify(
      quads.map((quad) => ({
        subject: quad.subject,
        predicate: quad.predicate,
        object: quad.object,
        graph: quad.graph,
      })),
      null,
      2
    )
  );

  return `SELECT *
WHERE {
  {
    ?s ?p ?o .
    BIND(<temp:default:graph> AS ?g)
  }
  UNION
  {
    GRAPH ?g { ?s ?p ?o . }
  }
} LIMIT 1000`;
};
