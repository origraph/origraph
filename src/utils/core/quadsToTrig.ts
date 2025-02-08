import { Quad, Writer } from 'n3';

export const quadsToTrig = (quads: Quad[]) =>
  new Promise<string>((resolve, reject) => {
    const writer = new Writer(); // TODO: { prefixes: { rdf: '...' } }
    writer.addQuads(quads);
    writer.end((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
