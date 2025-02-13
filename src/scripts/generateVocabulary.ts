import { NamedNode as RdfJsNamedNode } from '@rdfjs/types/data-model';
import fs from 'fs';
import n3, { NamedNode as N3NamedNode, Quad, Term } from 'n3';
import { clean, sort } from 'semver';
// Importing the LAST VERSION from the same file that we're about to overwrite;
// as we're doing some bizarre metaprogramming here, use these imports with
// care!
import omit from 'lodash.omit';
import { IrisByPrefix, Vocabulary, VOCABULARY } from '../constants/vocabulary';
(async () => {
  const VOCABULARY_DIR = 'public/vocabulary';

  const vocabularyByVersionIri: Record<
    string,
    Vocabulary & {
      enums: Record<string, string[]>;
    }
  > = {};

  const getIriFromNode = (node: RdfJsNamedNode<string> | N3NamedNode<string>) =>
    String(node); // Not sure why node.value is always undefined?

  await Promise.all(
    fs.readdirSync(VOCABULARY_DIR).map((path) => {
      return new Promise((resolve, reject) => {
        let versionIri: string;
        const allIris = new Set<string>();
        const allPrefixes: Record<string, string> = {};
        const groupMemberships: Record<string, Set<string>> = {};
        const enumsToTranslate = new Set<string>();
        const constants: Record<string, string> = {};

        const parser = new n3.Parser({ format: 'application/trig' });
        const stream = fs.createReadStream(`${VOCABULARY_DIR}/${path}`);
        parser.parse(stream, (error, quad, prefixes) => {
          if (error) {
            reject(
              new Error(
                `Error parsing ${path}: ${JSON.stringify(error, null, 2)}`
              )
            );
          }
          if (prefixes) {
            const origraphPrefix = getIriFromNode(prefixes.origraph);
            if (!versionIri) {
              versionIri = origraphPrefix;
            } else if (versionIri !== origraphPrefix) {
              reject(
                new Error(
                  `Expected ${path} to define its @prefix origraph: <${versionIri}> .\ninstead of @prefix origraph: <${origraphPrefix}> .`
                )
              );
            }
            Object.entries(prefixes).forEach(([key, prefix]) => {
              // Kinda strange tweak to make both our TriG and typescript more
              // natural; in typescript we want to reference IRIs like
              // origraph.ui.TrigView, but in TriG we want to use : for our base
              // IRI, and origraph: for the named graph & vocabulary itself.
              // This means we need to swap origraph: for : to enable natural
              // typescript references (and we can omit the origraph: prefix)
              if (key === '') {
                allPrefixes.origraph = getIriFromNode(prefix);
              } else if (key !== 'origraph') {
                allPrefixes[key] = getIriFromNode(prefix);
              }
            });
          }
          if (quad) {
            if (!versionIri) {
              versionIri = quad.graph.id;
            } else if (versionIri !== quad.graph.id) {
              reject(
                new Error(
                  `For now, multiple named graphs in vocabulary files are not supported; ${path} contains both ${versionIri} and ${quad.graph.id}`
                )
              );
            }
            (['subject', 'predicate', 'object'] as Array<keyof Quad>).forEach(
              (term) => {
                allIris.add((quad[term] as Term).id);
              }
            );
            // Collect any group members
            if (
              quad.predicate.id ===
              VOCABULARY.irisByPrefix.origraph.memberOfGroup
            ) {
              if (!groupMemberships[quad.object.id]) {
                groupMemberships[quad.object.id] = new Set();
              }
              groupMemberships[quad.object.id].add(quad.subject.id);
            }
            // Identify groups that should be exposed as Typescript enums
            if (
              quad.predicate.id ===
                VOCABULARY.irisByPrefix.origraph.ts.translateAs &&
              quad.object.id === VOCABULARY.irisByPrefix.origraph.ts.Enum
            ) {
              enumsToTranslate.add(quad.subject.id);
            }
            // Identify any constants
            if (
              quad.subject.id === VOCABULARY.irisByPrefix.origraph.Constants
            ) {
              constants[quad.predicate.id] = quad.object.id;
            }
          }
          if (quad === null) {
            // quad === null means this file has finished parsing
            if (vocabularyByVersionIri[versionIri]) {
              reject(`Duplicate vocabulary version: ${versionIri}`);
            }

            const irisByPrefix: IrisByPrefix = {};
            const unprefixedIris = new Set<string>();

            const longestPrefixOrder = Object.values(allPrefixes).sort(
              (prefixA, prefixB) => prefixB.length - prefixA.length
            );
            const keysByPrefix = Object.fromEntries(
              Object.entries(allPrefixes).map(([key, prefix]) => [prefix, key])
            );
            const keyChainsByPrefix: Record<string, string[]> = {};
            const getPrefixKeyChain = (prefix: string) => {
              if (keyChainsByPrefix[prefix]) {
                return keyChainsByPrefix[prefix];
              }
              const parentPrefix = longestPrefixOrder.find(
                (parent) => parent !== prefix && prefix.startsWith(parent)
              );
              const chain: string[] =
                parentPrefix !== undefined
                  ? [...getPrefixKeyChain(parentPrefix), keysByPrefix[prefix]]
                  : [keysByPrefix[prefix]];
              keyChainsByPrefix[prefix] = chain;
              return chain;
            };
            const createNestedObjects = (
              remainingChain: string[],
              level: IrisByPrefix
            ) => {
              if (!level[remainingChain[0]]) {
                level[remainingChain[0]] = {};
              }
              if (remainingChain.length >= 2) {
                createNestedObjects(
                  remainingChain.slice(1),
                  level[remainingChain[0]] as IrisByPrefix
                );
              }
            };
            const resolveLookupLevel = (
              remainingChain: string[],
              level: IrisByPrefix = irisByPrefix
            ) => {
              if (remainingChain.length === 1) {
                return level[remainingChain[0]] as IrisByPrefix;
              }
              return resolveLookupLevel(
                remainingChain.slice(1),
                level[remainingChain[0]] as IrisByPrefix
              );
            };
            longestPrefixOrder.forEach((prefix) => {
              createNestedObjects(getPrefixKeyChain(prefix), irisByPrefix);
            });

            // Now add IRIs to their corresponding prefix object
            const keyChainsByIri = { ...keyChainsByPrefix };
            allIris.forEach((iri) => {
              const longestPrefix = longestPrefixOrder.find((prefix) =>
                iri.startsWith(prefix)
              );
              if (!longestPrefix) {
                unprefixedIris.add(iri);
              } else {
                const prefixChain = getPrefixKeyChain(longestPrefix);
                const level = resolveLookupLevel(prefixChain);
                const key = iri.slice(longestPrefix.length);
                level[key] = iri;
                keyChainsByIri[iri] = [...prefixChain, key];
              }
            });

            // Create any special enums
            const enums = Object.fromEntries(
              Array.from(enumsToTranslate).map((enumIri) => [
                keyChainsByIri[enumIri][keyChainsByIri[enumIri].length - 1],
                Array.from(groupMemberships[enumIri]),
              ])
            );

            // Check and include the version number
            const versionNumber = clean(
              versionIri.match(/v([.\d]+)$/)?.[1] || ''
            );
            if (!versionNumber) {
              reject(
                new Error(
                  `Couldn't identify version number in IRI: ${versionIri}`
                )
              );
              return;
            }
            vocabularyByVersionIri[versionNumber] = {
              versionNumber,
              versionIri,
              unprefixedIris: Array.from(unprefixedIris),
              irisByPrefix,
              prefixes: allPrefixes,
              keyChainsByIri,
              constants,
              enums,
            };
            resolve(vocabularyByVersionIri[versionIri]);
          }
        });
      });
    })
  );

  // TODO: I kinda want to store a diff between versions in vocabulary.ts, in
  // order to get types for universal things, while having special types to warn
  // us about things like "hey, somebody's project might not actually have this
  // term?" Or maybe just do classic project migrations? Need to think through
  // what a migration really should look like from the user perspective
  // (automatic? manual? DO RESEARCH about who is likely to even care about
  // Origraph's internal vocabulary?)

  // TODO: for now, we're just going to hard-code 0.1.0 as the universal, unchanging
  // vocabulary
  const exportedVocabulary = vocabularyByVersionIri['0.1.0'];

  // Convert objects into typescript enums
  const enumChunks = Object.entries(exportedVocabulary.enums)
    .map(
      ([enumName, memberIris]) => `\
export enum ${enumName} {
${memberIris
  .map(
    (iri) => `\
  ${exportedVocabulary.keyChainsByIri[iri][exportedVocabulary.keyChainsByIri[iri].length - 1]} = '${iri}',`
  )
  .join('\n')}
}`
    )
    .join('\n\n');

  // Cleanup before outputting vocabularies
  const exportedVocabularies = Object.fromEntries(
    Object.entries(vocabularyByVersionIri).map(([vocabIri, vocab]) => {
      // Remove temporary stuff we don't want in the output
      const cleanedVocab = omit(vocab, ['enums']);
      // Make constants reference-able by their abbreviated definition
      cleanedVocab.constants = Object.fromEntries(
        Object.entries(cleanedVocab.constants).map(
          ([propertyIri, valueIri]) => {
            return [
              cleanedVocab.keyChainsByIri[propertyIri][
                cleanedVocab.keyChainsByIri[propertyIri].length - 1
              ],
              valueIri,
            ];
          }
        )
      );
      return [vocabIri, cleanedVocab];
    })
  );

  const formatJsObj = (obj: unknown) => JSON.stringify(obj, null, 2);

  fs.writeFileSync(
    'src/constants/vocabulary.ts',
    `\
/*
DO NOT EDIT THIS FILE DIRECTLY!!!

This should always be auto-generated by \`npm run build-vocabulary\`;
if you need to change something about it other than its contents,
edit src/scripts/generateVocabulary.ts instead.

Also, you should never edit an already-public version of the vocabulary;
instead, create a new .trig file for each version if edits are required
*/

/*
  Nested lookup for IRIs; prefixes that begin the same way will
  contain each other, e.g. a vocabulary that looks like this:

  @prefix ex: <example:vocab> .
  @prefix ui: <example:vocab:ui> .
  @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

  ex:MyConcept a rdfs:Class .
  ui:MyView a rdfs:Class .

  ...should result in an object that looks like this:

  irisByPrefix = {
    ex: {
      MyConcept: 'example:vocab:MyConcept',
      ui: {
        MyView: 'example:vocab:ui:MyView'
      }
    },
    rdf: {
      type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    },
    rdfs: {
      Class: 'http://www.w3.org/2000/01/rdf-schema#Class'
    }
  }
*/
export interface IrisByPrefix {
  [key: string]: string | IrisByPrefix;
}

export interface Vocabulary {
  versionNumber: string;
  versionIri: string;
  unprefixedIris: string[];
  irisByPrefix: IrisByPrefix;
  prefixes: Record<string, string>;
  keyChainsByIri: Record<string, string[]>;
  constants: Record<string, string>;
}

export const VOCABULARY_VERSION_ORDER = ${formatJsObj(sort(Object.keys(exportedVocabularies)))};

export const ALL_VOCABULARIES = ${formatJsObj(exportedVocabularies)};

// TODO: this hard-coding is likely to change...
export const VOCABULARY = ALL_VOCABULARIES['0.1.0'];

${enumChunks}
`
  );
})();
