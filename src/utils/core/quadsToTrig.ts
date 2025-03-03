import { Quad, Writer } from 'n3';
import { STANDARD_PREFIXES } from '../../constants/iris';

export const quadsToTrig = (quads: Quad[]) =>
  new Promise<string>((resolve, reject) => {
    const writer = new Writer({
      prefixes: STANDARD_PREFIXES,
    });
    writer.addQuads(quads);
    writer.end((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
