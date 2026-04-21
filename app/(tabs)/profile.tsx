import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserProfile, updateUserProfile } from '../../services/database';
import { useAuth } from '../../services/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateProfile } = useAuth();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [autoIrrigation, setAutoIrrigation] = useState(false);
  
  // Global Profile Edit State
  const [isEditingGlobal, setIsEditingGlobal] = useState(false);
  const [isEditingFarm, setIsEditingFarm] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Local edit state (initialized from auth user)
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userLocation, setUserLocation] = useState('');
  const [farmName, setFarmName] = useState('');
  const [landArea, setLandArea] = useState('');
  const [primaryCrops, setPrimaryCrops] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarUri, setAvatarUri] = useState('https://www.w3schools.com/howto/img_avatar.png');

  // Sync auth user → local state
  useEffect(() => {
    if (user) {
      setUserName(user.name || '');
      setUserEmail(user.email || '');
      setUserLocation(user.location || '');
      setFarmName(user.farmName || '');
      setLandArea(user.landArea || '');
      setPrimaryCrops(user.primaryCrops || '');
      setPhoneNumber(user.phoneNumber || '');
      if (user.avatarUri) setAvatarUri(user.avatarUri);
    }
  }, [user]);

  const handleToggleEdit = async () => {
    if (isEditingGlobal) {
      // Save to auth context (which also updates Firebase)
      await updateProfile({
        name: userName,
        email: userEmail,
        location: userLocation,
        farmName,
        landArea,
        primaryCrops,
        phoneNumber,
        avatarUri,
      });
      setIsEditingFarm(false);
      setIsEditingPhone(false);
    }
    setIsEditingGlobal(!isEditingGlobal);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
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

          {/* User Hero Card */}
          <View style={styles.heroCard}>
            <View style={styles.heroAvatarWrapper}>
              <Image 
                source={{ uri: avatarUri }} 
                style={styles.heroAvatar} 
              />
              <TouchableOpacity 
                style={styles.editHeroImageBtn}
                onPress={() => setAvatarUri('https://www.w3schools.com/howto/img_avatar2.png')} // Demo image change
              >
                <MaterialCommunityIcons name="pencil" size={12} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            {isEditingGlobal ? (
              <TextInput 
                style={styles.heroNameInput}
                value={userName}
                onChangeText={setUserName}
                placeholder="Your Name"
              />
            ) : (
              <Text style={styles.userName}>{userName || 'Set Your Name'}</Text>
            )}
            
            {!isEditingGlobal && userEmail ? (
              <Text style={{ fontSize: 11, color: '#a7f3d0', opacity: 0.8, marginBottom: 4 }}>{userEmail}</Text>
            ) : null}

            <View style={styles.userLocationRow}>
              <Ionicons name="location-outline" size={12} color="#a7f3d0" />
              {isEditingGlobal ? (
                <TextInput 
                  style={styles.heroLocationInput}
                  value={userLocation}
                  onChangeText={setUserLocation}
                  placeholder="Location"
                />
              ) : (
                <Text style={styles.userLocationText}>{userLocation || 'Set Location'}</Text>
              )}
            </View>
          </View>

          {/* Connected Device Card */}
          <View style={styles.deviceCard}>
            <View style={styles.deviceCardHeader}>
              <View style={styles.deviceIconBox}>
                <MaterialCommunityIcons name="chip" size={20} color="#4ade80" />
              </View>
              <View style={styles.deviceTextContainer}>
                <Text style={styles.deviceLabel}>CONNECTED DEVICE</Text>
                {user?.deviceCode ? (
                  <View style={styles.deviceCodeRow}>
                    <Text style={styles.deviceCodeText}>ESP-{user.deviceCode}</Text>
                    <View style={styles.deviceOnlineDot} />
                  </View>
                ) : (
                  <Text style={styles.deviceNotPaired}>No device paired</Text>
                )}
              </View>
            </View>
            <TouchableOpacity 
              style={styles.switchDeviceBtn}
              onPress={() => router.push('/device-pair')}
            >
              <MaterialCommunityIcons name="swap-horizontal" size={16} color="#022E1F" />
              <Text style={styles.switchDeviceBtnText}>
                {user?.deviceCode ? 'Switch Device' : 'Pair Device'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Farmer's Profile Section */}
          <View style={styles.glassCard}>
            <View style={styles.cardHeaderRowSpace}>
              <Text style={styles.sectionHeaderBold}>Farmer's Profile</Text>
              <TouchableOpacity onPress={() => setIsEditingFarm(!isEditingFarm)}>
                <MaterialCommunityIcons 
                  name={isEditingFarm ? "check-circle" : "square-edit-outline"} 
                  size={20} 
                  color={isEditingFarm ? "#059669" : "#6b7280"} 
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.farmProfileList}>
              {/* Item 1 - Farm Name */}
              <View style={styles.farmProfileItem}>
                <View style={styles.farmProfileIconBox}>
                  <MaterialCommunityIcons name="tractor" size={18} color="#022E1F" />
                </View>
                <View style={styles.farmProfileTextContainer}>
                  <Text style={styles.farmProfileLabel}>FARM NAME</Text>
                  {isEditingFarm ? (
                    <TextInput 
                      style={styles.farmInput}
                      value={farmName}
                      onChangeText={setFarmName}
                      placeholder="Enter farm name"
                    />
                  ) : (
                    <Text style={styles.farmProfileValue}>{farmName}</Text>
                  )}
                </View>
              </View>

              {/* Item 2 - Land Area */}
              <View style={styles.farmProfileItem}>
                <View style={styles.farmProfileIconBox}>
                  <MaterialCommunityIcons name="image-filter-hdr" size={18} color="#022E1F" />
                </View>
                <View style={styles.farmProfileTextContainer}>
                  <Text style={styles.farmProfileLabel}>LAND AREA</Text>
                  {isEditingFarm ? (
                    <TextInput 
                      style={styles.farmInput}
                      value={landArea}
                      onChangeText={setLandArea}
                      placeholder="Enter land area"
                    />
                  ) : (
                    <Text style={styles.farmProfileValue}>{landArea}</Text>
                  )}
                </View>
              </View>

              {/* Item 3 - Primary Crops */}
              <View style={styles.farmProfileItem}>
                <View style={styles.farmProfileIconBox}>
                  <MaterialCommunityIcons name="grass" size={18} color="#022E1F" />
                </View>
                <View style={styles.farmProfileTextContainer}>
                  <Text style={styles.farmProfileLabel}>PRIMARY CROPS</Text>
                  {isEditingFarm ? (
                    <TextInput 
                      style={styles.farmInput}
                      value={primaryCrops}
                      onChangeText={setPrimaryCrops}
                      placeholder="e.g. Wheat, Rice"
                    />
                  ) : (
                    <View style={styles.cropsPillRow}>
                      {primaryCrops.split(',').map((crop, idx) => (
                        <View key={idx} style={styles.cropPill}>
                          <Text style={styles.cropPillText}>{crop.trim()}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

            </View>
          </View>

          {/* Settings & Preferences */}
          <Text style={styles.sectionTitleOutside}>Settings & Preferences</Text>
          <View style={styles.glassCardNoPadding}>
            
            {/* Setting Item 1 - Contact Info with Inline Edit */}
            <TouchableOpacity 
              style={styles.settingItemRow} 
              onPress={() => setIsEditingPhone(!isEditingPhone)}
              activeOpacity={0.7}
            >
              <View style={styles.settingIconBox}>
                <Ionicons name="call-outline" size={16} color="#022E1F" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={styles.settingTitleText}>Contact Information</Text>
                {isEditingPhone ? (
                  <TextInput 
                    style={styles.settingInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    autoFocus
                    onBlur={() => setIsEditingPhone(false)}
                  />
                ) : (
                  <Text style={styles.settingSubText}>{phoneNumber}</Text>
                )}
              </View>
              <MaterialCommunityIcons 
                name={isEditingPhone ? "check" : "chevron-right"} 
                size={20} 
                color={isEditingPhone ? "#059669" : "#6b7280"} 
              />
            </TouchableOpacity>
            <View style={styles.settingDivider} />

            {/* Setting Item 2 */}
            <TouchableOpacity style={styles.settingItemRow}>
              <View style={styles.settingIconBox}>
                <MaterialCommunityIcons name="web" size={16} color="#022E1F" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={styles.settingTitleText}>Language</Text>
                <Text style={styles.settingSubText}>English</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#6b7280" />
            </TouchableOpacity>
            <View style={styles.settingDivider} />

            {/* Setting Item 3 - Switch */}
            <View style={styles.settingItemRow}>
              <View style={styles.settingIconBox}>
                <MaterialCommunityIcons name="bell-outline" size={16} color="#022E1F" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={styles.settingTitleText}>Push Notifications</Text>
              </View>
              <Switch
                trackColor={{ false: "#d1d5db", true: "#022E1F" }}
                thumbColor={"#ffffff"}
                ios_backgroundColor="#d1d5db"
                onValueChange={() => setPushNotifications(prev => !prev)}
                value={pushNotifications}
              />
            </View>
            <View style={styles.settingDivider} />

            {/* Setting Item 4 - Switch */}
            <View style={styles.settingItemRow}>
              <View style={styles.settingIconBox}>
                <Ionicons name="water-outline" size={16} color="#022E1F" />
              </View>
              <View style={styles.settingTextContent}>
                <Text style={styles.settingTitleText}>Auto Irrigation</Text>
                <Text style={styles.settingSubText}>AI controlled watering</Text>
              </View>
              <Switch
                trackColor={{ false: "#d1d5db", true: "#022E1F" }}
                thumbColor={"#ffffff"}
                ios_backgroundColor="#d1d5db"
                onValueChange={() => setAutoIrrigation(prev => !prev)}
                value={autoIrrigation}
              />
            </View>

          </View>

          {/* Support Section */}
          <View style={styles.glassCardNoPadding}>
            <View style={styles.supportHeaderSection}>
              <Text style={styles.supportHeaderText}>SUPPORT</Text>
            </View>
            
            <TouchableOpacity style={styles.supportItemRow}>
              <MaterialCommunityIcons name="help-circle-outline" size={18} color="#4b5563" />
              <Text style={styles.supportItemText}>Help Center & FAQs</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.supportItemRow, { paddingBottom: 20 }]}>
              <MaterialCommunityIcons name="information-outline" size={18} color="#4b5563" />
              <Text style={styles.supportItemText}>About FarmSense AI</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.editProfileButton, isEditingGlobal && styles.saveProfileButton]} 
            onPress={handleToggleEdit}
          >
            <Text style={[styles.editProfileButtonText, isEditingGlobal && styles.saveProfileButtonText]}>
              {isEditingGlobal ? 'Save Changes' : 'Edit Profile'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

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

  /* HERO CARD */
  heroCard: {
    backgroundColor: '#022E1F',
    borderRadius: 30,
    paddingVertical: 30,
    alignItems: 'center',
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 15,
    elevation: 6,
  },
  heroAvatarWrapper: {
    position: 'relative',
    marginBottom: 15,
  },
  heroAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#4ade80', // strong green border
  },
  editHeroImageBtn: {
    position: 'absolute',
    top: 0,
    right: -5,
    backgroundColor: '#064e3b',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#022E1F',
  },
  heroNameInput: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#4ade80',
    textAlign: 'center',
    width: '80%',
  },
  heroLocationInput: {
    fontSize: 12,
    color: '#a7f3d0',
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0',
    width: '60%',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  userLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userLocationText: {
    fontSize: 12,
    color: '#a7f3d0', // pale green
  },

  /* COMMON CARDS */
  glassCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  glassCardNoPadding: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeaderBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  sectionTitleOutside: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#022E1F',
    marginBottom: 15,
    marginLeft: 5,
  },
  cardHeaderRowSpace: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  /* FARM PROFILE */
  farmProfileList: {
    gap: 20,
  },
  farmProfileItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  farmProfileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  farmProfileTextContainer: {
    flex: 1,
  },
  farmProfileLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  farmProfileValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  farmInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#022E1F',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cropsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cropPill: {
    backgroundColor: '#dbeafe', // light blue background
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  cropPillText: {
    color: '#1e3a8a',
    fontSize: 12,
    fontWeight: '600',
  },

  /* SETTINGS */
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  settingTitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  settingSubText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  settingInput: {
    fontSize: 12,
    fontWeight: '600',
    color: '#022E1F',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    width: '100%',
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 20,
  },

  /* SUPPORT */
  supportHeaderSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  supportHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4b5563',
    letterSpacing: 1,
  },
  supportItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  supportItemText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },

  /* ACTION BUTTONS */
  editProfileButton: {
    backgroundColor: '#ccecf6', // Light cyan-blue as shown
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  saveProfileButton: {
    backgroundColor: '#059669', // Success green
  },
  editProfileButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#064e3b',
  },
  saveProfileButtonText: {
    color: '#ffffff',
  },
  logoutButton: {
    backgroundColor: '#ffffff',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca', // light red border
  },
  logoutButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#dc2626', // red text
  },

  /* DEVICE CARD */
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  deviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#064e3b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  deviceTextContainer: {
    flex: 1,
  },
  deviceLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  deviceCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceCodeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#022E1F',
    letterSpacing: 2,
  },
  deviceOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  deviceNotPaired: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  switchDeviceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    borderRadius: 15,
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  switchDeviceBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#022E1F',
  },
});
