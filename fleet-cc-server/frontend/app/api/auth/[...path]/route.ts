import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy route for Supabase Auth API
 *
 * The Supabase JS client expects /auth/v1/* endpoints, but GoTrue
 * uses direct endpoints like /token, /signup, etc.
 *
 * This proxy routes /api/auth/v1/* requests to GoTrue on port 9999
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'POST')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'PUT')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'DELETE')
}

async function handleRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  // In Docker, use the service name 'auth' to connect to GoTrue
  // In local dev, use localhost
  // The NEXT_PUBLIC_SUPABASE_URL is for client-side, but server-side needs the internal Docker URL
  const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true'
  const gotrueUrl = isDocker
    ? 'http://auth:9999'  // Docker service name
    : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:9999')

  // The Supabase client calls /auth/v1/token, /auth/v1/signup, etc.
  // pathSegments will be ['auth', 'v1', 'token'] or ['auth', 'v1', 'signup'], etc.
  // We need to extract the actual endpoint (last segment) and route to GoTrue

  // Remove 'auth' and 'v1' prefixes if present
  const segments = [...pathSegments]
  if (segments[0] === 'auth') segments.shift()
  if (segments[0] === 'v1') segments.shift()

  // Get the endpoint (last segment after removing prefixes)
  const endpoint = segments[segments.length - 1]

  // Map Supabase client paths to GoTrue paths
  const pathMap: Record<string, string> = {
    'token': 'token',
    'signup': 'signup',
    'logout': 'logout',
    'user': 'user',
    'admin': 'admin',
    'recover': 'recover',
    'verify': 'verify',
    'resend': 'resend',
  }

  const gotruePath = pathMap[endpoint] || endpoint

  // Build the GoTrue URL
  const url = new URL(`${gotrueUrl}/${gotruePath}`)

  // Copy query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value)
  })

  // Get request body if it exists
  let body: string | undefined
  if (method === 'POST' || method === 'PUT') {
    try {
      body = await request.text()
    } catch (e) {
      // No body
    }
  }

  // Forward the request to GoTrue
  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!,
        }),
      },
      body,
    })

    const data = await response.text()

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

