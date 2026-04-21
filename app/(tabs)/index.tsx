import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSensorData, useIrrigation, useWeather } from '../../services/database';
import { useAuth } from '../../services/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function InsightsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTimeframe, setActiveTimeframe] = useState('WEEK');
  const [activeMoisture, setActiveMoisture] = useState<number | null>(null);
  const [activeIrrigation, setActiveIrrigation] = useState<number | null>(6);

  // Device code from paired ESP32 (falls back for demo)
  const deviceId = user?.deviceCode || 'user_001';

  // --- Firebase Real-Time Data (scoped to paired device) ---
  const { latest: sensorLatest, history: sensorHistory, loading: sensorLoading } = useSensorData(deviceId);
  const { data: irrigationData, waterUsage, loading: irrigLoading } = useIrrigation(deviceId);
  const { current: weatherCurrent } = useWeather();

  const currTemp = weatherCurrent?.temp ?? 28;
  const currHumidity = weatherCurrent?.humidity ?? 62;

  // Derive chart data from Firebase history (fallback to mock)
  const moistureData = sensorHistory.length >= 7
    ? sensorHistory.map(s => s.soilMoisture)
    : [45, 52, 48, 68, 55, 75, 62];
  const irrigationChartData = waterUsage.length >= 7
    ? waterUsage
    : [3.5, 4.8, 2.5, 5.2, 4.0, 2.0, 6.5];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // --- Line Chart Math Calculations ---
  const CHART_HEIGHT = 80;
  const CHART_WIDTH = SCREEN_WIDTH - 127; // Increased buffer to prevent overflow
  const SPACING = CHART_WIDTH / 6;

  // Scale data (0 - 100%) to Y coordinates (0 is top, 80 is bottom)
  const getMoistureY = (val: number) => CHART_HEIGHT - ((val / 100) * CHART_HEIGHT);

  const renderLineSegments = () => {
    return moistureData.map((val, i) => {
      if (i === moistureData.length - 1) return null;
      
      const x1 = i * SPACING;
      const y1 = getMoistureY(val);
      const x2 = (i + 1) * SPACING;
      const y2 = getMoistureY(moistureData[i + 1]);

      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      return (
        <View
          key={`line-${i}`}
          style={{
            position: 'absolute',
            left: cx - length / 2 + 4, // +4 to center with dot (width 8)
            top: cy + 4, // +4 to center with dot (height 8)
            width: length,
            height: 2,
            backgroundColor: '#013a20',
            transform: [{ rotate: `${angle}deg` }],
          }}
        />
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
                <MaterialCommunityIcons name="weather-partly-cloudy" size={20} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/login')}>
                <MaterialCommunityIcons name="login" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Page Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>Insights</Text>
            <Text style={styles.pageSubtitle}>Smart analytics for your farm</Text>
          </View>

          {/* Timeframe Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleBtn, activeTimeframe === 'WEEK' && styles.activeToggleBtn]}
              onPress={() => setActiveTimeframe('WEEK')}
            >
              <Text style={[styles.toggleText, activeTimeframe === 'WEEK' && styles.activeToggleText]}>
                THIS WEEK
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, activeTimeframe === 'MONTH' && styles.activeToggleBtn]}
              onPress={() => setActiveTimeframe('MONTH')}
            >
              <Text style={[styles.toggleText, activeTimeframe === 'MONTH' && styles.activeToggleText]}>
                THIS MONTH
              </Text>
            </TouchableOpacity>
          </View>

          {/* 1. INTERACTIVE Soil Moisture Line Chart */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Soil Moisture Trend</Text>
                <Text style={styles.cardSubtitle}>Sector A & B Average</Text>
              </View>
              <View style={styles.badgeBlue}>
                <Text style={styles.badgeTextBlue}>AVG 68%</Text>
              </View>
            </View>
            
            <View style={styles.chartAreaWrapper}>
              <View style={styles.lineChartContainer}>
                {renderLineSegments()}

                {moistureData.map((val, i) => {
                  const isActive = activeMoisture === i;
                  return (
                    <TouchableOpacity
                      key={`point-${i}`}
                      activeOpacity={1}
                      onPress={() => setActiveMoisture(isActive ? null : i)}
                      style={[styles.dotTouchArea, { left: i * SPACING - 12 }]}
                    >
                      {/* Vertical highlight line on select */}
                      {isActive && <View style={styles.verticalGuideline} />}
                      
                      {/* Tooltip */}
                      {isActive && (
                        <View style={[styles.tooltipDynamic, { top: getMoistureY(val) - 30 }]}>
                          <Text style={styles.tooltipText}>{val}%</Text>
                        </View>
                      )}

                      {/* The Dot */}
                      <View style={[
                        styles.dot, 
                        { top: getMoistureY(val) },
                        isActive && styles.dotActive
                      ]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              {/* X Axis Labels */}
              <View style={styles.axisRow}>
                {days.map((day, i) => (
                  <Text key={`day-${i}`} style={[styles.chartAxisText, activeMoisture === i && { color: '#013a20', fontWeight: 'bold' }]}>
                    {day}
                  </Text>
                ))}
              </View>
            </View>
          </View>

          {/* 2. INTERACTIVE Irrigation Duration Bar Chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Irrigation Duration</Text>
            <View style={styles.durationValueContainer}>
              <Text style={styles.durationBig}>
                {activeIrrigation !== null ? irrigationChartData[activeIrrigation] : '4.2'}
              </Text>
              <Text style={styles.durationUnit}>Hours</Text>
            </View>

            <View style={styles.barChartContainer}>
              {irrigationChartData.map((val: number, i: number) => {
                const isActive = activeIrrigation === i;
                const barHeight = (val / 8.0) * CHART_HEIGHT; // Map out of max 8 hours

                return (
                  <TouchableOpacity 
                    key={`bar-${i}`} 
                    style={styles.barCol}
                    activeOpacity={0.8}
                    onPress={() => setActiveIrrigation(i)}
                  >
                    {isActive && (
                      <View style={styles.tooltipBar}>
                        <Text style={styles.tooltipText}>{val}h</Text>
                      </View>
                    )}
                    <View style={[
                      styles.bar, 
                      { height: barHeight },
                      isActive && styles.barActive
                    ]} />
                    <Text style={[styles.chartAxisText, isActive && { color: '#013a20', fontWeight: 'bold' }]}>
                      {days[i]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Environment Metrics */}
          <View style={styles.smallMetricCard}>
            <View style={styles.smallMetricLeft}>
              <FontAwesome5 name="thermometer-half" size={14} color="#e11d48" />
              <Text style={styles.smallMetricLabel}>TEMPERATURE</Text>
            </View>
            <View style={styles.smallMetricValueRow}>
              <Text style={styles.smallMetricBig}>{currTemp}°</Text>
              <Text style={styles.smallMetricUnit}>C</Text>
              <View style={styles.sparklineFake} />
            </View>
          </View>

          <View style={styles.smallMetricCard}>
            <View style={styles.smallMetricLeft}>
              <Ionicons name="water-outline" size={16} color="#475569" />
              <Text style={styles.smallMetricLabel}>HUMIDITY</Text>
            </View>
            <View style={styles.smallMetricValueRow}>
              <Text style={styles.smallMetricBig}>{currHumidity}</Text>
              <Text style={styles.smallMetricUnit}>%</Text>
              <View style={[styles.sparklineFake, { borderBottomColor: '#38bdf8' }]} />
            </View>
          </View>

          {/* Crop Health & Yield */}
          <View style={styles.card}>
            <View style={styles.healthHeader}>
              <View style={styles.healthIconBox}>
                <Ionicons name="leaf-outline" size={20} color="#059669" />
              </View>
              <View>
                <Text style={styles.smallMetricLabel}>CROP HEALTH STATUS</Text>
                <Text style={styles.healthStatusBig}>Healthy</Text>
              </View>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.indexScoreLabel}>INDEX SCORE</Text>
              <Text style={styles.indexScoreValue}>GOOD</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '85%' }]} />
            </View>
          </View>

          <View style={styles.cardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.smallMetricLabel}>YIELD PREDICTION</Text>
              <Text style={styles.healthStatusBig}>Expected Yield</Text>
              <Text style={styles.yieldBig}>85%</Text>
            </View>
            <View style={styles.gaugeContainer}>
              <View style={styles.gaugeOuter}>
                <View style={styles.gaugeInner}>
                  <Ionicons name="trending-up" size={24} color="#013a20" />
                </View>
              </View>
            </View>
          </View>

          {/* AI Recommendations Section */}
          <View style={styles.aiSectionHeader}>
            <MaterialCommunityIcons name="robot-outline" size={20} color="#013a20" />
            <Text style={styles.aiSectionTitle}>AI Recommendations</Text>
          </View>

          <View style={styles.recCard}>
            <View style={[styles.recIconBox, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="water" size={18} color="#0284c7" />
            </View>
            <Text style={styles.recTitle}>Increase irrigation in next 2 days</Text>
            <Text style={styles.recDesc}>
              Weather models predict a minor dry spell. Increasing Sector B irrigation by 15% will maintain optimal soil moisture levels for the current growth phase.
            </Text>
          </View>

          <View style={styles.recCard}>
            <View style={[styles.recIconBox, { backgroundColor: '#ffedd5' }]}>
              <Ionicons name="sunny" size={18} color="#ea580c" />
            </View>
            <Text style={styles.recTitle}>High temperature warning</Text>
            <Text style={styles.recDesc}>
              Temperatures are expected to peak at 34°C tomorrow afternoon. Consider deploying partial shade nets over vulnerable saplings in the nursery.
            </Text>
            <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/weather')}>
              <Text style={styles.linkBtnText}>VIEW DETAILS</Text>
              <Ionicons name="arrow-forward" size={14} color="#ea580c" />
            </TouchableOpacity>
          </View>

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
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
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
  titleContainer: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#022E1F',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#eaeef0',
    borderRadius: 25,
    padding: 4,
    marginBottom: 25,
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  activeToggleBtn: {
    backgroundColor: '#013a20',
  },
  toggleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  activeToggleText: {
    color: '#ffffff',
  },
  card: {
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
  cardRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  badgeBlue: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextBlue: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  /* MATH LINE CHART STYLES */
  chartAreaWrapper: {
    marginTop: 20,
    backgroundColor: '#f1f6f4',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 40, 
    paddingBottom: 20,
  },
  lineChartContainer: {
    height: 80, // Matches CHART_HEIGHT
    position: 'relative',
    width: '100%',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  dotTouchArea: {
    position: 'absolute',
    width: 32, // larger touch target
    height: '100%',
    alignItems: 'center',
    zIndex: 10,
  },
  verticalGuideline: {
    position: 'absolute',
    width: 1,
    height: '120%',
    backgroundColor: 'rgba(1, 58, 32, 0.1)',
    top: -10,
  },
  dot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#013a20',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  dotActive: {
    transform: [{ scale: 1.5 }],
    backgroundColor: '#059669',
  },
  tooltipDynamic: {
    position: 'absolute',
    backgroundColor: '#022E1F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 20,
    alignItems: 'center',
  },
  
  chartAxisText: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  durationValueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 5,
  },
  durationBig: {
    fontSize: 24,
    fontWeight: '300',
    color: '#022E1F',
  },
  durationUnit: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    marginLeft: 4,
  },
  
  /* BAR CHART STYLES */
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    marginTop: 20,
    paddingHorizontal: 5,
  },
  barCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    width: 30, // Larger touch area
  },
  tooltipBar: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#022E1F',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  bar: {
    width: 24,
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    marginBottom: 10,
    zIndex: 1,
  },
  barActive: {
    backgroundColor: '#013a20',
  },
  
  smallMetricCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 15,
    paddingHorizontal: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  smallMetricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallMetricLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  smallMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  smallMetricBig: {
    fontSize: 28,
    fontWeight: '300',
    color: '#022E1F',
  },
  smallMetricUnit: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 2,
    marginBottom: 5,
  },
  sparklineFake: {
    flex: 1,
    height: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#fca5a5',
    marginLeft: 20,
    marginBottom: 10,
    borderRadius: 10,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthStatusBig: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#022E1F',
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  indexScoreLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  indexScoreValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#013a20',
    borderRadius: 3,
  },
  yieldBig: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#022E1F',
    marginTop: 5,
  },
  gaugeContainer: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeOuter: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    borderWidth: 6,
    borderColor: '#e2e8f0',
    borderTopColor: '#013a20',
    borderRightColor: '#013a20',
    borderBottomColor: '#013a20',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '-45deg' }]
  },
  gaugeInner: {
    transform: [{ rotate: '45deg' }]
  },
  aiSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 15,
    marginBottom: 15,
  },
  aiSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  recCard: {
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
  recIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  recTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
    marginBottom: 8,
  },
  recDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  linkBtnText: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});