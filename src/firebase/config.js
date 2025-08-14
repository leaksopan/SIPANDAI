// Import functions you need from Firebase SDKs
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration untuk project SIPANDAI
const firebaseConfig = {
  apiKey: "AIzaSyAXJtOJzFN5J-5n4lF12wBi6Z_35Ar63ks",
  authDomain: "sipandai-a67d1.firebaseapp.com",
  projectId: "sipandai-a67d1",
  storageBucket: "sipandai-a67d1.firebasestorage.app",
  messagingSenderId: "324713224664",
  appId: "1:324713224664:web:762971aca98db8a3dd7aad",
  measurementId: "G-Q8GD4V8C0J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication dan setup Google provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export default app;
