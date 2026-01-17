#!/usr/bin/env node

/**
 * Admin Configuration Tool
 * 
 * Quick tool for administrators to change common settings without editing .env directly
 * Usage: node admin-config.js
 */

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

function readEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found. Run "npm run setup" first.');
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  return { envVars, envContent };
}

function writeEnvFile(envContent) {
  const envPath = path.join(__dirname, '.env');
  fs.writeFileSync(envPath, envContent);
}

function updateEnvVar(envContent, key, newValue) {
  const lines = envContent.split('\n');
  let updated = false;
  
  const updatedLines = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${newValue}`;
    }
    return line;
  });
  
  if (!updated) {
    updatedLines.push(`${key}=${newValue}`);
  }
  
  return updatedLines.join('\n');
}

async function adminConfig() {
  console.log(colorize('\n🔧 Admin Configuration Tool', 'cyan'));
  console.log(colorize('=================================\n', 'cyan'));

  try {
    const { envVars, envContent } = readEnvFile();
    let updatedContent = envContent;

    // Display current settings
    console.log(colorize('📊 Current Security Settings:', 'blue'));
    console.log(`   URL Risk Threshold: ${colorize(envVars.URL_RISK_THRESHOLD || '70', 'bright')}`);
    console.log(`   DLP Enabled: ${colorize(envVars.DLP_ENABLED || 'true', 'bright')}`);
    console.log(`   Rate Limit Messages: ${colorize(envVars.RATE_LIMIT_MESSAGES || '30', 'bright')}`);
    console.log(`   Max Message Length: ${colorize(envVars.MAX_MESSAGE_LENGTH || '1000', 'bright')}`);
    console.log('');

    while (true) {
      console.log(colorize('🎛️  What would you like to configure?', 'magenta'));
      console.log('   1. URL Risk Threshold (currently: ' + (envVars.URL_RISK_THRESHOLD || '70') + ')');
      console.log('   2. Rate Limiting (messages per minute)');
      console.log('   3. Maximum Message Length');
      console.log('   4. Enable/Disable DLP');
      console.log('   5. Enable/Disable Rate Limiting');
      console.log('   6. View Current Configuration');
      console.log('   7. Blocked URL Management');
      console.log('   8. Exit');
      console.log('');

      const choice = await question(colorize('Select option (1-8): ', 'yellow'));

      switch (choice) {
        case '1':
          console.log('\n' + colorize('🎯 URL Risk Threshold Configuration', 'cyan'));
          console.log('This controls when messages with URLs are blocked:');
          console.log('  • 0-30: Very permissive (allows most URLs)');
          console.log('  • 40-60: Moderate protection');
          console.log('  • 70-80: High protection (recommended)');
          console.log('  • 80-100: Maximum protection');
          console.log('');
          
          const newThreshold = await question('Enter new threshold (0-100): ');
          const threshold = parseInt(newThreshold);
          
          if (isNaN(threshold) || threshold < 0 || threshold > 100) {
            console.log(colorize('❌ Invalid threshold. Must be between 0 and 100.', 'red'));
            break;
          }
          
          updatedContent = updateEnvVar(updatedContent, 'URL_RISK_THRESHOLD', threshold.toString());
          console.log(colorize(`✅ URL Risk Threshold updated to ${threshold}`, 'green'));
          break;

        case '2':
          console.log('\n' + colorize('⏱️  Rate Limiting Configuration', 'cyan'));
          const newRateLimit = await question('Messages per minute per user (current: ' + (envVars.RATE_LIMIT_MESSAGES || '30') + '): ');
          const rateLimit = parseInt(newRateLimit);
          
          if (isNaN(rateLimit) || rateLimit < 1) {
            console.log(colorize('❌ Invalid rate limit. Must be a positive number.', 'red'));
            break;
          }
          
          updatedContent = updateEnvVar(updatedContent, 'RATE_LIMIT_MESSAGES', rateLimit.toString());
          console.log(colorize(`✅ Rate limit updated to ${rateLimit} messages per minute`, 'green'));
          break;

        case '3':
          console.log('\n' + colorize('📝 Message Length Configuration', 'cyan'));
          const newMaxLength = await question('Maximum message length (current: ' + (envVars.MAX_MESSAGE_LENGTH || '1000') + '): ');
          const maxLength = parseInt(newMaxLength);
          
          if (isNaN(maxLength) || maxLength < 1) {
            console.log(colorize('❌ Invalid length. Must be a positive number.', 'red'));
            break;
          }
          
          updatedContent = updateEnvVar(updatedContent, 'MAX_MESSAGE_LENGTH', maxLength.toString());
          console.log(colorize(`✅ Maximum message length updated to ${maxLength} characters`, 'green'));
          break;

        case '4':
          console.log('\n' + colorize('🛡️  Data Leak Prevention (DLP)', 'cyan'));
          const enableDLP = await question('Enable DLP? (y/n, current: ' + (envVars.DLP_ENABLED || 'true') + '): ');
          const dlpEnabled = enableDLP.toLowerCase() === 'y' || enableDLP.toLowerCase() === 'yes';
          
          updatedContent = updateEnvVar(updatedContent, 'DLP_ENABLED', dlpEnabled.toString());
          console.log(colorize(`✅ DLP ${dlpEnabled ? 'enabled' : 'disabled'}`, 'green'));
          break;

        case '5':
          console.log('\n' + colorize('🚦 Rate Limiting', 'cyan'));
          const enableRate = await question('Enable rate limiting? (y/n, current: ' + (envVars.RATE_LIMIT_ENABLED || 'true') + '): ');
          const rateEnabled = enableRate.toLowerCase() === 'y' || enableRate.toLowerCase() === 'yes';
          
          updatedContent = updateEnvVar(updatedContent, 'RATE_LIMIT_ENABLED', rateEnabled.toString());
          console.log(colorize(`✅ Rate limiting ${rateEnabled ? 'enabled' : 'disabled'}`, 'green'));
          break;

        case '6':
          console.log('\n' + colorize('📋 Current Configuration:', 'blue'));
          try {
            const config = require('./config/config');
            console.log('   Server Port:', colorize(config.server.port, 'bright'));
            console.log('   Environment:', colorize(config.environment, 'bright'));
            console.log('   URL Risk Threshold:', colorize(config.security.urlRiskThreshold, 'bright'));
            console.log('   DLP Enabled:', colorize(config.security.dlp.enabled, 'bright'));
            console.log('   Rate Limiting:', colorize(config.chat.rateLimit.enabled, 'bright'));
            console.log('   Max Message Length:', colorize(config.chat.maxMessageLength, 'bright'));
          } catch (error) {
            console.log(colorize('❌ Error loading configuration: ' + error.message, 'red'));
          }
          break;

        case '7':
          console.log('\n' + colorize('🚫 Blocked URL Management', 'cyan'));
          try {
            const BlockedUrl = require('./models/BlockedUrl');
            
            console.log('   a. View blocked URL statistics');
            console.log('   b. List recent blocked URLs');
            console.log('   c. Remove a blocked URL');
            console.log('   d. Clear all blocked URLs');
            console.log('   e. Back to main menu');
            
            const urlChoice = await question(colorize('Select option (a-e): ', 'yellow'));
            
            switch (urlChoice) {
              case 'a':
                const stats = await BlockedUrl.getStats();
                if (stats.length > 0) {
                  const s = stats[0];
                  console.log(colorize('\n📊 Blocked URL Statistics:', 'blue'));
                  console.log(`   Total blocked URLs: ${colorize(s.totalBlocked || 0, 'bright')}`);
                  console.log(`   Total blocks: ${colorize(s.totalBlockCount || 0, 'bright')}`);
                  console.log(`   Average risk score: ${colorize((s.avgRiskScore || 0).toFixed(1), 'bright')}`);
                  console.log(`   Max risk score: ${colorize(s.maxRiskScore || 0, 'bright')}`);
                  console.log(`   Detection sources: ${colorize((s.sources || []).join(', '), 'bright')}`);
                } else {
                  console.log(colorize('   No blocked URLs found', 'yellow'));
                }
                break;
                
              case 'b':
                const recentUrls = await BlockedUrl.find({ isActive: true })
                  .sort({ lastDetected: -1 })
                  .limit(10)
                  .select('url riskScore blockedCount lastDetected');
                  
                if (recentUrls.length > 0) {
                  console.log(colorize('\n🔗 Recent Blocked URLs:', 'blue'));
                  recentUrls.forEach((url, i) => {
                    console.log(`   ${i + 1}. ${url.url}`);
                    console.log(`      Score: ${url.riskScore}, Blocked: ${url.blockedCount} times`);
                    console.log(`      Last: ${url.lastDetected.toLocaleDateString()}`);
                  });
                } else {
                  console.log(colorize('   No blocked URLs found', 'yellow'));
                }
                break;
                
              case 'c':
                const urlToRemove = await question('Enter URL to remove from blocked list: ');
                if (urlToRemove) {
                  const removed = await BlockedUrl.findOneAndUpdate(
                    { $or: [{ url: urlToRemove }, { normalizedUrl: urlToRemove }] },
                    { isActive: false }
                  );
                  if (removed) {
                    console.log(colorize(`✅ Removed ${urlToRemove} from blocked list`, 'green'));
                  } else {
                    console.log(colorize(`❌ URL not found in blocked list`, 'red'));
                  }
                }
                break;
                
              case 'd':
                const confirm = await question(colorize('⚠️  Are you sure you want to clear ALL blocked URLs? (type "yes" to confirm): ', 'red'));
                if (confirm.toLowerCase() === 'yes') {
                  const result = await BlockedUrl.updateMany({ isActive: true }, { isActive: false });
                  console.log(colorize(`✅ Cleared ${result.modifiedCount} blocked URLs`, 'green'));
                } else {
                  console.log(colorize('Operation cancelled', 'yellow'));
                }
                break;
                
              case 'e':
                break;
                
              default:
                console.log(colorize('❌ Invalid option.', 'red'));
            }
          } catch (error) {
            console.log(colorize(`❌ Error accessing blocked URLs: ${error.message}`, 'red'));
          }
          break;

        case '8':
          // Save changes and exit
          if (updatedContent !== envContent) {
            writeEnvFile(updatedContent);
            console.log(colorize('\n✅ Configuration saved successfully!', 'green'));
            console.log(colorize('🔄 Restart the application to apply changes:', 'yellow'));
            console.log(colorize('   npm run dev  (development)', 'bright'));
            console.log(colorize('   pm2 restart chat-app  (production)', 'bright'));
          } else {
            console.log(colorize('\n📝 No changes made.', 'yellow'));
          }
          rl.close();
          return;

        default:
          console.log(colorize('❌ Invalid option. Please select 1-7.', 'red'));
      }
      
      console.log(''); // Empty line for readability
    }

  } catch (error) {
    console.error(colorize(`❌ Error: ${error.message}`, 'red'));
    rl.close();
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(colorize('\n\n👋 Configuration cancelled by user', 'yellow'));
  rl.close();
  process.exit(0);
});

adminConfig().catch((error) => {
  console.error(colorize(`❌ Setup failed: ${error.message}`, 'red'));
  rl.close();
  process.exit(1);
});
