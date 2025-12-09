import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import nextPlugin from '@next/eslint-plugin-next'

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{js,jsx,ts,tsx}'],
		plugins: {
			react,
			'react-hooks': reactHooks,
			'@next/next': nextPlugin,
		},
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		settings: {
			react: {
				version: 'detect',
			},
		},
		rules: {
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			...nextPlugin.configs.recommended.rules,
			...nextPlugin.configs['core-web-vitals'].rules,
			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_' },
			],
		},
	},
	{
		ignores: [
			'.next/**',
			'node_modules/**',
			'out/**',
			'build/**',
			'dist/**',
		],
	}
)
