// Firebase initialization
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBKkH_D1g6t4djCvU2yMO99VgGaj3KyA9Y",
  authDomain: "subconsciousbeliefs-3f4ee.firebaseapp.com",
  projectId: "subconsciousbeliefs-3f4ee",
  storageBucket: "subconsciousbeliefs-3f4ee.firebasestorage.app",
  messagingSenderId: "775698245350",
  appId: "1:775698245350:web:9610742cf4029536d0bd27"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
