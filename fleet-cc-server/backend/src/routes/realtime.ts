import express from 'express'

const router = express.Router()

// Store active SSE connections
const connections = new Set<express.Response>()

// Broadcast to all connected clients
function broadcast(data: any) {
  // Use a replacer function to handle BigInt values (convert to string)
  const message = `data: ${JSON.stringify(data, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )}\n\n`
  connections.forEach((res) => {
    try {
      res.write(message)
    } catch (error) {
      // Connection closed, remove it
      connections.delete(res)
    }
  })
}

// Clean up closed connections
function cleanup() {
  connections.forEach((res) => {
    if (res.closed || res.destroyed) {
      connections.delete(res)
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
  connections.add(res)

  // Send initial connection message
  try {
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`)
  } catch (error) {
    console.error('Failed to send initial SSE message:', error)
    connections.delete(res)
    return res.end()
  }

  let heartbeatInterval: NodeJS.Timeout | null = null

  // Send periodic heartbeat to keep connection alive
  heartbeatInterval = setInterval(() => {
    try {
      // Check if connection is still valid
      if (res.destroyed || res.writableEnded) {
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        connections.delete(res)
        return
      }
      res.write(`: heartbeat\n\n`)
    } catch (error) {
      console.error('SSE heartbeat error:', error)
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      connections.delete(res)
    }
  }, 30000) // Every 30 seconds

  // Handle client disconnect
  const cleanup = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    connections.delete(res)
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

export default router

