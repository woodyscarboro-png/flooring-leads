import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCBguEuPKEaiKgusoNZ6Lwp7D0Up4hxoP4",
  authDomain: "kqf-lead-generation.firebaseapp.com",
  projectId: "kqf-lead-generation",
  storageBucket: "kqf-lead-generation.firebasestorage.app",
  messagingSenderId: "360247291247",
  appId: "1:360247291247:web:a6b7480105263389094c9a",
  measurementId: "G-TDMSH76DX4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);