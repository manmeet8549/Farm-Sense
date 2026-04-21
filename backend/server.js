// ═══════════════════════════════════════════════════════════════
// FarmSense AI — Backend API Server (v2.0)
// Express + Firebase Admin + NVIDIA AI + OpenWeatherMap
// ═══════════════════════════════════════════════════════════════
// Improvements: Security, User-Scoped Data, History, Smart Irrigation,
// Error Handling, Multilingual AI, Weather Cache, Structured Logging
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ═══════════════════════════════════════════════════════════════
// ⚫ 8. LOGGING — Timestamped, color-coded helper
// ═══════════════════════════════════════════════════════════════
function log(tag, message, data = '') {
  const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] [${tag}] ${message}${dataStr}`);
}

// ═══════════════════════════════════════════════════════════════
// 🔴 1. SECURITY — Environment Variables
// ═══════════════════════════════════════════════════════════════
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

// Validate critical env vars on startup
if (!NVIDIA_API_KEY || !OPENWEATHER_API_KEY || !FIREBASE_DB_URL) {
  console.error('\n❌ FATAL: Missing required environment variables in backend/.env');
  console.error('   Required: NVIDIA_API_KEY, OPENWEATHER_API_KEY, FIREBASE_DB_URL\n');
  process.exit(1);
}

// ─── Firebase Admin Init ─────────────────────
admin.initializeApp({ databaseURL: FIREBASE_DB_URL });
const db = admin.database();
log('SYSTEM', `Firebase connected: ${FIREBASE_DB_URL}`);

// ═══════════════════════════════════════════════════════════════
// 🔴 1. SECURITY — Rate Limiting
// ═══════════════════════════════════════════════════════════════
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute window
  max: 10,                 // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI requests. Please wait 1 minute.', timestamp: Date.now() },
});

const sensorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                 // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many sensor requests. Please slow down.', timestamp: Date.now() },
});

// ═══════════════════════════════════════════════════════════════
// 🔴 1. SECURITY — Auth Token Middleware
// ═══════════════════════════════════════════════════════════════
function authMiddleware(req, res, next) {
  // Skip auth for health check
  if (req.path === '/api/health') return next();

  const token = req.headers['x-api-token'];

  if (!API_AUTH_TOKEN) {
    // If no token is configured in .env, allow all requests (dev mode)
    return next();
  }

  if (!token || token !== API_AUTH_TOKEN) {
    log('AUTH', `Unauthorized request to ${req.method} ${req.path}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Provide a valid x-api-token header.',
      timestamp: Date.now(),
    });
  }

  next();
}

app.use(authMiddleware);

// ═══════════════════════════════════════════════════════════════
// 🔴 1. SECURITY — Input Validation Helpers
// ═══════════════════════════════════════════════════════════════
function validateSensorData(body) {
  const errors = [];
  if (body.soilMoisture === undefined || typeof body.soilMoisture !== 'number' || body.soilMoisture < 0 || body.soilMoisture > 100) {
    errors.push('soilMoisture must be a number between 0 and 100');
  }
  if (body.temperature === undefined || typeof body.temperature !== 'number' || body.temperature < -50 || body.temperature > 80) {
    errors.push('temperature must be a number between -50 and 80');
  }
  if (body.humidity === undefined || typeof body.humidity !== 'number' || body.humidity < 0 || body.humidity > 100) {
    errors.push('humidity must be a number between 0 and 100');
  }
  return errors;
}

function validatePumpStatus(status) {
  return ['ON', 'OFF'].includes(status);
}

// ═══════════════════════════════════════════════════════════════
// 🔵 5. ERROR HANDLING — Standard Response Wrapper
// ═══════════════════════════════════════════════════════════════
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data, timestamp: Date.now() });
}

function sendError(res, message, statusCode = 500) {
  log('ERROR', message);
  return res.status(statusCode).json({ success: false, error: message, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════════════════
// ⚫ 8. LOGGING — Request Logger Middleware
// ═══════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const tag = req.path.includes('/ai') ? 'AI' :
                req.path.includes('/sensor') ? 'SENSOR' :
                req.path.includes('/weather') ? 'WEATHER' :
                req.path.includes('/irrigation') ? 'PUMP' :
                req.path.includes('/marketplace') ? 'MARKET' : 'API';
    log(tag, `${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ═══════════════════════════════════════════════════════════════
// 🟤 7. WEATHER CACHE — In-Memory TTL Cache (15 min)
// ═══════════════════════════════════════════════════════════════
const weatherCache = new Map();
const WEATHER_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCachedWeather(key) {
  const entry = weatherCache.get(key);
  if (entry && (Date.now() - entry.timestamp) < WEATHER_CACHE_TTL) {
    log('WEATHER', `Cache HIT for ${key}`);
    return entry.data;
  }
  return null;
}

function setCachedWeather(key, data) {
  weatherCache.set(key, { data, timestamp: Date.now() });
  log('WEATHER', `Cache SET for ${key}`);
}


// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// ─── Health Check ────────────────────────────
app.get('/api/health', (req, res) => {
  sendSuccess(res, {
    status: 'ok',
    service: 'FarmSense AI Backend v2.0',
    uptime: Math.floor(process.uptime()),
    features: ['security', 'rate-limiting', 'smart-irrigation', 'multilingual-ai', 'weather-cache', 'multi-device'],
  });
});


// ═══════════════════════════════════════════════════════════════
// 0. DEVICE MANAGEMENT — Registration & Validation
// ═══════════════════════════════════════════════════════════════

// POST — ESP32 self-registers on boot
app.post('/api/devices/register', async (req, res) => {
  try {
    const { deviceCode, ip } = req.body;

    if (!deviceCode || typeof deviceCode !== 'string' || !/^\d{4}$/.test(deviceCode)) {
      return sendError(res, 'deviceCode must be a 4-digit string', 400);
    }

    const deviceData = {
      deviceCode,
      status: 'online',
      lastSeen: Date.now(),
      registeredAt: Date.now(),
      ip: ip || 'unknown',
    };

    // Use PATCH to preserve existing registeredAt if already exists
    const existingSnap = await db.ref(`devices/${deviceCode}/registeredAt`).once('value');
    if (existingSnap.exists()) {
      // Just update heartbeat fields, preserve registeredAt
      await db.ref(`devices/${deviceCode}`).update({
        status: 'online',
        lastSeen: Date.now(),
        ip: ip || 'unknown',
      });
    } else {
      await db.ref(`devices/${deviceCode}`).set(deviceData);
    }

    log('DEVICE', `Registered/heartbeat: ${deviceCode} (IP: ${ip || 'unknown'})`);
    sendSuccess(res, { deviceCode, status: 'registered' });
  } catch (error) {
    sendError(res, error.message);
  }
});

// GET — Validate a device code exists (used by mobile app pairing)
app.get('/api/devices/:deviceCode', async (req, res) => {
  try {
    const { deviceCode } = req.params;

    if (!/^\d{4}$/.test(deviceCode)) {
      return sendError(res, 'Device code must be 4 digits', 400);
    }

    const snapshot = await db.ref(`devices/${deviceCode}`).once('value');
    
    if (!snapshot.exists()) {
      return sendError(res, 'Device not found', 404);
    }

    const deviceData = snapshot.val();
    log('DEVICE', `Validated device: ${deviceCode}`);
    sendSuccess(res, deviceData);
  } catch (error) {
    sendError(res, error.message);
  }
});


// ═══════════════════════════════════════════════════════════════
// 1. SENSOR DATA
// ═══════════════════════════════════════════════════════════════

// GET latest sensor data
app.get('/api/sensors/:userId', sensorLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    const snapshot = await db.ref(`sensorData/${userId}/latest`).once('value');
    const data = snapshot.val();
    log('SENSOR', `Fetched latest for ${userId}`, data);
    sendSuccess(res, data || null);
  } catch (error) {
    sendError(res, error.message);
  }
});

// POST sensor data from ESP32
app.post('/api/sensors/:userId', sensorLimiter, async (req, res) => {
  try {
    const { userId } = req.params;

    // 🔴 Input Validation
    const errors = validateSensorData(req.body);
    if (errors.length > 0) {
      return sendError(res, `Validation failed: ${errors.join('; ')}`, 400);
    }

    const { soilMoisture, temperature, humidity } = req.body;
    const timestamp = Date.now();
    const sensorEntry = { soilMoisture, temperature, humidity, timestamp };

    // Update latest
    await db.ref(`sensorData/${userId}/latest`).set(sensorEntry);

    // Push to history
    await db.ref(`sensorData/${userId}/history`).push(sensorEntry);

    log('SENSOR', `Data saved for ${userId}`, sensorEntry);

    // Smart alerts + irrigation check
    await checkAlerts(userId, sensorEntry);
    await smartIrrigationCheck(userId, sensorEntry);

    sendSuccess(res, { message: 'Sensor data saved', entry: sensorEntry });
  } catch (error) {
    sendError(res, error.message);
  }
});

// ═══════════════════════════════════════════════════════════════
// 🟡 3. SENSOR HISTORY — Graph Support
// ═══════════════════════════════════════════════════════════════
app.get('/api/sensors/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const snapshot = await db.ref(`sensorData/${userId}/history`)
      .orderByChild('timestamp')
      .limitToLast(limit)
      .once('value');

    const val = snapshot.val();
    const history = val
      ? Object.values(val).sort((a, b) => b.timestamp - a.timestamp)
      : [];

    log('SENSOR', `Fetched ${history.length} history entries for ${userId}`);
    sendSuccess(res, { history, count: history.length });
  } catch (error) {
    sendError(res, error.message);
  }
});


// ═══════════════════════════════════════════════════════════════
// 2. IRRIGATION CONTROL
// ═══════════════════════════════════════════════════════════════

// Set pump status
app.post('/api/irrigation/pump', async (req, res) => {
  try {
    const { userId = 'user_001', status } = req.body;

    // 🔴 Input Validation
    if (!validatePumpStatus(status)) {
      return sendError(res, 'status must be "ON" or "OFF"', 400);
    }

    await db.ref(`irrigation/${userId}/pumpStatus`).set(status);
    if (status === 'ON') {
      await db.ref(`irrigation/${userId}/lastWatered`).set(Date.now());
    }

    log('PUMP', `Pump set to ${status} for ${userId}`);
    sendSuccess(res, { pumpStatus: status, userId });
  } catch (error) {
    sendError(res, error.message);
  }
});

// Get irrigation settings
app.get('/api/irrigation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const snapshot = await db.ref(`irrigation/${userId}`).once('value');
    sendSuccess(res, snapshot.val() || null);
  } catch (error) {
    sendError(res, error.message);
  }
});

// Set irrigation threshold
app.post('/api/irrigation/threshold', async (req, res) => {
  try {
    const { userId = 'user_001', threshold } = req.body;

    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      return sendError(res, 'threshold must be a number between 0 and 100', 400);
    }

    await db.ref(`irrigation/${userId}/threshold`).set(threshold);
    log('PUMP', `Threshold set to ${threshold}% for ${userId}`);
    sendSuccess(res, { threshold, userId });
  } catch (error) {
    sendError(res, error.message);
  }
});


// ═══════════════════════════════════════════════════════════════
// 3. WEATHER (🟠 User-Scoped + 🟤 Cached)
// ═══════════════════════════════════════════════════════════════
app.get('/api/weather/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const userId = req.query.userId || 'global';

    // Round coords for cache key consistency
    const cacheKey = `${parseFloat(lat).toFixed(2)}:${parseFloat(lng).toFixed(2)}`;

    // 🟤 Check cache first
    const cached = getCachedWeather(cacheKey);
    if (cached) {
      return sendSuccess(res, cached);
    }

    // Fetch current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );
    const currentData = await currentRes.json();

    if (currentData.cod && currentData.cod !== 200) {
      return sendError(res, `Weather API error: ${currentData.message}`, 502);
    }

    // Fetch forecast
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );
    const forecastData = await forecastRes.json();

    const weatherObj = {
      current: {
        temp: Math.round(currentData.main?.temp || 0),
        humidity: currentData.main?.humidity || 0,
        pressure: currentData.main?.pressure || 0,
        visibility: currentData.visibility || 0,
        city: currentData.name || 'Unknown',
        condition: currentData.weather?.[0]?.description || 'Unknown',
        icon: currentData.weather?.[0]?.icon || '01d',
        windSpeed: Math.round((currentData.wind?.speed || 0) * 3.6),
        feelsLike: Math.round(currentData.main?.feels_like || 0),
        updatedAt: Date.now(),
      },
      hourly: (forecastData.list || []).slice(0, 12).map((item) => ({
        time: new Date(item.dt * 1000).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        temp: Math.round(item.main.temp),
        condition: item.weather[0].description,
        pRain: item.pop ? Math.round(item.pop * 100) : 0,
      })),
      rainProbability: Math.max(...(forecastData.list || []).slice(0, 8).map(i => Math.round((i.pop || 0) * 100))),
    };

    // 🟤 Cache result
    setCachedWeather(cacheKey, weatherObj);

    // 🟠 Store per-user in Firebase
    await db.ref(`weather/${userId}`).set(weatherObj);

    log('WEATHER', `Fetched & cached for ${userId} (${cacheKey})`);
    sendSuccess(res, weatherObj);
  } catch (error) {
    sendError(res, error.message);
  }
});


// ═══════════════════════════════════════════════════════════════
// 4. AI QUERY (🟣 Multilingual + Rate Limited)
// ═══════════════════════════════════════════════════════════════
app.post('/api/ai/query', aiLimiter, async (req, res) => {
  try {
    const { userId = 'user_001', message, sensorData } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return sendError(res, 'message is required and must be a non-empty string', 400);
    }

    let systemPrompt = `You are FarmSense AI, an expert agricultural assistant for Indian farmers.
You MUST respond in the following JSON format ONLY (no markdown, no extra text):
{
  "english": "your response in English",
  "hindi": "your response in Hindi",
  "punjabi": "your response in Punjabi"
}
Keep each response concise and actionable (under 200 words).`;

    if (sensorData) {
      systemPrompt += `\nCurrent sensor data: Soil Moisture: ${sensorData.soilMoisture}%, Temperature: ${sensorData.temperature}°C, Humidity: ${sensorData.humidity}%`;
    }

    log('AI', `Query from ${userId}: "${message.substring(0, 60)}..."`);

    const aiRes = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 2048,
        stream: false,
      }),
    });

    const aiData = await aiRes.json();
    const rawReply = aiData.choices?.[0]?.message?.content || '';

    // 🟣 Parse structured multilingual response
    let structuredResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structuredResponse = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      // Fallback: use raw reply as English, note parsing failure
      log('AI', `JSON parse failed, using raw response`);
    }

    if (!structuredResponse || !structuredResponse.english) {
      structuredResponse = {
        english: rawReply || 'Sorry, could not process your query.',
        hindi: rawReply || 'क्षमा करें, आपकी क्वेरी प्रोसेस नहीं हो सकी।',
        punjabi: rawReply || 'ਮਾਫ਼ ਕਰਨਾ, ਤੁਹਾਡੀ ਬੇਨਤੀ ਪ੍ਰੋਸੈਸ ਨਹੀਂ ਹੋ ਸਕੀ।',
      };
    }

    // Save to Firebase
    const queryEntry = {
      type: 'chat',
      input: message,
      response: structuredResponse,
      timestamp: Date.now(),
    };
    await db.ref(`ai_queries/${userId}`).push(queryEntry);

    log('AI', `Response sent to ${userId} (${rawReply.length} chars)`);
    sendSuccess(res, { response: structuredResponse, queryId: queryEntry.timestamp });
  } catch (error) {
    sendError(res, error.message);
  }
});


// ═══════════════════════════════════════════════════════════════
// 5. MARKETPLACE (🟠 User-Scoped)
// ═══════════════════════════════════════════════════════════════
app.post('/api/marketplace/listing', async (req, res) => {
  try {
    const { type = 'farmer', userId, ...listingData } = req.body;

    // 🔴 Validation
    if (!userId) {
      return sendError(res, 'userId is required for marketplace listings', 400);
    }

    listingData.userId = userId;
    listingData.createdAt = Date.now();
    listingData.status = 'active';

    const path = type === 'buyer' ? 'marketplace/buyers' : 'marketplace/farmers';
    const newRef = await db.ref(path).push(listingData);

    log('MARKET', `New ${type} listing by ${userId}: ${newRef.key}`);
    sendSuccess(res, { id: newRef.key, type }, 201);
  } catch (error) {
    sendError(res, error.message);
  }
});

app.get('/api/marketplace/listings', async (req, res) => {
  try {
    const { type = 'all', userId } = req.query;

    let farmers = [];
    let buyers = [];

    if (type === 'all' || type === 'farmer') {
      const snap = await db.ref('marketplace/farmers').once('value');
      const val = snap.val();
      if (val) {
        farmers = Object.entries(val).map(([id, data]) => ({ id, ...data }));
        // Filter by userId if provided
        if (userId) farmers = farmers.filter(f => f.userId === userId);
      }
    }
    if (type === 'all' || type === 'buyer') {
      const snap = await db.ref('marketplace/buyers').once('value');
      const val = snap.val();
      if (val) {
        buyers = Object.entries(val).map(([id, data]) => ({ id, ...data }));
        if (userId) buyers = buyers.filter(b => b.userId === userId);
      }
    }

    sendSuccess(res, { farmers, buyers, total: farmers.length + buyers.length });
  } catch (error) {
    sendError(res, error.message);
  }
});


// ═══════════════════════════════════════════════════════════════
// 6. ALERTS
// ═══════════════════════════════════════════════════════════════
app.get('/api/alerts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const snapshot = await db.ref(`alerts/${userId}`)
      .orderByChild('timestamp')
      .limitToLast(20)
      .once('value');
    const val = snapshot.val();
    const alerts = val
      ? Object.entries(val).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.timestamp - a.timestamp)
      : [];

    sendSuccess(res, { alerts, unreadCount: alerts.filter(a => !a.read).length });
  } catch (error) {
    sendError(res, error.message);
  }
});

// Mark alert as read
app.patch('/api/alerts/:userId/:alertId', async (req, res) => {
  try {
    const { userId, alertId } = req.params;
    await db.ref(`alerts/${userId}/${alertId}/read`).set(true);
    sendSuccess(res, { message: 'Alert marked as read' });
  } catch (error) {
    sendError(res, error.message);
  }
});


// ═══════════════════════════════════════════════════════════════
// SMART ALERT CHECKER (called after sensor writes)
// ═══════════════════════════════════════════════════════════════
async function checkAlerts(userId, sensorData) {
  const alerts = [];
  const now = Date.now();

  if (sensorData.soilMoisture < 25) {
    alerts.push({
      type: 'low_moisture',
      message: `⚠️ Soil moisture critically low at ${sensorData.soilMoisture}%. Irrigate immediately!`,
      severity: 'critical',
      read: false,
      timestamp: now,
    });
  }

  if (sensorData.soilMoisture < 40 && sensorData.soilMoisture >= 25) {
    alerts.push({
      type: 'low_moisture',
      message: `🌱 Soil moisture is ${sensorData.soilMoisture}%. Consider irrigating soon.`,
      severity: 'warning',
      read: false,
      timestamp: now,
    });
  }

  if (sensorData.temperature > 40) {
    alerts.push({
      type: 'high_temp',
      message: `🌡️ Temperature is ${sensorData.temperature}°C — heat stress risk for crops!`,
      severity: 'critical',
      read: false,
      timestamp: now,
    });
  }

  if (sensorData.humidity > 90) {
    alerts.push({
      type: 'high_humidity',
      message: `💧 Humidity at ${sensorData.humidity}% — fungal disease risk!`,
      severity: 'warning',
      read: false,
      timestamp: now,
    });
  }

  for (const alert of alerts) {
    await db.ref(`alerts/${userId}`).push(alert);
    log('ALERT', `${alert.severity.toUpperCase()} for ${userId}: ${alert.message}`);
  }
}


// ═══════════════════════════════════════════════════════════════
// 🟢 4. SMART IRRIGATION LOGIC
// ═══════════════════════════════════════════════════════════════
async function smartIrrigationCheck(userId, sensorData) {
  try {
    // Fetch current irrigation settings
    const irrigSnap = await db.ref(`irrigation/${userId}`).once('value');
    const irrigSettings = irrigSnap.val();

    if (!irrigSettings || irrigSettings.mode !== 'AUTO') {
      return; // Skip if not in AUTO mode
    }

    const threshold = irrigSettings.threshold || 30;
    const currentPump = irrigSettings.pumpStatus || 'OFF';

    // Check rain forecast — skip irrigation if rain > 50%
    let rainExpected = false;
    const weatherSnap = await db.ref(`weather/${userId}`).once('value');
    const weatherData = weatherSnap.val();
    if (weatherData && weatherData.rainProbability && weatherData.rainProbability > 50) {
      rainExpected = true;
      log('PUMP', `Rain expected (${weatherData.rainProbability}%) — skipping auto-irrigation for ${userId}`);
    }

    // AUTO ON: Soil is dry + no rain expected + pump is off
    if (sensorData.soilMoisture < threshold && !rainExpected && currentPump === 'OFF') {
      await db.ref(`irrigation/${userId}/pumpStatus`).set('ON');
      await db.ref(`irrigation/${userId}/lastWatered`).set(Date.now());
      log('PUMP', `🟢 AUTO ON: Moisture ${sensorData.soilMoisture}% < threshold ${threshold}% for ${userId}`);

      // Push alert
      await db.ref(`alerts/${userId}`).push({
        type: 'system',
        message: `🤖 Smart irrigation activated: Soil moisture (${sensorData.soilMoisture}%) fell below threshold (${threshold}%).`,
        severity: 'info',
        read: false,
        timestamp: Date.now(),
      });
    }

    // AUTO OFF: Soil moisture recovered (with 10% hysteresis)
    if (sensorData.soilMoisture >= (threshold + 10) && currentPump === 'ON') {
      await db.ref(`irrigation/${userId}/pumpStatus`).set('OFF');
      log('PUMP', `🔴 AUTO OFF: Moisture ${sensorData.soilMoisture}% >= threshold+10 ${threshold + 10}% for ${userId}`);

      await db.ref(`alerts/${userId}`).push({
        type: 'system',
        message: `🤖 Smart irrigation stopped: Soil moisture (${sensorData.soilMoisture}%) recovered above threshold.`,
        severity: 'info',
        read: false,
        timestamp: Date.now(),
      });
    }

    // Rain skip: Turn off pump if rain is expected and pump is running
    if (rainExpected && currentPump === 'ON') {
      await db.ref(`irrigation/${userId}/pumpStatus`).set('OFF');
      log('PUMP', `🌧️ Rain-skip: Pump turned OFF for ${userId} due to rain forecast`);

      await db.ref(`alerts/${userId}`).push({
        type: 'rain',
        message: `🌧️ Pump turned off — rain expected (${weatherData.rainProbability}% probability). Water saved!`,
        severity: 'info',
        read: false,
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    log('ERROR', `Smart irrigation check failed: ${error.message}`);
  }
}


// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  🌱 FarmSense AI Backend v2.0');
  console.log('══════════════════════════════════════════════════');
  console.log(`  🌐 Server:   http://localhost:${PORT}`);
  console.log(`  📡 Firebase: ${FIREBASE_DB_URL}`);
  console.log(`  🤖 AI Model: meta/llama-3.1-8b-instruct (NVIDIA)`);
  console.log(`  🔒 Auth:     ${API_AUTH_TOKEN ? 'Token enabled' : 'Open (dev mode)'}`);
  console.log(`  ⏱️  Rate Limits: AI=10/min, Sensors=60/min`);
  console.log(`  🟤 Weather Cache: 15 min TTL`);
  console.log('══════════════════════════════════════════════════\n');
});
