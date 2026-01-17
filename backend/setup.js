#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnvironment() {
  console.log(colorize('\n🚀 Chat Application Setup Wizard', 'cyan'));
  console.log(colorize('=====================================\n', 'cyan'));

  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, 'env.example');

  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    const overwrite = await question(colorize('📋 .env file already exists. Overwrite? (y/N): ', 'yellow'));
    if (overwrite.toLowerCase() !== 'y') {
      console.log(colorize('✅ Setup cancelled. Using existing .env file.', 'green'));
      rl.close();
      return;
    }
  }

  // Copy from example if it exists
  let envContent = '';
  if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
  }

  console.log(colorize('\n📝 Let\'s configure your application:\n', 'blue'));

  // Collect configuration
  const config = {};

  // Server Configuration
  console.log(colorize('🖥️  Server Configuration:', 'magenta'));
  config.PORT = await question('   Port (default: 3000): ') || '3000';
  config.HOST = await question('   Host (default: 0.0.0.0): ') || '0.0.0.0';
  config.CORS_ORIGIN = await question('   CORS Origin (default: *): ') || '*';

  // Database Configuration
  console.log(colorize('\n💾 Database Configuration:', 'magenta'));
  const useLocal = await question('   Use local MongoDB? (Y/n): ');
  if (useLocal.toLowerCase() === 'n') {
    config.MONGO_URI = await question('   MongoDB URI: ');
  } else {
    const dbName = await question('   Database name (default: chatapp): ') || 'chatapp';
    config.MONGO_URI = `mongodb://localhost:27017/${dbName}`;
  }

  // Security Configuration
  console.log(colorize('\n🔐 Security Configuration:', 'magenta'));
  config.JWT_SECRET = await question('   JWT Secret (leave empty for auto-generate): ');
  if (!config.JWT_SECRET) {
    config.JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
    console.log(colorize(`   ✅ Generated JWT Secret: ${config.JWT_SECRET.substring(0, 20)}...`, 'green'));
  }

  config.URL_RISK_THRESHOLD = await question('   URL Risk Threshold (default: 70, range: 0-100): ') || '70';

  // API Keys
  console.log(colorize('\n🔑 API Keys:', 'magenta'));
  config.GEMINI_API_KEY = await question('   Gemini API Key (required for DLP): ');
  config.VT_API_KEY = await question('   VirusTotal API Key (optional): ') || '';

  // Environment
  console.log(colorize('\n🌍 Environment:', 'magenta'));
  const isDev = await question('   Development environment? (Y/n): ');
  config.NODE_ENV = isDev.toLowerCase() === 'n' ? 'production' : 'development';

  // Generate .env content
  let newEnvContent = '';
  for (const [key, value] of Object.entries(config)) {
    newEnvContent += `${key}=${value}\n`;
  }

  // Add optional configurations with defaults
  newEnvContent += `
# Additional Configuration (with defaults)
JWT_EXPIRATION=24h
BCRYPT_SALT_ROUNDS=10
URL_CHECK_TIMEOUT=1500
MAX_URLS_PER_MESSAGE=5
DLP_ENABLED=true
DLP_MAX_RETRIES=5
DLP_BASE_DELAY=1000
GEMINI_MODEL=gemini-1.5-flash
URLHAUS_API=https://urlhaus.abuse.ch/api/v1/url/
URLHAUS_TIMEOUT=2500
MAX_MESSAGE_LENGTH=1000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MESSAGES=30
RATE_LIMIT_WINDOW=60000
LOG_LEVEL=info
LOG_TO_FILE=false
LOG_FILE_PATH=./logs/app.log
FEATURE_USER_REGISTRATION=true
FEATURE_ROOM_CREATION=true
FEATURE_FILE_UPLOAD=false
FEATURE_EMAIL_NOTIFICATIONS=false
`;

  // Write .env file
  fs.writeFileSync(envPath, newEnvContent);

  console.log(colorize('\n✅ Configuration complete!', 'green'));
  console.log(colorize('📄 .env file created successfully', 'green'));

  // Validate configuration
  console.log(colorize('\n🔍 Validating configuration...', 'yellow'));
  try {
    require('./config/config');
    console.log(colorize('✅ Configuration is valid!', 'green'));
  } catch (error) {
    console.log(colorize(`❌ Configuration error: ${error.message}`, 'red'));
  }

  // Check database connection
  if (config.MONGO_URI) {
    console.log(colorize('\n🔌 Testing database connection...', 'yellow'));
    try {
      const connectDB = require('./db');
      await connectDB();
      console.log(colorize('✅ Database connection successful!', 'green'));
    } catch (error) {
      console.log(colorize(`❌ Database connection failed: ${error.message}`, 'red'));
      console.log(colorize('   Make sure MongoDB is running', 'yellow'));
    }
  }

  console.log(colorize('\n🎉 Setup complete! You can now run:', 'cyan'));
  console.log(colorize('   npm run dev   (for development)', 'bright'));
  console.log(colorize('   npm start     (for production)', 'bright'));
  console.log(colorize('\n📚 Check the SETUP.md file for more information', 'blue'));

  rl.close();
}

// Handle errors gracefully
process.on('SIGINT', () => {
  console.log(colorize('\n\n👋 Setup cancelled by user', 'yellow'));
  rl.close();
  process.exit(0);
});

setupEnvironment().catch((error) => {
  console.error(colorize(`\n❌ Setup failed: ${error.message}`, 'red'));
  rl.close();
  process.exit(1);
});
