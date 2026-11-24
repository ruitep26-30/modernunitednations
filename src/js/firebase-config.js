// Firebase Web SDK Modular Configuration (v10.13.2)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadString,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import {
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  get as rtdbGet,
  update as rtdbUpdate,
  remove as rtdbRemove,
  onValue as rtdbOnValue,
  push as rtdbPush,
  child as rtdbChild,
  off as rtdbOff,
  query as rtdbQuery,
  orderByChild as rtdbOrderByChild,
  equalTo as rtdbEqualTo,
  serverTimestamp as rtdbServerTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDHs4U6hmPFIZrtY1mHjZWqmYhmbXSNdcM",
  authDomain: "modernunitednations-vish.firebaseapp.com",
  databaseURL: "https://modernunitednations-vish-default-rtdb.firebaseio.com",
  projectId: "modernunitednations-vish",
  storageBucket: "modernunitednations-vish.firebasestorage.app",
  messagingSenderId: "997463439610",
  appId: "1:997463439610:web:3da2c51b4a9ac1cee87143",
  measurementId: "G-NNVNTF2YY1"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  doc,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  storageRef,
  uploadBytes,
  uploadString,
  getDownloadURL,
  rtdbRef,
  rtdbSet,
  rtdbGet,
  rtdbUpdate,
  rtdbRemove,
  rtdbOnValue,
  rtdbPush,
  rtdbChild,
  rtdbOff,
  rtdbQuery,
  rtdbOrderByChild,
  rtdbEqualTo,
  rtdbServerTimestamp
};

// Production-Grade Auth Session & JWT helpers
export {
  saveSession,
  getSession,
  getJwtToken,
  updateSessionProfile,
  clearSession,
  ensureUserSession
} from './auth-session.js';



