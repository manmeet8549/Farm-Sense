import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWeather, useSensorData } from '../../services/database';
import { startWeatherAutoRefresh, stopWeatherAutoRefresh } from '../../services/weather';
import { getSmartRecommendation } from '../../services/ai';
import { useAuth } from '../../services/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WeatherScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeDayIndex, setActiveDayIndex] = useState(1);

  // --- Firebase Real-Time Weather ---
  const { current: weatherCurrent, daily: weatherDaily, hourly: weatherHourly, loading: weatherLoading } = useWeather();
  const deviceId = user?.deviceCode || 'user_001';
  const { latest: sensorLatest } = useSensorData(deviceId);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiAdvisory, setAiAdvisory] = useState<string>('Analyzing real-time data for smart recommendations...');
  const [selectedGraphIndex, setSelectedGraphIndex] = useState<number | null>(null);

  // Start weather auto-refresh on mount and update local time clock
  useEffect(() => {
    startWeatherAutoRefresh('current', 600000); // every 10 min
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // 1 min timer
    return () => {
      stopWeatherAutoRefresh();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    // Only fetch AI advisory when we have REAL weather data
    if (aiAdvisory === 'Analyzing real-time data for smart recommendations...' && weatherCurrent) {
      const moisture = sensorLatest?.soilMoisture ?? 45;
      const temp = weatherCurrent.temp ?? 28;
      const humidity = weatherCurrent.humidity ?? 65;
      const condition = weatherCurrent.condition ?? 'Partly Cloudy';
      
      getSmartRecommendation(moisture, temp, humidity, condition)
        .then(setAiAdvisory)
        .catch(() => setAiAdvisory('Unable to fetch AI recommendations at this time.'));
    }
  }, [weatherCurrent, sensorLatest, aiAdvisory]);

  // Current weather vars — show '-' when not yet loaded
  const currTemp = weatherCurrent?.temp != null ? weatherCurrent.temp : null;
  const currCondition = weatherCurrent?.condition ?? null;
  const currFeelsLike = weatherCurrent?.feelsLike != null ? weatherCurrent.feelsLike : null;
  const currIcon = weatherCurrent?.icon ?? 'weather-partly-cloudy';
  const currHumidity = weatherCurrent?.humidity != null ? weatherCurrent.humidity : null;
  const currWind = weatherCurrent?.windSpeed != null ? weatherCurrent.windSpeed : null;
  const currPressure = weatherCurrent?.pressure != null ? weatherCurrent.pressure : null;
  const currVisibility = weatherCurrent?.visibility != null ? weatherCurrent.visibility : null;
  const currCity = weatherCurrent?.city ?? 'Fetching...';
  const soilMoisture = sensorLatest?.soilMoisture != null ? sensorLatest.soilMoisture : null;
  const soilTemp = sensorLatest?.temperature != null ? sensorLatest.temperature - 2 : null;

  // Use Firebase data with fallback to mock
  const forecastData = weatherDaily.length >= 5
    ? weatherDaily.map(d => ({
        day: d.day,
        icon: d.icon as any,
        pRain: d.pRain,
        min: d.min,
        max: d.max,
      }))
    : [
        { day: 'Mon', icon: 'weather-partly-cloudy', pRain: 10, min: 21, max: 32 },
        { day: 'Tue', icon: 'weather-cloudy', pRain: 15, min: 22, max: 30 },
        { day: 'Wed', icon: 'weather-cloudy', pRain: 20, min: 19, max: 29 },
        { day: 'Thu', icon: 'weather-sunny', pRain: 5, min: 22, max: 34 },
        { day: 'Fri', icon: 'weather-sunny', pRain: 5, min: 23, max: 35 },
      ];

  const todayRainProb = forecastData[0]?.pRain ?? 0;
  const precipDesc = weatherCurrent 
    ? (todayRainProb > 30 ? "Rain expected in next 24 hours" : "Low chance of rain in next 24 hours")
    : "Fetching precipitation data...";

  // Graph logic: Scrollable Hourly trend
  const hourlySubset = weatherHourly.length > 0 
    ? weatherHourly.slice(0, 12) 
    : [
        { time: '11:30 AM', temp: 28 }, { time: '02:30 PM', temp: 31 }, 
        { time: '05:30 PM', temp: 32 }, { time: '08:30 PM', temp: 29 },
        { time: '11:30 PM', temp: 26 }, { time: '02:30 AM', temp: 24 },
        { time: '05:30 AM', temp: 23 }, { time: '08:30 AM', temp: 27 },
        { time: '11:30 AM', temp: 30 }, { time: '02:30 PM', temp: 33 },
        { time: '05:30 PM', temp: 31 }, { time: '08:30 PM', temp: 28 }
      ];

  const trendData = hourlySubset.map(h => h.temp);

  const CHART_HEIGHT = 100;
  const COLUMN_WIDTH = 70; // Width per time interval
  const CHART_WIDTH = COLUMN_WIDTH * (trendData.length - 1);
  const SPACING = COLUMN_WIDTH;
  
  // Dynamic scaling
  const minTemp = Math.min(...trendData) - 2;
  const maxTemp = Math.max(...trendData) + 2;

  const getY = (val: number) => CHART_HEIGHT - (((val - minTemp) / (maxTemp - minTemp)) * CHART_HEIGHT);

  const renderTrendLine = () => {
    return trendData.map((val, i) => {
      if (i === trendData.length - 1) return null;
      
      const x1 = i * SPACING;
      const y1 = getY(val);
      const x2 = (i + 1) * SPACING;
      const y2 = getY(trendData[i + 1]);

      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      return (
        <View
          key={`trend-${i}`}
          style={{
            position: 'absolute',
            left: cx - length / 2,
            top: cy,
            width: length,
            height: 2.5,
            backgroundColor: '#0ea5e9',
            borderRadius: 2,
            transform: [{ rotate: `${angle}deg` }],
            opacity: 0.8,
          }}
        />
      );
    });
  };

  const renderTrendDots = () => {
    return trendData.map((val, i) => {
      const isSelected = i === selectedGraphIndex;
      return (
        <TouchableOpacity 
          key={`dot-${i}`}
          activeOpacity={0.7}
          onPress={() => setSelectedGraphIndex(i === selectedGraphIndex ? null : i)}
          style={{
            position: 'absolute',
            left: (i * SPACING) - 15, // larger touch area
            top: getY(val) - 15,
            width: 30,
            height: 30,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: isSelected ? 20 : 5,
          }}
        >
          <View style={{
            width: isSelected ? 10 : 6,
            height: isSelected ? 10 : 6,
            borderRadius: isSelected ? 5 : 3,
            backgroundColor: isSelected ? '#0369a1' : '#0ea5e9',
            borderWidth: 1.5,
            borderColor: '#fff',
            shadowColor: '#0ea5e9',
            shadowOpacity: isSelected ? 0.5 : 0,
            shadowRadius: 5,
            elevation: isSelected ? 3 : 0,
          }} />
          
          {isSelected && (
            <View style={{ 
              position: 'absolute', 
              top: -35, 
              backgroundColor: '#1e293b', 
              paddingHorizontal: 8, 
              paddingVertical: 4, 
              borderRadius: 6,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
              minWidth: 40,
              alignItems: 'center'
            }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{val}°C</Text>
              <View style={{
                position: 'absolute',
                bottom: -4,
                width: 8,
                height: 8,
                backgroundColor: '#1e293b',
                transform: [{ rotate: '45deg' }]
              }} />
            </View>
          )}
        </TouchableOpacity>
      );
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          
          {/* Top Header Icons */}
          <View style={styles.headerTopRow}>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push('/profile')}>
              <Image 
                source={{ uri: user?.avatarUri || 'https://www.w3schools.com/howto/img_avatar.png' }} 
                style={styles.avatar} 
              />
            </TouchableOpacity>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/ai')}>
                <MaterialCommunityIcons name="robot-outline" size={20} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/weather')}>
                <MaterialCommunityIcons name="weather-partly-cloudy" size={20} color="#022E1F" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/login')}>
                <MaterialCommunityIcons name="login" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Location & Title */}
          <View style={styles.locationHeaderRow}>
            <Ionicons name="location-outline" size={14} color="#4b5563" />
            <Text style={styles.locationText}>{currCity.toUpperCase()}, INDIA</Text>
            <Text style={styles.timeText}>•    {(() => {
              const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const timeStr = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              return `${dateStr}, ${timeStr}`;
            })()}</Text>
          </View>

          <Text style={styles.pageTitle}>Weather & Forecast</Text>
          <Text style={styles.subtitleGray}>Real-time and future weather insights for your farm</Text>

          {/* Current Weather Main Card */}
          <View style={styles.mainWeatherCard}>
            <View style={styles.weatherCardTop}>
              <View>
                <View style={styles.currentPill}>
                  <MaterialCommunityIcons name="target" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.currentPillText}>CURRENT</Text>
                </View>
                
                <View style={styles.tempRow}>
                  <Text style={styles.hugeTemp}>{currTemp != null ? `${currTemp}°` : '–'}</Text>
                  {currTemp != null && <Text style={styles.tempUnit}>C</Text>}
                </View>

                <Text style={styles.weatherCondition}>{currCondition ?? '–'}</Text>
                <Text style={styles.feelsLikeText}>{currFeelsLike != null ? `Feels like ${currFeelsLike}°C` : '–'}</Text>
              </View>
              
              <View style={styles.weatherIconLarge}>
                <MaterialCommunityIcons name={currIcon as any} size={72} color="#ffffff" />
              </View>
            </View>

            <View style={styles.weatherCardBottom}>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>HUMIDITY</Text>
                  <View style={styles.gridValueRow}>
                    <MaterialCommunityIcons name="water-percent" size={16} color="#ffffff" />
                    <Text style={styles.gridValueText}>  {currHumidity != null ? `${currHumidity}%` : '–'}</Text>
                  </View>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>WIND</Text>
                  <View style={styles.gridValueRow}>
                    <MaterialCommunityIcons name="weather-windy" size={16} color="#ffffff" />
                    <Text style={styles.gridValueText}>  {currWind != null ? `${currWind} km/h` : '–'}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>PRESSURE</Text>
                  <View style={styles.gridValueRow}>
                    <MaterialCommunityIcons name="arrow-down" size={16} color="#ffffff" />
                    <Text style={styles.gridValueText}>  {currPressure != null ? `${currPressure} hPa` : '–'}</Text>
                  </View>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>VISIBILITY</Text>
                  <View style={styles.gridValueRow}>
                    <MaterialCommunityIcons name="eye-outline" size={16} color="#ffffff" />
                    <Text style={styles.gridValueText}>  {currVisibility != null ? `${currVisibility} km` : '–'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Precipitation Card */}
          <View style={styles.glassCard}>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="weather-pouring" size={16} color="#6b7280" />
              <Text style={styles.cardHeaderTitle}>PRECIPITATION</Text>
            </View>
            <Text style={styles.precipDescText}>{precipDesc}</Text>
            
            <View style={styles.probRow}>
              <Text style={styles.probBigText}>{todayRainProb}%</Text>
              <Text style={styles.probSmallText}>  probability</Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${todayRainProb}%` }]} />
            </View>
          </View>

          {/* Farming Advisory Card */}
          <View style={styles.advisoryCard}>
            <View style={styles.cardHeaderRow}>
              <MaterialCommunityIcons name="robot-outline" size={16} color="#9a3412" />
              <Text style={[styles.cardHeaderTitle, { color: '#9a3412' }]}>AI FARMING ADVISORY</Text>
            </View>

            {(() => {
              if (aiAdvisory === 'Analyzing real-time data for smart recommendations...') {
                return (
                  <View style={styles.advisoryItem}>
                    <MaterialCommunityIcons name="auto-fix" size={16} color="#059669" />
                    <Text style={[styles.advisoryItemText, { flex: 1, lineHeight: 18 }]}>
                      {aiAdvisory}
                    </Text>
                  </View>
                );
              }

              // Strip markdown bold and split by newlines
              const cleanText = aiAdvisory.replace(/\*\*/g, '');
              const parts = cleanText.split('\n').filter(p => p.trim().length > 0);

              return parts.map((part, index) => {
                // Remove numeric prefixes (like "1. ") or bullet points (like "- ")
                const cleanedPart = part.replace(/^(\d+\.|-)\s*/, '').trim();
                if (!cleanedPart) return null;

                return (
                  <View key={`adv-${index}`} style={[styles.advisoryItem, { marginBottom: 8 }]}>
                    <MaterialCommunityIcons name="leaf-circle-outline" size={18} color="#059669" />
                    <Text style={[styles.advisoryItemText, { flex: 1, lineHeight: 20 }]}>
                      {cleanedPart}
                    </Text>
                  </View>
                );
              });
            })()}
          </View>

          {/* 2x2 Metrics Grid */}
          <View style={styles.twoByTwoGrid}>
            <View style={styles.smallMetricCard}>
              <MaterialCommunityIcons name="weather-sunny" size={20} color="#022E1F" />
              <Text style={styles.smallMetricLabel}>UV INDEX</Text>
              <Text style={styles.smallMetricValue}>Medium (5)</Text>
            </View>
            <View style={styles.smallMetricCard}>
              <MaterialCommunityIcons name="weather-windy" size={20} color="#022E1F" />
              <Text style={styles.smallMetricLabel}>AIR QUALITY</Text>
              <Text style={styles.smallMetricValue}>Good (42)</Text>
            </View>
            <View style={styles.smallMetricCard}>
              <MaterialCommunityIcons name="sprout-outline" size={20} color="#022E1F" />
              <Text style={styles.smallMetricLabel}>SOIL TEMP</Text>
              <Text style={styles.smallMetricValue}>{soilTemp != null ? `${soilTemp}°C` : '–'}</Text>
            </View>
            <View style={styles.smallMetricCard}>
              <Ionicons name="water-outline" size={20} color="#022E1F" />
              <Text style={styles.smallMetricLabel}>SOIL MOISTURE</Text>
              <Text style={styles.smallMetricValue}>{soilMoisture != null ? `${soilMoisture}%` : '–'}</Text>
            </View>
          </View>

          {/* Today's Forecast */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderBold}>Today's Forecast</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollPadding}>
              {(weatherHourly.length > 0 ? weatherHourly.slice(0, 5) : [
                { time: '11:00 AM', icon: 'weather-partly-cloudy', temp: 29, pRain: 10 },
                { time: '12:00 PM', icon: 'weather-partly-cloudy', temp: 30, pRain: 15 },
                { time: '1:00 PM', icon: 'weather-cloudy', temp: 31, pRain: 20 },
                { time: '2:00 PM', icon: 'weather-cloudy', temp: 32, pRain: 20 },
                { time: '3:00 PM', icon: 'weather-sunny', temp: 33, pRain: 5 },
              ]).map((hourData, i) => (
                <View key={i} style={styles.hourlyCard}>
                  <Text style={styles.hourlyTime}>{hourData.time}</Text>
                  <MaterialCommunityIcons name={hourData.icon as any} size={22} color="#022E1F" />
                  {hourData.pRain !== undefined && hourData.pRain > 0 && (
                    <Text style={styles.hourlyRainText}>{hourData.pRain}%</Text>
                  )}
                  <Text style={styles.hourlyTemp}>{hourData.temp}°</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* 7-Day Forecast */}
          <View style={styles.glassCard}>
            <Text style={styles.sectionHeaderBold}>7-Day Forecast</Text>
            
            {forecastData.map((data, index) => {
              const isToday = index === 0;
              const isActive = index === activeDayIndex;
              return (
                <TouchableOpacity 
                  key={index}
                  activeOpacity={0.8}
                  onPress={() => setActiveDayIndex(index)}
                  style={[
                    styles.forecastRow, 
                    isActive && styles.forecastRowSelected,
                    isToday && styles.forecastRowToday
                  ]}
                >
                  <Text style={[styles.forecastDay, (isToday || isActive) && styles.textWhite]}>{data.day}</Text>
                  <MaterialCommunityIcons 
                    name={data.icon as any} 
                    size={20} 
                    color={(isToday || isActive) ? "#fff" : "#022E1F"} 
                    style={styles.forecastIcon} 
                  />
                  <Text style={[styles.forecastRain, (isToday || isActive) && styles.textWhiteOpacity]}>{data.pRain}% rain</Text>
                  <Text style={[styles.forecastMin, (isToday || isActive) && styles.textWhite]}>{data.min}°</Text>
                  <Text style={[styles.forecastMax, (isToday || isActive) && styles.textWhite]}>{data.max}°</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Temperature Trends */}
          <View style={[styles.glassCard, { marginBottom: 30 }]}>
            <Text style={styles.sectionHeaderBold}>Hourly Temperature Trends</Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              <View>
                <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT, position: 'relative', marginTop: 20 }}>
                  {renderTrendLine()}
                  {renderTrendDots()}
                </View>
                <View style={{ flexDirection: 'row', width: CHART_WIDTH, marginTop: 15 }}>
                  {hourlySubset.map((data, index) => (
                    <View key={index} style={{ width: SPACING, alignItems: 'center', marginLeft: index === 0 ? -SPACING/2 : 0 }}>
                      <Text style={[
                        styles.trendDayText, 
                        { fontSize: 10, width: 60, textAlign: 'center' },
                        index === selectedGraphIndex && { color: '#0ea5e9', fontWeight: 'bold' }
                      ]}>
                        {(() => {
                          const timePart = data.time.split(' ')[0]; // "05:30"
                          const hour = timePart.split(':')[0]; 
                          const ampm = data.time.toLowerCase().includes('pm') ? 'PM' : 'AM';
                          return `${parseInt(hour)} ${ampm}`;
                        })()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Bottom spacer for the tab bar */}
          <View style={{ height: 120 }} />

        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFA',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  /* HEADER */
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  avatarContainer: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: '#fff',
    padding: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    backgroundColor: '#fff',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },

  /* LOCATION & TITLE */
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4b5563',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 8,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#022E1F',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitleGray: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 18,
  },

  /* MAIN WEATHER CARD */
  mainWeatherCard: {
    backgroundColor: '#022E1F',
    borderRadius: 30,
    paddingTop: 25,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
    elevation: 6,
  },
  weatherCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
  },
  currentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 10,
  },
  currentPillText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hugeTemp: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeight: 60,
  },
  tempUnit: {
    fontSize: 20,
    color: '#ffffff',
    marginTop: 5,
  },
  weatherCondition: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 2,
  },
  feelsLikeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  weatherIconLarge: {
    marginTop: 10,
  },
  weatherCardBottom: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 15,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridItem: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  gridValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridValueText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },

  /* COMMON CARDS */
  glassCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 1,
    marginLeft: 6,
    marginTop: 2,
  },

  /* PRECIPITATION */
  precipDescText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  probRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 15,
  },
  probBigText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#475569',
  },
  probSmallText: {
    fontSize: 12,
    color: '#64748b',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#334155', // dark slate blue
    borderRadius: 4,
  },

  /* ADVISORY CARD */
  advisoryCard: {
    backgroundColor: '#ffedd5', // light peach
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
  },
  advisoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  advisoryItemText: {
    fontSize: 12,
    color: '#1f2937',
    marginLeft: 10,
    fontWeight: '500',
  },

  /* 2x2 METRICS GRID */
  twoByTwoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 15,
  },
  smallMetricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  smallMetricLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  smallMetricValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#022E1F',
  },

  /* TODAY'S FORECAST HORIZONTAL */
  sectionContainer: {
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    paddingVertical: 20,
    borderRadius: 24,
  },
  sectionHeaderBold: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#022E1F',
    marginBottom: 15,
    marginHorizontal: 20,
  },
  horizontalScrollPadding: {
    paddingHorizontal: 20,
    gap: 12,
  },
  hourlyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
    width: 85,
  },
  hourlyTime: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 10,
    fontWeight: '600',
  },
  hourlyRainText: {
    fontSize: 9,
    color: '#0ea5e9',
    fontWeight: 'bold',
    marginTop: 2,
  },
  hourlyTemp: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
    marginTop: 10,
  },

  /* 7-DAY FORECAST */
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 4,
  },
  forecastRowToday: {
    backgroundColor: '#0ea5e9', // Blue bar for today
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  forecastRowSelected: {
    backgroundColor: '#022E1F', // Contrast color for other selections
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textWhite: {
    color: '#ffffff',
  },
  textWhiteOpacity: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  forecastDay: {
    width: 50,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  forecastDayActive: {
    width: 40,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0369a1', // darker blue text
  },
  forecastIcon: {
    width: 30,
    textAlign: 'center',
  },
  forecastRain: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginHorizontal: 10,
  },
  forecastMin: {
    width: 35,
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'right',
  },
  forecastMax: {
    width: 35,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'right',
    marginLeft: 10,
  },

  /* TEMPERATURE TRENDS */
  trendGraphPlaceholder: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  trendDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  trendDayText: {
    fontSize: 10,
    color: '#9ca3af',
  }
});
