import packageJson from '../../package.json' with { type: 'json' };

import fs from 'fs';

fs.writeFileSync(
  'builds/chrome-extension/manifest.json',
  JSON.stringify(
    {
      manifest_version: 3,
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      action: {
        default_popup: 'extension.html',
      },
      permissions: [],
    },
    null,
    2
  )
);
