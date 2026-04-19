import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useHealthScans, useSensorData } from '../../services/database';
import { useAuth } from '../../services/auth';

export default function HealthScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // --- Firebase Real-Time Data ---
  const { scans, loading: scansLoading } = useHealthScans();
  const { latest: sensorLatest } = useSensorData();

  // Get latest scan result for status card
  const latestScan = scans.length > 0 ? scans[0] : null;
  const healthStatus = latestScan?.diseaseName === 'Healthy' || !latestScan ? 'Healthy' : latestScan.diseaseName;
  const healthSubText = latestScan && latestScan.diseaseName !== 'Healthy'
    ? `${latestScan.diseaseName} detected (${latestScan.confidence}% confidence)`
    : 'No major disease detected';

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
          <Text style={styles.pageTitle}>AI-powered crop monitoring</Text>

          {/* 1. Main Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.watermarkContainer}>
              <MaterialCommunityIcons name="leaf-circle-outline" size={120} color="rgba(255,255,255,0.15)" />
            </View>
            
            <View style={styles.statusIconOuter}>
              <View style={styles.statusIconInner}>
                <Ionicons name="leaf" size={40} color="#fff" />
              </View>
            </View>
            
            <Text style={styles.statusBigText}>{healthStatus}</Text>
            <Text style={styles.statusSubText}>{healthSubText}</Text>
          </View>

          {/* 2. Ask AI Button */}
          <TouchableOpacity 
            style={styles.askAiButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/ai')}
          >
            <MaterialCommunityIcons name="robot-outline" size={24} color="#fff" />
            <Text style={styles.askAiButtonText}>ASK AI</Text>
          </TouchableOpacity>

          {/* 3. Latest Alert Section */}
          <View style={styles.alertSection}>
            <Text style={styles.sectionTitleSmall}>LATEST ALERT</Text>
            
            <View style={styles.alertCard}>
              <View style={styles.alertImageContainer}>
                <Image 
                  source={{ uri: 'https://images.unsplash.com/photo-1595015949544-245ed7e79391?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80' }} 
                  style={styles.alertImage}
                />
              </View>
              
              <View style={styles.alertContent}>
                <View style={styles.alertHeaderRow}>
                  <Text style={styles.alertTitle}>Leaf Blight</Text>
                  <View style={styles.matchPill}>
                    <Text style={styles.matchPillText}>92% Match</Text>
                  </View>
                </View>
                
                <Text style={styles.alertDesc}>
                  Detected on North Field tomatoes.
                </Text>
                
                <TouchableOpacity>
                  <Text style={styles.viewDetailsText}>View details</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 4. AI Recommendations Card */}
          <View style={styles.recommendationsCard}>
            <View style={styles.recHeaderRow}>
              <MaterialCommunityIcons name="robot-outline" size={18} color="#4b5563" />
              <Text style={styles.recHeaderTitle}>AI RECOMMENDATIONS</Text>
            </View>
            
            <View style={styles.recListItem}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#022E1F" style={styles.recListIcon} />
              <Text style={styles.recListText}>
                Apply fungicide within 2 days to prevent spread.
              </Text>
            </View>
            
            <View style={styles.recListItem}>
              <Ionicons name="eye-outline" size={20} color="#022E1F" style={styles.recListIcon} />
              <Text style={styles.recListText}>
                Monitor affected area closely for 48 hours.
              </Text>
            </View>
          </View>

          {/* 5. Metrics Row */}
          <View style={styles.metricsRow}>
            {/* Soil Comp */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Ionicons name="water-outline" size={20} color="#022E1F" />
                <View style={styles.metricPill}>
                  <Text style={styles.metricPillText}>Good</Text>
                </View>
              </View>
              <Text style={styles.metricLabel}>SOIL COMP</Text>
              <Text style={styles.metricValue}>85%</Text>
            </View>

            {/* Leaf Health */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <MaterialCommunityIcons name="leaf" size={20} color="#022E1F" />
                <View style={styles.metricPill}>
                  <Text style={styles.metricPillText}>Fair</Text>
                </View>
              </View>
              <Text style={styles.metricLabel}>LEAF HEALTH</Text>
              <Text style={styles.metricValue}>72%</Text>
            </View>
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
    marginBottom: 25,
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
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#022E1F',
    letterSpacing: -0.5,
    marginBottom: 20,
  },

  /* 1. STATUS CARD */
  statusCard: {
    backgroundColor: '#d0e0d8', // Light sage green
    borderRadius: 35,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    elevation: 2,
  },
  watermarkContainer: {
    position: 'absolute',
    top: -20,
    right: -20,
    transform: [{ rotate: '15deg' }],
  },
  statusIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(2, 46, 31, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#022E1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBigText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#022E1F',
    marginBottom: 5,
  },
  statusSubText: {
    fontSize: 14,
    color: '#4b5b54',
  },

  /* 2. ASK AI BUTTON */
  askAiButton: {
    flexDirection: 'row',
    backgroundColor: '#022E1F',
    borderRadius: 30,
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 4,
  },
  askAiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  /* 3. LATEST ALERT */
  alertSection: {
    backgroundColor: '#f8f9fa', // subtle background for the section
    borderRadius: 30, // to match curved design loosely
    marginBottom: 20,
  },
  sectionTitleSmall: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 1.5,
    marginBottom: 15,
    marginLeft: 5,
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  alertImageContainer: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    overflow: 'hidden',
    marginRight: 15,
    backgroundColor: '#f3f4f6',
  },
  alertImage: {
    width: '100%',
    height: '100%',
  },
  alertContent: {
    flex: 1,
    justifyContent: 'center',
  },
  alertHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  matchPill: {
    backgroundColor: '#fee2e2', // light red
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  matchPillText: {
    color: '#b91c1c', // dark red
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    lineHeight: 18,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#022E1F',
    textDecorationLine: 'underline',
  },

  /* 4. AI RECOMMENDATIONS */
  recommendationsCard: {
    backgroundColor: '#dbeafe', // light blue
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  recHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 15,
  },
  recHeaderTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4b5563',
    letterSpacing: 1,
  },
  recListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 10,
  },
  recListIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  recListText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },

  /* 5. METRICS ROW */
  metricsRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#f3f4f6', // Light gray background
    borderRadius: 24,
    padding: 20,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  metricPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  metricPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#022E1F',
  }
});
