#!/usr/bin/env tsx
/**
 * Script to verify that all API routes have proper Swagger documentation
 * Run with: npx tsx scripts/verify-swagger-docs.ts
 *
 * This script verifies:
 * 1. All Express routes have corresponding JSDoc annotations
 * 2. Protected routes have security annotations
 * 3. Routes with request bodies have requestBody documented
 * 4. Routes have response documentation
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROUTES_DIR = join(__dirname, '../src/routes');
const BASE_PATHS: Record<string, string> = {
  'commands.ts': '/api/commands',
  'metrics.ts': '/api/metrics',
  'images.ts': '/api/images',
  'verifiedImages.ts': '/api/verified-images',
  'notifications.ts': '/api/notifications',
  'devices.ts': '/api/devices',
  'health.ts': '/health',
  'realtime.ts': '/api/realtime',
  'admin/notifications.ts': '/api/admin/notifications',
  'admin/rules.ts': '/api/admin/notifications/rules',
};

const PROTECTED_ROUTE_PATTERNS = [
  '/api/commands',
  '/api/metrics',
  '/api/images',
  '/api/verified-images',
  '/api/notifications',
  '/api/admin',
  '/api/realtime',
];

interface ActualRoute {
  file: string;
  method: string;
  path: string;
  fullPath: string;
  line: number;
  hasRequireAuth: boolean;
  hasZodSchema: boolean; // Has a Zod schema.parse() call
}

interface DocumentedRoute {
  file: string;
  method: string;
  path: string;
  line: number;
  hasSecurity: boolean;
  hasBearerAuth: boolean;
  hasRequestBody: boolean;
  hasResponses: boolean;
}

/**
 * Parse actual Express route definitions from code
 */
function parseActualRoutes(filePath: string, basePath: string): ActualRoute[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const routes: ActualRoute[] = [];

  // Check if router has router.use(requireAuth) at the router level
  let routerHasRequireAuth = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/router\.use\s*\(\s*requireAuth/)) {
      routerHasRequireAuth = true;
      break;
    }
    if (line.match(/router\.(get|post|put|patch|delete)/)) {
      break;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const routeMatch = line.match(/router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/);
    if (routeMatch) {
      const method = routeMatch[1].toLowerCase();
      const routePath = routeMatch[2];

      let hasRequireAuth = routerHasRequireAuth;
      let hasZodSchema = false;

      // Check for requireAuth middleware
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine.includes('requireAuth')) {
          hasRequireAuth = true;
        }
        if (nextLine.includes('async (req, res)') || nextLine.includes('(req, res) =>')) {
          break;
        }
      }

      if (line.includes('requireAuth')) {
        hasRequireAuth = true;
      }

      // Check for Zod schema usage in the handler (look ahead up to 30 lines)
      for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
        if (lines[j].match(/\w+Schema\.parse\s*\(/)) {
          hasZodSchema = true;
          break;
        }
        // Stop if we hit another route definition
        if (lines[j].match(/router\.(get|post|put|patch|delete)/)) {
          break;
        }
      }

      const fullPath = basePath + routePath;

      routes.push({
        file: filePath,
        method,
        path: routePath,
        fullPath,
        line: i + 1,
        hasRequireAuth,
        hasZodSchema,
      });
    }
  }

  return routes;
}

/**
 * Parse Swagger JSDoc annotations from code
 */
function parseDocumentedRoutes(filePath: string): DocumentedRoute[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const routes: DocumentedRoute[] = [];

  let inSwaggerBlock = false;
  let currentPath = '';
  let currentMethod = '';
  let swaggerStartLine = 0;
  let hasSecurity = false;
  let hasBearerAuth = false;
  let hasRequestBody = false;
  let hasResponses = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('@swagger')) {
      inSwaggerBlock = true;
      swaggerStartLine = i + 1;
      hasSecurity = false;
      hasBearerAuth = false;
      hasRequestBody = false;
      hasResponses = false;
      currentPath = '';
      currentMethod = '';
    }

    if (inSwaggerBlock && (line.match(/^\s*\*\s*\/api\//) || line.match(/^\s*\*\s*\/health/))) {
      const match = line.match(/^\s*\*\s*(\/[^:]+):/);
      if (match) {
        currentPath = match[1];
      }
    }

    if (inSwaggerBlock && line.match(/^\s*\*\s+(get|post|put|patch|delete):/)) {
      const match = line.match(/^\s*\*\s+(get|post|put|patch|delete):/);
      if (match) {
        currentMethod = match[1].toLowerCase();
      }
    }

    if (inSwaggerBlock && line.includes('security:')) {
      hasSecurity = true;
    }

    if (inSwaggerBlock && line.includes('bearerAuth')) {
      hasBearerAuth = true;
    }

    if (inSwaggerBlock && line.includes('requestBody:')) {
      hasRequestBody = true;
    }

    if (inSwaggerBlock && line.includes('responses:')) {
      hasResponses = true;
    }

    if (inSwaggerBlock && line.match(/^\s*\*\//)) {
      if (currentPath && currentMethod) {
        routes.push({
          file: filePath,
          method: currentMethod,
          path: currentPath,
          line: swaggerStartLine,
          hasSecurity,
          hasBearerAuth,
          hasRequestBody,
          hasResponses,
        });
      }
      inSwaggerBlock = false;
      currentPath = '';
      currentMethod = '';
    }
  }

  return routes;
}

/**
 * Get all route files recursively
 */
function getAllRouteFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Get base path for a route file
 */
function getBasePath(filePath: string): string {
  const routesDir = join(__dirname, '../src/routes');
  const relativePath = filePath.replace(routesDir + '/', '').replace(/\\/g, '/');

  if (BASE_PATHS[relativePath]) {
    return BASE_PATHS[relativePath];
  }

  if (relativePath.startsWith('admin/')) {
    const fileName = relativePath.replace('admin/', '');
    if (fileName === 'notifications.ts') {
      return '/api/admin/notifications';
    }
    if (fileName === 'rules.ts') {
      return '/api/admin/notifications/rules';
    }
  }

  const fileName = relativePath.replace('.ts', '');
  return `/api/${fileName}`;
}

/**
 * Check if a route path matches (handles path parameters)
 */
function pathsMatch(actualPath: string, documentedPath: string): boolean {
  const normalize = (p: string) => p.replace(/\/$/, '');
  const actual = normalize(actualPath);
  const documented = normalize(documentedPath);

  if (actual === documented) {
    return true;
  }

  const actualNormalized = actual.replace(/:(\w+)/g, '{$1}');
  const documentedNormalized = documented.replace(/:(\w+)/g, '{$1}');

  return actualNormalized === documentedNormalized;
}

function main() {
  console.log('🔍 Verifying Swagger documentation...\n');

  const routeFiles = getAllRouteFiles(ROUTES_DIR);
  const allActualRoutes: ActualRoute[] = [];
  const allDocumentedRoutes: DocumentedRoute[] = [];

  // Parse all routes
  for (const file of routeFiles) {
    const basePath = getBasePath(file);
    const actualRoutes = parseActualRoutes(file, basePath);
    const documentedRoutes = parseDocumentedRoutes(file);

    allActualRoutes.push(...actualRoutes);
    allDocumentedRoutes.push(...documentedRoutes);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check each actual route
  for (const actual of allActualRoutes) {
    const documented = allDocumentedRoutes.find(
      d => d.file === actual.file &&
           d.method === actual.method &&
           pathsMatch(actual.fullPath, d.path)
    );

    if (!documented) {
      const fileName = actual.file.split('/').pop();
      errors.push(
        `❌ Missing documentation: ${actual.method.toUpperCase()} ${actual.fullPath}\n` +
        `   File: ${fileName}:${actual.line}\n` +
        `   Add @swagger annotation before the route definition`
      );
      continue;
    }

    // Check if route is protected
    const isProtected = PROTECTED_ROUTE_PATTERNS.some(pattern =>
      actual.fullPath.startsWith(pattern)
    ) || actual.hasRequireAuth;

    if (isProtected && !documented.hasBearerAuth) {
      const fileName = actual.file.split('/').pop();
      const reason = actual.hasRequireAuth
        ? 'Route uses requireAuth middleware'
        : 'Route matches protected route pattern';
      errors.push(
        `❌ Missing security annotation: ${actual.method.toUpperCase()} ${actual.fullPath}\n` +
        `   File: ${fileName}:${documented.line}\n` +
        `   Reason: ${reason}\n` +
        `   Add to @swagger annotation:\n` +
        `     security:\n` +
        `       - bearerAuth: []`
      );
    }

    // Check if route has request body but no documentation
    if (actual.hasZodSchema && !documented.hasRequestBody) {
      const fileName = actual.file.split('/').pop();
      warnings.push(
        `⚠️  Route uses Zod schema but no requestBody in docs: ${actual.method.toUpperCase()} ${actual.fullPath}\n` +
        `   File: ${fileName}:${documented.line}\n` +
        `   Add requestBody section to @swagger annotation`
      );
    }

    // Check if route has no response documentation
    if (!documented.hasResponses) {
      const fileName = actual.file.split('/').pop();
      warnings.push(
        `⚠️  Route missing response documentation: ${actual.method.toUpperCase()} ${actual.fullPath}\n` +
        `   File: ${fileName}:${documented.line}\n` +
        `   Add responses section to @swagger annotation`
      );
    }
  }

  // Check for orphaned documentation
  for (const documented of allDocumentedRoutes) {
    const actual = allActualRoutes.find(
      a => a.file === documented.file &&
           a.method === documented.method &&
           pathsMatch(a.fullPath, documented.path)
    );

    if (!actual) {
      const fileName = documented.file.split('/').pop();
      warnings.push(
        `⚠️  Orphaned documentation: ${documented.method.toUpperCase()} ${documented.path}\n` +
        `   File: ${fileName}:${documented.line}\n` +
        `   This route may have been removed or renamed`
      );
    }
  }

  // Report results
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All routes are properly documented!\n');
    console.log(`Verified ${allActualRoutes.length} route(s):`);
    allActualRoutes.forEach(r => {
      const doc = allDocumentedRoutes.find(
        d => d.file === r.file && d.method === r.method && pathsMatch(r.fullPath, d.path)
      );
      const status = (r.hasRequireAuth && doc?.hasBearerAuth) || !r.hasRequireAuth ? '✓' : '✗';
      console.log(`  ${status} ${r.method.toUpperCase()} ${r.fullPath}`);
    });
    process.exit(0);
  } else {
    if (errors.length > 0) {
      console.log('❌ Documentation errors found:\n');
      errors.forEach(err => console.log(err + '\n'));
    }

    if (warnings.length > 0) {
      console.log('⚠️  Documentation warnings:\n');
      warnings.forEach(warn => console.log(warn + '\n'));
    }

    console.log('\n💡 Fix these issues before merging to main.');
    console.log('   Errors must be fixed. Warnings indicate missing documentation.');
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

main();
