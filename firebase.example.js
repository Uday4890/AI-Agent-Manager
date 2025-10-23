import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";
import dotenv from "dotenv"; // <-- NEW: Import dotenv
dotenv.config(); // <-- NEW: Load environment variables

// Your Firebase configuration is now loaded from the .env file.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY, // <-- Changed to use ENV variable
  authDomain: process.env.FIREBASE_AUTH_DOMAIN, // <-- Changed to use ENV variable
  projectId: process.env.FIREBASE_PROJECT_ID, // <-- Changed to use ENV variable
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // <-- Changed to use ENV variable
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID, // <-- Changed to use ENV variable
  appId: process.env.FIREBASE_APP_ID, // <-- Changed to use ENV variable
  measurementId: process.env.FIREBASE_MEASUREMENT_ID, // <-- Changed to use ENV variable
};

const app = initializeApp(firebaseConfig);

// INITIALIZE AND EXPORT FIRESTORE INSTANCE
export const db = getFirestore(app);