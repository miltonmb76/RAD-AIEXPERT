import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google OAuth Provider
export const provider = new GoogleAuthProvider();
// Request explicit scopes for Gmail
provider.addScope('https://www.googleapis.com/auth/gmail.send');
// provider.addScope('https://www.googleapis.com/auth/gmail.readonly'); // only send is strictly required, let's keep what we had

// Do NOT force 'select_account' so that the session can be kept open and re-authorized instantly with 1-click
// provider.setCustomParameters({
//   prompt: 'select_account'
// });

// Flag to indicate if we are currently signing in
let isSigningIn = false;

// Cache the access token in memory, initializing from localStorage if available
let cachedAccessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("rad_gmail_access_token") : null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // Restore cached access token from localStorage if memory is empty
      const storedToken = localStorage.getItem("rad_gmail_access_token") || cachedAccessToken || "";
      cachedAccessToken = storedToken;
      
      // Save basic user details in localStorage for instant restoration on next load
      localStorage.setItem("rad_cached_user", JSON.stringify({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      }));
      
      if (onAuthSuccess) {
        onAuthSuccess(user, storedToken);
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("rad_gmail_access_token");
      localStorage.removeItem("rad_cached_user");
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Auth.');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem("rad_gmail_access_token", cachedAccessToken);
    
    // Save basic user details in localStorage for instant restoration on next load
    localStorage.setItem("rad_cached_user", JSON.stringify({
      uid: result.user.uid,
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL
    }));

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error during Google sign-in:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== "undefined") {
    cachedAccessToken = localStorage.getItem("rad_gmail_access_token");
  }
  return cachedAccessToken;
};

export const setAccessTokenDirectly = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem("rad_gmail_access_token", token);
  } else {
    localStorage.removeItem("rad_gmail_access_token");
  }
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("rad_gmail_access_token");
  localStorage.removeItem("rad_cached_user");
};
