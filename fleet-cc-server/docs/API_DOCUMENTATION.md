# API Documentation

## Overview

The Fleet CC API uses Swagger/OpenAPI 3.0 for interactive documentation. The documentation is automatically generated from JSDoc comments in the route files.

## Accessing Documentation

- **Swagger UI**: `http://localhost:3001/api-docs` (or your API server URL)
- **OpenAPI JSON**: `http://localhost:3001/api-docs/swagger.json`

## Authentication

The API uses JWT Bearer token authentication for most endpoints. There are three authentication methods:

1. **Bearer Token (User Authentication)**: Required for most API endpoints
   - Get token by logging in via the frontend or directly via GoTrue:
     ```
     POST /auth/v1/token?grant_type=password
     Body: { "email": "user@example.com", "password": "password" }
     ```
   - Include token in requests: `Authorization: Bearer <token>`

2. **Device MAC Address**: For device-specific endpoints
   - Header: `x-device-mac: AA:BB:CC:DD:EE:FF`

3. **Device ID**: Alternative device authentication
   - Header: `x-device-id: device-identifier`

## Using Swagger UI

1. Navigate to `/api-docs`
2. Click the "Authorize" button at the top
3. Enter your JWT token in the format: `Bearer <your-token>` or just `<your-token>`
4. Click "Authorize" to authenticate all requests
5. The token will persist across page refreshes

## Postman Import

### Method 1: Direct Import from Swagger JSON

1. Open Postman
2. Click "Import" button
3. Select "Link" tab
4. Enter: `http://localhost:3001/api-docs/swagger.json` (or your API server URL)
5. Click "Continue" and "Import"

### Method 2: Download and Import

1. Navigate to `http://localhost:3001/api-docs/swagger.json`
2. Save the JSON file
3. In Postman, click "Import" → "Upload Files"
4. Select the downloaded JSON file

### Postman Environment Setup

After importing, create a Postman environment with:

- `base_url`: `http://localhost:3001` (or your API server URL)
- `auth_url`: `http://localhost:9999` (or your GoTrue URL)
- `token`: (leave empty, will be set after login)

### Postman Pre-request Script (Optional)

To automatically get a token, add this to a collection pre-request script:

```javascript
if (!pm.environment.get("token") || pm.environment.get("token_expires") < Date.now()) {
    pm.sendRequest({
        url: pm.environment.get("auth_url") + "/token?grant_type=password",
        method: 'POST',
        header: {
            'Content-Type': 'application/json'
        },
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                email: pm.environment.get("user_email"),
                password: pm.environment.get("user_password")
            })
        }
    }, function (err, res) {
        if (res.json().access_token) {
            pm.environment.set("token", res.json().access_token);
            pm.environment.set("token_expires", Date.now() + (res.json().expires_in * 1000));
        }
    });
}
```

Then set the Authorization header to: `Bearer {{token}}`

## Keeping Documentation Up to Date

The documentation is **automatically generated** from JSDoc comments in the route files. To keep it up to date:

### 1. Add Security Annotations to Protected Routes

For routes that require authentication, add:

```typescript
/**
 * @swagger
 * /api/your-endpoint:
 *   get:
 *     summary: Your endpoint description
 *     security:
 *       - bearerAuth: []
 *     ...
 */
```

### 2. Document New Endpoints

When adding new routes, include Swagger annotations:

```typescript
/**
 * @swagger
 * /api/new-endpoint:
 *   post:
 *     summary: Brief description
 *     description: Detailed description
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []  # If authentication required
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */
```

### 3. Update Schemas

Add new schemas to `src/config/swagger.ts` in the `components.schemas` section.

### 4. Verify Documentation

After making changes:
1. Run `npm run docs:verify` locally to check your changes
2. Restart the API server
3. Navigate to `/api-docs`
4. Verify your changes appear correctly
5. Test the "Try it out" feature

### 5. CI/CD Verification

The documentation verification is **automatically enforced** in CI/CD pipelines:

- **GitHub Actions**: Runs on every pull request and push to `main`/`master`
- **Blocking**: Pull requests **cannot be merged** if documentation verification fails
- **Path-based triggers**: Only runs when route files or Swagger config changes (for efficiency)
- **Fast feedback**: Verification typically completes in under 30 seconds

The CI pipeline will:
1. Install dependencies
2. Run `npm run docs:verify`
3. **Fail the build** if:
   - Any routes are missing JSDoc documentation
   - Documented routes don't match actual route code
   - Protected routes are missing security annotations
   - Routes with `requireAuth` middleware lack `bearerAuth` in docs

**What the verification checks:**
- ✅ All Express routes have corresponding JSDoc annotations
- ✅ Documented paths match actual route paths (handles path parameters)
- ✅ HTTP methods match between code and docs
- ✅ Protected routes have `security: - bearerAuth: []` annotations
- ✅ Routes using `requireAuth` middleware (inline or router-level) have security documented
- ✅ **Routes with request bodies (Zod schemas) have `requestBody` documented**
- ✅ **Routes have `responses` section documented**
- ✅ No orphaned documentation (docs for non-existent routes)

**Note:** The verification ensures that inputs and outputs are documented, but does not validate the detailed structure matches. This keeps the verification fast and reliable while ensuring all routes are properly documented.

This ensures that all API documentation stays **in sync with the actual code** and properly secured before code is merged into the main branch.

**Note**: To enforce this check as a required status check, configure branch protection rules in your repository settings (see `.github/workflows/README.md` for details).

## Public vs Protected Routes

### Public Routes (No Authentication)
- `GET /health` - Health check
- `POST /api/devices/register/auto` - Device registration
- `POST /api/devices/heartbeat` - Device heartbeat

### Protected Routes (Require Bearer Token)
- All `/api/commands/*` endpoints
- All `/api/metrics/*` endpoints
- All `/api/images/*` endpoints
- All `/api/verified-images/*` endpoints
- All `/api/notifications/*` endpoints
- All `/api/admin/*` endpoints
- All `/api/realtime/*` endpoints

## Troubleshooting

### Documentation Not Updating
- Restart the API server after making changes
- Check that JSDoc comments are properly formatted
- Verify the route file is included in `swagger.ts` `apis` array

### Postman Import Fails
- Ensure the API server is running
- Check that `/api-docs/swagger.json` is accessible
- Verify the JSON is valid (check browser console)

### Authentication Not Working in Swagger
- Ensure you're using the correct token format
- Check that the token hasn't expired
- Verify the `bearerAuth` security scheme is configured

## Best Practices

1. **Always document new endpoints** - Add Swagger annotations when creating routes
2. **Include security requirements** - Mark protected routes with `security: - bearerAuth: []`
3. **Add response examples** - Include example responses for common status codes
4. **Document error responses** - Include 400, 401, 404, 500 responses
5. **Keep schemas updated** - Update shared schemas when data models change
6. **Test in Swagger UI** - Use "Try it out" to verify endpoints work correctly

