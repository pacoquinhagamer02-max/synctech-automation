export { initializeApp } from 'firebase/app';
export { initializeAuth, browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, onAuthStateChanged, signInAnonymously,
  RecaptchaVerifier, linkWithPhoneNumber, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
export { initializeFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
