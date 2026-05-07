const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const expressWs = require('express-ws');
const Redis = require('redis');
const cron = require('node-cron');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const interactiveRoutes = require('./routes/interactive');
const realtimeRoutes = require('./routes/realtime');
const analyticsRoutes = require('./routes/analytics');
const workflowRoutes = require('./routes/workflow');
const collaborationRoutes = require('./routes/collaboration');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');

// Import services
const { initializeDatabase } = require('./config/database');
const { initializeSocketHandlers } = require('./services/socketService');
const { initializeRedis } = require('./services/redisService');
const { initializeJobQueue } = require('./services/queueService');
const { startCronJobs } = require('./services/cronService');

const app = express();
const server = createServer(app);

// Initialize WebSocket support
expressWs(app, server);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      mediaSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(morgan('combined'));

// Enhanced rate limiting with different tiers
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: message });
  }
});

// Different rate limits for different endpoints
app.use('/api/auth', createRateLimit(15 * 60 * 1000, 10, 'Too many authentication attempts'));
app.use('/api/upload', createRateLimit(60 * 1000, 5, 'Too many upload attempts'));
app.use('/api/', createRateLimit(15 * 60 * 1000, 200, 'Too many requests'));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3000",
      "https://localhost:3000"
    ];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      realtime: true,
      interactive: true,
      collaborative: true,
      analytics: true
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/interactive', authenticateToken, interactiveRoutes);
app.use('/api/realtime', authenticateToken, realtimeRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/workflow', authenticateToken, workflowRoutes);
app.use('/api/collaboration', authenticateToken, collaborationRoutes);

// WebSocket endpoint for real-time features
app.ws('/ws', (ws, req) => {
  console.log('WebSocket connection established');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      // Handle real-time messages
      handleWebSocketMessage(ws, data);
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Enhanced embedding endpoint with dynamic features
app.get('/embed', (req, res) => {
  const { token, dashboard, theme, features } = req.query;
  
  const enabledFeatures = features ? features.split(',') : ['basic'];
  const selectedTheme = theme || 'default';
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DDD Healthcare - Interactive Dashboard</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          margin: 0; 
          padding: 0; 
          font-family: 'Roboto', sans-serif;
          background: ${selectedTheme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
        }
        .embed-container {
          width: 100%;
          height: 100vh;
          position: relative;
          overflow: hidden;
        }
        .loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          background: ${selectedTheme === 'dark' ? '#2d2d2d' : '#ffffff'};
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #e0e0e0;
          border-top: 4px solid #1976d2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
          background: ${selectedTheme === 'dark' ? '#1a1a1a' : '#ffffff'};
        }
      </style>
    </head>
    <body>
      <div class="embed-container">
        <div class="loading" id="loading">
          <div class="spinner"></div>
        </div>
        <iframe 
          id="dashboard-frame"
          src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/${dashboard}?token=${token}&embedded=true&theme=${selectedTheme}&features=${enabledFeatures.join(',')}"
          style="display: none;"
          onload="document.getElementById('loading').style.display='none'; this.style.display='block';">
        </iframe>
      </div>
      
      <script>
        // Enhanced embedding features
        window.addEventListener('message', function(event) {
          const iframe = document.getElementById('dashboard-frame');
          
          if (event.data.type === 'resize') {
            iframe.style.height = event.data.height + 'px';
          } else if (event.data.type === 'theme-change') {
            document.body.style.background = event.data.background;
          } else if (event.data.type === 'notification') {
            // Handle embedded notifications
            console.log('Embedded notification:', event.data.message);
          }
        });
        
        // Auto-resize functionality
        function autoResize() {
          const iframe = document.getElementById('dashboard-frame');
          try {
            const height = iframe.contentWindow.document.body.scrollHeight;
            iframe.style.height = height + 'px';
          } catch (e) {
            // Cross-origin restrictions
          }
        }
        
        setInterval(autoResize, 1000);
      </script>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// WebSocket message handler
function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'subscribe':
      // Handle subscription to real-time updates
      ws.channel = data.channel;
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    case 'update':
      // Broadcast updates to all connected clients
      broadcastUpdate(data);
      break;
    default:
      console.log('Unknown WebSocket message type:', data.type);
  }
}

function broadcastUpdate(data) {
  // Broadcast to all WebSocket connections
  // Implementation depends on your specific needs
}

// Initialize services and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Initialize Redis
    await initializeRedis();
    console.log('Redis initialized successfully');
    
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Initialize job queue
    await initializeJobQueue();
    console.log('Job queue initialized successfully');
    
    // Initialize socket handlers
    initializeSocketHandlers(io);
    console.log('Socket.IO initialized successfully');
    
    // Start cron jobs
    startCronJobs();
    console.log('Cron jobs started successfully');
    
    server.listen(PORT, () => {
      console.log(`🚀 DDD Healthcare Interactive Server running on port ${PORT}`);
      console.log(`🌟 Features: Real-time, Interactive, Collaborative`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = { app, server, io };