import { resolve } from 'path';

export function getDataRoot() {
  if (process.env.APP_DATA_DIR) {
    return resolve(/* turbopackIgnore: true */ process.env.APP_DATA_DIR);
  }

  return resolve(process.cwd(), 'data');
}
