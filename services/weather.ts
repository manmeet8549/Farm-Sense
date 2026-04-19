// Weather API Service — OpenWeatherMap + GPS
import * as Location from 'expo-location';
import { db, ref, set } from './firebase';

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;

// Map OpenWeatherMap icon codes to MaterialCommunityIcons names
const iconMap: Record<string, string> = {
  '01d': 'weather-sunny',
  '01n': 'weather-night',
  '02d': 'weather-partly-cloudy',
  '02n': 'weather-night-partly-cloudy',
  '03d': 'weather-cloudy',
  '03n': 'weather-cloudy',
  '04d': 'weather-cloudy',
  '04n': 'weather-cloudy',
  '09d': 'weather-rainy',
  '09n': 'weather-rainy',
  '10d': 'weather-pouring',
  '10n': 'weather-pouring',
  '11d': 'weather-lightning',
  '11n': 'weather-lightning',
  '13d': 'weather-snowy',
  '13n': 'weather-snowy',
  '50d': 'weather-fog',
  '50n': 'weather-fog',
};

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeatherIcon(iconCode: string): string {
  return iconMap[iconCode] || 'weather-cloudy';
}

// ─────────────────────────────────────────────
// Get device GPS location
// ─────────────────────────────────────────────
export async function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission denied, using default Punjab coordinates');
      return { lat: 30.7333, lng: 76.7794 }; // Chandigarh, Punjab
    }
    const location = await Location.getCurrentPositionAsync({});
    return { lat: location.coords.latitude, lng: location.coords.longitude };
  } catch {
    return { lat: 30.7333, lng: 76.7794 }; // Fallback
  }
}

// ─────────────────────────────────────────────
// Fetch current weather + forecast from OpenWeatherMap
// and cache it in Firebase
// ─────────────────────────────────────────────
export async function fetchAndCacheWeather(locationKey: string = 'current') {
  try {
    const coords = await getDeviceLocation();
    if (!coords) return;

    const { lat, lng } = coords;

    // Fetch current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );
    const currentData = await currentRes.json();

    // Fetch 5-day / 3-hour forecast
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${OPENWEATHER_API_KEY}`
    );
    const forecastData = await forecastRes.json();

    if (currentData.cod !== 200 || forecastData.cod !== '200') {
      console.error('Weather API error:', currentData.message || forecastData.message);
      return;
    }

    // Parse current weather
    const current = {
      temp: Math.round(currentData.main.temp),
      humidity: currentData.main.humidity,
      pressure: currentData.main.pressure,
      visibility: Math.round(currentData.visibility / 1000), // m to km
      city: currentData.name || 'Punjab',
      condition: currentData.weather[0].description,
      icon: getWeatherIcon(currentData.weather[0].icon),
      windSpeed: Math.round(currentData.wind.speed * 3.6), // m/s → km/h
      feelsLike: Math.round(currentData.main.feels_like),
      updatedAt: Date.now(),
    };

    // Parse hourly (next 12 entries = ~36 hours)
    const hourly = forecastData.list.slice(0, 12).map((item: any) => {
      let icon = getWeatherIcon(item.weather[0].icon);
      const pop = item.pop ? Math.round(item.pop * 100) : 0;
      
      // Apply 50% threshold to hourly icons too
      if (pop < 50 && (icon.includes('rainy') || icon.includes('pouring'))) {
        icon = 'weather-partly-cloudy';
      } else if (pop >= 50 && !icon.includes('rainy') && !icon.includes('pouring') && !icon.includes('lightning')) {
        icon = 'weather-rainy';
      }

      return {
        time: new Date(item.dt * 1000).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
        temp: Math.round(item.main.temp),
        icon: icon,
        condition: item.weather[0].description,
        pRain: pop,
      };
    });

    // Parse daily (group by day, take min/max)
    const dailyMap: Record<string, { temps: number[]; icon: string; pRain: number; condition: string }> = {};
    forecastData.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000);
      const dayKey = date.toISOString().split('T')[0];
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { temps: [], icon: '', pRain: 0, condition: '' };
      }
      dailyMap[dayKey].temps.push(item.main.temp);
      // Pick the "worst" icon of the day (Rain > Cloudy > Sunny) or just the daytime peak
      const currentPriority = (icon: string) => {
        if (icon.includes('lightning')) return 5;
        if (icon.includes('pouring')) return 4;
        if (icon.includes('rainy')) return 3;
        if (icon.includes('cloudy')) return 2;
        return 1;
      };
      
      const newIcon = getWeatherIcon(item.weather[0].icon);
      const existingIcon = dailyMap[dayKey].icon;
      
      if (currentPriority(newIcon) > currentPriority(existingIcon)) {
        dailyMap[dayKey].icon = newIcon;
      } else if (!existingIcon) {
        dailyMap[dayKey].icon = newIcon;
      }
      
      dailyMap[dayKey].condition = item.weather[0].description;
      if (item.pop != null) {
        dailyMap[dayKey].pRain = Math.max(dailyMap[dayKey].pRain, Math.round(item.pop * 100));
      }
      
      // Safety check:
      // 1. If pRain is less than 50%, suppress rainy icons (show clouds or sun instead)
      if (dailyMap[dayKey].pRain < 50 && (dailyMap[dayKey].icon.includes('rainy') || dailyMap[dayKey].icon.includes('pouring'))) {
        dailyMap[dayKey].icon = 'weather-partly-cloudy';
      }
      
      // 2. If pRain is 50% or higher, ensure we show a rain icon as requested
      if (dailyMap[dayKey].pRain >= 50 && !dailyMap[dayKey].icon.includes('rainy') && !dailyMap[dayKey].icon.includes('pouring') && !dailyMap[dayKey].icon.includes('lightning')) {
        dailyMap[dayKey].icon = 'weather-rainy';
      }
    });

    const daily = Object.entries(dailyMap).slice(0, 5).map(([dateStr, data]) => {
      const date = new Date(dateStr);
      return {
        day: dayNames[date.getDay()],
        icon: data.icon,
        pRain: data.pRain,
        min: Math.round(Math.min(...data.temps)),
        max: Math.round(Math.max(...data.temps)),
        condition: data.condition,
      };
    });

    // Write to Firebase for caching
    await set(ref(db, `weather/${locationKey}`), { current, hourly, daily });

    console.log('✅ Weather data cached in Firebase');
    return { current, hourly, daily };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
}

// ─────────────────────────────────────────────
// Auto-refresh weather every 10 minutes
// ─────────────────────────────────────────────
let weatherInterval: ReturnType<typeof setInterval> | null = null;

export function startWeatherAutoRefresh(locationKey: string = 'current', intervalMs: number = 600000) {
  // Fetch immediately
  fetchAndCacheWeather(locationKey);
  // Then every 10 minutes
  weatherInterval = setInterval(() => fetchAndCacheWeather(locationKey), intervalMs);
}

export function stopWeatherAutoRefresh() {
  if (weatherInterval) {
    clearInterval(weatherInterval);
    weatherInterval = null;
  }
}
