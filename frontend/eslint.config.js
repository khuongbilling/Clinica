// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Unescaped HTML entities (' " etc.) are cosmetic; downgrade to warning
      // so the validate workflow fails only on real logic errors.
      'react/no-unescaped-entities': 'warn',
    },
  },
]);
