const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	output: 'standalone',
	// Transpile swagger-ui-react and its dependencies
	transpilePackages: [
		'swagger-ui-react',
		'swagger-ui',
		'react-syntax-highlighter',
	],
	sassOptions: {
		includePaths: ['./styles'],
	},
	webpack: (config, { dev, dir }) => {
		if (dev) {
			// Get absolute paths for parent directories
			const parentDir = path.resolve(__dirname, '..')
			const grandParentDir = path.resolve(__dirname, '../..')

			// Force polling mode - this is critical to avoid inotify limits
			// Set poll to a number (milliseconds) to enable polling
			config.watchOptions = {
				poll: 1000, // 1 second polling interval - uses polling instead of inotify
				ignored: [
					// Use glob patterns as strings
					'**/node_modules/**',
					'**/.next/**',
					'**/.git/**',
					'**/dist/**',
					// Ignore parent directories using absolute path glob patterns
					`${parentDir}/**`,
					`${grandParentDir}/**`,
				],
				aggregateTimeout: 300,
				followSymlinks: false,
			}

			// Also set webpack's context to prevent watching outside
			if (!config.context) {
				config.context = dir || __dirname
			}
		}
		return config
	},
}

module.exports = nextConfig
