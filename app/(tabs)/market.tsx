import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMarketplace, addFarmerListing, addBuyerListing } from '../../services/database';
import { useAuth } from '../../services/auth';

export default function MarketScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState('FARMER');
  const [selectedCrop, setSelectedCrop] = useState('Wheat Straw');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [orgName, setOrgName] = useState(user?.name || '');
  const [isPublishing, setIsPublishing] = useState(false);

  const cropOptions = ['Wheat Straw', 'Rice Husk', 'Corn Stalk', 'Sugarcane Trash', 'Cotton Stalk', 'Other'];

  // --- Firebase Real-Time Marketplace ---
  const { farmerListings, buyerListings, loading: marketLoading } = useMarketplace();

  const handlePublish = async () => {
    // Validation based on role
    if (activeRole === 'FARMER') {
      if (!selectedCrop || !quantity || !price || !location || !phone) {
        alert('Please fill in all Farmer listing fields.');
        return;
      }
    } else {
      if (!orgName || !selectedCrop || !quantity || !price || !phone) {
        alert('Please fill in all Organization listing fields.');
        return;
      }
    }

    setIsPublishing(true);
    try {
      if (activeRole === 'FARMER') {
        await addFarmerListing({
          userId: user?.userId || 'unknown',
          cropType: selectedCrop,
          quantity: parseFloat(quantity),
          pricePerKg: parseFloat(price),
          contact: phone,
          createdAt: Date.now(),
          status: 'active',
          farmerName: user?.name || 'Local Farmer',
        });
      } else {
        await addBuyerListing({
          orgName: orgName,
          cropNeeded: selectedCrop,
          quantityNeeded: parseFloat(quantity),
          offerPrice: parseFloat(price),
          contact: phone,
          createdAt: Date.now(),
          status: 'active',
        });
      }

      // Reset form
      setQuantity('');
      setPrice('');
      setLocation('');
      setPhone('');
      setOrgName('');
      alert('Listing published successfully!');
    } catch (error) {
      console.error('Error publishing listing:', error);
      alert('Failed to publish. Ensure you have internet and database permissions.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
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

          {/* Page Title & Subtitle */}
          <Text style={styles.pageTitle}>Marketplace</Text>
          <Text style={styles.subtitleHighlight}>Trade Smart.</Text>
          <Text style={styles.subtitleGray}>
            Connect farmers with sustainable{'\n'}buyers to reduce waste.
          </Text>

          {/* Role Toggle Switch */}
          <View style={styles.roleToggleContainer}>
            <TouchableOpacity 
              style={[styles.roleBtn, activeRole === 'FARMER' && styles.roleBtnActive]}
              onPress={() => setActiveRole('FARMER')}
              activeOpacity={0.9}
            >
              <Text style={[styles.roleBtnText, activeRole === 'FARMER' && styles.roleBtnTextActive]}>
                FARMER
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.roleBtn, activeRole === 'ORGANIZATION' && styles.roleBtnActive]}
              onPress={() => setActiveRole('ORGANIZATION')}
              activeOpacity={0.9}
            >
              <Text style={[styles.roleBtnText, activeRole === 'ORGANIZATION' && styles.roleBtnTextActive]}>
                ORGANIZATION
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Form Card based on Role */}
          <View style={styles.formCard}>
            <View style={styles.ambientGlow} />

            <Text style={styles.formCardTitle}>
              {activeRole === 'FARMER' ? 'List My Residue (Sell)' : 'Submit Buying Intent'}
            </Text>

            {activeRole === 'ORGANIZATION' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ORGANIZATION NAME</Text>
                <View style={styles.textInputWrapper}>
                  <TextInput 
                    style={styles.textInput} 
                    placeholder="Company or Factory Name" 
                    placeholderTextColor="#9ca3af"
                    value={orgName}
                    onChangeText={setOrgName}
                  />
                </View>
              </View>
            )}

            {/* SHARED CROP TYPE DROPDOWN */}
            <View style={[styles.inputGroup, { zIndex: 100 }]}>
              <Text style={styles.inputLabel}>
                {activeRole === 'FARMER' ? 'CROP TYPE' : 'RESIDUE NEEDED'}
              </Text>
              <View style={styles.dropdownContainer}>
                <View style={styles.dropdownInputBox}>
                  <TextInput 
                    style={styles.dropdownTextInput}
                    value={selectedCrop}
                    onChangeText={(text) => {
                      setSelectedCrop(text);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Search or Type Crop"
                    placeholderTextColor="#9ca3af"
                  />
                  <TouchableOpacity onPress={() => setIsDropdownOpen(!isDropdownOpen)}>
                    <Ionicons name={isDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {isDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {cropOptions.filter(opt => opt.toLowerCase().includes(selectedCrop.toLowerCase())).map((item) => (
                      <TouchableOpacity 
                        key={item} 
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedCrop(item);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>QUANTITY (KG)</Text>
                <View style={styles.textInputWrapper}>
                  <TextInput 
                    style={styles.textInput} 
                    placeholder="e.g. 500" 
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>
                  {activeRole === 'FARMER' ? 'PRICE / KG (₹)' : 'OFFER / KG (₹)'}
                </Text>
                <View style={styles.textInputWrapper}>
                  <TextInput 
                    style={styles.textInput} 
                    placeholder="e.g. 15" 
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>
              </View>
            </View>

            {activeRole === 'FARMER' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>LOCATION</Text>
                <View style={styles.textInputWrapperWithIcon}>
                  <Ionicons name="location-outline" size={18} color="#6b7280" />
                  <TextInput 
                    style={styles.textInputIconPad} 
                    placeholder="Village, District" 
                    placeholderTextColor="#9ca3af"
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {activeRole === 'FARMER' ? 'PHONE NUMBER' : 'CONTACT NUMBER'}
              </Text>
              <View style={styles.textInputWrapper}>
                <TextInput 
                  style={styles.textInput} 
                  placeholder="+91 XXXXX XXXXX" 
                  placeholderTextColor="#9ca3af" 
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.publishBtn, isPublishing && { opacity: 0.7 }]} 
              activeOpacity={0.8}
              onPress={handlePublish}
              disabled={isPublishing}
            >
              <Text style={styles.publishBtnText}>
                {isPublishing ? 'PUBLISHING...' : (activeRole === 'FARMER' ? 'PUBLISH LISTING' : 'SUBMIT INTENT')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Dynamic Listings Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {activeRole === 'FARMER' ? 'Recent Demands (Buyers)' : 'Recent Supplies (Farmers)'}
            </Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>SEE ALL</Text>
            </TouchableOpacity>
          </View>

          {activeRole === 'FARMER' ? (
            // Logic for Farmer: Show Buyer Demands
            buyerListings.length > 0 ? (
              buyerListings.slice(0, 5).map((listing, idx) => (
                <View key={listing.id || idx} style={styles.demandCard}>
                  <View style={styles.demandHeaderRow}>
                    <View style={styles.demandIconBoxBlue}>
                      <MaterialCommunityIcons name="factory" size={20} color="#0284c7" />
                    </View>
                    <View style={styles.demandTitleWrapper}>
                      <Text style={styles.demandTitle}>{listing.orgName}</Text>
                      <Text style={styles.demandSubtitle}>Looking for {listing.cropNeeded}</Text>
                    </View>
                    {idx === 0 && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.demandBottomRow}>
                    <View>
                      <Text style={styles.offeringLabel}>OFFERING</Text>
                      <Text style={styles.offeringPrice}>₹{listing.offerPrice} / KG</Text>
                    </View>
                    <TouchableOpacity style={styles.contactBtn}>
                      <Text style={styles.contactBtnText}>{listing.contact}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No buyer demands found.</Text>
            )
          ) : (
            // Logic for Organization: Show Farmer Supplies
            farmerListings.length > 0 ? (
              farmerListings.slice(0, 5).map((listing, idx) => (
                <View key={listing.id || idx} style={styles.demandCard}>
                  <View style={styles.demandHeaderRow}>
                    <View style={styles.demandIconBoxOrange}>
                      <FontAwesome5 name="seedling" size={16} color="#c2410c" />
                    </View>
                    <View style={styles.demandTitleWrapper}>
                      <Text style={styles.demandTitle}>{listing.farmerName || 'Independent Farmer'}</Text>
                      <Text style={styles.demandSubtitle}>Available: {listing.cropType}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.demandBottomRow}>
                    <View>
                      <Text style={styles.offeringLabel}>PRICE</Text>
                      <Text style={styles.offeringPrice}>₹{listing.pricePerKg} / KG</Text>
                      <Text style={[styles.offeringLabel, { marginTop: 4 }]}>QTY: {listing.quantity} KG</Text>
                    </View>
                    <TouchableOpacity style={styles.contactBtn}>
                      <Text style={styles.contactBtnText}>{listing.contact}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No farmer supplies found.</Text>
            )
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

  /* TITLE SECTION */
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#022E1F',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitleHighlight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
    marginBottom: 4,
  },
  subtitleGray: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 25,
  },

  /* ROLE TOGGLE */
  roleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 25,
    padding: 4,
    height: 48,
    marginBottom: 25,
  },
  roleBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  roleBtnActive: {
    backgroundColor: '#022E1F',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 1,
  },
  roleBtnTextActive: {
    color: '#ffffff',
  },

  /* FORM CARD */
  formCard: {
    backgroundColor: '#f1f8f5', // soft mint background
    borderRadius: 24,
    padding: 20,
    marginBottom: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#d1fae5',
    opacity: 0.5,
  },
  formCardTitle: {
    fontSize: 14,
    color: '#022E1F',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 15,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 100,
  },
  dropdownInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e5e7eb',
    height: 48,
    paddingHorizontal: 15,
    borderRadius: 12,
  },
  dropdownTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    height: '100%',
  },
  dropdownList: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
    zIndex: 1000,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#4b5563',
  },
  textInputWrapper: {
    backgroundColor: '#e5e7eb',
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  textInput: {
    fontSize: 13,
    color: '#1f2937',
  },
  textInputWrapperWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  textInputIconPad: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
    marginLeft: 8,
  },
  publishBtn: {
    backgroundColor: '#022E1F',
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  publishBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  /* RECENT DEMANDS SECTION */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 1,
  },
  demandCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    padding: 20,
    marginBottom: 15,
  },
  demandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  demandIconBoxBlue: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  demandIconBoxOrange: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  demandTitleWrapper: {
    flex: 1,
    paddingTop: 2,
  },
  demandTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  demandSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  urgentBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#064e3b', // very dark green
    letterSpacing: 0.5,
  },
  demandBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  offeringLabel: {
    fontSize: 10,
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 4,
  },
  offeringPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#022E1F',
  },
  contactBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#022E1F',
    letterSpacing: 0.5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
  }
});
