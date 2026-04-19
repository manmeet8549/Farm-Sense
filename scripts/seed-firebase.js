// Seed script — Run once to populate Firebase with demo data
// Usage: npx ts-node scripts/seed-firebase.ts  (or import and call from the app)

const FIREBASE_DB_URL = 'https://farmsense-580c0-default-rtdb.firebaseio.com';

async function seedData() {
  const now = Date.now();
  const userId = 'user_001';

  // 1. User profile
  await putData(`users/${userId}`, {
    name: 'Gurpreet Singh',
    email: 'gurpreet@farm.com',
    location: 'Punjab, India',
    farmName: 'Green Acres Estate',
    landArea: '5 Acres',
    primaryCrops: 'Wheat, Rice',
    phoneNumber: '+91 98765 43210',
    avatarUri: 'https://www.w3schools.com/howto/img_avatar.png',
  });

  // 2. Latest sensor data
  await putData(`sensorData/${userId}/latest`, {
    soilMoisture: 45,
    temperature: 28,
    humidity: 65,
    timestamp: now,
  });

  // 3. Sensor history (7 days)
  const moistureValues = [45, 52, 48, 68, 55, 75, 62];
  const tempValues = [26, 28, 27, 30, 29, 31, 28];
  const humidityValues = [60, 65, 58, 70, 62, 68, 65];
  for (let i = 0; i < 7; i++) {
    await postData(`sensorData/${userId}/history`, {
      soilMoisture: moistureValues[i],
      temperature: tempValues[i],
      humidity: humidityValues[i],
      timestamp: now - (6 - i) * 86400000,
    });
  }

  // 4. Irrigation
  await putData(`irrigation/${userId}`, {
    pumpStatus: 'ON',
    mode: 'AUTO',
    threshold: 30,
    lastWatered: now - 3600000,
    waterUsageHistory: {
      day1: 3.5, day2: 4.8, day3: 2.5, day4: 5.2,
      day5: 4.0, day6: 2.0, day7: 6.5,
    },
  });

  // 5. Weather (demo)
  await putData('weather/current', {
    current: {
      temp: 28, humidity: 65, condition: 'Partly Cloudy',
      icon: 'weather-partly-cloudy', windSpeed: 12, feelsLike: 30,
      updatedAt: now,
    },
    daily: {
      d0: { day: 'Mon', icon: 'weather-partly-cloudy', pRain: 0, min: 21, max: 32, condition: 'partly cloudy' },
      d1: { day: 'Tue', icon: 'weather-pouring', pRain: 80, min: 20, max: 28, condition: 'rain' },
      d2: { day: 'Wed', icon: 'weather-cloudy', pRain: 20, min: 19, max: 29, condition: 'cloudy' },
      d3: { day: 'Thu', icon: 'weather-sunny', pRain: 0, min: 22, max: 34, condition: 'clear sky' },
      d4: { day: 'Fri', icon: 'weather-sunny', pRain: 0, min: 23, max: 35, condition: 'clear sky' },
    },
  });

  // 6. Marketplace listings
  await postData('marketplace/farmers', {
    userId, cropType: 'Wheat Straw', quantity: 500, pricePerKg: 8,
    contact: '+91 98765 43210', createdAt: now, status: 'active', farmerName: 'Gurpreet Singh',
  });
  await postData('marketplace/buyers', {
    orgName: 'Green Energy Corp', cropNeeded: 'Rice Husk', quantityNeeded: 1000,
    offerPrice: 6, contact: '+91 98000 11111', createdAt: now, status: 'active',
  });

  console.log('✅ Firebase seeded successfully!');
}

// --- HTTP helpers for Firebase REST API ---
async function putData(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) console.error(`PUT ${path} failed:`, await res.text());
}

async function postData(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) console.error(`POST ${path} failed:`, await res.text());
}

seedData();
