const mongoose = require('mongoose');

const blockedUrlSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true,
    index: true // For fast lookups
  },
  normalizedUrl: {
    type: String,
    required: true,
    index: true // Store normalized version for consistent matching
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  detectionSource: {
    type: String,
    required: true,
    enum: ['heuristic', 'urlhaus', 'virustotal', 'combined'],
    default: 'combined'
  },
  reasons: [{
    type: String
  }],
  categories: [{
    type: String
  }],
  blockedCount: {
    type: Number,
    default: 1 // How many times this URL was blocked
  },
  firstDetected: {
    type: Date,
    default: Date.now
  },
  lastDetected: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true // Allow admins to disable certain blocked URLs
  },
  // Evidence from original detection
  evidence: {
    urlhaus: mongoose.Schema.Types.Mixed,
    virustotal: mongoose.Schema.Types.Mixed,
    heuristic: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
blockedUrlSchema.index({ normalizedUrl: 1, isActive: 1 });
blockedUrlSchema.index({ riskScore: -1, lastDetected: -1 });

// Instance method to increment block count
blockedUrlSchema.methods.incrementBlockCount = function() {
  this.blockedCount += 1;
  this.lastDetected = new Date();
  return this.save();
};

// Static method to find blocked URL
blockedUrlSchema.statics.findBlockedUrl = function(normalizedUrl) {
  return this.findOne({ 
    normalizedUrl: normalizedUrl,
    isActive: true 
  });
};

// Static method to add or update blocked URL
blockedUrlSchema.statics.addBlockedUrl = function(urlData) {
  return this.findOneAndUpdate(
    { normalizedUrl: urlData.normalizedUrl },
    {
      $set: {
        url: urlData.url,
        riskScore: urlData.riskScore,
        detectionSource: urlData.detectionSource,
        reasons: urlData.reasons,
        categories: urlData.categories,
        evidence: urlData.evidence,
        lastDetected: new Date(),
        isActive: true
      },
      $inc: { blockedCount: 1 },
      $setOnInsert: { firstDetected: new Date() }
    },
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  );
};

// Static method to get statistics
blockedUrlSchema.statics.getStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalBlocked: { $sum: 1 },
        totalBlockCount: { $sum: '$blockedCount' },
        avgRiskScore: { $avg: '$riskScore' },
        maxRiskScore: { $max: '$riskScore' },
        sources: { $addToSet: '$detectionSource' }
      }
    }
  ]);
};

module.exports = mongoose.model('BlockedUrl', blockedUrlSchema);
