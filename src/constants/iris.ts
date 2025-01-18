import { v4 as uuid } from 'uuid';

// TODO: pull this shit from comunica and a turtle file; will probably need to do typescript magic for enums
export const PROJECTLESS_PREFIX = `origraph:projectless:`;

export const createNewQueryIri = (projectPrefix: string | null) =>
  `${projectPrefix || PROJECTLESS_PREFIX}${uuid()}`;
