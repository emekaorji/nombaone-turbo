import { config as baseConfig } from './base.js';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';

/** @type {import("eslint").Linter.Config[]} */
export const config = [
  ...baseConfig,
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': hooksPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
