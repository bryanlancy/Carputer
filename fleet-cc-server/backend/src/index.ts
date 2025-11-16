import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Import routes
import deviceRoutes from './routes/devices';
import commandRoutes from './routes/commands';
import metricsRoutes from './routes/metrics';
import healthRoutes from './routes/health';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is not set. Supabase features may not work.');
}
const supabase = createClient(supabaseUrl, supabaseKey || '');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request context middleware
app.use((req, res, next) => {
  req.db = pool;
  req.supabase = supabase;
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/metrics', metricsRoutes);

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
app.listen(PORT, () => {
  console.log(`Fleet CC API server listening on port ${PORT}`);
});

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      db: Pool;
      supabase: ReturnType<typeof createClient>;
    }
  }
}

