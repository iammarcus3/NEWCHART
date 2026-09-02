import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  setAuthError: (err: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Upsert user profile document in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          await setDoc(
            userDocRef,
            {
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Music Curator',
              photoURL: currentUser.photoURL || '',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error('Error saving user profile:', err);
        }

        // Synchronize user to Cloud SQL backend
        try {
          const idToken = await currentUser.getIdToken();
          await fetch('/api/users/me', {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });
        } catch (err) {
          console.warn('Backend sync notice:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.warn('Sign-in notice:', err?.code, err?.message);
      let userFriendlyMessage = 'Failed to sign in with Google.';
      if (err?.code === 'auth/popup-closed-by-user') {
        userFriendlyMessage = 'Sign-in window was closed before completing. Click "Sign in with Google" to try again, or continue as Guest.';
      } else if (err?.code === 'auth/popup-blocked') {
        userFriendlyMessage = 'The Google sign-in window was blocked by your browser. Please allow popups or open the app in a new tab.';
      } else if (err?.code === 'auth/cancelled-popup-request') {
        userFriendlyMessage = 'Sign-in window request was cancelled. Please try again.';
      } else if (err?.code === 'auth/unauthorized-domain') {
        userFriendlyMessage = 'This preview domain is pending OAuth authorization. You can use full features via "Continue as Guest".';
      } else if (err?.code === 'auth/network-request-failed') {
        userFriendlyMessage = 'Network connection issue reaching Google Auth. Please check your connection and retry.';
      } else if (err?.message) {
        userFriendlyMessage = err.message;
      }
      setAuthError(userFriendlyMessage);
      throw new Error(userFriendlyMessage);
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        logout,
        authError,
        setAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
