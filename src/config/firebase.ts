import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyC2bsCBal_1GZ0vBZ9_iPFNkqQk-kocqkU",
  authDomain: "removebg-ab28d.firebaseapp.com",
  databaseURL: "https://removebg-ab28d-default-rtdb.firebaseio.com",
  projectId: "removebg-ab28d",
  storageBucket: "removebg-ab28d.firebasestorage.app",
  messagingSenderId: "528882913121",
  appId: "1:528882913121:web:ceac377301683b92fd7f20",
  measurementId: "G-DEN9HTDKNK",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export default app;
