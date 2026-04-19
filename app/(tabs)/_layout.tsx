import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_MARGIN = 15; // Decreased margin to widen the background
const TAB_BAR_WIDTH = SCREEN_WIDTH - (TAB_BAR_MARGIN * 2);
function CustomTabBar({ state, descriptors, navigation }: any) {
  const [barWidth, setBarWidth] = React.useState(SCREEN_WIDTH - (TAB_BAR_MARGIN * 2));
  const translateX = useRef(new Animated.Value(0)).current;
  
  const tabWidth = barWidth / 5;
  const PILL_WIDTH = 65;

  const VISIBLE_TABS = ['farm', 'index', 'irrigation', 'health', 'market'];
  const visibleRoutes = state.routes.filter((route: any) => VISIBLE_TABS.includes(route.name));
  const currentRouteName = state.routes[state.index].name;
  const isHiddenRoute = !VISIBLE_TABS.includes(currentRouteName);

  useEffect(() => {
    const visibleIndex = visibleRoutes.findIndex((r: any) => r.name === currentRouteName);
    
    if (visibleIndex !== -1) {
      Animated.spring(translateX, {
        toValue: visibleIndex * tabWidth,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }).start();
    }
  }, [state.index, tabWidth, currentRouteName]);

  const onBarLayout = (event: any) => {
    const { width } = event.nativeEvent.layout;
    setBarWidth(width);
  };

  return (
    <View style={styles.tabBarContainer} onLayout={onBarLayout}>
      {/* Animated Pill Background */}
      <Animated.View 
        style={[
          styles.activeTabPill,
          {
            width: PILL_WIDTH,
            transform: [{ translateX }],
            position: 'absolute',
            left: (tabWidth - PILL_WIDTH) / 2, 
            opacity: isHiddenRoute ? 0 : 1, 
          }
        ]} 
      />

      {visibleRoutes.map((route: any, index: number) => {
        const isFocused = state.index === state.routes.findIndex((r: any) => r.key === route.key);

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let iconName: any = 'tractor';
        let label = 'FARM';
        if (route.name === 'index') { iconName = 'chart-box'; label = 'INSIGHTS'; }
        else if (route.name === 'irrigation') { iconName = 'water'; label = 'IRRIGATE'; }
        else if (route.name === 'health') { iconName = 'shield-plus'; label = 'HEALTH'; }
        else if (route.name === 'market') { iconName = 'storefront'; label = 'MARKET'; }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons 
              size={24} 
              name={iconName} 
              color={isFocused ? '#ffffff' : '#6b7280'} 
            />
            <Text 
              numberOfLines={1} 
              adjustsFontSizeToFit 
              style={isFocused ? styles.activeLabel : styles.inactiveLabel}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="farm" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="irrigation" />
      <Tabs.Screen name="health" />
      <Tabs.Screen name="market" />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="weather" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    marginHorizontal: TAB_BAR_MARGIN,
    marginBottom: 20,
    height: 70,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    borderTopWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 0, // items distributed by TAB_WIDTH
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    top: 0, // User's preferred offset
  },
  activeTabPill: {
    height: 52,
    width: 65,
    backgroundColor: '#013a20',
    borderRadius: 30, // User's preferred borderRadius
    top: 9, // Adjusted relative to container (70-52)/2 + slight offset
  },
  activeLabel: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 4,
  },
  inactiveLabel: {
    color: '#6b7280',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
  }
});
