import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendChatQuery, analyzeImage } from '../../services/ai';
import { saveAIQuery, saveHealthScan, useSensorData, useHealthScans } from '../../services/database';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../services/auth';

export default function AiScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // --- Chat State ---
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{role: string; text: string; time: string; image?: string; lang?: string; translating?: boolean; analysis?: { disease: string; confidence: number; recommendation: string }}[]>([
    { role: 'user', text: 'What is the optimal time to spray pesticide for leaf rust?', time: '10:42 AM' },
    { role: 'ai', text: 'For leaf rust, it is best to apply a systemic fungicide early in the morning or late evening when temperatures are cooler and wind is minimal.', time: '10:42 AM', lang: 'English' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState('English');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<{
    disease: string;
    confidence: number;
    recommendation: string;
    treatment: string;
  } | null>(null);

  // Device code from paired ESP32
  const deviceId = user?.deviceCode || 'user_001';

  const { latest: sensorLatest } = useSensorData(deviceId);
  const { scans } = useHealthScans(deviceId);
  const latestScan = scans && scans.length > 0 ? scans[scans.length - 1] : null;

  // Determine what to show in the summary cards
  const displayResult = currentAnalysis || (latestScan ? {
    disease: latestScan.diseaseName,
    confidence: latestScan.confidence,
    recommendation: 'Check soil moisture',
    treatment: latestScan.recommendation.split('.')[0] || 'Apply treatment'
  } : null);

  // Dynamic recommendation based on sensors if no disease
  const sensorRec = sensorLatest ? (
    sensorLatest.soilMoisture < 30 ? 'Irrigate immediately' : 
    sensorLatest.temperature > 35 ? 'Protect from heat' : 'Conditions optimal'
  ) : 'Monitor crop growth';
  const chatScrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom of chat when messages change
  useEffect(() => {
    setTimeout(() => {
      chatScrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMsg = chatInput.trim();
    const now = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    
    setMessages(prev => [...prev, { role: 'user', text: userMsg, time: now }]);
    setChatInput('');
    setIsLoading(true);

    try {
      // 1. Always generate AI response in English for maximum quality and context understanding
      let response = await sendChatQuery(userMsg, 'English', {
        soilMoisture: sensorLatest?.soilMoisture,
        temperature: sensorLatest?.temperature,
        humidity: sensorLatest?.humidity,
      });

      // 2. If the user wants a different language, translate the English output
      if (activeLanguage !== 'English') {
        const { translateText } = await import('../../services/ai');
        response = await translateText(response, activeLanguage);
      }

      setMessages(prev => [...prev, { role: 'ai', text: response, time: now, lang: activeLanguage }]);
      await saveAIQuery(deviceId, {
        type: 'chat', input: userMsg, response, language: activeLanguage, timestamp: Date.now(),
      });
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, could not process your query.', time: now, lang: activeLanguage }]);
    }
    setIsLoading(false);
  };

  // --- Translate a specific AI message ---
  const handleTranslate = async (msgIndex: number, targetLang: string) => {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== 'ai' || msg.lang === targetLang) return;

    // Mark as translating
    setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, translating: true } : m));

    try {
      const textToTranslate = msg.analysis ? msg.analysis.recommendation : msg.text;
      
      // Use the dedicated translator instead of the base AI model
      const { translateText } = await import('../../services/ai');
      const translated = await translateText(textToTranslate, targetLang);

      setMessages(prev => prev.map((m, i) => {
        if (i !== msgIndex) return m;
        if (m.analysis) {
          return { ...m, text: translated, lang: targetLang, translating: false, analysis: { ...m.analysis, recommendation: translated } };
        }
        return { ...m, text: translated, lang: targetLang, translating: false };
      }));
    } catch {
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, translating: false } : m));
    }
  };

  // --- Image Picker & Analysis ---
  const handlePickImage = () => {
    Alert.alert(
      '🌿 Crop Image Analysis',
      'Choose how to provide the crop image',
      [
        {
          text: '📷 Camera',
          onPress: () => pickImage('camera'),
        },
        {
          text: '🖼️ Gallery',
          onPress: () => pickImage('gallery'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    let result;

    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Camera permission is required.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const imageUri = asset.uri;
      setSelectedImage(imageUri);
      const now = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

      // Add user image message
      setMessages(prev => [...prev, { role: 'user', text: '🌿 Analyze this crop image', time: now, image: imageUri }]);
      setIsLoading(true);

      try {
        // 1. Analyze the image in English first for highest diagnosis accuracy
        const analysisResult = await analyzeImage(asset.base64 || '', 'English');

        // 2. If a different language is selected, translate the recommendation
        if (activeLanguage !== 'English') {
           const { translateText } = await import('../../services/ai');
           analysisResult.recommendation = await translateText(analysisResult.recommendation, activeLanguage);
           analysisResult.diseaseName = await translateText(analysisResult.diseaseName, activeLanguage);
        }

        // Add AI analysis response with results
        const newAnalysis = {
          disease: analysisResult.diseaseName,
          confidence: analysisResult.confidence,
          recommendation: analysisResult.recommendation,
          treatment: analysisResult.recommendation.split('.')[0] || 'Consult expert', // Simple extraction for summary
        };

        setCurrentAnalysis(newAnalysis);

        setMessages(prev => [...prev, {
          role: 'ai',
          text: analysisResult.recommendation,
          time: now,
          image: imageUri,
          analysis: newAnalysis,
        }]);

        // Save to Firebase
        await saveHealthScan(deviceId, {
          imageUri,
          diseaseName: analysisResult.diseaseName,
          confidence: analysisResult.confidence,
          recommendation: analysisResult.recommendation,
          timestamp: Date.now(),
        });
      } catch (e) {
        setMessages(prev => [...prev, { role: 'ai', text: 'Could not analyze the image. Please try again.', time: now }]);
      }
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
              {/* Note: This is already the AI screen, but providing an identity loop is fine, or going back */}
              <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/ai')}>
                <MaterialCommunityIcons name="robot-outline" size={20} color="#022E1F" />
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
          <Text style={styles.pageTitle}>FarmSense AI</Text>
          <Text style={styles.subtitleGray}>Ask questions and analyze crops using AI</Text>

          {/* Crop Visual Analysis Section */}
          <View style={styles.visualAnalysisContainer}>
            <Text style={styles.sectionTitle}>Crop Visual Analysis</Text>
            
            <TouchableOpacity 
              style={styles.imageDropzone}
              onPress={() => pickImage('gallery')}
              activeOpacity={0.8}
            >
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <MaterialCommunityIcons name="apple" size={140} color="rgba(255,255,255,0.4)" style={styles.appleWatermark} />
              )}
              <View style={[styles.dropzoneContent, selectedImage && { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: 8 }]}>
                <MaterialCommunityIcons name={selectedImage ? "refresh" : "camera-plus-outline"} size={32} color="#022E1F" />
                <Text style={styles.dropzoneText}>{selectedImage ? "CHANGE IMAGE" : "SELECT IMAGE"}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.analysisActionRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('gallery')} disabled={isLoading}>
                <MaterialCommunityIcons name="image-outline" size={20} color="#022E1F" />
                <Text style={styles.uploadBtnText}>Upload</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.scanBtn} onPress={() => pickImage('camera')} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <MaterialCommunityIcons name="camera-iris" size={20} color="#ffffff" />
                )}
                <Text style={styles.scanBtnText}>{isLoading ? 'Analyzing...' : 'Scan Crop'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detection Alert Section */}
          <View style={[styles.alertCard, displayResult?.disease === 'Healthy' && { backgroundColor: '#ecfdf5', borderColor: '#dcfce7' }]}>
            <View style={styles.alertHeaderRow}>
              <View style={styles.alertIconBox}>
                <MaterialCommunityIcons 
                  name={displayResult?.disease === 'Healthy' ? "check-circle-outline" : "alert-outline"} 
                  size={20} 
                  color={displayResult?.disease === 'Healthy' ? "#059669" : "#b91c1c"} 
                />
              </View>
              <Text style={styles.alertTitle}>
                {displayResult ? (displayResult.disease === 'Healthy' ? 'No Issues Found' : `${displayResult.disease} Detected`) : 'Leaf Rust Detected'}
              </Text>
              <View style={styles.matchPill}>
                <Text style={styles.matchPillText}>{displayResult ? `${displayResult.confidence}%` : '92%'} Match</Text>
              </View>
            </View>
            <Text style={styles.alertText}>
              {displayResult 
                ? (displayResult.disease === 'Healthy' ? 'Your crop looks healthy. Continue monitoring for optimal growth.' : `AI scan detected signs of ${displayResult.disease}.`) 
                : 'Fungal disease primarily affecting wheat leaves. Spores spread rapidly in humid conditions.'}
            </Text>
          </View>

          {/* FarmSense Chat Section */}
          <View style={styles.chatSection}>
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderIcon}>
                <MaterialCommunityIcons name="robot-outline" size={16} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatHeaderTitle}>FarmSense Chat</Text>
                <Text style={styles.chatHeaderSubtitle}>
                  {isLoading ? 'AI is typing...' : 'AI Assistant is online'}
                </Text>
              </View>
              {/* Language Selector */}
              <View style={styles.langSelectorRow}>
                {(['English', 'हिंदी', 'ਪੰਜਾਬੀ'] as const).map((lang) => {
                  const langKey = lang === 'हिंदी' ? 'Hindi' : lang === 'ਪੰਜਾਬੀ' ? 'Punjabi' : 'English';
                  const isActive = activeLanguage === langKey;
                  return (
                    <TouchableOpacity
                      key={lang}
                      style={isActive ? styles.langTabActive : styles.langTab}
                      onPress={() => setActiveLanguage(langKey)}
                    >
                      <Text style={isActive ? styles.langTabTextActive : styles.langTabText}>{lang}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Scrollable Message Area */}
            <View style={styles.messagesContainer}>
              <ScrollView 
                ref={chatScrollViewRef}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                onContentSizeChange={() => chatScrollViewRef.current?.scrollToEnd({ animated: true })}
              >
                {/* Dynamic Messages */}
                {messages.map((msg, index) => (
                  <View key={index}>
                    {msg.role === 'user' ? (
                      <>
                        <View style={styles.userMessageBubble}>
                          {msg.image && (
                            <Image source={{ uri: msg.image }} style={styles.chatImage} resizeMode="cover" />
                          )}
                          <Text style={styles.userMessageText}>{msg.text}</Text>
                        </View>
                        <Text style={styles.messageTimestamp}>{msg.time}</Text>
                      </>
                    ) : (
                      <View style={styles.aiMessageRow}>
                        <View style={styles.aiMessageAvatar}>
                          <MaterialCommunityIcons name="robot-outline" size={14} color="#ffffff" />
                        </View>
                        <View style={styles.aiMessageCard}>
                          {/* If analysis result, show results card */}
                          {msg.analysis ? (
                            <View>
                              {/* Disease Result Header */}
                              <View style={styles.analysisHeader}>
                                <View style={[styles.analysisDot, { backgroundColor: msg.analysis.confidence > 70 ? '#ef4444' : msg.analysis.confidence > 40 ? '#f59e0b' : '#10b981' }]} />
                                <Text style={styles.analysisDisease}>{msg.analysis.disease}</Text>
                              </View>

                              {/* Confidence Bar */}
                              <View style={styles.confidenceContainer}>
                                <Text style={styles.confidenceLabel}>Confidence</Text>
                                <View style={styles.confidenceBarBg}>
                                  <View style={[styles.confidenceBarFill, { width: `${msg.analysis.confidence}%`, backgroundColor: msg.analysis.confidence > 70 ? '#ef4444' : msg.analysis.confidence > 40 ? '#f59e0b' : '#10b981' }]} />
                                </View>
                                <Text style={styles.confidenceValue}>{msg.analysis.confidence}%</Text>
                              </View>

                              {/* Recommendation */}
                              <View style={styles.recSeparator} />
                              <View style={styles.recRow}>
                                <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#022E1F" />
                                <Text style={styles.recLabel}>Recommendation</Text>
                              </View>
                              <Text style={styles.aiMessageText}>{msg.analysis.recommendation}</Text>
                            </View>
                          ) : (
                            <Text style={styles.aiMessageText}>{msg.text}</Text>
                          )}

                          {/* Translate Buttons */}
                          <View style={styles.translateRow}>
                            {msg.translating ? (
                              <View style={styles.translateLoadingRow}>
                                <ActivityIndicator size="small" color="#6b7280" />
                                <Text style={styles.translateLoadingText}>Translating...</Text>
                              </View>
                            ) : (
                              <>
                                <Text style={styles.translateLabel}>
                                  {msg.lang === 'Hindi' ? 'हिंदी' : msg.lang === 'Punjabi' ? 'ਪੰਜਾਬੀ' : 'EN'}
                                </Text>
                                <View style={styles.translateBtnGroup}>
                                  {[{ key: 'English', label: 'EN' }, { key: 'Hindi', label: 'हिंदी' }, { key: 'Punjabi', label: 'ਪੰਜਾਬੀ' }].map(l => (
                                    <TouchableOpacity
                                      key={l.key}
                                      style={[styles.translateBtn, msg.lang === l.key && styles.translateBtnActive]}
                                      onPress={() => handleTranslate(index, l.key)}
                                      disabled={msg.lang === l.key}
                                    >
                                      <Text style={[styles.translateBtnText, msg.lang === l.key && styles.translateBtnTextActive]}>{l.label}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </>
                            )}
                          </View>
                          <Text style={styles.aiTimestamp}>{msg.time}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                  <View style={styles.aiMessageRow}>
                    <View style={styles.aiMessageAvatar}>
                      <MaterialCommunityIcons name="robot-outline" size={14} color="#ffffff" />
                    </View>
                    <View style={[styles.aiMessageCard, styles.typingCard]}>
                      <ActivityIndicator size="small" color="#022E1F" />
                      <Text style={styles.typingText}>Thinking...</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Chat Input Field */}
            <View style={styles.chatInputContainer}>
                <TouchableOpacity onPress={handlePickImage} disabled={isLoading}>
                  <MaterialCommunityIcons name="image-plus" size={24} color={isLoading ? '#9ca3af' : '#022E1F'} style={styles.inputIconLeft} />
                </TouchableOpacity>
              <TextInput 
                style={styles.chatInput}
                placeholder={isLoading ? "Thinking..." : "Ask your question..."}
                placeholderTextColor="#9ca3af"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSend}
                editable={!isLoading}
              />
              <TouchableOpacity style={[styles.sendIconBox, isLoading && { opacity: 0.5 }]} onPress={handleSend} disabled={isLoading}>
                <MaterialCommunityIcons name="send" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>

          </View>

          {/* Bottom spacer taking tab bar height into account */}
          <View style={{ height: 120 }} />

        </SafeAreaView>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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

  /* TITLE SECTION */
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#022E1F',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitleGray: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 25,
  },

  /* VISUAL ANALYSIS */
  visualAnalysisContainer: {
    backgroundColor: '#f1f8f5',
    borderRadius: 30,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
    marginBottom: 15,
  },
  imageDropzone: {
    backgroundColor: '#dfede6',
    borderRadius: 20,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative',
    overflow: 'hidden',
  },
  appleWatermark: {
    position: 'absolute',
    top: 0,
    opacity: 0.8,
  },
  dropzoneContent: {
    alignItems: 'center',
    zIndex: 10,
  },
  dropzoneText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#022E1F',
    letterSpacing: 1,
    marginTop: 8,
  },
  analysisActionRow: {
    flexDirection: 'row',
    gap: 15,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  scanBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#022E1F',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  /* ALERT CARD */
  alertCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertIconBox: {
    marginRight: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
    flex: 1,
  },
  matchPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  matchPillText: {
    color: '#022E1F', // dark green match text
    fontSize: 10,
    fontWeight: 'bold',
  },
  alertText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 20,
  },

  /* ACTION CARDS (Rec & Treatment) */
  actionRowContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  actionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#022E1F',
  },

  /* CHAT SECTION */
  chatSection: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  messagesContainer: {
    height: 350, // Fixed height for chat area to ensure internal scroll
    marginBottom: 15,
  },
  chatHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#022E1F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  chatHeaderSubtitle: {
    fontSize: 10,
    color: '#6b7280',
  },
  userMessageBubble: {
    backgroundColor: '#f1f8f5', // Pale green tint instead of gray
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'stretch',
    marginBottom: 6,
  },
  userMessageText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  messageTimestamp: {
    fontSize: 10,
    color: '#9ca3af',
    alignSelf: 'flex-end',
    marginBottom: 15,
    marginRight: 5,
  },
  aiMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  aiMessageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#022E1F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 5,
  },
  aiMessageCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  languageToggleRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
    marginBottom: 10,
    gap: 15,
  },
  langTabActive: {
    backgroundColor: '#022E1F',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  langTabTextActive: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  langTab: {
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  langTabText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: 'bold',
  },
  aiMessageText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
  },
  inputIconLeft: {
    marginRight: 10,
  },
  chatInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#1f2937',
  },
  sendIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#022E1F',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  langSelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  typingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  typingText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  aiTimestamp: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'right',
  },
  chatImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  analysisDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  analysisDisease: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  confidenceLabel: {
    fontSize: 11,
    color: '#6b7280',
    width: 70,
  },
  confidenceBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
    width: 35,
    textAlign: 'right',
  },
  recSeparator: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 10,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  recLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  translateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  translateLabel: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  translateBtnGroup: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  translateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  translateBtnActive: {
    backgroundColor: '#022E1F',
  },
  translateBtnText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  translateBtnTextActive: {
    color: '#ffffff',
  },
  translateLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  translateLoadingText: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
});
