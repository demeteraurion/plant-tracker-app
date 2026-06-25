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
const DB_VERSION = 2
const STORE_NAME = 'plants'
const CACHE_STORE_NAME = 'plantCache'

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
      if (!indexedDb.objectStoreNames.contains(CACHE_STORE_NAME)) {
        indexedDb.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const getAllPlantsFromStore = async (storeName) => {
  const indexedDb = await initIndexedDB()

  return new Promise((resolve, reject) => {
    const transaction = indexedDb.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const savePlantsToStore = async (plants, storeName) => {
  const plantsToSave = plants.filter((plant) => plant?.id)
  if (plantsToSave.length === 0) return true

  const indexedDb = await initIndexedDB()

  return new Promise((resolve, reject) => {
    const transaction = indexedDb.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)

    plantsToSave.forEach((plant) => store.put(plant))

    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

const replacePlantsInStore = async (plants, storeName) => {
  const plantsToSave = plants.filter((plant) => plant?.id)
  const indexedDb = await initIndexedDB()

  return new Promise((resolve, reject) => {
    const transaction = indexedDb.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)

    store.clear()
    plantsToSave.forEach((plant) => store.put(plant))

    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export const getAllPlantsFromIndexedDB = () => getAllPlantsFromStore(STORE_NAME)
export const getCachedPlantsFromIndexedDB = () => getAllPlantsFromStore(CACHE_STORE_NAME)
export const savePlantsToIndexedDBCache = (plants) => savePlantsToStore(plants, CACHE_STORE_NAME)
export const replaceIndexedDBCache = (plants) => replacePlantsInStore(plants, CACHE_STORE_NAME)

const deletePlantsFromIndexedDB = async (ids, storeName = STORE_NAME) => {
  const idsToDelete = ids.filter(Boolean)
  if (idsToDelete.length === 0) return true

  const indexedDb = await initIndexedDB()

  return new Promise((resolve, reject) => {
    const transaction = indexedDb.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)

    idsToDelete.forEach((id) => store.delete(id))

    transaction.oncomplete = () => resolve(true)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export const getAllPlants = async () => {
  const snapshot = await getDocs(getPlantsCollection())
  const plants = snapshot.docs.map((plantDoc) => plantDoc.data())
  await replaceIndexedDBCache(plants)
  return plants
}

export const savePlantToDB = async (plant) => {
  await setDoc(getPlantDocument(plant.id), plant)
  await savePlantsToIndexedDBCache([plant])
  return true
}

export const deletePlantFromDB = async (id) => {
  await deleteDoc(getPlantDocument(id))
  await deletePlantsFromIndexedDB([id])
  await deletePlantsFromIndexedDB([id], CACHE_STORE_NAME)
  return true
}

export const deleteLocalPlantsFromDB = async (ids) => {
  await deletePlantsFromIndexedDB(ids)
  return true
}

export const replacePlantsInDB = async (plants) => {
  const snapshot = await getDocs(getPlantsCollection())
  const batch = writeBatch(db)

  snapshot.docs.forEach((plantDoc) => batch.delete(plantDoc.ref))
  plants.forEach((plant) => batch.set(getPlantDocument(plant.id), plant))

  await batch.commit()
  await replaceIndexedDBCache(plants)
  return true
}
