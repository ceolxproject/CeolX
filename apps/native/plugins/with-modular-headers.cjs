const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '# @ceolx use_modular_headers (firebase swift / google-utilities fix)';

const withModularHeaders = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes('use_modular_headers!')) {
        return cfg;
      }

      const anchor = 'use_expo_modules!';
      const idx = contents.indexOf(anchor);
      if (idx === -1) {
        throw new Error(
          '[with-modular-headers] could not find use_expo_modules! anchor in Podfile'
        );
      }

      const insertion = `\n  ${MARKER}\n  use_modular_headers!\n`;
      contents =
        contents.slice(0, idx + anchor.length) + insertion + contents.slice(idx + anchor.length);

      fs.writeFileSync(podfilePath, contents, 'utf8');
      return cfg;
    },
  ]);

module.exports = withModularHeaders;
