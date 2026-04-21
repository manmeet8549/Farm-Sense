import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  ImageBackground,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../services/auth';
import { db, ref, get } from '../services/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOX_SIZE = (SCREEN_WIDTH - 50 - 60) / 4; // 4 boxes with gaps

export default function DevicePairScreen() {
  const router = useRouter();
  const { user, setDeviceCode } = useAuth();
  const [code, setCode] = useState(['', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Refs for auto-focus between inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  // Animated values
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulse animation
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigitChange = (text: string, index: number) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setErrorMsg('');

    // Auto-advance to next input
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (digit && index === 3 && newCode.every(d => d !== '')) {
      handlePair(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && code[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const handlePair = async (deviceCode?: string) => {
    const finalCode = deviceCode || code.join('');
    
    if (finalCode.length !== 4) {
      setErrorMsg('Please enter all 4 digits.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // Validate the device code exists in Firebase
      const deviceRef = ref(db, `devices/${finalCode}`);
      const deviceSnap = await get(deviceRef);

      if (!deviceSnap.exists()) {
        setErrorMsg('Device not found. Check the code on your ESP32 module.');
        triggerShake();
        setIsLoading(false);
        return;
      }

      // Save device code to user profile
      await setDeviceCode(finalCode);
      
      setIsSuccess(true);
      
      // Navigate to main app after brief success animation
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1200);

    } catch (error: any) {
      console.error('Device pairing error:', error);
      setErrorMsg('Connection failed. Please try again.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow skip for demo purposes (uses default device)
    router.replace('/(tabs)');
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?q=80&w=2000&auto=format&fit=crop' }} 
      style={styles.backgroundImage}
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            
            {/* ESP32 Icon with pulse */}
            <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="chip" size={48} color="#4ade80" />
              </View>
              <View style={styles.signalDots}>
                <View style={[styles.signalDot, { opacity: 0.3 }]} />
                <View style={[styles.signalDot, { opacity: 0.5 }]} />
                <View style={[styles.signalDot, { opacity: 0.8 }]} />
              </View>
            </Animated.View>

            {/* Header Text */}
            <View style={styles.headerSection}>
              <Text style={styles.titleText}>Connect Your{'\n'}ESP32 Device</Text>
              <Text style={styles.subText}>
                Enter the 4-digit code from your{'\n'}FarmSense ESP32 module
              </Text>
            </View>

            {/* Code Input Card */}
            <BlurView intensity={80} tint="light" style={styles.glassCard}>
              
              {/* OTP-Style Input Boxes */}
              <Animated.View style={[styles.codeInputRow, { transform: [{ translateX: shakeAnim }] }]}>
                {[0, 1, 2, 3].map((index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.codeBox,
                      code[index] !== '' && styles.codeBoxFilled,
                      isSuccess && styles.codeBoxSuccess,
                    ]}
                  >
                    <TextInput
                      ref={(el) => { inputRefs.current[index] = el; }}
                      style={[
                        styles.codeInput,
                        isSuccess && { color: '#059669' },
                      ]}
                      value={code[index]}
                      onChangeText={(text) => handleDigitChange(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      editable={!isLoading && !isSuccess}
                    />
                    {/* Bottom accent line */}
                    <View style={[
                      styles.codeBoxAccent,
                      code[index] !== '' && styles.codeBoxAccentFilled,
                      isSuccess && styles.codeBoxAccentSuccess,
                    ]} />
                  </View>
                ))}
              </Animated.View>

              {/* Error Message */}
              {errorMsg ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color="#dc2626" />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Success Message */}
              {isSuccess ? (
                <View style={styles.successContainer}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#059669" />
                  <Text style={styles.successText}>Device paired successfully!</Text>
                </View>
              ) : null}

              {/* Connect Button */}
              <TouchableOpacity 
                style={[
                  styles.connectBtn, 
                  isLoading && { opacity: 0.7 },
                  isSuccess && styles.connectBtnSuccess,
                ]}
                onPress={() => handlePair()}
                disabled={isLoading || isSuccess}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : isSuccess ? (
                  <View style={styles.btnContent}>
                    <MaterialCommunityIcons name="check" size={20} color="#fff" />
                    <Text style={styles.connectBtnText}>Connected!</Text>
                  </View>
                ) : (
                  <View style={styles.btnContent}>
                    <MaterialCommunityIcons name="link-variant" size={20} color="#fff" />
                    <Text style={styles.connectBtnText}>Pair Device</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Help text */}
              <View style={styles.helpRow}>
                <MaterialCommunityIcons name="information-outline" size={14} color="#6b7280" />
                <Text style={styles.helpText}>
                  The code is printed on your ESP32 module or set in the firmware configuration.
                </Text>
              </View>
            </BlurView>

            {/* Skip button */}
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip for now</Text>
              <Ionicons name="arrow-forward" size={14} color="#d1fae5" />
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 46, 31, 0.55)',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  /* ICON */
  iconContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 25,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  signalDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  signalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },

  /* HEADER */
  headerSection: {
    marginBottom: 30,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  subText: {
    fontSize: 14,
    color: '#d1fae5',
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },

  /* GLASS CARD */
  glassCard: {
    padding: 30,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },

  /* CODE INPUTS */
  codeInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 15,
  },
  codeBox: {
    flex: 1,
    aspectRatio: 0.85,
    maxHeight: 75,
    backgroundColor: '#fff',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  codeBoxFilled: {
    borderWidth: 2,
    borderColor: '#022E1F',
  },
  codeBoxSuccess: {
    borderWidth: 2,
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  codeInput: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#022E1F',
    textAlign: 'center',
    width: '100%',
    height: '80%',
  },
  codeBoxAccent: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 3,
    backgroundColor: '#e5e7eb',
  },
  codeBoxAccentFilled: {
    backgroundColor: '#022E1F',
  },
  codeBoxAccentSuccess: {
    backgroundColor: '#059669',
  },

  /* ERROR */
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    gap: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    flex: 1,
  },

  /* SUCCESS */
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    gap: 8,
  },
  successText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  /* BUTTON */
  connectBtn: {
    backgroundColor: '#022E1F',
    height: 55,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 20,
  },
  connectBtnSuccess: {
    backgroundColor: '#059669',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },

  /* HELP */
  helpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
    lineHeight: 18,
  },

  /* SKIP */
  skipBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
    gap: 6,
  },
  skipText: {
    color: '#d1fae5',
    fontSize: 14,
    fontWeight: '500',
  },
});
