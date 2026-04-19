// Smart Alert Engine — Combines sensor + weather data for intelligent alerts
import { db, ref, push, set } from './firebase';

const DEFAULT_USER_ID = 'user_001';

export interface AlertPayload {
  type: 'low_moisture' | 'rain' | 'disease' | 'high_temp' | 'system';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  timestamp: number;
}

// ─────────────────────────────────────────────
// Smart Alert Checker — call after each sensor update
// ─────────────────────────────────────────────
export async function checkAndTriggerAlerts(
  sensorData: { soilMoisture: number; temperature: number; humidity: number },
  weatherData?: { condition: string; pRain?: number; temp?: number },
  userId: string = DEFAULT_USER_ID
): Promise<AlertPayload[]> {
  const triggered: AlertPayload[] = [];
  const now = Date.now();

  // 1. Low soil moisture alert
  if (sensorData.soilMoisture < 25) {
    triggered.push({
      type: 'low_moisture',
      message: `⚠️ Soil moisture critically low at ${sensorData.soilMoisture}%. Irrigate immediately!`,
      severity: 'critical',
      read: false,
      timestamp: now,
    });
  } else if (sensorData.soilMoisture < 35) {
    triggered.push({
      type: 'low_moisture',
      message: `Soil moisture is low at ${sensorData.soilMoisture}%. Consider watering your crops soon.`,
      severity: 'warning',
      read: false,
      timestamp: now,
    });
  }

  // 2. High temperature alert
  if (sensorData.temperature > 40) {
    triggered.push({
      type: 'high_temp',
      message: `🌡️ Temperature is ${sensorData.temperature}°C — risk of heat stress. Provide shade or extra watering.`,
      severity: 'critical',
      read: false,
      timestamp: now,
    });
  } else if (sensorData.temperature > 35) {
    triggered.push({
      type: 'high_temp',
      message: `Temperature is ${sensorData.temperature}°C — monitor crops for heat stress.`,
      severity: 'warning',
      read: false,
      timestamp: now,
    });
  }

  // 3. Rain forecast alert  
  if (weatherData) {
    const condition = weatherData.condition?.toLowerCase() || '';
    const rainChance = weatherData.pRain || 0;

    if (rainChance > 70 || condition.includes('rain') || condition.includes('storm')) {
      triggered.push({
        type: 'rain',
        message: `🌧️ Rain expected (${rainChance}% chance). Consider skipping irrigation today.`,
        severity: 'info',
        read: false,
        timestamp: now,
      });
    }
  }

  // 4. Write triggered alerts to Firebase
  for (const alert of triggered) {
    await push(ref(db, `alerts/${userId}`), alert);
  }

  return triggered;
}

// ─────────────────────────────────────────────
// Generate irrigation recommendation
// ─────────────────────────────────────────────
export function getIrrigationRecommendation(
  soilMoisture: number,
  weatherCondition: string,
  rainChance: number
): string {
  if (rainChance > 60) {
    return 'Rain expected — skip watering today to conserve water.';
  }
  if (soilMoisture < 25) {
    return 'Soil is very dry — irrigate immediately for 30-45 minutes.';
  }
  if (soilMoisture < 40) {
    return 'Soil moisture is moderate — water in the evening for best results.';
  }
  if (soilMoisture > 70) {
    return 'Soil moisture is high — no watering needed today.';
  }
  return 'Conditions are good — maintain current irrigation schedule.';
}
