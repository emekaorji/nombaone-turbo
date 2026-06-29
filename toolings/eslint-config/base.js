import js from '@eslint/js';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import onlyWarn from 'eslint-plugin-only-warn';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

/**
 * Custom rule: enforce side-effect (bare) imports — `import 'foo';` with no
 * specifiers — appear at the very top of the import block as a tight cluster
 * with exactly one blank line separating them from other imports.
 *
 * `eslint-plugin-import` can warn about side-effect ordering but refuses to
 * auto-fix it (intentional safety against changing CSS/polyfill load order).
 * We auto-fix here. Three violations handled, one per pass:
 *   1. Side-effect import appearing after a value import → move into cluster.
 *   2. Blank line between two consecutive side-effect imports → collapse.
 *   3. Wrong number of newlines between cluster end and first value import →
 *      normalise to exactly one blank line.
 */
const sideEffectImportsFirstRule = {
  meta: {
    type: 'layout',
    fixable: 'code',
    schema: [],
    messages: {
      notFirst: 'Side-effect imports must appear before all other imports.',
      noBlankInCluster:
        'Side-effect imports must be clustered together without blank lines between them.',
      blankAfterCluster:
        'Exactly one blank line is required between side-effect imports and the rest.',
    },
  },
  create(context) {
    return {
      Program(node) {
        const sourceCode = context.sourceCode;
        const imports = node.body.filter((s) => s.type === 'ImportDeclaration');
        if (imports.length < 2) return;

        let firstValuedIndex = -1;
        for (let i = 0; i < imports.length; i++) {
          if (imports[i].specifiers.length > 0) {
            firstValuedIndex = i;
            break;
          }
        }
        if (firstValuedIndex === -1) return;

        // Check 1: side-effect import sitting after a value import.
        for (let i = firstValuedIndex + 1; i < imports.length; i++) {
          const imp = imports[i];
          if (imp.specifiers.length !== 0) continue;

          context.report({
            node: imp,
            messageId: 'notFirst',
            fix(fixer) {
              const text = sourceCode.getText(imp);
              const sourceText = sourceCode.text;

              // Collapse up to 2 trailing newlines so we don't leave an
              // orphaned blank line behind where the side-effect import lived.
              let removeEnd = imp.range[1];
              let consumed = 0;
              while (
                removeEnd < sourceText.length &&
                sourceText[removeEnd] === '\n' &&
                consumed < 2
              ) {
                removeEnd++;
                consumed++;
              }

              if (firstValuedIndex > 0) {
                // Cluster already exists at the top — append after the last
                // cluster member with just a single newline (no blank line).
                const lastClusterMember = imports[firstValuedIndex - 1];
                return [
                  fixer.removeRange([imp.range[0], removeEnd]),
                  fixer.insertTextAfter(lastClusterMember, `\n${text}`),
                ];
              }

              // No cluster yet — insert before the first value import with
              // a blank line separating them.
              const firstValued = imports[firstValuedIndex];
              return [
                fixer.removeRange([imp.range[0], removeEnd]),
                fixer.insertTextBefore(firstValued, `${text}\n\n`),
              ];
            },
          });
          return;
        }

        // Check 2: blank line(s) between consecutive side-effect imports.
        for (let i = 1; i < firstValuedIndex; i++) {
          const prev = imports[i - 1];
          const curr = imports[i];
          const between = sourceCode.text.slice(prev.range[1], curr.range[0]);
          const newlineCount = (between.match(/\n/g) || []).length;
          if (newlineCount > 1) {
            context.report({
              node: curr,
              messageId: 'noBlankInCluster',
              fix(fixer) {
                return fixer.replaceTextRange([prev.range[1], curr.range[0]], '\n');
              },
            });
            return;
          }
        }

        // Check 3: cluster-to-values spacing must be exactly one blank line.
        if (firstValuedIndex > 0) {
          const lastClusterMember = imports[firstValuedIndex - 1];
          const firstValued = imports[firstValuedIndex];
          const between = sourceCode.text.slice(lastClusterMember.range[1], firstValued.range[0]);
          const newlineCount = (between.match(/\n/g) || []).length;
          if (newlineCount !== 2) {
            context.report({
              node: firstValued,
              messageId: 'blankAfterCluster',
              fix(fixer) {
                return fixer.replaceTextRange(
                  [lastClusterMember.range[1], firstValued.range[0]],
                  '\n\n'
                );
              },
            });
            return;
          }
        }
      },
    };
  },
};

const localPlugin = {
  rules: {
    'side-effect-imports-first': sideEffectImportsFirstRule,
  },
};

/** @type {import("eslint").Linter.Config[]} */
export const config = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: {
      turbo: turboPlugin,
      onlyWarn,
      import: importPlugin,
      local: localPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
        node: true,
      },
      'import/internal-regex': '^@(modules|shared)(/|$)',
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-empty-object-type': 'off',
      'local/side-effect-imports-first': 'error',
      'import/no-duplicates': ['error', { 'prefer-inline': false }],
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@nombaone/**', group: 'external', position: 'after' }],
          pathGroupsExcludedImportTypes: ['type'],
          distinctGroup: true,
          'newlines-between': 'always',
        },
      ],
    },
  },
  {
    ignores: ['dist/**', '.next/**', 'build/**', 'node_modules/**', '*.config.*'],
  },
];
