// utils/urlChecker.js  (CommonJS)
const config = require('../config/config');
const BlockedUrl = require('../models/BlockedUrl');

const URLHAUS_API = config.apis.urlhaus.apiUrl;
const REQUEST_TIMEOUT_MS = config.security.urlCheckTimeout;
const VT_API_KEY = config.apis.virustotal.apiKey;

function withTimeout(promiseFactory, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return promiseFactory(controller.signal)
    .finally(() => clearTimeout(t));
}

function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function isIpLiteral(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

// --- Enhanced Heuristics ---
function heuristicCheck(url) {
  let reasons = [], risk = 0;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // High-risk indicators (more aggressive scoring)
    if (isIpLiteral(host)) { risk += 40; reasons.push("IP literal host"); }
    if (host.split(".").length > 4) { risk += 30; reasons.push("too many subdomains"); }
    
    // Suspicious TLDs
    if (/\.(tk|ml|ga|cf|top|click|download|loan|faith|accountant|science|date|racing)$/.test(host)) {
      risk += 35; reasons.push("suspicious TLD");
    }

    // Suspicious patterns in domain (avoid false positive for google.com)
    if (/\b(secure|login|bank|paypal|amazon|microsoft|apple|facebook)\b/.test(host) && 
        !/\.(paypal|amazon|microsoft|apple|google|facebook)\.com$/.test(host)) {
      risk += 50; reasons.push("domain spoofing attempt");
    }
    
    // Special case for google - only flag if it's not the real google.com
    if (/\bgoogle\b/.test(host) && !/^(www\.)?google\.com$/.test(host)) {
      risk += 50; reasons.push("potential Google spoofing");
    }

    // URL shorteners (can hide malicious content)
    if (/\b(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly)\b/.test(host)) {
      risk += 25; reasons.push("URL shortener");
    }

    // Suspicious file extensions
    if (/\.(exe|scr|bat|cmd|com|pif|vbs|jar|apk|dmg)$/i.test(path)) {
      risk += 45; reasons.push("dangerous file extension");
    }

    // Suspicious keywords in URL
    if (/\b(phishing|malware|virus|hack|crack|keygen|torrent|warez)\b/.test(fullUrl)) {
      risk += 40; reasons.push("suspicious keywords");
    }

    // Long URLs (often used to hide content)
    if (url.length > 200) { risk += 20; reasons.push("very long URL"); }
    else if (url.length > 100) { risk += 10; reasons.push("long URL"); }

    // Suspicious ports
    if (u.port && !["80","443","8080","8443"].includes(u.port)) {
      risk += 25; reasons.push(`suspicious port :${u.port}`);
    }

    // Too many dashes or numbers in domain
    if ((host.match(/-/g) || []).length > 3) { risk += 15; reasons.push("many dashes in domain"); }
    if ((host.match(/\d/g) || []).length > 5) { risk += 20; reasons.push("many numbers in domain"); }

    // Suspicious query parameters
    if (/(\?|&)(redirect|url|goto|link|redir)=http/i.test(url)) {
      risk += 30; reasons.push("suspicious redirect parameter");
    }

    return { risk, reasons };
  } catch {
    return { risk: 80, reasons: ["invalid URL"] };
  }
}

// --- URLHaus lookup (free, no key) ---
async function urlhausCheck(url) {
  try {
    const body = new URLSearchParams({ url });
    const res = await withTimeout(
      (signal) => fetch(URLHAUS_API, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal
      }), REQUEST_TIMEOUT_MS
    );
    if (!res.ok) return { listed: false };
    const data = await res.json();
    if (data.query_status === "ok") {
      return { listed: true, status: data.url_status, data };
    }
    return { listed: false };
  } catch {
    return { listed: false };
  }
}

// --- VirusTotal helper: base64url(URL) for /urls/{id} ---
function toBase64Url(s) {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// --- VirusTotal lookup (optional; provides categories) ---
async function vtLookup(url) {
  if (!VT_API_KEY) return { enabled: false, listed: false };

  const headers = { "x-apikey": VT_API_KEY };

  try {
    // 1) Submit URL (creates/refreshes analysis)
    await withTimeout(
      (signal) => fetch("https://www.virustotal.com/api/v3/urls", {
        method: "POST",
        headers: { ...headers, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url }),
        signal
      }),
      2500
    ).catch(() => null); // ignore failures here; we'll still try to read the URL object

    // 2) Read URL object (contains categories + last_analysis_stats)
    const id = toBase64Url(url);
    const res = await withTimeout(
      (signal) => fetch(`https://www.virustotal.com/api/v3/urls/${id}`, { headers, signal }),
      2500
    );
    if (!res.ok) return { enabled: true, listed: false };

    const j = await res.json();
    const attr = j?.data?.attributes || {};
    const stats = attr.last_analysis_stats || {};
    const detections = (stats.malicious || 0) + (stats.suspicious || 0);

    // categories is an object like { "BitDefender": "phishing", "Sophos": "malware" }
    const categoriesMap = attr.categories || {};
    const categories = [...new Set(Object.values(categoriesMap || {}))];

    return {
      enabled: true,
      listed: detections > 0,
      detections,
      stats,
      categories,        // ← what you want to show in UI
      raw_categories: categoriesMap
    };
  } catch {
    return { enabled: true, listed: false };
  }
}

function verdictFrom(score) {
  if (score >= 60) return "malicious";        // Lower threshold for malicious
  if (score >= 35) return "suspicious";       // Lower threshold for suspicious  
  if (score >= 15) return "potentially_risky"; // New category for moderate risk
  if (score >= 5) return "likely_clean";      // Sites with minor issues
  return "clean";                             // Very low risk sites
}

// --- Database Check ---
async function checkBlockedDatabase(normalizedUrl) {
  try {
    const blockedUrl = await BlockedUrl.findBlockedUrl(normalizedUrl);
    if (blockedUrl) {
      // Update block count and last detected time
      await blockedUrl.incrementBlockCount();
      
      console.log(`🚫 URL found in blocked database: ${normalizedUrl} (blocked ${blockedUrl.blockedCount} times)`);
      
      return {
        blocked: true,
        source: 'database',
        data: {
          url: blockedUrl.url,
          normalizedUrl: blockedUrl.normalizedUrl,
          riskScore: blockedUrl.riskScore,
          reasons: blockedUrl.reasons,
          categories: blockedUrl.categories,
          detectionSource: blockedUrl.detectionSource,
          blockedCount: blockedUrl.blockedCount,
          firstDetected: blockedUrl.firstDetected,
          lastDetected: blockedUrl.lastDetected
        }
      };
    }
    return { blocked: false };
  } catch (error) {
    console.error('Error checking blocked URL database:', error);
    return { blocked: false }; // Don't block if database check fails
  }
}

// --- Save Blocked URL to Database ---
async function saveBlockedUrl(urlResult) {
  try {
    if (urlResult.score >= config.security.urlRiskThreshold) {
      const urlData = {
        url: urlResult.input,
        normalizedUrl: urlResult.url,
        riskScore: urlResult.score,
        detectionSource: getDetectionSource(urlResult),
        reasons: urlResult.reasons,
        categories: urlResult.categories || [],
        evidence: urlResult.evidence
      };
      
      await BlockedUrl.addBlockedUrl(urlData);
      console.log(`💾 Saved blocked URL to database: ${urlData.normalizedUrl} (score: ${urlData.riskScore})`);
    }
  } catch (error) {
    console.error('Error saving blocked URL to database:', error);
    // Don't throw - this shouldn't prevent the original blocking
  }
}

function getDetectionSource(urlResult) {
  const sources = [];
  if (urlResult.evidence?.urlhaus?.listed) sources.push('urlhaus');
  if (urlResult.evidence?.virustotal?.listed) sources.push('virustotal');
  if (urlResult.reasons?.some(r => r.includes('heuristic') || !r.includes('URLHaus') && !r.includes('VirusTotal'))) {
    sources.push('heuristic');
  }
  return sources.length > 1 ? 'combined' : sources[0] || 'heuristic';
}

// --- Public API ---
async function checkUrl(rawUrl) {
  const norm = normalizeUrl(rawUrl);
  if (!norm) {
    return { input: rawUrl, url: rawUrl, verdict: "malicious", score: 90, reasons: ["invalid URL"], evidence: {} };
  }

  // 🚫 FIRST: Check if URL is already in blocked database (if enabled)
  if (config.security.blockedUrls.enabled) {
    const dbCheck = await checkBlockedDatabase(norm);
    if (dbCheck.blocked) {
      return {
        input: rawUrl,
        url: norm,
        verdict: verdictFrom(dbCheck.data.riskScore),
        score: dbCheck.data.riskScore,
        reasons: [...dbCheck.data.reasons, `Previously blocked (${dbCheck.data.blockedCount} times)`],
        categories: dbCheck.data.categories,
        evidence: { database: dbCheck.data, source: 'database' },
        fromDatabase: true // Flag to indicate this came from cache
      };
    }
  }

  // If not in database, proceed with normal checks
  const h = heuristicCheck(norm);
  const [uh, vt] = await Promise.all([urlhausCheck(norm), vtLookup(norm)]);

  let score = h.risk;
  const reasons = [...h.reasons];
  const categories = [];

  // Give high weight to threat intelligence sources
  if (uh.listed) { 
    score += 80; // Increased from 70
    reasons.push(`URLHaus: ${uh.status}`); 
  }
  
  if (vt.enabled) {
    if (vt.listed) { 
      // Scale VirusTotal score based on number of detections
      const vtScore = Math.min(80, 30 + (vt.detections * 5)); // 30-80 range
      score += vtScore; 
      reasons.push(`VirusTotal detections: ${vt.detections}`); 
    }
    if (vt.categories?.length) {
      categories.push(...vt.categories);
      // Add score for malicious categories
      const maliciousCategories = vt.categories.filter(cat => 
        /phishing|malware|suspicious|trojan|virus/i.test(cat)
      );
      if (maliciousCategories.length > 0) {
        score += maliciousCategories.length * 15;
        reasons.push(`malicious categories: ${maliciousCategories.join(', ')}`);
      }
    }
  }

  const verdict = verdictFrom(score);

  const result = {
    input: rawUrl,
    url: norm,
    verdict,
    score,
    reasons,
    categories,                 // ← expose categories
    evidence: { urlhaus: uh, virustotal: vt }
  };

  // 💾 Save to database if malicious (async, don't wait) - only if caching enabled
  if (config.security.blockedUrls.enabled && score >= config.security.urlRiskThreshold) {
    saveBlockedUrl(result).catch(err => {
      console.error('Failed to save blocked URL:', err);
    });
  }

  return result;
}

function extractUrls(text) {
  const urls = [];

  // Normalize spaces around dots in domain-like patterns
  const normalizedText = text.replace(/\s*\.\s*/g, ".");

  // 1. Find URLs with protocols
  const protocolRegex = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
  const protocolUrls = normalizedText.match(protocolRegex) || [];
  urls.push(...protocolUrls);

  // 2. Find www.* URLs
  const wwwRegex = /\bwww\.[^\s<>"')\]]+/gi;
  const wwwUrls = normalizedText.match(wwwRegex) || [];
  urls.push(...wwwUrls.map(url => 'http://' + url));

  // 3. Find domain patterns (domain.tld)
  const domainRegex = /\b[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})\b/g;
  const words = normalizedText.split(/\s+/);

  for (const word of words) {
    if (protocolUrls.some(url => url.includes(word)) ||
        wwwUrls.some(url => url.includes(word))) {
      continue;
    }

    if (domainRegex.test(word)) {
      if (/\.(com|org|net|edu|gov|mil|int|tk|ml|ga|cf|top|click|download|loan|faith|accountant|science|date|racing|exe|scr|bat)$/i.test(word)) {
        urls.push('http://' + word);
      }
    }
    domainRegex.lastIndex = 0;
  }

  return [...new Set(urls)];
}

async function checkMessageUrls(text) {
  const urls = extractUrls(text).slice(0, config.security.maxUrlsPerMessage);
  const results = await Promise.all(urls.map((u) => checkUrl(u)));
  return results;
}

module.exports = {
  normalizeUrl,
  heuristicCheck,
  urlhausCheck,
  vtLookup,
  checkUrl,
  extractUrls,
  checkMessageUrls,
  checkBlockedDatabase,
  saveBlockedUrl
};
