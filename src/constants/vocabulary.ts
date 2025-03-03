/*
DO NOT EDIT THIS FILE DIRECTLY!!!

This should always be auto-generated by `npm run build-vocabulary`;
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

export const VOCABULARY_VERSION_ORDER = [
  'https://origraph.net/vocabulary/v0.1.0',
];

export const ALL_VOCABULARIES = {
  'https://origraph.net/vocabulary/v0.1.0': {
    versionNumber: '0.1.0',
    versionIri: 'https://origraph.net/vocabulary/v0.1.0',
    unprefixedIris: [
      'https://origraph.net/vocabulary/v0.1.0',
      '"Results"',
      '"Query Definition"',
      '"Overview"',
      '"Current Selection"',
    ],
    irisByPrefix: {
      origraph: {
        ts: {
          translateAs:
            'https://origraph.net/vocabulary/v0.1.0/typescript/translateAs',
          Enum: 'https://origraph.net/vocabulary/v0.1.0/typescript/Enum',
        },
        ui: {
          ViewType: 'https://origraph.net/vocabulary/v0.1.0/ui/ViewType',
          TrigView: 'https://origraph.net/vocabulary/v0.1.0/ui/TrigView',
          PerspectiveAspect:
            'https://origraph.net/vocabulary/v0.1.0/ui/PerspectiveAspect',
          ResultPage: 'https://origraph.net/vocabulary/v0.1.0/ui/ResultPage',
          PerspectiveQuery:
            'https://origraph.net/vocabulary/v0.1.0/ui/PerspectiveQuery',
          overviewQueryIri:
            'https://origraph.net/vocabulary/v0.1.0/ui/overviewQueryIri',
          selectionQueryIri:
            'https://origraph.net/vocabulary/v0.1.0/ui/selectionQueryIri',
          basePerspectiveIri:
            'https://origraph.net/vocabulary/v0.1.0/ui/basePerspectiveIri',
          baseJobIri: 'https://origraph.net/vocabulary/v0.1.0/ui/baseJobIri',
        },
        Node: 'https://origraph.net/vocabulary/v0.1.0/Node',
        inheritsFrom: 'https://origraph.net/vocabulary/v0.1.0/inheritsFrom',
        Item: 'https://origraph.net/vocabulary/v0.1.0/Item',
        Link: 'https://origraph.net/vocabulary/v0.1.0/Link',
        Group: 'https://origraph.net/vocabulary/v0.1.0/Group',
        Attribute: 'https://origraph.net/vocabulary/v0.1.0/Attribute',
        Hyperedge: 'https://origraph.net/vocabulary/v0.1.0/Hyperedge',
        memberOfGroup: 'https://origraph.net/vocabulary/v0.1.0/memberOfGroup',
        Constants: 'https://origraph.net/vocabulary/v0.1.0/Constants',
        OverviewQuery: 'https://origraph.net/vocabulary/v0.1.0/OverviewQuery',
        SelectionQuery: 'https://origraph.net/vocabulary/v0.1.0/SelectionQuery',
        Perspective: 'https://origraph.net/vocabulary/v0.1.0/Perspective',
        Job: 'https://origraph.net/vocabulary/v0.1.0/Job',
      },
      rdf: {
        type: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      },
      origraphGlobal: {
        vocabularies: 'https://origraph.net/vocabulary/global/vocabularies',
        installed_version:
          'https://origraph.net/vocabulary/global/installed_version',
      },
      rdfs: {
        label: 'http://www.w3.org/2000/01/rdf-schema#label',
        subClassOf: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
        subPropertyOf: 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf',
      },
      void: {},
    },
    prefixes: {
      origraph: 'https://origraph.net/vocabulary/v0.1.0/',
      origraphGlobal: 'https://origraph.net/vocabulary/global/',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      ts: 'https://origraph.net/vocabulary/v0.1.0/typescript/',
      ui: 'https://origraph.net/vocabulary/v0.1.0/ui/',
      void: 'http://rdfs.org/ns/void#',
    },
    keyChainsByIri: {
      'https://origraph.net/vocabulary/v0.1.0/': ['origraph'],
      'https://origraph.net/vocabulary/v0.1.0/typescript/': ['origraph', 'ts'],
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#': ['rdf'],
      'https://origraph.net/vocabulary/v0.1.0/ui/': ['origraph', 'ui'],
      'https://origraph.net/vocabulary/global/': ['origraphGlobal'],
      'http://www.w3.org/2000/01/rdf-schema#': ['rdfs'],
      'http://rdfs.org/ns/void#': ['void'],
      'https://origraph.net/vocabulary/global/vocabularies': [
        'origraphGlobal',
        'vocabularies',
      ],
      'https://origraph.net/vocabulary/global/installed_version': [
        'origraphGlobal',
        'installed_version',
      ],
      'https://origraph.net/vocabulary/v0.1.0/Node': ['origraph', 'Node'],
      'https://origraph.net/vocabulary/v0.1.0/inheritsFrom': [
        'origraph',
        'inheritsFrom',
      ],
      'https://origraph.net/vocabulary/v0.1.0/Item': ['origraph', 'Item'],
      'https://origraph.net/vocabulary/v0.1.0/Link': ['origraph', 'Link'],
      'https://origraph.net/vocabulary/v0.1.0/Group': ['origraph', 'Group'],
      'https://origraph.net/vocabulary/v0.1.0/Attribute': [
        'origraph',
        'Attribute',
      ],
      'https://origraph.net/vocabulary/v0.1.0/Hyperedge': [
        'origraph',
        'Hyperedge',
      ],
      'https://origraph.net/vocabulary/v0.1.0/memberOfGroup': [
        'origraph',
        'memberOfGroup',
      ],
      'https://origraph.net/vocabulary/v0.1.0/ui/ViewType': [
        'origraph',
        'ui',
        'ViewType',
      ],
      'https://origraph.net/vocabulary/v0.1.0/typescript/translateAs': [
        'origraph',
        'ts',
        'translateAs',
      ],
      'https://origraph.net/vocabulary/v0.1.0/typescript/Enum': [
        'origraph',
        'ts',
        'Enum',
      ],
      'https://origraph.net/vocabulary/v0.1.0/ui/TrigView': [
        'origraph',
        'ui',
        'TrigView',
      ],
      'https://origraph.net/vocabulary/v0.1.0/ui/PerspectiveAspect': [
        'origraph',
        'ui',
        'PerspectiveAspect',
      ],
      'https://origraph.net/vocabulary/v0.1.0/ui/ResultPage': [
        'origraph',
        'ui',
        'ResultPage',
      ],
      'http://www.w3.org/2000/01/rdf-schema#label': ['rdfs', 'label'],
      'https://origraph.net/vocabulary/v0.1.0/ui/PerspectiveQuery': [
        'origraph',
        'ui',
        'PerspectiveQuery',
      ],
      'https://origraph.net/vocabulary/v0.1.0/Constants': [
        'origraph',
        'Constants',
      ],
      'https://origraph.net/vocabulary/v0.1.0/ui/overviewQueryIri': [
        'origraph',
        'ui',
        'overviewQueryIri',
      ],
      'https://origraph.net/vocabulary/v0.1.0/OverviewQuery': [
        'origraph',
        'OverviewQuery',
      ],
      'https://origraph.net/vocabulary/v0.1.0/ui/selectionQueryIri': [
        'origraph',
        'ui',
        'selectionQueryIri',
      ],
      'https://origraph.net/vocabulary/v0.1.0/SelectionQuery': [
        'origraph',
        'SelectionQuery',
      ],
      'https://origraph.net/vocabulary/v0.1.0/ui/basePerspectiveIri': [
        'origraph',
        'ui',
        'basePerspectiveIri',
      ],
      'https://origraph.net/vocabulary/v0.1.0/Perspective': [
        'origraph',
        'Perspective',
      ],
      'https://origraph.net/vocabulary/v0.1.0/ui/baseJobIri': [
        'origraph',
        'ui',
        'baseJobIri',
      ],
      'https://origraph.net/vocabulary/v0.1.0/Job': ['origraph', 'Job'],
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': ['rdf', 'type'],
      'http://www.w3.org/2000/01/rdf-schema#subClassOf': ['rdfs', 'subClassOf'],
      'http://www.w3.org/2000/01/rdf-schema#subPropertyOf': [
        'rdfs',
        'subPropertyOf',
      ],
    },
    constants: {
      overviewQueryIri: 'https://origraph.net/vocabulary/v0.1.0/OverviewQuery',
      selectionQueryIri:
        'https://origraph.net/vocabulary/v0.1.0/SelectionQuery',
      basePerspectiveIri: 'https://origraph.net/vocabulary/v0.1.0/Perspective',
      baseJobIri: 'https://origraph.net/vocabulary/v0.1.0/Job',
    },
  },
};

// TODO: this hard-coding is likely to change...
export const VOCABULARY =
  ALL_VOCABULARIES['https://origraph.net/vocabulary/v0.1.0'];

export enum ViewType {
  TrigView = 'https://origraph.net/vocabulary/v0.1.0/ui/TrigView',
}

export enum PerspectiveAspect {
  ResultPage = 'https://origraph.net/vocabulary/v0.1.0/ui/ResultPage',
  PerspectiveQuery = 'https://origraph.net/vocabulary/v0.1.0/ui/PerspectiveQuery',
}
