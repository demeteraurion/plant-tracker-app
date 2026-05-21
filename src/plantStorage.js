import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'

const DB_NAME = 'PlantTrackerDB_CuteCozy'
const DB_VERSION = 1
const STORE_NAME = 'plants'

const getCurrentUserId = () => {
  const uid = auth.currentUser?.uid

  if (!uid) {
    throw new Error('Plant storage requires an authenticated user.')
  }

  return uid
}

const getPlantsCollection = () => collection(db, 'users', getCurrentUserId(), 'plants')
const getPlantDocument = (id) => doc(db, 'users', getCurrentUserId(), 'plants', id)

const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const indexedDb = event.target.result
      if (!indexedDb.objectStoreNames.contains(STORE_NAME)) {
        indexedDb.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const getAllPlantsFromIndexedDB = async () => {
  const indexedDb = await initIndexedDB()

  return new Promise((resolve, reject) => {
    const transaction = indexedDb.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const getAllPlants = async () => {
  const snapshot = await getDocs(getPlantsCollection())
  return snapshot.docs.map((plantDoc) => plantDoc.data())
}

export const savePlantToDB = async (plant) => {
  await setDoc(getPlantDocument(plant.id), plant)
  return true
}

export const deletePlantFromDB = async (id) => {
  await deleteDoc(getPlantDocument(id))
  return true
}

export const replacePlantsInDB = async (plants) => {
  const snapshot = await getDocs(getPlantsCollection())
  const batch = writeBatch(db)

  snapshot.docs.forEach((plantDoc) => batch.delete(plantDoc.ref))
  plants.forEach((plant) => batch.set(getPlantDocument(plant.id), plant))

  await batch.commit()
  return true
}
