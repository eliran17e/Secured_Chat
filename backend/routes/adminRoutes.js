const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middlewares/authMiddleware");

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(adminController.requireAdmin);

// Get current configuration
router.get("/config", adminController.getConfig);

// Update URL risk threshold
router.put("/config/url-threshold", adminController.updateUrlThreshold);

// Update DLP settings
router.put("/config/dlp", adminController.updateDlpConfig);

// Get blocked URL statistics
router.get("/blocked-urls/stats", adminController.getBlockedUrlStats);

// Get recent blocked URLs
router.get("/blocked-urls/recent", adminController.getRecentBlockedUrls);

// Remove blocked URL
router.delete("/blocked-urls/:id", adminController.removeBlockedUrl);

// Clear all blocked URLs
router.delete("/blocked-urls", adminController.clearBlockedUrls);

module.exports = router;