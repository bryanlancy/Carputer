import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'

const router = express.Router()

// Store active SSE connections
const sseConnections = new Set<express.Response>()

// Store active WebSocket connections
const wsConnections = new Set<WebSocket>()

// Broadcast to all connected clients (both SSE and WebSocket)
function broadcast(data: any) {
  // Use a replacer function to handle BigInt values (convert to string)
  const jsonData = JSON.stringify(data, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )

  // Broadcast to SSE connections
  const sseMessage = `data: ${jsonData}\n\n`
  sseConnections.forEach((res) => {
    try {
      res.write(sseMessage)
    } catch (error) {
      // Connection closed, remove it
      sseConnections.delete(res)
    }
  })

  // Broadcast to WebSocket connections
  wsConnections.forEach((ws) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(jsonData)
      } else {
        // Connection closed, remove it
        wsConnections.delete(ws)
      }
    } catch (error) {
      // Connection closed, remove it
      wsConnections.delete(ws)
    }
  })
}

// Clean up closed connections
function cleanup() {
  // Clean up SSE connections
  sseConnections.forEach((res) => {
    if (res.closed || res.destroyed) {
      sseConnections.delete(res)
    }
  })

  // Clean up WebSocket connections
  wsConnections.forEach((ws) => {
    if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING) {
      wsConnections.delete(ws)
    }
  })
}

// Cleanup every 30 seconds
setInterval(cleanup, 30000)

/**
 * Server-Sent Events endpoint for realtime device updates
 * Clients can subscribe to this endpoint to receive realtime updates
 * about device status changes, new notifications, etc.
 */
router.get('/devices', (req, res) => {
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
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)
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
  req.on('error', (error) => {
    console.error('SSE connection error:', error)
    cleanup()
  })

  res.on('error', (error) => {
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
 */
export function broadcastNotification(notification: any) {
  broadcast({
    type: 'notification',
    notification,
    timestamp: new Date().toISOString(),
  })
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
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname

    if (pathname === '/api/realtime/ws') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request)
      })
    } else {
      socket.destroy()
    }
  })

  wss.on('connection', (ws: WebSocket, req: any) => {
    console.log('WebSocket client connected')
    wsConnections.add(ws)

    // Parse query params for channels
    const url = new URL(req.url || '', 'http://localhost')
    const channels = url.searchParams.get('channels')?.split(',') || []

    // Send initial connection message
    try {
      ws.send(JSON.stringify({
        type: 'connected',
        channels,
        timestamp: new Date().toISOString(),
      }))
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
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString(),
          }))
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    })

    // Handle client disconnect
    const cleanup = () => {
      console.log('WebSocket client disconnected')
      wsConnections.delete(ws)
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
    }

    ws.on('close', cleanup)

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
      cleanup()
    })

    // Send periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          }))
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

export default router

