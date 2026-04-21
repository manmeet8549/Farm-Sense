import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSensorData, useWeather, useIrrigation, updatePumpStatus, useHealthScans } from '../../services/database';
import { startWeatherAutoRefresh, stopWeatherAutoRefresh } from '../../services/weather';
import { useAuth } from '../../services/auth';

export default function FarmScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // --- Real-time Date & Time ---
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => setCurrentDate(new Date()), 60000);
    
    // Start weather auto-refresh on mount
    startWeatherAutoRefresh('current', 600000); // every 10 min
    
    return () => {
      clearInterval(timer);
      stopWeatherAutoRefresh();
    };
  }, []);

  const getGreeting = () => {
    const hour = currentDate.getHours();
    if (hour < 12) return 'Hello, Good Morning';
    if (hour < 18) return 'Hello, Good Afternoon';
    return 'Hello, Good Evening';
  };

  const getFormattedDate = () => {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    
    const dayName = days[currentDate.getDay()];
    const date = currentDate.getDate().toString().padStart(2, '0');
    const monthName = months[currentDate.getMonth()];
    const year = currentDate.getFullYear();
    
    return `${dayName}, ${date} ${monthName} ${year}`;
  };

  // --- Firebase Real-Time Data ---
  const deviceId = user?.deviceCode || 'user_001';
  const { latest: sensorLatest } = useSensorData(deviceId);
  const { current: weatherCurrent, daily } = useWeather();
  const { data: irrigData } = useIrrigation(deviceId);
  const { scans } = useHealthScans(deviceId);

  // Derive values with fallbacks
  const moisture = sensorLatest?.soilMoisture ?? 45;
  const temperature = weatherCurrent?.temp ?? sensorLatest?.temperature ?? 28;
  const humidity = weatherCurrent?.humidity ?? sensorLatest?.humidity ?? 65;
  const condition = weatherCurrent?.condition ?? 'Partly Cloudy';
  const windSpeed = weatherCurrent?.windSpeed ?? 12;
  const weatherIcon = weatherCurrent?.icon ?? 'weather-partly-cloudy';
  const city = weatherCurrent?.city ?? 'Punjab';

  // --- Dynamic Recommendations Logic ---
  const getRecommendations = () => {
    const recs = [];
    const threshold = irrigData?.threshold ?? 30;

    // 1. Irrigation recommendation
    if (moisture < threshold && irrigData?.pumpStatus === 'OFF') {
      recs.push({
        id: 'irrigation',
        title: 'Irrigation Recommended',
        desc: `Soil moisture (${moisture}%) is below your ${threshold}% threshold.`,
        icon: 'water',
        iconType: 'Ionicons',
        color: '#0284c7',
        bgColor: '#bae6fd',
        action: () => router.push('/irrigation')
      });
    }

    // 2. Weather/Rain alert
    const rainToday = daily?.[0]?.pRain ?? 0;
    if (rainToday > 50) {
      recs.push({
        id: 'rain',
        title: 'Rain Expected Today',
        desc: `High probability of rain (${rainToday}%). You might want to skip irrigation.`,
        icon: 'weather-pouring',
        iconType: 'MaterialCommunityIcons',
        color: '#1e40af',
        bgColor: '#dbeafe',
        action: () => router.push('/weather')
      });
    } else if (condition.toLowerCase().includes('rain')) {
      recs.push({
        id: 'rain-now',
        title: 'Raining Now',
        desc: 'It is currently raining. Ensure your equipment is protected.',
        icon: 'weather-rainy',
        iconType: 'MaterialCommunityIcons',
        color: '#1e40af',
        bgColor: '#dbeafe',
        action: () => router.push('/weather')
      });
    }

    // 3. Heat stress
    if (temperature > 38) {
      recs.push({
        id: 'heat',
        title: 'High Heat Warning',
        desc: `Temperature is ${temperature}°C. Increased evaporation risk for crops.`,
        icon: 'thermometer',
        iconType: 'Ionicons',
        color: '#b91c1c',
        bgColor: '#fee2e2',
        action: () => router.push('/weather')
      });
    }

    // 4. Crop Health
    const lastScan = scans?.[0];
    const daysSinceScan = lastScan ? (Date.now() - lastScan.timestamp) / 86400000 : 10;
    if (daysSinceScan > 3) {
      recs.push({
        id: 'health',
        title: 'Crop Health Check',
        desc: 'It’s been over 3 days since your last health scan. Consider a new scan.',
        icon: 'scan',
        iconType: 'Ionicons',
        color: '#166534',
        bgColor: '#dcfce7',
        action: () => router.push('/ai')
      });
    }

    // Fallback if no specific recommendations
    if (recs.length === 0) {
      recs.push({
        id: 'status-ok',
        title: 'All Systems Optimal',
        desc: 'Your farm is looking great! No urgent actions needed at the moment.',
        icon: 'checkmark-circle',
        iconType: 'Ionicons',
        color: '#059669',
        bgColor: '#ecfdf5',
        action: () => {}
      });
    }

    return recs;
  };

  const recommendations = getRecommendations();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.headerBackground}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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
                  <MaterialCommunityIcons name="weather-partly-cloudy" size={20} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/login')}>
                  <MaterialCommunityIcons name="login" size={20} color="#000" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.greetingContainer}>
              <Text style={styles.greetingTitle}>{getGreeting()}</Text>
              <Text style={styles.greetingDate}>{getFormattedDate()}</Text>
            </View>

            {/* Spacer for padding instead of search bar */}
            <View style={{ height: 70 }} />
          </SafeAreaView>
        </View>

        {/* Overlapping Weather Card */}
        <View style={styles.weatherCardWrapper}>
          <LinearGradient
            colors={['#2A4D45', '#162E28']} // Elegant dark green gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.weatherCard}
          >
            {/* Dark gradient blur look - simulating with solid semi-dark + blur conceptually */}
            <View style={styles.weatherHeader}>
              <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={16} color="#fff" />
                <Text style={styles.locationText}>{city.toUpperCase()}</Text>
              </View>
              <View style={styles.moisturePill}>
                <Text style={styles.moistureText}>{moisture}% MOISTURE</Text>
              </View>
            </View>

            <View style={styles.weatherMain}>
              <View style={styles.tempContainer}>
                <Text style={styles.tempBig}>{temperature}°</Text>
                <Text style={styles.tempUnit}>C</Text>
              </View>
              <View style={styles.weatherCondition}>
                <MaterialCommunityIcons name={weatherIcon as any} size={32} color="#fff" />
                <Text style={styles.conditionText}>{condition}</Text>
              </View>
            </View>

            <View style={styles.weatherStats}>
              <View style={styles.statPill}>
                <Ionicons name="water-outline" size={16} color="#6b7280" />
                <Text style={styles.statLabel}>HUMIDITY</Text>
                <Text style={styles.statValue}>{humidity}%</Text>
              </View>
              <View style={styles.statPill}>
                <MaterialCommunityIcons name="sprinkler" size={16} color="#6b7280" />
                <Text style={styles.statLabel}>IRRIGATION</Text>
                <Text style={styles.statValue}>Low</Text>
              </View>
              <View style={styles.statPill}>
                <MaterialCommunityIcons name="weather-windy" size={16} color="#6b7280" />
                <Text style={styles.statLabel}>WIND</Text>
                <Text style={styles.statValue}>{windSpeed} km/h</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Insights Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick Insights</Text>
          <View style={styles.insightsGrid}>
            <View style={styles.insightCard}>
              <View style={[styles.insightIconWrapper, { backgroundColor: moisture < (irrigData?.threshold ?? 30) ? '#fee2e2' : '#e0f2fe' }]}>
                <MaterialCommunityIcons 
                  name="sprout" 
                  size={20} 
                  color={moisture < (irrigData?.threshold ?? 30) ? '#b91c1c' : '#0284c7'} 
                />
              </View>
              <Text style={styles.insightLabel}>SOIL STATUS</Text>
              <Text style={styles.insightValue}>
                {moisture < (irrigData?.threshold ?? 30) ? 'Dry' : moisture > 80 ? 'Wet' : 'Optimal'}
              </Text>
            </View>
            <View style={styles.insightCard}>
              <View style={[styles.insightIconWrapper, { backgroundColor: '#dcfce7' }]}>
                <MaterialCommunityIcons name="water-pump" size={20} color="#166534" />
              </View>
              <Text style={styles.insightLabel}>WATER USAGE</Text>
              <Text style={styles.insightValue}>
                {irrigData?.lastWatered ? '32' : '0'} L
              </Text>
            </View>
            <View style={styles.insightCard}>
              <View style={[styles.insightIconWrapper, { backgroundColor: '#ffedd5' }]}>
                <MaterialCommunityIcons name="leaf" size={20} color="#9a3412" />
              </View>
              <Text style={styles.insightLabel}>CROP HEALTH</Text>
              <Text style={styles.insightValue}>
                {scans?.[0]?.diseaseName === 'Healthy' ? 'Healthy' : scans?.[0]?.diseaseName || 'Not Scanned'}
              </Text>
            </View>
            <View style={styles.insightCard}>
              <View style={[styles.insightIconWrapper, { backgroundColor: (temperature > 35 || moisture < 20) ? '#fee2e2' : '#dcfce7' }]}>
                <MaterialCommunityIcons 
                  name="alert-outline" 
                  size={20} 
                  color={(temperature > 35 || moisture < 20) ? '#b91c1c' : '#166534'} 
                />
              </View>
              <Text style={styles.insightLabel}>RISK LEVEL</Text>
              <Text style={styles.insightValue}>
                {(temperature > 40 || moisture < 15) ? 'High' : (temperature > 35 || moisture < 25) ? 'Moderate' : 'Low'}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.startIrrigationBtn, irrigData?.pumpStatus === 'ON' && { backgroundColor: '#10b981' }]}
            onPress={async () => {
              await updatePumpStatus(deviceId, irrigData?.pumpStatus === 'ON' ? 'OFF' : 'ON');
            }}
          >
            <Ionicons name={irrigData?.pumpStatus === 'ON' ? "pause-circle-outline" : "play-circle-outline"} size={20} color="#fff" />
            <Text style={styles.startIrrigationText}>
              {irrigData?.pumpStatus === 'ON' ? 'Running...' : 'Start\nIrrigation'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.stopBtn}
            onPress={async () => {
              await updatePumpStatus(deviceId, 'OFF');
            }}
          >
            <Ionicons name="stop-circle-outline" size={20} color="#1f2937" />
            <Text style={styles.stopText}>Stop</Text>
          </TouchableOpacity>
        </View>

        {/* Scan Actions */}
        <View style={styles.scanActionsContainer}>
          <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/ai')}>
            <MaterialCommunityIcons name="line-scan" size={20} color="#0369a1" />
            <Text style={styles.scanBtnText}>Scan Crop Disease</Text>
          </TouchableOpacity>
        </View>

        {/* Recommendations */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          
          {recommendations.map((rec) => (
            <TouchableOpacity 
              key={rec.id} 
              style={styles.recommendationCard}
              onPress={rec.action}
              activeOpacity={0.7}
            >
              <View style={[styles.recIconWrapper, { backgroundColor: rec.bgColor }]}>
                {rec.iconType === 'Ionicons' ? (
                  <Ionicons name={rec.icon as any} size={24} color={rec.color} />
                ) : (
                  <MaterialCommunityIcons name={rec.icon as any} size={24} color={rec.color} />
                )}
              </View>
              <View style={styles.recTextContainer}>
                <Text style={styles.recTitle}>{rec.title}</Text>
                <Text style={styles.recDesc}>{rec.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom padding for tab bar */}
        <View style={{ height: 100 }} />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9f7',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerBackground: {
    backgroundColor: '#022E1F',
    paddingHorizontal: 20,
    paddingBottom: 60, // Extra padding so card overlaps
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  avatarContainer: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: '#fff',
    padding: 2,
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
  },
  greetingContainer: {
    marginTop: 25,
  },
  greetingTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  greetingDate: {
    color: '#7ca593',
    fontSize: 12,
    marginTop: 5,
    fontWeight: '600',
    letterSpacing: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    marginTop: 20,
    paddingHorizontal: 15,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  weatherCardWrapper: {
    marginTop: -40,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  weatherCard: {
    // backgroundColor: '#1E3C36', // Removed in favor of LinearGradient
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden',
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  moisturePill: {
    backgroundColor: '#cce6f4',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moistureText: {
    color: '#0369a1',
    fontSize: 10,
    fontWeight: 'bold',
  },
  weatherMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 25,
  },
  tempContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tempBig: {
    color: '#fff',
    fontSize: 56,
    fontWeight: 'bold',
    lineHeight: 60,
  },
  tempUnit: {
    color: '#ccc',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 5,
  },
  weatherCondition: {
    alignItems: 'center',
  },
  conditionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 5,
  },
  weatherStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    color: '#6b7280',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  statValue: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginTop: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
    marginBottom: 15,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  insightCard: {
    backgroundColor: '#fff',
    width: '47%',
    borderRadius: 20,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  insightIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  insightLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  insightValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 2,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 25,
    gap: 15,
  },
  startIrrigationBtn: {
    flex: 1,
    backgroundColor: '#014A32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 25,
    gap: 10,
  },
  startIrrigationText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stopBtn: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 25,
    gap: 10,
  },
  stopText: {
    color: '#1f2937',
    fontWeight: 'bold',
    fontSize: 16,
  },
  scanActionsContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  scanBtn: {
    backgroundColor: '#cce6f4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 20,
    gap: 10,
  },
  scanBtnText: {
    color: '#0369a1',
    fontWeight: 'bold',
    fontSize: 14,
  },
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  recIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  recTextContainer: {
    flex: 1,
  },
  recTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  recDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  }
});
