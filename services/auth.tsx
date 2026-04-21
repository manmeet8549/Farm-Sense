// Auth Context for FarmSense AI
// Simple email/password auth using Firebase Realtime Database
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, ref, set, get } from './firebase';

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  location: string;
  phoneNumber: string;
  farmName: string;
  landArea: string;
  primaryCrops: string;
  avatarUri: string;
  deviceCode: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  setDeviceCode: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: async () => {},
  updateProfile: async () => {},
  setDeviceCode: async () => {},
});

// Simple hash for demo (NOT production-grade)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Convert email to a safe Firebase key
function emailToKey(email: string): string {
  return email.replace(/\./g, '_dot_').replace(/@/g, '_at_');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app launch
  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const stored = await AsyncStorage.getItem('farmsense_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      }
    } catch (e) {
      console.error('Failed to restore session:', e);
    } finally {
      setLoading(false);
    }
  }

  async function signup(name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const userKey = emailToKey(email);
      console.log('Attempting signup for:', email);
      
      // Check if user already exists
      const existingRef = ref(db, `auth/${userKey}`);
      const existingSnap = await get(existingRef).catch(err => {
        console.error('Firebase GET failed (Signup):', err);
        throw new Error('Database permission denied. Please check your Firebase Rules.');
      });

      if (existingSnap.exists()) {
        return { success: false, error: 'An account with this email already exists.' };
      }

      const userId = `user_${Date.now()}`;
      const hashedPassword = simpleHash(password);

      // Save auth credentials
      await set(ref(db, `auth/${userKey}`), {
        userId,
        email,
        passwordHash: hashedPassword,
        createdAt: Date.now(),
      });

      // Save user profile (deviceCode is empty until pairing)
      const newProfile: AuthUser = {
        userId,
        name,
        email,
        location: '',
        phoneNumber: '',
        farmName: '',
        landArea: '',
        primaryCrops: '',
        avatarUri: 'https://www.w3schools.com/howto/img_avatar.png',
        deviceCode: '',
      };

      await set(ref(db, `users/${userId}`), newProfile);

      // Persist session locally
      setUser(newProfile);
      await AsyncStorage.setItem('farmsense_user', JSON.stringify(newProfile));

      return { success: true };
    } catch (error: any) {
      console.error('Full Signup Error Object:', error);
      return { success: false, error: error.message || 'Signup failed. Check your API Key and Rules.' };
    }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const userKey = emailToKey(email);
      console.log('Attempting login for:', email);
      
      const authRef = ref(db, `auth/${userKey}`);
      const authSnap = await get(authRef).catch(err => {
        console.error('Firebase GET failed (Login):', err);
        throw new Error('Database connection failed. Check your API Key and Rules.');
      });

      if (!authSnap.exists()) {
        return { success: false, error: 'No account found with this email.' };
      }

      const authData = authSnap.val();
      const hashedPassword = simpleHash(password);

      if (authData.passwordHash !== hashedPassword) {
        return { success: false, error: 'Incorrect password.' };
      }

      // Fetch user profile
      const profileRef = ref(db, `users/${authData.userId}`);
      const profileSnap = await get(profileRef);

      if (profileSnap.exists()) {
        const profileData = profileSnap.val() as AuthUser;
        setUser(profileData);
        await AsyncStorage.setItem('farmsense_user', JSON.stringify(profileData));
      }

      return { success: true };
    } catch (error: any) {
      console.error('Full Login Error Object:', error);
      return { success: false, error: error.message || 'Login failed. Check your connectivity.' };
    }
  }

  async function logout() {
    setUser(null);
    await AsyncStorage.removeItem('farmsense_user');
  }

  async function updateProfile(updates: Partial<AuthUser>) {
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    await AsyncStorage.setItem('farmsense_user', JSON.stringify(updatedUser));

    // Also update Firebase
    const { userId, ...profileData } = updatedUser;
    await set(ref(db, `users/${user.userId}`), updatedUser);
  }

  async function setDeviceCode(code: string) {
    if (!user) return;

    const updatedUser = { ...user, deviceCode: code };
    setUser(updatedUser);
    await AsyncStorage.setItem('farmsense_user', JSON.stringify(updatedUser));

    // Persist to Firebase user profile
    await set(ref(db, `users/${user.userId}/deviceCode`), code);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile, setDeviceCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
