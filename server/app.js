import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import eventRoutes from './routes/events.js';
import organizerRoutes from './routes/organizer.js';
import ticketRoutes from './routes/tickets.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Needed to use __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Middleware ===
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(compression());

app.use((req, res, next) => {
  if (req.path.startsWith('/api/tickets')) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Track last request time for idle detection
let lastRequestTime = Date.now();

// Middleware to update lastRequestTime on every incoming request
app.use((req, res, next) => {
  lastRequestTime = Date.now();
  next();
});

// === API Routes ===
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Debug route to test API
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working', timestamp: new Date().toISOString() });
});

app.use('/api/events', eventRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/tickets', ticketRoutes);

// === Serve static frontend ===
app.use(express.static(path.join(__dirname, '../dist')));

// === Catch-all: Serve index.html for client-side routing ===
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.use(errorHandler);

// === Graceful shutdown ===
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Self-ping function to keep server alive if idle > 1 minute
const SELF_PING_INTERVAL = 15 * 1000; // check every 15 sec
const IDLE_TIME_LIMIT = 60 * 1000; // 1 minute idle

setInterval(() => {
  const now = Date.now();
  if (now - lastRequestTime > IDLE_TIME_LIMIT) {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/health',
      method: 'GET',
    };

    const req = http.request(options, res => {
      if (res.statusCode === 200) {
        console.log(`[Keep-Alive] Self-ping successful at ${new Date().toISOString()}`);
        lastRequestTime = Date.now();
      } else {
        console.warn(`[Keep-Alive] Self-ping responded with status ${res.statusCode}`);
      }
    });

    req.on('error', error => {
      console.error('[Keep-Alive] Self-ping failed:', error.message);
    });

    req.end();
  }
}, SELF_PING_INTERVAL);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
