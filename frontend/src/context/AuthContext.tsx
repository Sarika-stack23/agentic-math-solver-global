import React, { createContext, useContext, useState } from 'react';
import type { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isGuest: boolean;
  signInWithGoogle: () => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const guestUser = {
  uid: 'guest-user',
  email: 'Guest',
  displayName: 'Guest Student',
  getIdToken: async () => 'test-token',
} as any;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const loading = false;
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      // TODO: Replace with real Firebase Google Auth in production
      // For now, use guest mode as default
      setUser(guestUser);
      setIsGuest(true);
    } catch (e) {
      setError('Sign in failed. Please try again.');
    }
  };

  const continueAsGuest = () => {
    setUser(guestUser);
    setIsGuest(true);
    setError(null);
  };

  const logout = async () => {
    setUser(null);
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, isGuest, signInWithGoogle, continueAsGuest, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
