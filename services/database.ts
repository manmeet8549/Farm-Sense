// Real-time Database Hooks & Write Functions for FarmSense AI
import { useState, useEffect } from 'react';
import { db, ref, onValue, set, push, get, update, query, orderByChild, limitToLast } from './firebase';

// ─────────────────────────────────────────────
// DEFAULT USER ID (until auth is wired)
// ─────────────────────────────────────────────
const DEFAULT_USER_ID = 'user_001';

// ─────────────────────────────────────────────
// SENSOR DATA — Real-time hook
// ─────────────────────────────────────────────
export interface SensorData {
  soilMoisture: number;
  temperature: number;
  humidity: number;
  timestamp: number;
}

export function useSensorData(userId: string = DEFAULT_USER_ID) {
  const [latest, setLatest] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to latest sensor reading
    const latestRef = ref(db, `sensorData/${userId}/latest`);
    const unsubLatest = onValue(latestRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setLatest(data);
      setLoading(false);
    });

    // Listen to history (last 7 readings for graphs)
    const historyRef = query(
      ref(db, `sensorData/${userId}/history`),
      orderByChild('timestamp'),
      limitToLast(7)
    );
    const unsubHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Object.values(data) as SensorData[];
        arr.sort((a, b) => a.timestamp - b.timestamp);
        setHistory(arr);
      }
    });

    return () => {
      unsubLatest();
      unsubHistory();
    };
  }, [userId]);

  return { latest, history, loading };
}

// ─────────────────────────────────────────────
// IRRIGATION — Real-time hook + controls
// ─────────────────────────────────────────────
export interface IrrigationData {
  pumpStatus: 'ON' | 'OFF';
  mode: 'AUTO' | 'MANUAL';
  threshold: number;
  lastWatered: number;
}

export function useIrrigation(userId: string = DEFAULT_USER_ID) {
  const [data, setData] = useState<IrrigationData | null>(null);
  const [waterUsage, setWaterUsage] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const irrigRef = ref(db, `irrigation/${userId}`);
    const unsub = onValue(irrigRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        setData({
          pumpStatus: val.pumpStatus || 'OFF',
          mode: val.mode || 'MANUAL',
          threshold: val.threshold || 30,
          lastWatered: val.lastWatered || 0,
        });
        // Extract water usage history
        if (val.waterUsageHistory) {
          const usage = Object.values(val.waterUsageHistory) as number[];
          setWaterUsage(usage.slice(-7)); // last 7 days
        }
      }
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { data, waterUsage, loading };
}

export async function updatePumpStatus(userId: string = DEFAULT_USER_ID, status: 'ON' | 'OFF') {
  await set(ref(db, `irrigation/${userId}/pumpStatus`), status);
}

export async function updateIrrigationMode(userId: string = DEFAULT_USER_ID, mode: 'AUTO' | 'MANUAL') {
  await set(ref(db, `irrigation/${userId}/mode`), mode);
}

export async function updateThreshold(userId: string = DEFAULT_USER_ID, threshold: number) {
  await set(ref(db, `irrigation/${userId}/threshold`), threshold);
}

export async function updateIrrigationTimer(userId: string = DEFAULT_USER_ID, timer: number) {
  await update(ref(db, `irrigation/${userId}`), { timer });
}

// ─────────────────────────────────────────────
// WEATHER — Real-time hook
// ─────────────────────────────────────────────
export interface WeatherCurrent {
  temp: number;
  humidity: number;
  pressure: number;
  visibility: number;
  city: string;
  condition: string;
  icon: string;
  windSpeed: number;
  feelsLike: number;
  updatedAt: number;
}

export interface WeatherHourly {
  time: string;
  temp: number;
  icon: string;
  condition: string;
  pRain?: number;
}

export interface WeatherDaily {
  day: string;
  icon: string;
  pRain: number;
  min: number;
  max: number;
  condition: string;
}

export function useWeather(locationKey: string = 'current') {
  const [current, setCurrent] = useState<WeatherCurrent | null>(null);
  const [hourly, setHourly] = useState<WeatherHourly[]>([]);
  const [daily, setDaily] = useState<WeatherDaily[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const weatherRef = ref(db, `weather/${locationKey}`);
    const unsub = onValue(weatherRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        if (val.current) setCurrent(val.current);
        if (val.hourly) setHourly(Object.values(val.hourly));
        if (val.daily) setDaily(Object.values(val.daily));
      }
      setLoading(false);
    });

    return () => unsub();
  }, [locationKey]);

  return { current, hourly, daily, loading };
}

// ─────────────────────────────────────────────
// MARKETPLACE — Real-time hook + write
// ─────────────────────────────────────────────
export interface MarketListing {
  id?: string;
  userId: string;
  cropType: string;
  quantity: number;
  pricePerKg: number;
  contact: string;
  createdAt: number;
  status: 'active' | 'sold';
  farmerName?: string;
}

export interface BuyerListing {
  id?: string;
  orgName: string;
  cropNeeded: string;
  quantityNeeded: number;
  offerPrice: number;
  contact: string;
  createdAt: number;
  status: 'active' | 'fulfilled';
}

export function useMarketplace() {
  const [farmerListings, setFarmerListings] = useState<MarketListing[]>([]);
  const [buyerListings, setBuyerListings] = useState<BuyerListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const farmersRef = ref(db, 'marketplace/farmers');
    const buyersRef = ref(db, 'marketplace/buyers');

    const unsubFarmers = onValue(farmersRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = Object.entries(val).map(([id, data]: any) => ({ id, ...data }));
        setFarmerListings(arr);
      }
      setLoading(false);
    });

    const unsubBuyers = onValue(buyersRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = Object.entries(val).map(([id, data]: any) => ({ id, ...data }));
        setBuyerListings(arr);
      }
    });

    return () => {
      unsubFarmers();
      unsubBuyers();
    };
  }, []);

  return { farmerListings, buyerListings, loading };
}

export async function addFarmerListing(listing: Omit<MarketListing, 'id'>) {
  const listingsRef = ref(db, 'marketplace/farmers');
  await push(listingsRef, listing);
}

export async function addBuyerListing(listing: Omit<BuyerListing, 'id'>) {
  const listingsRef = ref(db, 'marketplace/buyers');
  await push(listingsRef, listing);
}

// ─────────────────────────────────────────────
// AI QUERIES — Write + History
// ─────────────────────────────────────────────
export interface AIQuery {
  id?: string;
  type: 'chat' | 'image';
  input: string;
  response: string;
  language: string;
  timestamp: number;
}

export function useAIHistory(userId: string = DEFAULT_USER_ID) {
  const [queries, setQueries] = useState<AIQuery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const queriesRef = query(
      ref(db, `ai_queries/${userId}`),
      orderByChild('timestamp'),
      limitToLast(20)
    );
    const unsub = onValue(queriesRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = Object.entries(val).map(([id, data]: any) => ({ id, ...data }));
        arr.sort((a, b) => a.timestamp - b.timestamp);
        setQueries(arr);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { queries, loading };
}

export async function saveAIQuery(userId: string = DEFAULT_USER_ID, queryData: Omit<AIQuery, 'id'>) {
  const queriesRef = ref(db, `ai_queries/${userId}`);
  await push(queriesRef, queryData);
}

// ─────────────────────────────────────────────
// HEALTH SCANS — Real-time hook
// ─────────────────────────────────────────────
export interface HealthScan {
  id?: string;
  imageUri: string;
  diseaseName: string;
  confidence: number;
  recommendation: string;
  timestamp: number;
}

export function useHealthScans(userId: string = DEFAULT_USER_ID) {
  const [scans, setScans] = useState<HealthScan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const scansRef = query(
      ref(db, `health_scans/${userId}`),
      orderByChild('timestamp'),
      limitToLast(10)
    );
    const unsub = onValue(scansRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = Object.entries(val).map(([id, data]: any) => ({ id, ...data }));
        arr.sort((a, b) => b.timestamp - a.timestamp);
        setScans(arr);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { scans, loading };
}

export async function saveHealthScan(userId: string = DEFAULT_USER_ID, scan: Omit<HealthScan, 'id'>) {
  const scansRef = ref(db, `health_scans/${userId}`);
  await push(scansRef, scan);
}

// ─────────────────────────────────────────────
// ALERTS — Real-time hook
// ─────────────────────────────────────────────
export interface AlertData {
  id?: string;
  type: 'low_moisture' | 'rain' | 'disease' | 'system';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  timestamp: number;
}

export function useAlerts(userId: string = DEFAULT_USER_ID) {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const alertsRef = query(
      ref(db, `alerts/${userId}`),
      orderByChild('timestamp'),
      limitToLast(20)
    );
    const unsub = onValue(alertsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = Object.entries(val).map(([id, data]: any) => ({ id, ...data }));
        arr.sort((a, b) => b.timestamp - a.timestamp);
        setAlerts(arr);
        setUnreadCount(arr.filter((a) => !a.read).length);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { alerts, unreadCount, loading };
}

export async function markAlertRead(userId: string = DEFAULT_USER_ID, alertId: string) {
  await set(ref(db, `alerts/${userId}/${alertId}/read`), true);
}

// ─────────────────────────────────────────────
// USER PROFILE — Read/Write
// ─────────────────────────────────────────────
export interface UserProfile {
  name: string;
  email: string;
  location: string;
  farmName: string;
  landArea: string;
  primaryCrops: string;
  phoneNumber: string;
  avatarUri: string;
}

export function useUserProfile(userId: string = DEFAULT_USER_ID) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const profileRef = ref(db, `users/${userId}`);
    const unsub = onValue(profileRef, (snapshot) => {
      const val = snapshot.val();
      if (val) setProfile(val);
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  return { profile, loading };
}

export async function updateUserProfile(userId: string = DEFAULT_USER_ID, updates: Partial<UserProfile>) {
  await update(ref(db, `users/${userId}`), updates);
}

// ─────────────────────────────────────────────
// SEED DATA — Populate initial data for demo
// ─────────────────────────────────────────────
export async function seedDemoData() {
  const userId = DEFAULT_USER_ID;
  const now = Date.now();

  // User profile
  await set(ref(db, `users/${userId}`), {
    name: 'Gurpreet Singh',
    email: 'gurpreet@farm.com',
    location: 'Punjab, India',
    farmName: 'Green Acres Estate',
    landArea: '5 Acres',
    primaryCrops: 'Wheat, Rice',
    phoneNumber: '+91 98765 43210',
    avatarUri: 'https://www.w3schools.com/howto/img_avatar.png',
  });

  // Latest sensor data
  await set(ref(db, `sensorData/${userId}/latest`), {
    soilMoisture: 45,
    temperature: 28,
    humidity: 65,
    timestamp: now,
  });

  // Sensor history (7 entries)
  const moistureValues = [45, 52, 48, 68, 55, 75, 62];
  const tempValues = [26, 28, 27, 30, 29, 31, 28];
  const humidityValues = [60, 65, 58, 70, 62, 68, 65];
  for (let i = 0; i < 7; i++) {
    await push(ref(db, `sensorData/${userId}/history`), {
      soilMoisture: moistureValues[i],
      temperature: tempValues[i],
      humidity: humidityValues[i],
      timestamp: now - (6 - i) * 86400000, // past 7 days
    });
  }

  // Irrigation
  await set(ref(db, `irrigation/${userId}`), {
    pumpStatus: 'ON',
    mode: 'AUTO',
    threshold: 30,
    lastWatered: now - 3600000,
    waterUsageHistory: {
      day1: 3.5,
      day2: 4.8,
      day3: 2.5,
      day4: 5.2,
      day5: 4.0,
      day6: 2.0,
      day7: 6.5,
    },
  });

  // Marketplace demo listings
  await push(ref(db, 'marketplace/farmers'), {
    userId,
    cropType: 'Wheat Straw',
    quantity: 500,
    pricePerKg: 8,
    contact: '+91 98765 43210',
    createdAt: now,
    status: 'active',
    farmerName: 'Gurpreet Singh',
  });

  await push(ref(db, 'marketplace/buyers'), {
    orgName: 'Green Energy Corp',
    cropNeeded: 'Rice Husk',
    quantityNeeded: 1000,
    offerPrice: 6,
    contact: '+91 98000 11111',
    createdAt: now,
    status: 'active',
  });

  console.log('✅ Demo data seeded successfully!');
}
