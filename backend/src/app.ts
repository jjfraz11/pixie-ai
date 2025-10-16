import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { feathers } from '@feathersjs/feathers';
import express, { json, urlencoded, static as serveStatic, rest, errorHandler } from '@feathersjs/express';
import socketio from '@feathersjs/socketio';
import cors from 'cors'; // Import cors
import helmet from 'helmet'; // Import helmet
import rateLimit from 'express-rate-limit'; // Import rateLimit
import { v4 as uuidv4 } from 'uuid'; // Import uuid for correlation IDs
import winston from 'winston'; // Import winston

// In your app.js or equivalent
const app = express(feathers());

// Create a Winston logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'pixie-ai-backend' },
  transports: [
    new winston.transports.Console(),
    // Add other transports like file or daily rotate file for production
  ],
});

// Middleware to add correlation ID and log requests
app.use((req: any, res: any, next: any) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId; // Attach to request for later use
  logger.info('Incoming Request', {
    correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// Use Helmet.js for security headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Parse HTTP JSON bodies
app.use(json());
// Parse URL-encoded params
app.use(urlencoded({ extended: true }));
// Host static files from the /public folder
app.use(serveStatic(join(__dirname, 'public')));
// Add REST API support
app.configure(rest());
// Configure Socket.io real-time APIs
app.configure(socketio());

// Rate limiting for authentication endpoints (stricter limits)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 authentication attempts per windowMs
  message: (req: any, res: any) => {
    res.status(429).json({
      error: 'Too many authentication attempts from this IP, please try again after 15 minutes',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => {
    return process.env.NODE_ENV === 'development';
  },
});

// Rate limiting for general API endpoints (more permissive)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: (req: any, res: any) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again after 15 minutes',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => {
    return process.env.NODE_ENV === 'development';
  },
});

// Apply rate limiting based on request path
app.use((req: any, res: any, next: any) => {
  const isAuthPath = req.path.startsWith('/authentication') || req.path.includes('/auth');

  if (isAuthPath) {
    return authLimiter(req, res, next);
  } else {
    return apiLimiter(req, res, next);
  }
});

// Import services first
import configureUsersService from '@/services/users/users.service';
import configureSessionsService from '@/services/sessions/sessions.service';
import configureAuthentication from '@/services/authentication/authentication.service';
import configureEmailService from '@/services/email/email.service';
import configureParticipantService from '@/services/participants/participants.service';

// Set authentication configuration
app.set('authentication', {
  secret: process.env.AUTHENTICATION_SECRET || 'fallback-secret-key-for-development',
  authStrategies: ['jwt', 'local'],
  service: 'users',
  entity: 'user',
  entityId: 'id',
  local: {
    usernameField: 'email',
    passwordField: 'password',
  },
});

// Configure authentication service (includes password reset functionality)
import { sanitizeData } from '@/hooks/sanitize';

// Configure authentication service (includes password reset functionality)
configureAuthentication(app);

app.configure(configureEmailService);

app.configure(configureSessionsService);

app.configure(configureParticipantService);

app.configure(configureUsersService);

// Add global hooks
app.hooks({
  before: {
    // all: [sanitizeData()],
  },
});

import { errorRateCounter } from '@/opentelemetry'; // Import errorRateCounter
import prisma from '@/prisma'; // Import prisma

// Interface for health check response
interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: string;
    livekit: string;
    redis: string;
  };
}

// Health check endpoint
app.use('/health', async (req: any, res: any) => {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0', // Replace with actual version from package.json
    uptime: process.uptime(),
    services: {
      database: 'disconnected',
      livekit: 'disconnected',
      redis: 'disconnected',
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.services.database = 'connected';
  } catch (error) {
    healthStatus.status = 'unhealthy';
    healthStatus.services.database = 'disconnected';
    logger.error('Database health check failed', { error });
  }

  // LiveKit health check (assuming LiveKit server is accessible)
  try {
    const livekitUrl = process.env.LIVEKIT_WS_URL?.replace('ws', 'http') + '/api/health';
    if (livekitUrl) {
      const response = await fetch(livekitUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok') {
          healthStatus.services.livekit = 'connected';
        }
      }
    }
  } catch (error) {
    healthStatus.status = 'unhealthy';
    healthStatus.services.livekit = 'disconnected';
    logger.error('LiveKit health check failed', { error });
  }

  // Redis health check (assuming Redis is configured)
  try {
    // This is a placeholder. Actual Redis health check would involve pinging Redis.
    // For now, we'll assume it's connected if REDIS_URL is present.
    if (process.env.REDIS_URL) {
      healthStatus.services.redis = 'connected';
    }
  } catch (error) {
    healthStatus.status = 'unhealthy';
    healthStatus.services.redis = 'disconnected';
    logger.error('Redis health check failed', { error });
  }

  res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
});

// Configure error handler after services are set up
app.use((error: any, req: any, res: any, next: any) => {
  errorRateCounter.add(1, {
    method: req.method,
    path: req.path,
    statusCode: error.code || 500,
  });
  errorHandler()(error, req, res, next);
});

// Add logger to app context for services to use
app.set('logger', logger);

export default app;
