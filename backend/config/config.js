// config/config.js
require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  },

  // Database Configuration
  database: {
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp',
    options: {
      // Add any mongoose connection options here
    }
  },

  // Authentication Configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'supersecret',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10
  },

  // Security Configuration
  security: {
    // URL Risk Score Configuration
    urlRiskThreshold: parseInt(process.env.URL_RISK_THRESHOLD) || 70,
    
    // Request timeout for URL checking (in milliseconds)
    urlCheckTimeout: parseInt(process.env.URL_CHECK_TIMEOUT) || 1500,
    
    // Maximum URLs to check per message
    maxUrlsPerMessage: parseInt(process.env.MAX_URLS_PER_MESSAGE) || 5,

    // Blocked URL Database Configuration
    blockedUrls: {
      enabled: process.env.BLOCKED_URL_CACHE_ENABLED !== 'false', // Default to true
      maxEntries: parseInt(process.env.BLOCKED_URL_MAX_ENTRIES) || 10000, // Max URLs to store
      cleanupInterval: parseInt(process.env.BLOCKED_URL_CLEANUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
      autoCleanup: process.env.BLOCKED_URL_AUTO_CLEANUP !== 'false' // Auto cleanup old entries
    },

    // DLP (Data Leak Prevention) Configuration
    dlp: {
      enabled: process.env.DLP_ENABLED !== 'false', // Default to true unless explicitly disabled
      maxRetries: parseInt(process.env.DLP_MAX_RETRIES) || 5,
      baseDelay: parseInt(process.env.DLP_BASE_DELAY) || 1000 // milliseconds
    }
  },

  // External API Configuration
  apis: {
    // Google Gemini AI for DLP checking
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    },
    
    // VirusTotal for URL checking (optional)
    virustotal: {
      apiKey: process.env.VT_API_KEY // Optional
    },
    
    // URLHaus for malware URL checking (free, no key required)
    urlhaus: {
      apiUrl: process.env.URLHAUS_API || 'https://urlhaus.abuse.ch/api/v1/url/',
      timeout: parseInt(process.env.URLHAUS_TIMEOUT) || 2500
    }
  },

  // Chat Configuration
  chat: {
    // Maximum message length
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH) || 1000,
    
    // Rate limiting (messages per minute per user)
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      messagesPerMinute: parseInt(process.env.RATE_LIMIT_MESSAGES) || 30,
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000 // 1 minute
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info', // error, warn, info, debug
    logToFile: process.env.LOG_TO_FILE === 'true',
    logFilePath: process.env.LOG_FILE_PATH || './logs/app.log'
  },

  // Development/Production Configuration
  environment: process.env.NODE_ENV || 'development',
  
  // Feature Flags
  features: {
    userRegistration: process.env.FEATURE_USER_REGISTRATION !== 'false',
    roomCreation: process.env.FEATURE_ROOM_CREATION !== 'false',
    fileUpload: process.env.FEATURE_FILE_UPLOAD === 'true', // Default disabled
    emailNotifications: process.env.FEATURE_EMAIL_NOTIFICATIONS === 'true' // Default disabled
  }
};

// Validation function
function validateConfig() {
  const errors = [];

  // Check required environment variables
  if (!config.database.mongoUri) {
    errors.push('MONGO_URI is required');
  }

  if (config.security.dlp.enabled && !config.apis.gemini.apiKey) {
    errors.push('GEMINI_API_KEY is required when DLP is enabled');
  }

  if (config.auth.jwtSecret === 'supersecret' && config.environment === 'production') {
    errors.push('JWT_SECRET should be changed from default value in production');
  }

  if (errors.length > 0) {
    console.error('Configuration validation errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    
    if (config.environment === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Running with configuration warnings in development mode');
    }
  }
}

// Validate configuration on load
validateConfig();

module.exports = config;
