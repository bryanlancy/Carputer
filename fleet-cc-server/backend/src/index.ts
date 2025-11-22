import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import { swaggerSpec } from './config/swagger';
import { prisma } from './db/prisma';

// Load environment variables
dotenv.config();

// Import routes
import deviceRoutes from './routes/devices';
import commandRoutes from './routes/commands';
import metricsRoutes from './routes/metrics';
import healthRoutes from './routes/health';
import imageRoutes from './routes/images';
import verifiedImageRoutes from './routes/verifiedImages';
import notificationRoutes from './routes/notifications';
import realtimeRoutes, { broadcastDeviceUpdate, broadcastNotification } from './routes/realtime';
import { setBroadcastFunctions, DeviceStatusService } from './services/deviceStatus';

// Initialize Express app
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.JWT_SECRET || 'dummy-key-for-development';
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is not set. Using fallback key. Supabase features may not work.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
// Configure Helmet for API (less restrictive than default)
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API endpoints
  crossOriginEmbedderPolicy: false,
}));
// CORS configuration - allow multiple origins in development
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://10.0.0.68:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      // In development, be more permissive
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`CORS: Allowing origin ${origin} in development mode`);
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request context middleware
app.use((req, res, next) => {
  req.prisma = prisma;
  req.supabase = supabase;
  next();
});

// Serve Swagger JSON spec for frontend (must be before Swagger UI middleware)
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  // Update server URL based on request origin or environment
  const spec = JSON.parse(JSON.stringify(swaggerSpec)); // Deep clone to avoid mutating original
  const origin = req.get('origin') || req.get('referer') || '';
  const host = req.get('host') || '';
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

  // Try to determine the correct server URL
  let serverUrl = apiUrl || 'http://localhost:3001';

  // Priority 1: Use origin header (from frontend fetch with Origin header)
  if (origin) {
    try {
      const url = new URL(origin);
      // Use the same host but with port 3001
      serverUrl = `${url.protocol}//${url.hostname}:3001`;
    } catch (e) {
      // If URL parsing fails, continue to next option
    }
  }

  // Priority 2: Use referer header if origin wasn't available
  if (serverUrl.includes('localhost') && !origin) {
    try {
      const referer = req.get('referer');
      if (referer) {
        const url = new URL(referer);
        serverUrl = `${url.protocol}//${url.hostname}:3001`;
      }
    } catch (e) {
      // If referer parsing fails, continue to next option
    }
  }

  // Priority 3: Use Host header if we still have localhost
  if (serverUrl.includes('localhost') && host && !host.includes('localhost')) {
    try {
      // Extract hostname from Host header (format: hostname:port)
      const hostname = host.split(':')[0];
      const protocol = req.protocol || (req.secure ? 'https' : 'http');
      serverUrl = `${protocol}://${hostname}:3001`;
    } catch (e) {
      // Keep existing serverUrl
    }
  }

  // Update the servers array with the correct URL
  if (spec.servers && spec.servers.length > 0) {
    spec.servers[0].url = serverUrl;
    spec.servers[0].description = 'API Server';
  }

  res.json(spec);
});

// Swagger API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Fleet CC API Documentation',
}));

// Routes
app.use('/health', healthRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/verified-images', verifiedImageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/realtime', realtimeRoutes);

// Set broadcast functions in deviceStatus service for offline detection
setBroadcastFunctions(broadcastDeviceUpdate, broadcastNotification);

// Initialize device status service for periodic offline checks
const deviceStatusService = new DeviceStatusService(prisma);

// Periodic background job to check for offline devices
// Runs every 30 seconds, but only if there are devices currently online
const OFFLINE_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds

const offlineCheckInterval = setInterval(async () => {
  try {
    // Only run offline check if there are devices currently online
    const hasOnline = await deviceStatusService.hasOnlineDevices();
    if (!hasOnline) {
      // Skip check if no devices are online
      return;
    }

    // Check for and update offline devices
    const updatedDeviceIds = await deviceStatusService.updateAllOfflineDevices();
    if (updatedDeviceIds.length > 0) {
      console.log(`Marked ${updatedDeviceIds.length} device(s) as offline`);
    }
  } catch (error) {
    console.error('Error in offline device check:', error);
  }
}, OFFLINE_CHECK_INTERVAL_MS);

// Log when offline check starts
console.log('Started periodic offline device check (every 30 seconds, only when devices are online)');

// Cleanup on process exit
process.on('SIGTERM', () => {
  console.log('Stopping offline device check...');
  clearInterval(offlineCheckInterval);
});

process.on('SIGINT', () => {
  console.log('Stopping offline device check...');
  clearInterval(offlineCheckInterval);
});

// Export broadcast functions for use in routes
export { broadcastDeviceUpdate, broadcastNotification };

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
// Listen on 0.0.0.0 to allow connections from other machines on the network
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`Fleet CC API server listening on ${HOST}:${PORT}`);
  console.log(`Accessible at http://localhost:${PORT} or http://<your-ip>:${PORT}`);
});

// Configure server for better connection handling
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds (should be > keepAliveTimeout)
server.maxConnections = 1000;

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      prisma: PrismaClient;
      supabase: SupabaseClient<any, 'public', any>;
    }
  }
}

