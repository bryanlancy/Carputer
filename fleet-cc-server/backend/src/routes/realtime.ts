import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { verifyToken } from '../middleware/auth'
import { prisma } from '../db/prisma'

const router = express.Router()

// Store active SSE connections
const sseConnections = new Set<express.Response>()

// Store active WebSocket connections with user info
interface WebSocketConnection {
	ws: WebSocket
	userId?: string
	userRoles?: string[]
}

const wsConnections = new Map<WebSocket, WebSocketConnection>()

// Broadcast to all connected clients (both SSE and WebSocket)
function broadcast(data: any) {
	// Use a replacer function to handle BigInt values (convert to string)
	const jsonData = JSON.stringify(data, (key, value) =>
		typeof value === 'bigint' ? value.toString() : value
	)

	// Broadcast to SSE connections
	const sseMessage = `data: ${jsonData}\n\n`
	sseConnections.forEach(res => {
		try {
			res.write(sseMessage)
		} catch (error) {
			// Connection closed, remove it
			sseConnections.delete(res)
		}
	})

	// Broadcast to WebSocket connections
	wsConnections.forEach(conn => {
		try {
			if (conn.ws.readyState === WebSocket.OPEN) {
				conn.ws.send(jsonData)
			} else {
				// Connection closed, remove it
				wsConnections.delete(conn.ws)
			}
		} catch (error) {
			// Connection closed, remove it
			wsConnections.delete(conn.ws)
		}
	})
}

/**
 * Broadcast notification to specific user
 */
function broadcastToUser(userId: string, data: any) {
	const jsonData = JSON.stringify(data, (key, value) =>
		typeof value === 'bigint' ? value.toString() : value
	)

	wsConnections.forEach(conn => {
		if (conn.userId === userId && conn.ws.readyState === WebSocket.OPEN) {
			try {
				conn.ws.send(jsonData)
			} catch (error) {
				wsConnections.delete(conn.ws)
			}
		}
	})
}

// Clean up closed connections
function cleanup() {
	// Clean up SSE connections
	sseConnections.forEach(res => {
		if (res.closed || res.destroyed) {
			sseConnections.delete(res)
		}
	})

	// Clean up WebSocket connections
	wsConnections.forEach((conn, ws) => {
		if (
			conn.ws.readyState !== WebSocket.OPEN &&
			conn.ws.readyState !== WebSocket.CONNECTING
		) {
			wsConnections.delete(ws)
		}
	})
}

// Cleanup every 30 seconds
setInterval(cleanup, 30000)

/**
 * @swagger
 * /api/realtime/devices:
 *   get:
 *     summary: Server-Sent Events endpoint for realtime device updates
 *     description: Clients can subscribe to this endpoint to receive realtime updates about device status changes, new notifications, etc. Uses Server-Sent Events (SSE) protocol.
 *     tags: [Realtime]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SSE stream connection established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/devices', (req, res) => {
	// Explicitly check authentication - requireAuth middleware should have already checked,
	// but we verify here as well to be safe
	if (!req.user) {
		console.warn('SSE connection rejected: User not authenticated')
		res.status(401).json({ error: 'Authentication required' })
		return
	}

	// Set headers for SSE
	res.setHeader('Content-Type', 'text/event-stream')
	res.setHeader('Cache-Control', 'no-cache')
	res.setHeader('Connection', 'keep-alive')
	res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
	res.setHeader('Access-Control-Allow-Origin', '*') // Allow CORS for SSE
	res.setHeader('Access-Control-Allow-Headers', 'Cache-Control')

	// Add connection to set
	sseConnections.add(res)

	// Send initial connection message
	try {
		res.write(
			`data: ${JSON.stringify({
				type: 'connected',
				timestamp: new Date().toISOString(),
			})}\n\n`
		)
	} catch (error) {
		console.error('Failed to send initial SSE message:', error)
		sseConnections.delete(res)
		return res.end()
	}

	let heartbeatInterval: NodeJS.Timeout | null = null

	// Send periodic heartbeat to keep connection alive
	heartbeatInterval = setInterval(() => {
		try {
			// Check if connection is still valid
			if (res.destroyed || res.writableEnded) {
				if (heartbeatInterval) clearInterval(heartbeatInterval)
				sseConnections.delete(res)
				return
			}
			res.write(`: heartbeat\n\n`)
		} catch (error) {
			console.error('SSE heartbeat error:', error)
			if (heartbeatInterval) clearInterval(heartbeatInterval)
			sseConnections.delete(res)
		}
	}, 30000) // Every 30 seconds

	// Handle client disconnect
	const cleanup = () => {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval)
			heartbeatInterval = null
		}
		sseConnections.delete(res)
		if (!res.destroyed && !res.writableEnded) {
			try {
				res.end()
			} catch (error) {
				// Connection already closed
			}
		}
	}

	req.on('close', cleanup)
	req.on('aborted', cleanup)

	// Handle errors
	req.on('error', error => {
		console.error('SSE connection error:', error)
		cleanup()
	})

	res.on('error', error => {
		console.error('SSE response error:', error)
		cleanup()
	})
})

/**
 * Broadcast device status update
 */
export function broadcastDeviceUpdate(device: any, notification?: any) {
	broadcast({
		type: 'device_update',
		device,
		notification,
		timestamp: new Date().toISOString(),
	})
}

/**
 * Broadcast notification update
 * If notification has user_notifications, also send to specific users
 */
export function broadcastNotification(notification: any) {
	// Broadcast to all (for backward compatibility)
	broadcast({
		type: 'notification',
		notification,
		timestamp: new Date().toISOString(),
	})

	// If notification has user_notifications, also send to specific users
	if (
		notification.user_notifications &&
		Array.isArray(notification.user_notifications)
	) {
		notification.user_notifications.forEach((un: any) => {
			if (un.user_id) {
				broadcastToUser(un.user_id, {
					type: 'notification',
					notification,
					timestamp: new Date().toISOString(),
				})
			}
		})
	}
}

/**
 * Broadcast image update
 */
export function broadcastImageUpdate(image: any, notification?: any) {
	broadcast({
		type: 'image_update',
		image,
		notification,
		timestamp: new Date().toISOString(),
	})
}

/**
 * Broadcast metrics update
 */
export function broadcastMetricsUpdate(metrics: any) {
	broadcast({
		type: 'metrics_update',
		metrics,
		timestamp: new Date().toISOString(),
	})
}

/**
 * Create WebSocket server instance
 * This should be called from the main server file
 */
export function createWebSocketServer(server: any) {
	const wss = new WebSocketServer({ noServer: true })

	// Handle HTTP upgrade requests
	server.on('upgrade', (request: any, socket: any, head: Buffer) => {
		try {
			const pathname = new URL(
				request.url || '',
				`http://${request.headers.host || 'localhost'}`
			).pathname

			if (pathname === '/api/realtime/ws') {
				wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
					wss.emit('connection', ws, request)
				})
			} else {
				socket.destroy()
			}
		} catch (error) {
			console.error('WebSocket upgrade error:', error)
			socket.destroy()
		}
	})

	wss.on('connection', async (ws: WebSocket, req: any) => {
		console.log('WebSocket client connected')

		// Parse query params for channels and token
		const url = new URL(req.url || '', 'http://localhost')
		const channels = url.searchParams.get('channels')?.split(',') || []
		const token =
			url.searchParams.get('token') ||
			req.headers.authorization?.replace('Bearer ', '')

		let userId: string | undefined
		let userRoles: string[] = []

		// Require authentication for WebSocket connections
		if (!token) {
			console.warn('WebSocket connection rejected: No token provided')
			ws.close(1008, 'Authentication required')
			return
		}

		try {
			const decoded = await verifyToken(token)
			if (!decoded || !decoded.sub) {
				console.warn('WebSocket connection rejected: Invalid token')
				ws.close(1008, 'Invalid token')
				return
			}

			try {
				const user = await prisma.user.findUnique({
					where: { supabase_user_id: decoded.sub },
					include: {
						user_roles: true,
					},
				})

				if (!user) {
					console.warn(
						'WebSocket connection rejected: User not found'
					)
					ws.close(1008, 'User not found')
					return
				}

				userId = user.id
				userRoles = user.user_roles.map(ur => ur.role)
				console.log(`WebSocket authenticated user: ${user.email}`)
			} catch (dbError) {
				console.error('WebSocket user lookup failed:', dbError)
				ws.close(1011, 'Database error')
				return
			}
		} catch (error) {
			console.warn('WebSocket authentication failed:', error)
			ws.close(1008, 'Authentication failed')
			return
		}

		// Store connection with user info
		wsConnections.set(ws, {
			ws,
			userId,
			userRoles,
		})

		// Send initial connection message
		try {
			ws.send(
				JSON.stringify({
					type: 'connected',
					channels,
					authenticated: !!userId,
					userId,
					timestamp: new Date().toISOString(),
				})
			)
		} catch (error) {
			console.error('Failed to send initial WebSocket message:', error)
		}

		// Handle incoming messages (for two-way communication)
		ws.on('message', (message: Buffer) => {
			try {
				const data = JSON.parse(message.toString())
				console.log('Received WebSocket message:', data)
				// Handle client messages here if needed
				// For now, we just acknowledge receipt
				if (data.type === 'ping') {
					ws.send(
						JSON.stringify({
							type: 'pong',
							timestamp: new Date().toISOString(),
						})
					)
				}
			} catch (error) {
				console.error('Failed to parse WebSocket message:', error)
			}
		})

		// Send periodic heartbeat
		let heartbeatInterval: NodeJS.Timeout | null = null

		// Handle client disconnect
		const cleanup = () => {
			console.log('WebSocket client disconnected')
			wsConnections.delete(ws)
			if (heartbeatInterval) {
				clearInterval(heartbeatInterval)
				heartbeatInterval = null
			}
		}

		ws.on('close', cleanup)

		ws.on('error', error => {
			console.error('WebSocket error:', error)
			cleanup()
		})

		// Start periodic heartbeat
		heartbeatInterval = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(
						JSON.stringify({
							type: 'heartbeat',
							timestamp: new Date().toISOString(),
						})
					)
				} catch (error) {
					cleanup()
				}
			} else {
				cleanup()
			}
		}, 30000) // Every 30 seconds
	})

	return wss
}

/**
 * Broadcast notification to specific user by ID
 */
export function broadcastNotificationToUser(userId: string, notification: any) {
	broadcastToUser(userId, {
		type: 'notification',
		notification,
		timestamp: new Date().toISOString(),
	})
}

/**
 * Terminate all WebSocket connections for a specific user
 * This should be called when a user logs out or their session is revoked
 */
export function terminateUserConnections(userId: string) {
	const connectionsToClose: WebSocket[] = []

	// Find all connections for this user
	wsConnections.forEach((conn, ws) => {
		if (conn.userId === userId) {
			connectionsToClose.push(ws)
		}
	})

	// Close all connections for this user
	connectionsToClose.forEach(ws => {
		try {
			if (
				ws.readyState === WebSocket.OPEN ||
				ws.readyState === WebSocket.CONNECTING
			) {
				ws.close(1008, 'User logged out')
			}
			wsConnections.delete(ws)
		} catch (error) {
			console.error('Error closing WebSocket connection:', error)
			wsConnections.delete(ws)
		}
	})

	if (connectionsToClose.length > 0) {
		console.log(
			`Terminated ${connectionsToClose.length} WebSocket connection(s) for user ${userId}`
		)
	}
}

/**
 * Terminate all connections (WebSocket and SSE) for a user by their Supabase user ID
 * This is a helper that looks up the user ID from the Supabase user ID
 */
export async function terminateUserConnectionsBySupabaseId(
	supabaseUserId: string
) {
	try {
		const user = await prisma.user.findUnique({
			where: { supabase_user_id: supabaseUserId },
		})

		if (user) {
			terminateUserConnections(user.id)
		}
	} catch (error) {
		console.error('Error terminating user connections:', error)
	}
}

export default router
