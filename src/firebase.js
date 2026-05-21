import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDHoxrg07lvHKlPRVVsLyJje385dK-CnW0',
  authDomain: 'plant-tracker-app-fdf90.firebaseapp.com',
  projectId: 'plant-tracker-app-fdf90',
  storageBucket: 'plant-tracker-app-fdf90.firebasestorage.app',
  messagingSenderId: '996255725521',
  appId: '1:996255725521:web:f5ba86fded3aa7250fd2f0',
  measurementId: 'G-P7DHT60FP2',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
