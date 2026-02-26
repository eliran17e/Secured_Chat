const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const BlockedUrl = require('../models/BlockedUrl');

// Middleware to check admin role
exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Get current configuration
exports.getConfig = async (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        urlRiskThreshold: config.security.urlRiskThreshold,
        dlpEnabled: config.security.dlp.enabled,
        dlpMaxRetries: config.security.dlp.maxRetries,
        dlpBaseDelay: config.security.dlp.baseDelay,
        dlpThreshold: config.security.dlp.threshold,
        blockedUrlCacheEnabled: config.security.blockedUrls.enabled,
        maxUrlsPerMessage: config.security.maxUrlsPerMessage,
        urlCheckTimeout: config.security.urlCheckTimeout,
        rateLimitEnabled: config.chat.rateLimit.enabled,
        rateLimitMessages: config.chat.rateLimit.messagesPerMinute,
        maxMessageLength: config.chat.maxMessageLength
      }
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ message: 'Failed to get configuration' });
  }
};

// Update environment variable in .env file
function updateEnvVariable(key, value) {
  const envPath = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found');
  }
  
  let envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  let updated = false;
  
  // Update existing line or add new one
  const updatedLines = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });
  
  if (!updated) {
    updatedLines.push(`${key}=${value}`);
  }
  
  fs.writeFileSync(envPath, updatedLines.join('\n'));
}

// Update URL risk threshold
exports.updateUrlThreshold = async (req, res) => {
  try {
    const { threshold } = req.body;
    
    // Validate threshold
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      return res.status(400).json({ 
        message: 'Threshold must be a number between 0 and 100' 
      });
    }
    
    // Update .env file
    updateEnvVariable('URL_RISK_THRESHOLD', threshold);
    
    // Update in-memory config (note: requires restart for full effect)
    config.security.urlRiskThreshold = threshold;
    
    console.log(`Admin ${req.user.name} updated URL risk threshold to ${threshold}`);
    
    res.json({
      success: true,
      message: 'URL risk threshold updated successfully',
      newThreshold: threshold,
      note: 'Server restart recommended for all changes to take effect'
    });
  } catch (error) {
    console.error('Error updating URL threshold:', error);
    res.status(500).json({ message: 'Failed to update URL threshold' });
  }
};

// Update DLP configuration
exports.updateDlpConfig = async (req, res) => {
  try {
    const { enabled, maxRetries, baseDelay, threshold } = req.body;
    const updates = {};
    
    // Validate and update each field
    if (typeof enabled === 'boolean') {
      updateEnvVariable('DLP_ENABLED', enabled.toString());
      config.security.dlp.enabled = enabled;
      updates.enabled = enabled;
    }
    
    if (typeof maxRetries === 'number' && maxRetries > 0 && maxRetries <= 10) {
      updateEnvVariable('DLP_MAX_RETRIES', maxRetries);
      config.security.dlp.maxRetries = maxRetries;
      updates.maxRetries = maxRetries;
    } else if (maxRetries !== undefined) {
      return res.status(400).json({ 
        message: 'maxRetries must be a number between 1 and 10' 
      });
    }
    
    if (typeof baseDelay === 'number' && baseDelay >= 500 && baseDelay <= 10000) {
      updateEnvVariable('DLP_BASE_DELAY', baseDelay);
      config.security.dlp.baseDelay = baseDelay;
      updates.baseDelay = baseDelay;
    } else if (baseDelay !== undefined) {
      return res.status(400).json({ 
        message: 'baseDelay must be a number between 500 and 10000 milliseconds' 
      });
    }
    
    if (typeof threshold === 'number' && threshold >= 0.0 && threshold <= 1.0) {
      updateEnvVariable('DLP_THRESHOLD', threshold);
      config.security.dlp.threshold = threshold;
      updates.threshold = threshold;
    } else if (threshold !== undefined) {
      return res.status(400).json({ 
        message: 'threshold must be a number between 0.0 and 1.0' 
      });
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        message: 'No valid updates provided' 
      });
    }
    
    console.log(`Admin ${req.user.name} updated DLP config:`, updates);
    
    res.json({
      success: true,
      message: 'DLP configuration updated successfully',
      updates,
      note: 'Server restart recommended for all changes to take effect'
    });
  } catch (error) {
    console.error('Error updating DLP config:', error);
    res.status(500).json({ message: 'Failed to update DLP configuration' });
  }
};

// Get blocked URL statistics
exports.getBlockedUrlStats = async (req, res) => {
  try {
    const stats = await BlockedUrl.getStats();
    const totalUrls = await BlockedUrl.countDocuments({ isActive: true });
    
    res.json({
      success: true,
      stats: stats.length > 0 ? {
        ...stats[0],
        totalUrls
      } : {
        totalBlocked: 0,
        totalBlockCount: 0,
        avgRiskScore: 0,
        maxRiskScore: 0,
        sources: [],
        totalUrls: 0
      }
    });
  } catch (error) {
    console.error('Error getting blocked URL stats:', error);
    res.status(500).json({ message: 'Failed to get blocked URL statistics' });
  }
};

// Get recent blocked URLs
exports.getRecentBlockedUrls = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recentUrls = await BlockedUrl.find({ isActive: true })
      .sort({ lastDetected: -1 })
      .limit(limit)
      .select('url normalizedUrl riskScore blockedCount lastDetected detectionSource reasons');
    
    res.json({
      success: true,
      urls: recentUrls
    });
  } catch (error) {
    console.error('Error getting recent blocked URLs:', error);
    res.status(500).json({ message: 'Failed to get recent blocked URLs' });
  }
};

// Remove blocked URL
exports.removeBlockedUrl = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await BlockedUrl.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!result) {
      return res.status(404).json({ message: 'Blocked URL not found' });
    }
    
    console.log(`Admin ${req.user.name} removed blocked URL: ${result.url}`);
    
    res.json({
      success: true,
      message: 'Blocked URL removed successfully',
      url: result.url
    });
  } catch (error) {
    console.error('Error removing blocked URL:', error);
    res.status(500).json({ message: 'Failed to remove blocked URL' });
  }
};

// Clear all blocked URLs
exports.clearBlockedUrls = async (req, res) => {
  try {
    const result = await BlockedUrl.updateMany(
      { isActive: true },
      { isActive: false }
    );
    
    console.log(`Admin ${req.user.name} cleared ${result.modifiedCount} blocked URLs`);
    
    res.json({
      success: true,
      message: `Cleared ${result.modifiedCount} blocked URLs`,
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error clearing blocked URLs:', error);
    res.status(500).json({ message: 'Failed to clear blocked URLs' });
  }
};