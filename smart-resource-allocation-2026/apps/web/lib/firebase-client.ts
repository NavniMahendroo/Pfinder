import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isFirebaseClientConfigured = Object.values(firebaseConfig).every(Boolean);

let firebaseAuth: Auth | null = null;

if (isFirebaseClientConfigured) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firebaseAuth = getAuth(app);
}

export { firebaseAuth, isFirebaseClientConfigured };
