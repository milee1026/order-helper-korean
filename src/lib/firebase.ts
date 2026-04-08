import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA2kV5Jd-HT1WKBmkz2-NMTgsjpl6-JUEk',
  authDomain: 'order-helper-korean.firebaseapp.com',
  projectId: 'order-helper-korean',
  storageBucket: 'order-helper-korean.firebasestorage.app',
  messagingSenderId: '599179353895',
  appId: '1:599179353895:web:661e01047c20cffec8d302',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

void setPersistence(auth, browserLocalPersistence).catch(() => {
  // Firebase Auth already defaults to browser persistence in most browsers.
});

void enableIndexedDbPersistence(db).catch(() => {
  // Multi-tab or unsupported browsers can fall back to the default cache mode.
});

