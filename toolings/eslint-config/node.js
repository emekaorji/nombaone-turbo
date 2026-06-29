import { config as baseConfig } from './base.js';
import globals from 'globals';

/** @type {import("eslint").Linter.Config[]} */
export const config = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
