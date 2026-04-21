import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSensorData, useIrrigation, useAlerts, updatePumpStatus, updateIrrigationMode, updateThreshold as fbUpdateThreshold, updateIrrigationTimer } from '../../services/database';
import { useAuth } from '../../services/auth';

// --- CUSTOM CIRCULAR PROGRESS RING (PURE CSS) ---
const CircularProgress = ({ size, strokeWidth, percent, children }: any) => {
  const half = size / 2;
  
  // Right Half ranges from 0% to 50%
  const rightPercent = Math.min(percent, 50);
  const rightRotation = -225 + (rightPercent / 50) * 180; 

  // Left Half ranges from 50% to 100%
  const leftPercent = Math.max(percent - 50, 0);
  const leftRotation = -45 + (leftPercent / 50) * 180;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Background Ring */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: half, borderWidth: strokeWidth, borderColor: '#e5e7eb' }]} />
      
      {/* Right Half Mask */}
      <View style={{ position: 'absolute', width: half, height: size, right: 0, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            right: 0,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderRightColor: '#022E1F',
            borderBottomColor: '#022E1F',
            transform: [{ rotate: `${rightRotation}deg` }],
          }}
        />
      </View>

      {/* Left Half Mask */}
      <View style={{ position: 'absolute', width: half, height: size, left: 0, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            left: 0,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderRightColor: '#022E1F',
            borderBottomColor: '#022E1F',
            transform: [{ rotate: `${leftRotation}deg` }],
          }}
        />
      </View>

      {/* Inner Content */}
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {children}
      </View>
    </View>
  );
};


export default function IrrigationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [sliderWidth, setSliderWidth] = useState(1);

  // Device code from paired ESP32 (falls back to 'user_001' for demo)
  const deviceId = user?.deviceCode || 'user_001';

  // --- Firebase Real-Time Data (scoped to paired device) ---
  const { latest: sensorLatest, loading: sensorLoading } = useSensorData(deviceId);
  const { data: irrigData, waterUsage, loading: irrigLoading } = useIrrigation(deviceId);
  const { alerts } = useAlerts(deviceId);

  // filter recent relevant alerts
  const recentAlerts = alerts.slice(0, 3);

  // --- Connection Heartbeat Logic ---
  const [isOnline, setIsOnline] = useState(!!sensorLatest);
  const lastSeenRef = React.useRef(Date.now());
  const prevTimestampRef = React.useRef(-1);

  // Mark online immediately when sensor data arrives or changes
  useEffect(() => {
    if (sensorLatest) {
      const ts = sensorLatest.timestamp ?? 0;
      if (ts !== prevTimestampRef.current) {
        prevTimestampRef.current = ts;
        lastSeenRef.current = Date.now();
        if (!isOnline) setIsOnline(true);
      }
    }
  }, [sensorLatest]);

  // Connection monitoring: check every 2s, offline after 15s (ESP32 heartbeat is 5s)
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastSeenRef.current;
      if (elapsed > 15000 && isOnline) {
        setIsOnline(false);
      } else if (elapsed <= 15000 && !isOnline) {
        setIsOnline(true);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [isOnline]);

  // Derive values from Firebase (with fallbacks)
  const isAuto = irrigData?.mode === 'AUTO';
  const isPumpOn = irrigData?.pumpStatus === 'ON';
  const moistureValue = sensorLatest?.soilMoisture ?? 0;
  const threshold = irrigData?.threshold ?? 30;
  const lastWatered = irrigData?.lastWatered || 0;

  // --- Dynamic Pump Runtime Logic ---
  const [activePumpHours, setActivePumpHours] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isPumpOn && lastWatered > 0) {
      timer = setInterval(() => {
        setActivePumpHours((Date.now() - lastWatered) / 3600000); // ms to hours
      }, 1000); // update every second for live feel
    } else {
      setActivePumpHours(0);
    }
    return () => clearInterval(timer);
  }, [isPumpOn, lastWatered]);

  const todayBase = waterUsage.length > 0 ? waterUsage[waterUsage.length - 1] : 0;
  const weekBase = waterUsage.reduce((acc, val) => acc + val, 0);

  const todayTotal = (todayBase + activePumpHours).toFixed(2);
  const weekTotal = (weekBase + activePumpHours).toFixed(2);

  // Toggle handlers that write to Firebase
  const handlePumpToggle = async () => {
    await updatePumpStatus(deviceId, isPumpOn ? 'OFF' : 'ON');
  };
  const handleModeToggle = async () => {
    await updateIrrigationMode(deviceId, isAuto ? 'MANUAL' : 'AUTO');
  };

  // --- Pump Timer Logic ---
  const [selectedTimer, setSelectedTimer] = useState(0); // minutes

  useEffect(() => {
    let timerId: any;
    if (isPumpOn && selectedTimer > 0) {
      // Convert minutes to ms
      timerId = setTimeout(async () => {
        await updatePumpStatus(deviceId, 'OFF');
        setSelectedTimer(0); // Reset timer
      }, selectedTimer * 60000);
    }
    return () => clearTimeout(timerId);
  }, [isPumpOn, selectedTimer]);

  // Drag handler for Threshold slider
  const handleSliderDrag = async (evt: any) => {
    const x = evt.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(x / sliderWidth, 1));
    const newThreshold = Math.round(pct * 100);
    await fbUpdateThreshold(deviceId, newThreshold);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} scrollEnabled={true}>
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

          {/* Page Title & Status */}
          <View style={styles.titleHeader}>
            <View style={styles.titleTextContainer}>
              <Text style={styles.pageTitle}>Irrigation{'\n'}Control</Text>
            </View>
            <View style={[styles.systemStatusPill, !isOnline && { backgroundColor: '#fee2e2' }]}>
              <View style={[styles.statusDot, !isOnline && { backgroundColor: '#ef4444' }]} />
              <Text style={[styles.systemStatusText, !isOnline && { color: '#991b1b' }]}>
                SYSTEM{'\n'}{isOnline ? 'ACTIVE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
          <Text style={styles.pageSubtitle}>Smart water management system</Text>

          {/* 1. Current Soil Moisture (INTERACTIVE GRAPH) */}
          <TouchableOpacity 
            style={styles.moistureCard} 
            activeOpacity={0.9} 
            onPress={() => {}} // Moisture updates automatically from ESP32 sensors
          >
            <Text style={styles.sectionHeaderSmall}>SOIL MOISTURE</Text>
            <View style={styles.circleGraphContainer}>
              
              <CircularProgress size={190} strokeWidth={8} percent={moistureValue}>
                <Text style={styles.moistureBig}>{moistureValue}<Text style={styles.moisturePercent}>%</Text></Text>
                <View style={[styles.optimalPill, { backgroundColor: moistureValue < threshold ? '#fee2e2' : '#ecfdf5' }]}>
                  <Text style={[styles.optimalText, { color: moistureValue < threshold ? '#991b1b' : '#047857' }]}>
                    {moistureValue < threshold ? 'DRY' : 'OPTIMAL'}
                  </Text>
                </View>
              </CircularProgress>

            </View>
            <Text style={styles.hintText}>Tap to test dynamic graph updates</Text>
          </TouchableOpacity>

          {/* 2. Main Pump Control */}
          <View style={styles.pumpCard}>
            <View style={styles.pumpHeader}>
              <View>
                <Text style={styles.pumpTitle}>Main Pump</Text>
                <View style={styles.pumpStatusRow}>
                  <View style={[styles.pumpStatusDot, !isPumpOn && { backgroundColor: '#9ca3af' }]} />
                  <Text style={styles.pumpStatusText}>{isPumpOn ? 'PUMP IS RUNNING' : 'PUMP IS OFF'}</Text>
                </View>
              </View>
              <View style={styles.pumpIconContainer}>
                <MaterialCommunityIcons name="water-pump" size={24} color="#34d399" />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.pumpToggleBtn}
              activeOpacity={0.8}
              onPress={handlePumpToggle}
            >
              <Ionicons name="power" size={20} color={isPumpOn ? "#ef4444" : "#10b981"} />
              <Text style={styles.pumpToggleText}>
                {isPumpOn ? 'Turn Off Pump' : 'Turn On Pump'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 2.5 Pump Shutdown Timer (NEW) */}
          <View style={styles.timerCard}>
            <View style={styles.timerHeader}>
              <View>
                <Text style={styles.timerTitle}>Auto Shutdown Timer</Text>
                <Text style={styles.timerSubtitle}>Pump will stop after selected time</Text>
              </View>
              <MaterialCommunityIcons name="timer-outline" size={24} color="#022E1F" />
            </View>

            <View style={styles.timerOptionsRow}>
              {[1, 5, 10, 30].map((mins) => (
                <TouchableOpacity 
                  key={mins} 
                  style={[styles.timerOptionPill, selectedTimer === mins && styles.timerOptionPillActive]}
                  onPress={async () => {
                    setSelectedTimer(mins);
                    // Sync timer to Firebase for ESP32 visibility
                    await updateIrrigationTimer(deviceId, mins);
                  }}
                >
                  <Text style={[styles.timerOptionText, selectedTimer === mins && styles.timerOptionTextActive]}>
                    {mins}m
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                style={[styles.timerOptionPill, selectedTimer === 0 && styles.timerOptionPillActive]}
                onPress={async () => {
                  setSelectedTimer(0);
                  await updateIrrigationTimer(deviceId, 0);
                }}
              >
                <Text style={[styles.timerOptionText, selectedTimer === 0 && styles.timerOptionTextActive]}>Off</Text>
              </TouchableOpacity>
            </View>

            {isPumpOn && selectedTimer > 0 && (
              <View style={styles.countdownContainer}>
                <MaterialCommunityIcons name="clock-fast" size={16} color="#059669" />
                <Text style={styles.countdownText}>
                  Scheduled shutoff in {selectedTimer} minutes
                </Text>
              </View>
            )}
          </View>

          {/* 3. Auto/Manual Toggle */}
          <View style={styles.modeToggleContainer}>
            <TouchableOpacity 
              style={[styles.modeBtn, isAuto && styles.modeBtnActive]}
              onPress={() => updateIrrigationMode(deviceId, 'AUTO')}
              activeOpacity={0.9}
            >
              <Text style={[styles.modeBtnText, isAuto && styles.modeBtnTextActive]}>Auto</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modeBtn, !isAuto && styles.modeBtnActive]}
              onPress={() => updateIrrigationMode(deviceId, 'MANUAL')}
              activeOpacity={0.9}
            >
              <Text style={[styles.modeBtnText, !isAuto && styles.modeBtnTextActive]}>Manual</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeDescription}>
            System will irrigate based on soil moisture and weather forecasts.
          </Text>

          {/* 4. Auto Irrigation Threshold (INTERACTIVE SLIDER) */}
          <View style={styles.thresholdCard}>
            <View style={styles.thresholdHeader}>
              <Text style={styles.sectionHeaderSmall}>AUTO IRRIGATION THRESHOLD</Text>
              <Text style={styles.thresholdValue}>{threshold}%</Text>
            </View>
            
            {/* Interactive Slider */}
            <View 
              style={styles.sliderInteractiveArea}
              onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onResponderGrant={handleSliderDrag}
              onResponderMove={handleSliderDrag}
            >
              <View style={styles.sliderTrackLine} pointerEvents="none" />
              <View style={[styles.sliderTrackFill, { width: `${threshold}%` }]} pointerEvents="none" />
              <View style={[styles.sliderThumb, { left: `${threshold}%` }]} pointerEvents="none" />
            </View>

            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>DRY</Text>
              <Text style={styles.sliderLabelText}>WET</Text>
            </View>
          </View>

          {/* 5. Time Stats (Row) */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="water-outline" size={20} color="#1f2937" />
              <Text style={styles.statLabel}>TODAY</Text>
              <Text style={styles.statValue}>{todayTotal} Hr</Text>
            </View>
            
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="history" size={22} color="#1f2937" />
              <Text style={styles.statLabel}>THIS WEEK</Text>
              <Text style={styles.statValue}>{weekTotal} Hr</Text>
            </View>
          </View>

          {/* 6. AI Insights */}
          <Text style={styles.aiInsightsTitle}>AI INSIGHTS</Text>

          {recentAlerts.length > 0 ? (
            recentAlerts.map(alert => (
              <View 
                key={alert.id} 
                style={alert.severity === 'critical' || alert.severity === 'warning' ? styles.insightCardWarning : styles.insightCardNormal}
              >
                <View style={alert.severity === 'critical' || alert.severity === 'warning' ? styles.insightIconCircleWarning : styles.insightIconCircleNormal}>
                  <Ionicons 
                    name={alert.severity === 'critical' ? 'warning' : alert.type === 'rain' ? 'cloud-download' : 'information-circle'} 
                    size={18} 
                    color="#1f2937" 
                  />
                </View>
                <View style={styles.insightTextContent}>
                  <Text style={styles.insightTitle}>
                    {alert.type === 'rain' ? 'Weather Update' : alert.severity === 'critical' ? 'Critical Alert' : alert.severity === 'warning' ? 'System Warning' : 'System Notice'}
                  </Text>
                  <Text style={styles.insightDesc}>
                    {alert.message}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.insightCardNormal}>
              <View style={styles.insightIconCircleNormal}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
              </View>
              <View style={styles.insightTextContent}>
                <Text style={styles.insightTitle}>System Optimal</Text>
                <Text style={styles.insightDesc}>
                  Soil moisture is currently at {moistureValue}%. No urgent actions required at this time. {isAuto ? 'Auto mode is actively monitoring.' : 'Consider enabling Auto mode.'}
                </Text>
              </View>
            </View>
          )}

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

  /* TITLE */
  titleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleTextContainer: {},
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#022E1F',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 25,
  },
  systemStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe', // light blue
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669', // green
  },
  systemStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0369a1',
    lineHeight: 12,
    letterSpacing: 0.5,
  },

  /* 1. SOIL MOISTURE */
  moistureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    padding: 25,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 2,
  },
  sectionHeaderSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 1,
  },
  circleGraphContainer: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGraphOuter: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 12,
    borderColor: '#022E1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGraphInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moistureBig: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#022E1F',
    lineHeight: 52,
  },
  moisturePercent: {
    fontSize: 24,
  },
  optimalPill: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 5,
  },
  optimalText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
    letterSpacing: 0.5,
  },

  /* 2. PUMP CONTROL */
  pumpCard: {
    backgroundColor: '#022E1F',
    borderRadius: 30,
    padding: 20,
    paddingVertical: 25,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
    elevation: 4,
  },
  pumpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  pumpTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  pumpStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  pumpStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  pumpStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 1,
  },
  pumpIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#064e3b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pumpToggleBtn: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 10,
  },
  pumpToggleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#022E1F',
  },

  /* 3. AUTO / MANUAL */
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 25,
    padding: 4,
    height: 48,
  },
  modeBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  modeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  modeBtnTextActive: {
    color: '#022E1F',
    fontWeight: 'bold',
  },
  modeDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 15,
    marginBottom: 25,
    lineHeight: 18,
  },

  hintText: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 15,
    fontStyle: 'italic',
  },

  /* 4. THRESHOLD SETTING */
  thresholdCard: {
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
  thresholdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  thresholdValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  sliderInteractiveArea: {
    height: 30, // Taller touch target area
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  sliderTrackLine: {
    width: '100%',
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    position: 'absolute',
  },
  sliderTrackFill: {
    height: 6,
    backgroundColor: '#022E1F',
    borderRadius: 3,
    position: 'absolute',
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 4,
    borderColor: '#022E1F',
    position: 'absolute',
    transform: [{ translateX: -12 }], // center it
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9ca3af',
  },

  /* 5. TIME STATS */
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 25,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 15,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#022E1F',
  },

  /* PUMP TIMER */
  timerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  timerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  timerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  timerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  timerOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 5,
  },
  timerOptionPill: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    borderRadius: 15,
    alignItems: 'center',
  },
  timerOptionPillActive: {
    backgroundColor: '#022E1F',
  },
  timerOptionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  timerOptionTextActive: {
    color: '#ffffff',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 12,
    marginTop: 15,
    gap: 8,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },

  /* 6. AI INSIGHTS */
  aiInsightsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 15,
  },
  insightCardWarning: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    backgroundColor: '#f0fdfa', // Teal tint from the screenshot
  },
  insightCardNormal: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  insightIconCircleWarning: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  insightIconCircleNormal: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  insightTextContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#022E1F',
    marginBottom: 6,
  },
  insightDesc: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 18,
  }
});
