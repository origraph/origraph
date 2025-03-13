import packageJson from '../../package.json' with { type: 'json' };

import fs from 'fs';

const peerDependencies = {
  react: packageJson.dependencies.react,
  'react-dom': packageJson.dependencies['react-dom'],
};

fs.writeFileSync(
  'builds/library/package.json',
  JSON.stringify(
    {
      name: packageJson.name,
      version: packageJson.version,
      description: `Component library from ${packageJson.name}`,
      main: `${packageJson.name}.umd.cjs`,
      module: `${packageJson.name}.js`,
      types: `${packageJson.name}.d.ts`,
      sideEffects: ['style.css'],
      devDependencies: peerDependencies, // ensure that peerDependencies are installed
      peerDependencies,
    },
    null,
    2
  )
);
