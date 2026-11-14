// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDXNapsrDEKVm9f2_r92Jy07qk-KQkURx8",
  authDomain: "ambiente-86b84.firebaseapp.com",
  databaseURL: "https://ambiente-86b84-default-rtdb.firebaseio.com",
  projectId: "ambiente-86b84",
  storageBucket: "ambiente-86b84.firebasestorage.app",
  messagingSenderId: "769415872643",
  appId: "1:769415872643:web:4609d8d4e462134c905bb6",
  measurementId: "G-Y2P23H8DBX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
