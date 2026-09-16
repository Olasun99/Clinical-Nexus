import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, Permission, ROLE_PERMISSIONS } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isDoctor: boolean;
  isPatient: boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Sync profile
          const profileRef = doc(db, 'users', firebaseUser.uid);
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            const data = profileSnap.data() as UserProfile;
            // Auto-upgrade to admin if they are still a patient
            if (firebaseUser.email === 'sunmonuolawaleemmanuel@gmail.com' && data.role === 'patient') {
              const updated = { ...data, role: 'admin' as const };
              await setDoc(profileRef, updated, { merge: true });
              setProfile(updated);
            } else {
              setProfile(data);
            }
          } else {
            // Create default profile for new user
            const newProfile: UserProfile = {
              userId: firebaseUser.uid,
              name: firebaseUser.displayName || 'Unknown User',
              email: firebaseUser.email || '',
              role: firebaseUser.email === 'sunmonuolawaleemmanuel@gmail.com' ? 'admin' : 'patient',
              createdAt: new Date().toISOString(),
            };
            try {
              await setDoc(profileRef, newProfile);
              setProfile(newProfile);
            } catch (createError) {
              console.error('Failed to create initial profile:', createError);
              // Set a local fallback profile so the app still works for the superuser
              if (firebaseUser.email === 'sunmonuolawaleemmanuel@gmail.com') {
                setProfile(newProfile);
              }
            }
          }
        } catch (error) {
          console.error('Profile sync error:', error);
          // If we can't fetch the profile, we still want to allow the superuser to see the admin UI
          if (firebaseUser.email === 'sunmonuolawaleemmanuel@gmail.com') {
             setProfile({
               userId: firebaseUser.uid,
               name: firebaseUser.displayName || 'Super User',
               email: firebaseUser.email || '',
               role: 'admin',
               createdAt: new Date().toISOString()
             });
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = (permission: Permission): boolean => {
    const role = user?.email === 'sunmonuolawaleemmanuel@gmail.com' ? 'admin' : (profile?.role || 'patient');
    const permissions = ROLE_PERMISSIONS[role as any] || [];
    return permissions.includes(permission);
  };

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || user?.email === 'sunmonuolawaleemmanuel@gmail.com',
    isDoctor: profile?.role === 'doctor' || user?.email === 'sunmonuolawaleemmanuel@gmail.com',
    isPatient: profile?.role === 'patient' || user?.email === 'sunmonuolawaleemmanuel@gmail.com',
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
