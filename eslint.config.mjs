import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		ignores: ['worker-configuration.d.ts'],
		plugins: { js },
		extends: ['js/recommended'],
	},
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		ignores: ['worker-configuration.d.ts'],
		languageOptions: { globals: globals.node },
	},
	{
		extends: tseslint.configs.recommended,
		ignores: ['worker-configuration.d.ts'],
	},
]);
