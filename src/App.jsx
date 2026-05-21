import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  deletePlantFromDB,
  getAllPlants,
  getAllPlantsFromIndexedDB,
  replacePlantsInDB,
  savePlantToDB,
} from './plantStorage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Auth from './Auth';
import { auth } from './firebase';
import {
  Plus,
  Droplets,
  Trash2,
  ArrowLeft,
  LayoutGrid,
  X,
  Sparkles,
  Download,
  Sprout,
  Stars,
  Home,
  Upload,
  Menu,
  Search,
  Sun,
  Moon,
  Camera,
  CloudRain,
  CheckCircle2,
  Heart,
  PencilLine,
  Wind
} from 'lucide-react';

// --- Constants ---
const BASE_URL = import.meta.env.BASE_URL;

const POPULAR_PLANTS = [
  "Aloe Vera", "African Violet", "Anthurium", "Areca Palm", "Asparagus Fern",
  "Bamboo Palm", "Begonia", "Bird of Paradise", "Boston Fern", "Burro's Tail",
  "Calathea", "Cast Iron Plant", "Chinese Evergreen", "Chinese Money Plant", "Christmas Cactus",
  "Croton", "Dieffenbachia", "Dragon Tree", "English Ivy", "Fiddle Leaf Fig",
  "Golden Pothos", "Hoya Carnosa", "Hoya Kerrii", "Hoya Pubicalyx", "Hoya Rope",
  "Jade Plant", "Kentia Palm", "Lavender", "Maidenhair Fern", "Majesty Palm",
  "Monstera Adansonii", "Monstera Deliciosa", "Orchid", "Peace Lily", "Parlor Palm",
  "Peperomia", "Philodendron Birkin", "Philodendron Brasil", "Philodendron Heartleaf", "Philodendron Pink Princess",
  "Pony Tail Palm", "Pothos Marble Queen", "Pothos Neon", "Rubber Plant", "Sago Palm",
  "Snake Plant", "Spider Plant", "String of Hearts", "String of Pearls", "String of Turtles",
  "Swiss Cheese Plant", "Trident Fern", "Venus Flytrap", "Yuccas", "ZZ Plant"
].sort();

const calculateNextDue = (lastWatered, frequency) => {
  if (!lastWatered || !frequency) return null;
  const date = new Date(lastWatered);
  date.setDate(date.getDate() + parseInt(frequency));
  return date;
};

const getStatus = (nextDue) => {
  if (!nextDue) return 'unknown';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue);
  due.setHours(0, 0, 0, 0);

  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'upcoming';
};

const createPlantId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeImportedPlant = (plant) => {
  if (!plant || typeof plant !== 'object' || Array.isArray(plant)) return null;

  return {
    ...plant,
    id: plant.id ? String(plant.id) : createPlantId(),
  };
};

const compressImage = (input, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Image compression could not create a canvas context.'));
        return;
      }

      context.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = reject;

    if (typeof input === 'string') {
      img.src = input;
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(input);
  });
};

const compressOversizedPlantPhotos = async (plants) => {
  const results = await Promise.all(
    plants.map(async (plant) => {
      if (
        !plant.photo ||
        !plant.photo.startsWith('data:') ||
        plant.photo.length <= 200000
      ) {
        return plant;
      }

      try {
        const photo = await compressImage(plant.photo);
        return { ...plant, photo };
      } catch (error) {
        console.error('Failed to optimize an existing plant photo', error);
        return plant;
      }
    }),
  );

  return results;
};

// --- Main App Component ---
export default function App() {
  const [plants, setPlants] = useState([]);
  const [view, setView] = useState('dashboard');
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const searchBoxRef = useRef(null);

  const [filter, setFilter] = useState('all');
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [photoOptimizationMessage, setPhotoOptimizationMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('plantTrackerTheme') === 'dark';
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setPlants([]);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const loadPlants = async () => {
      setIsLoading(true);
      try {
        const indexedDbPlants = await getAllPlantsFromIndexedDB();
        const firestorePlants = await getAllPlants();
        const firestorePlantIds = new Set(firestorePlants.map((plant) => plant.id));
        const localPlantsToMigrate = indexedDbPlants.filter(
          (plant) => plant.id && !firestorePlantIds.has(plant.id),
        );
        const plantsNeedingOptimization = [...firestorePlants, ...localPlantsToMigrate]
          .filter((plant) =>
            plant.photo &&
            plant.photo.startsWith('data:') &&
            plant.photo.length > 200000
          );
        let migratedLocalPlants = [];

        if (plantsNeedingOptimization.length > 0 && isActive) {
          setPhotoOptimizationMessage('Optimizing photos...');
        }

        const optimizedFirestorePlants = await compressOversizedPlantPhotos(firestorePlants);
        const optimizedLocalPlantsToMigrate = await compressOversizedPlantPhotos(localPlantsToMigrate);
        const optimizedFirestoreById = new Map(
          optimizedFirestorePlants.map((plant) => [plant.id, plant]),
        );
        const changedFirestorePlants = firestorePlants
          .filter((plant) => optimizedFirestoreById.get(plant.id)?.photo !== plant.photo)
          .map((plant) => optimizedFirestoreById.get(plant.id));

        if (changedFirestorePlants.length > 0) {
          await Promise.all(changedFirestorePlants.map((plant) => savePlantToDB(plant)));
        }

        if (localPlantsToMigrate.length > 0) {
          const migrationResults = await Promise.allSettled(
            optimizedLocalPlantsToMigrate.map((plant) => savePlantToDB(plant)),
          );

          migratedLocalPlants = optimizedLocalPlantsToMigrate.filter(
            (_, index) => migrationResults[index].status === 'fulfilled',
          );

          const migrationErrors = migrationResults
            .filter((result) => result.status === 'rejected')
            .map((result) => result.reason);

          if (migrationErrors.length > 0) {
            console.error('Failed to migrate some local plants', migrationErrors);
            window.alert('Some local plants could not be synced to Firestore. Check your Firebase Firestore rules and any large plant photos, then try again.');
          }
        }

        if (isActive) {
          setPlants([...optimizedFirestorePlants, ...migratedLocalPlants]);
        }
      } catch (e) {
        console.error('Failed to load plants', e);
        window.alert('Root Record could not load or migrate your synced plants. Check your Firebase Firestore rules and try again.');
      } finally {
        if (isActive) {
          setIsLoading(false);
          setPhotoOptimizationMessage('');
        }
      }
    };

    loadPlants();

    return () => {
      isActive = false;
    };
  }, [user]);

  useEffect(() => {
    localStorage.setItem('plantTrackerTheme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);
    if (standalone) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

useEffect(() => {
  const onMouseDown = (e) => {
    if (!searchBoxRef.current) return;
    if (!searchBoxRef.current.contains(e.target)) {
      setIsSearchOpen(false);
      setIsSearchPanelOpen(false);
    }
  };
  document.addEventListener('mousedown', onMouseDown);
  return () => document.removeEventListener('mousedown', onMouseDown);
}, []);



  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return plants
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const species = (p.species || '').toLowerCase();
        return name.includes(q) || species.includes(q);
      })
      .slice(0, 8);
  }, [plants, searchQuery]);

  useEffect(() => {
    const onKeyDown = (e) => {
if (e.key === 'Escape') {
  setIsSearchOpen(false);
  setIsSearchPanelOpen(false);
}

      if (e.key === 'Enter') {
        const q = searchQuery.trim();
        if (q && searchResults.length === 1) {
          const only = searchResults[0];
          setSelectedPlantId(only.id);
          setView('detail');
          setSearchQuery('');
          setIsSearchOpen(false);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searchQuery, searchResults]);

  const addPlant = async (newPlant) => {
    const plant = { ...newPlant, id: createPlantId(), createdAt: new Date().toISOString() };
    await savePlantToDB(plant);
    setPlants((current) => [...current, plant]);
    setIsModalOpen(false);
  };

  const updatePlant = async (id, updates) => {
    const existing = plants.find((p) => p.id === id);
    if (!existing) return;

    const newPlant = { ...existing, ...updates };

    await savePlantToDB(newPlant);
    setPlants((current) => current.map((p) => (p.id === id ? newPlant : p)));
  };

  const deletePlant = async (id) => {
    await deletePlantFromDB(id);
    setPlants((current) => current.filter((p) => p.id !== id));
    setSelectedPlantId(null);
    setView('dashboard');
  };
  const markWatered = (id) => {
    const now = new Date();
    updatePlant(id, { lastWatered: now.toISOString() });
  };

  const exportData = () => {
    const dataStr = JSON.stringify(plants, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'my-cozy-garden.json');
    linkElement.click();
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) {
          throw new Error('Import file must contain an array of plants.');
        }

        const normalized = imported
          .map(normalizeImportedPlant)
          .filter(Boolean);

        await replacePlantsInDB(normalized);
        setPlants(normalized);
      } catch (err) {
        console.error('Import failed', err);
        window.alert('Import failed. Please choose a valid Root Record JSON backup.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const filteredPlants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return plants.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const speciesMatch = (p.species || '').toLowerCase().includes(q);
      const matchesSearch = !q || nameMatch || speciesMatch;

      if (filter === 'all') return matchesSearch;
      return matchesSearch && getStatus(calculateNextDue(p.lastWatered, p.frequency)) === filter;
    });
  }, [plants, searchQuery, filter]);



  const selectedPlant = plants.find(p => p.id === selectedPlantId);

  if (isAuthLoading) {
    return (
      <div className={`${isDarkMode ? 'dark' : ''}`}>
        <div className="flex items-center justify-center min-h-screen bg-[#FFF9F2] dark:bg-[#151A17]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-bounce">
              <Sprout size={48} className="text-[#A7C080]" />
            </div>
            <p className="font-serif italic text-[#A7C080]">Checking your garden gate...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${isDarkMode ? 'dark' : ''}`}>
        <Auth />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${isDarkMode ? 'dark' : ''}`}>
        <div className="flex items-center justify-center min-h-screen bg-[#FFF9F2] dark:bg-[#151A17]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-bounce">
              <Sprout size={48} className="text-[#A7C080]" />
            </div>
            <p className="font-serif italic text-[#A7C080]">Waking up the seedlings...</p>
          </div>
          {photoOptimizationMessage && (
            <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-white/95 px-5 py-3 text-sm font-bold text-[#8FA66A] shadow-2xl dark:bg-[#232B26]/95 dark:text-[#A7C080]">
              {photoOptimizationMessage}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="flex min-h-screen w-full overflow-x-hidden bg-[#FFF9F2] dark:bg-[#151A17] text-[#5C4D42] dark:text-[#CBD5D0] font-sans transition-colors duration-700 selection:bg-[#F2C6C2] selection:text-white">

        {/* Mobile sidebar backdrop (tap to close) */}
        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          />
        )}
        
        {/* Bubbly Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/60 dark:bg-[#1A211D]/80 backdrop-blur-xl border-r border-[#F2E8D5] dark:border-[#2A332E] transition-all duration-500 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 shadow-2xl lg:shadow-none`}>
          <div className="flex flex-col h-full p-6">
            <div className="py-8 flex items-center gap-4 px-2">
              <div className="w-12 h-12 bg-gradient-to-br from-[#A7C080] to-[#8FA66A] rounded-[22px] flex items-center justify-center text-white shadow-[0_8px_20px_rgba(167,192,128,0.3)] animate-pulse">
               <img src={`${BASE_URL}logo.png`} alt="Root Record" />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-black tracking-tight text-[#8FA66A] dark:text-[#B8D194]">Root Record</h1>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-50 dark:text-[#A7C080]">Garden Journal</p>
              </div>
              <button
                type="button"
                aria-label="Close sidebar"
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden ml-auto p-3 bg-white dark:bg-[#232B26] shadow-sm rounded-2xl dark:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 space-y-3">
              <NavItem active={view === 'dashboard'} onClick={() => { setView('dashboard'); setSelectedPlantId(null); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} icon={<Home size={22}/>} label="Home Sweet Home" />
              <NavItem active={view === 'list'} onClick={() => { setView('list'); setSelectedPlantId(null); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} icon={<LayoutGrid size={22}/>} label="My Planties" />
             
            </nav>

            <div className="mt-auto space-y-4">
              <div className="bg-gradient-to-tr from-[#FDF2F0] to-[#FFF9F2] dark:from-[#232B26] dark:to-[#1A211D] rounded-[32px] p-6 text-center border-2 border-dashed border-[#F2C6C2]/30 dark:border-[#A7C080]/10 relative overflow-hidden group">
                <Stars className="absolute -top-2 -right-2 text-[#F2C6C2] dark:text-[#E8C06F] opacity-40 group-hover:rotate-12 transition-transform" size={40} />
                <p className="text-xs font-bold text-[#D98E82] dark:text-[#E8C06F] mb-1">Coziness Tip</p>
                <p className="text-sm italic opacity-70 dark:text-slate-400">Dust your leaves gently with a damp cloth today! *</p>
              </div>

              <div className="rounded-[30px] border border-white/70 bg-white/45 p-3 shadow-sm dark:border-[#2A332E] dark:bg-[#17201B]/80">
                <div className="flex items-start justify-between gap-3 px-2 pb-3 pt-1">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#D9E3D8] dark:text-[#415147]">
                      Signed in
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-[#A8BDB4] dark:text-[#6D857A]">
                      {user.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut(auth)}
                    className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-[#8FA66A] shadow-sm transition hover:bg-[#EAF2ED] dark:bg-[#232B26] dark:text-[#A7C080] dark:hover:bg-[#2A332E]"
                  >
                    Sign out
                  </button>
                </div>

                {!isStandalone && (installPrompt || isIOS) && (
                  <div className="relative pb-2">
                    {isIOS && !installPrompt && showIOSInstructions && (
                      <div className="absolute bottom-full left-0 right-0 z-10 mb-3 rounded-[20px] bg-[#E8F0E8] p-4 text-xs font-bold text-[#5C4D42] shadow-2xl dark:bg-[#1A211D] dark:text-[#CBD5D0]">
                        <button
                          type="button"
                          onClick={() => setShowIOSInstructions(false)}
                          className="absolute right-3 top-2 text-base text-[#8FA66A] dark:text-[#A7C080]"
                          aria-label="Close install instructions"
                        >
                          x
                        </button>
                        <p className="pr-5">To install Root Record:</p>
                        <ol className="mt-2 list-decimal space-y-1 pl-4">
                          <li>Tap the Share button at the bottom of Safari.</li>
                          <li>Scroll down and tap Add to Home Screen.</li>
                          <li>Tap Add in the top right.</li>
                        </ol>
                      </div>
                    )}

                    {installPrompt && (
                      <button
                        type="button"
                        onClick={handleInstall}
                        className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#A7C080] px-4 py-3 text-sm font-black text-white shadow-[0_10px_22px_rgba(167,192,128,0.24)] transition hover:bg-[#96AD73] active:scale-95 dark:shadow-none"
                      >
                        <Download size={16} />
                        Install App
                      </button>
                    )}

                    {isIOS && !installPrompt && (
                      <button
                        type="button"
                        onClick={() => setShowIOSInstructions((current) => !current)}
                        className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-[#A7C080] px-4 py-3 text-sm font-black text-white shadow-[0_10px_22px_rgba(167,192,128,0.24)] transition hover:bg-[#96AD73] active:scale-95 dark:shadow-none"
                      >
                        <Download size={16} />
                        Install App
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={exportData}
                    title="Backup"
                    className="flex min-h-11 items-center justify-center gap-2 rounded-[20px] bg-white/75 px-3 py-3 text-xs font-black text-[#A8BDB4] transition hover:bg-white hover:text-[#8FA66A] dark:bg-[#232B26]/80 dark:text-[#6D857A] dark:hover:bg-[#2A332E] dark:hover:text-[#A7C080]"
                  >
                    <Download size={16} />
                    Backup
                  </button>
                  <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[20px] bg-white/75 px-3 py-3 text-xs font-black text-[#A8BDB4] transition hover:bg-white hover:text-[#8FA66A] dark:bg-[#232B26]/80 dark:text-[#6D857A] dark:hover:bg-[#2A332E] dark:hover:text-[#A7C080]">
                    <Upload size={16} />
                    Restore
                    <input type="file" className="hidden" accept=".json" onChange={importData} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col min-w-0">
<header className="h-24 px-4 sm:px-6 lg:px-12 flex items-center justify-between sticky top-0 z-40">
  {/* Left side: menu (mobile) */}
  <div className="flex items-center gap-3 min-w-0">
    <button
      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      className="lg:hidden p-3 bg-white dark:bg-[#232B26] shadow-sm rounded-2xl dark:text-white transition-colors shrink-0"
      aria-label="Toggle sidebar"
    >
      <Menu size={20} />
    </button>

    {/* Optional: you can put a tiny title/breadcrumb here later */}
  </div>

  {/* Right side: actions (NO WRAP) */}
  <div className="flex items-center gap-2 sm:gap-4 flex-nowrap shrink-0">
    {/* Search icon + popover */}
    <div ref={searchBoxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setIsSearchPanelOpen((v) => !v);
          setIsSearchOpen(true);
          setTimeout(() => {
            const el = document.getElementById('header-search-input');
            el?.focus();
          }, 0);
        }}
        className="p-3 sm:p-4 bg-white dark:bg-[#232B26] text-[#8FA66A] dark:text-[#A7C080] rounded-[24px] shadow-sm hover:rotate-6 transition-all active:scale-90 border-2 border-transparent dark:border-[#2A332E]"
        aria-label="Open search"
        aria-expanded={isSearchPanelOpen}
      >
        <Search size={22} />
      </button>

      {isSearchPanelOpen && (
        <div
          className="
            fixed left-4 right-4 top-24 z-[80]
            lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-3
            lg:w-[520px]
            bg-white dark:bg-[#232B26]
            border-2 border-[#F2E8D5] dark:border-[#2A332E]
            rounded-[28px]
            shadow-2xl
            overflow-hidden
          "
        >
          <div className="p-4">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D9E3D8] dark:text-[#415147]"
                size={20}
              />
              <input
                id="header-search-input"
                type="text"
                placeholder="Find a friend by name..."
                className="w-full pl-12 pr-12 py-4 bg-[#FFF9F2] dark:bg-[#1A211D] border-2 border-transparent focus:border-[#A7C080]/30 dark:focus:border-[#A7C080]/20 rounded-[22px] outline-none text-base dark:text-white placeholder-[#D9E3D8] dark:placeholder-[#415147]"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                  setIsSearchPanelOpen(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-[18px] hover:bg-white/60 dark:hover:bg-[#1A211D] transition"
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {isSearchOpen && searchQuery.trim() && (
            <div className="border-t border-[#F2E8D5] dark:border-[#2A332E]">
              {searchResults.length ? (
                <>
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-6 py-4 hover:bg-[#EAF2ED] dark:hover:bg-[#A7C080]/10 transition-colors"
                      onClick={() => {
                        setSelectedPlantId(p.id);
                        setView('detail');
                        setSearchQuery('');
                        setIsSearchOpen(false);
                        setIsSearchPanelOpen(false);
                      }}
                    >
                      <div className="font-black text-sm text-[#5C4D42] dark:text-white truncate">
                        {p.name || 'Unnamed plant'}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-[#A8BDB4] dark:text-[#5B6D65] truncate mt-1">
                        {p.species || "Nature's Gem"}
                      </div>
                    </button>
                  ))}
                  <div className="px-6 py-3 text-[10px] font-black uppercase tracking-[0.25em] text-[#D9E3D8] dark:text-[#415147] border-t border-[#F2E8D5] dark:border-[#2A332E]">
                    Tip: press Enter if there's only one match
                  </div>
                </>
              ) : (
                <div className="px-6 py-5 text-sm font-bold text-[#A8BDB4] dark:text-[#5B6D65]">
                  No matches
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Theme toggle */}
    <button
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="p-3 sm:p-4 bg-white dark:bg-[#232B26] text-[#E8C06F] rounded-[24px] shadow-sm hover:rotate-12 transition-all active:scale-90 border-2 border-transparent dark:border-[#2A332E] shrink-0"
      aria-label="Toggle theme"
    >
      {isDarkMode ? <Sun size={22} fill="currentColor" /> : <Moon size={22} fill="currentColor" />}
    </button>

    {/* Add plant: icon-only on xs so it won't push Search to a new line */}
    <button
      onClick={() => setIsModalOpen(true)}
      className="bg-[#A7C080] hover:bg-[#96AD73] text-white px-4 sm:px-6 py-3 sm:py-4 rounded-[30px] font-black text-sm flex items-center gap-2 shadow-[0_10px_25px_rgba(167,192,128,0.4)] dark:shadow-none transition-all active:scale-95 shrink-0"
    >
      <Plus size={20} strokeWidth={3} />
      <span className="hidden sm:inline">ADD PLANT</span>
    </button>
  </div>
</header>



          <div className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
            {view === 'dashboard' && <DashboardView plants={filteredPlants} onPlantClick={(id) => { setSelectedPlantId(id); setView('detail'); }} onWater={markWatered} />}
            {view === 'list' && <ListView plants={filteredPlants} filter={filter} setFilter={setFilter} onPlantClick={(id) => { setSelectedPlantId(id); setView('detail'); }} onWater={markWatered} />}
            {view === 'detail' && selectedPlant && <DetailView plant={selectedPlant} onBack={() => setView('dashboard')} onWater={markWatered} onDelete={deletePlant} onEdit={() => setIsEditModalOpen(true)} />}
          </div>
        </main>

        {isModalOpen && <AddPlantModal onClose={() => setIsModalOpen(false)} onSubmit={addPlant} />}

        {isEditModalOpen && selectedPlant && (
          <EditPlantModal
            plant={selectedPlant}
            onClose={() => setIsEditModalOpen(false)}
            onSubmit={(updates) => updatePlant(selectedPlant.id, updates)}
          />
        )}

        {photoOptimizationMessage && (
          <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-white/95 px-5 py-3 text-sm font-bold text-[#8FA66A] shadow-2xl dark:bg-[#232B26]/95 dark:text-[#A7C080]">
            {photoOptimizationMessage}
          </div>
        )}

      </div>
    </div>
  );
}

// --- Cute UI Components ---

function NavItem({ active, onClick, icon, label, disabled }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-5 px-6 py-5 rounded-[32px] transition-all relative overflow-hidden group ${
        active 
          ? 'bg-[#A7C080] text-white shadow-[0_10px_20px_rgba(167,192,128,0.25)]' 
          : disabled ? 'opacity-30 cursor-not-allowed text-[#D9E3D8] dark:text-[#2A332E]' : 'text-[#A8BDB4] dark:text-[#5B6D65] hover:bg-white dark:hover:bg-[#232B26] hover:text-[#8FA66A] dark:hover:text-[#A7C080]'
      }`}
    >
      <div className={`transition-transform group-hover:scale-110 duration-300`}>{icon}</div>
      <span className="font-bold tracking-tight text-[15px]">{label}</span>
      {active && <div className="absolute right-4 w-2 h-2 bg-white rounded-full animate-pulse" />}
    </button>
  );
}

function DashboardView({ plants, onPlantClick, onWater }) {
  const overdue = plants.filter(p => getStatus(calculateNextDue(p.lastWatered, p.frequency)) === 'overdue');
  const today = plants.filter(p => getStatus(calculateNextDue(p.lastWatered, p.frequency)) === 'today');

  return (
    <div className="space-y-16 max-w-7xl mx-auto">
      {/* Sticker Style Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StickerCard label="My Garden" value={plants.length} icon={<Sprout />} type="plants" />
        <StickerCard label="Thirsty" value={overdue.length} icon={<CloudRain />} type="water" highlight={overdue.length > 0} />
        <StickerCard label="Due Today" value={today.length} icon={<CheckCircle2 />} type="today" />
      </div>

      <section>
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 bg-[#F2C6C2] dark:bg-[#4D3533] rounded-full flex items-center justify-center text-white dark:text-[#F2C6C2] shadow-lg">
            <Heart size={24} fill="currentColor" />
          </div>
          <h2 className="text-3xl font-serif font-black text-[#5C4D42] dark:text-white">Needs some love</h2>
        </div>
        
        {overdue.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {overdue.map(p => <PlantCard key={p.id} plant={p} onWater={onWater} onClick={() => onPlantClick(p.id)} />)}
          </div>
        ) : (
          <div className="bg-white/40 dark:bg-[#232B26]/40 border-4 border-dashed border-[#F2E8D5] dark:border-[#2A332E] rounded-[50px] p-24 text-center">
            <Sparkles size={64} className="mx-auto mb-6 text-[#A7C080] opacity-30 animate-spin-slow" />
            <p className="text-xl font-serif italic text-[#A8BDB4] dark:text-[#415147]">Everyone is perfectly happy right now!</p>
          </div>
        )}
      </section>

      {today.length > 0 && (
        <section>
          <h2 className="text-3xl font-serif font-black mb-10 text-[#5C4D42] dark:text-white ml-2">Today's Schedule</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {today.map(p => <PlantCard key={p.id} plant={p} onWater={onWater} onClick={() => onPlantClick(p.id)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function ListView({ plants, filter, setFilter, onPlantClick, onWater }) {
  const PAGE_SIZE = 16;

  const [page, setPage] = React.useState(1);

  const showPagination = plants.length > PAGE_SIZE;
  const totalPages = showPagination ? Math.ceil(plants.length / PAGE_SIZE) : 1;

  // Reset to page 1 when the visible list changes (search/filter/add/delete)
  React.useEffect(() => {
    setPage(1);
  }, [plants.length, filter]);

  // Clamp page if it becomes out of range
  React.useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedPlants = React.useMemo(() => {
    if (!showPagination) return plants;
    const start = (page - 1) * PAGE_SIZE;
    return plants.slice(start, start + PAGE_SIZE);
  }, [plants, page, showPagination]);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const pageItems = React.useMemo(() => {
    if (!showPagination) return [1];

    // Basic pagination: show first, last, and a window around current page.
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
    const nums = Array.from(items)
      .filter((n) => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);

    const out = [];
    for (let i = 0; i < nums.length; i++) {
      const n = nums[i];
      out.push(n);
      const next = nums[i + 1];
      if (next && next > n + 1) out.push("...");
    }
    return out;
  }, [page, totalPages, showPagination]);

  const renderPagination = (className = "") => {
    if (!showPagination) return null;

    return (
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}>
        <div className="text-[11px] font-black uppercase tracking-widest text-[#A8BDB4] dark:text-[#5B6D65]">
          Showing{" "}
          <span className="text-[#5C4D42] dark:text-white">
            {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, plants.length)}
          </span>{" "}
          of <span className="text-[#5C4D42] dark:text-white">{plants.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={page === 1}
            className="px-5 py-3 rounded-[22px] font-black border-2 border-black dark:border-[#2A332E] bg-white dark:bg-[#232B26] text-[#5C4D42] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:translate-y-[-1px] active:translate-y-[0px] transition"
          >
            Prev
          </button>

          <div className="flex items-center gap-1 bg-white/60 dark:bg-[#1A211D]/80 backdrop-blur rounded-full p-2 shadow-sm border border-[#F2E8D5] dark:border-[#2A332E]">
            {pageItems.map((it, idx) => {
              if (it === "...") {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="px-3 py-2 text-xs font-black text-[#A8BDB4] dark:text-[#5B6D65]"
                  >
                    ...
                  </span>
                );
              }

              const n = it;
              const active = n === page;

              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`min-w-[44px] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                    active
                      ? "bg-[#A7C080] text-white shadow-md scale-105"
                      : "text-[#A8BDB4] dark:text-[#5B6D65] hover:text-[#8FA66A] dark:hover:text-[#A7C080]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={page === totalPages}
            className="px-5 py-3 rounded-[22px] font-black border-2 border-black dark:border-[#2A332E] bg-white dark:bg-[#232B26] text-[#5C4D42] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:translate-y-[-1px] active:translate-y-[0px] transition"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8">
        <h2 className="text-4xl font-serif font-black text-[#5C4D42] dark:text-white">
          The Full Nursery
        </h2>

        <div className="flex bg-white/60 dark:bg-[#1A211D]/80 backdrop-blur rounded-full p-2 shadow-sm border border-[#F2E8D5] dark:border-[#2A332E]">
          {["all", "overdue", "today", "upcoming"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                filter === f
                  ? "bg-[#A7C080] text-white shadow-md scale-105"
                  : "text-[#A8BDB4] dark:text-[#5B6D65] hover:text-[#8FA66A] dark:hover:text-[#A7C080]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Top pagination (only when needed) */}
      {showPagination && renderPagination("mb-8")}

      {plants.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
            {pagedPlants.map((p) => (
              <PlantCard
                key={p.id}
                plant={p}
                onWater={onWater}
                onClick={() => onPlantClick(p.id)}
              />
            ))}
          </div>

          {/* Bottom pagination (only when needed) */}
          {showPagination && renderPagination("mt-10")}
        </>
      ) : (
        <div className="text-center py-32 bg-white dark:bg-[#232B26] rounded-[60px] border-4 border-dashed border-[#F2E8D5] dark:border-[#2A332E]">
          <Wind
            size={64}
            className="mx-auto text-[#D9E3D8] dark:text-[#151A17] mb-8 animate-pulse"
          />
          <h3 className="text-2xl font-serif italic text-[#A8BDB4] dark:text-[#415147]">
            So much space for new plant friends...
          </h3>
        </div>
      )}
    </div>
  );
}



function DetailView({ plant, onBack, onWater, onDelete, onEdit }) {
  const nextDue = calculateNextDue(plant.lastWatered, plant.frequency);
  const status = getStatus(nextDue);

  return (
    <div className="max-w-5xl mx-auto animate-in zoom-in-95 duration-500">
      <button onClick={onBack} className="flex items-center gap-3 text-[#A8BDB4] dark:text-[#5B6D65] hover:text-[#A7C080] mb-10 font-bold transition-all group uppercase tracking-widest text-xs">
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> BACK TO JOURNAL
      </button>

      <div className="bg-white dark:bg-[#232B26] rounded-[60px] overflow-hidden shadow-[0_30px_60px_-15px_rgba(167,192,128,0.15)] dark:shadow-none border border-[#F2E8D5] dark:border-[#2A332E]">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="h-[500px] md:h-auto bg-[#FFF9F2] dark:bg-[#1A211D] flex items-center justify-center p-8">
            <div className="w-full h-full rounded-[40px] overflow-hidden shadow-2xl relative">
              {plant.photo ? (
                <img src={plant.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#D9E3D8] dark:text-[#232B26] gap-4">
                  <Camera size={80} strokeWidth={1} />
                  <p className="font-serif italic">No portrait yet</p>
                </div>
              )}
            </div>
          </div>
          
<div className="p-6 sm:p-10 lg:p-16 space-y-8 sm:space-y-12">

  {/* HEADER */}
<div className="flex items-center gap-4">
  {/* LEFT: species */}
  <div className="flex items-center gap-3 text-[#8FA66A] dark:text-[#A7C080] bg-[#EAF2ED] dark:bg-[#A7C080]/10 px-6 py-3 rounded-full border border-transparent dark:border-[#A7C080]/20">
    <Stars size={16} />
    <span className="text-sm font-black tracking-widest uppercase">
      {plant.species || "Nature's Gem"}
    </span>
  </div>

  {/* RIGHT: actions */}
  <div className="flex items-center gap-2 ml-auto shrink-0">
    <button
      onClick={onEdit}
      className="p-4 text-[#A7C080] hover:text-[#8FA66A] hover:bg-[#EAF2ED] dark:hover:bg-[#A7C080]/10 rounded-[24px] transition-all"
      title="Edit"
    >
      <span className="sr-only">Edit</span>
      <PencilLine size={24} />
    </button>

    <button
      onClick={() => onDelete(plant.id)}
      className="p-4 text-[#F2C6C2] dark:text-[#B17F7A] hover:text-[#D98E82] hover:bg-[#FFF4F2] dark:hover:bg-[#B17F7A]/10 rounded-[24px] transition-all"
      title="Delete"
    >
      <Trash2 size={24} />
    </button>
  </div>
</div>


{/* TITLE */}
<div className="space-y-4">
<h1 className="text-2xl sm:text-3xl lg:text-5xl font-serif font-black text-[#5C4D42] dark:text-white leading-snug break-words [overflow-wrap:anywhere]">
  {plant.name}
</h1>




  </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="bg-[#FEF9E7] dark:bg-[#2F332A] p-8 rounded-[40px] border-2 border-white dark:border-transparent shadow-sm transition-colors">
                <p className="text-[10px] font-black text-[#D9C582] dark:text-[#E8C06F] uppercase tracking-[0.25em] mb-2 text-center">Interval</p>
                <p className="text-lg sm:text-xl font-black text-[#5C4D42] dark:text-[#E8DCCB] text-center">
{plant.frequency} Days</p>
              </div>
              <div className={`p-8 rounded-[40px] border-2 border-white dark:border-transparent shadow-sm transition-colors ${status === 'overdue' ? 'bg-[#FFF4F2] dark:bg-[#3D2B29]' : 'bg-[#EAF2ED] dark:bg-[#2A332E]'}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.25em] mb-2 text-center ${status === 'overdue' ? 'text-[#D98E82]' : 'text-[#8FA66A]'}`}>Feeling</p>
                <p className={`text-lg sm:text-xl font-black text-center capitalize ${status === 'overdue' ? 'text-[#D98E82]' : 'text-[#8FA66A]'}`}>
                  {status === 'overdue' ? 'Thirsty' : 'Happy'}
                </p>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t-4 border-dotted border-[#F2E8D5] dark:border-[#2A332E]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-[#5B6D65] font-bold uppercase tracking-widest text-[10px]">Last Hydration</span>
                <span className="font-bold text-sm sm:text-base text-[#5C4D42] dark:text-[#CBD5D0]">
{(plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString() : '-')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-[#5B6D65] font-bold uppercase tracking-widest text-[10px]">Next Best Time</span>
                <span className="font-black text-[#A7C080]">{nextDue?.toLocaleDateString()}</span>
              </div>
            </div>

<button
  onClick={() => onWater(plant.id)}
  className="
    w-full
    py-4 sm:py-6
    bg-gradient-to-r from-[#8DA399] to-[#A7C080]
    text-white
    rounded-[36px]
    font-black
    shadow-[0_12px_32px_rgba(167,192,128,0.35)]
    dark:shadow-none
    flex items-center justify-center gap-3
    transition-all
    active:scale-95
    text-sm sm:text-base lg:text-lg
  "
>
  <Droplets className="w-5 h-5 sm:w-6 sm:h-6" />
  <span className="tracking-wide">MARK AS REFRESHED</span>
</button>

          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sticker/Card Sub-components ---

function StickerCard({ label, value, icon, type, highlight }) {
  const themes = {
    plants: 'bg-[#EAF2ED] dark:bg-[#2A332E] text-[#8FA66A] dark:text-[#A7C080]',
    water: highlight ? 'bg-[#FFF4F2] dark:bg-[#3D2B29] text-[#D98E82] dark:text-[#F2C6C2]' : 'bg-[#FFF4F2] dark:bg-[#2A332E] text-[#D98E82] dark:text-[#5B6D65]',
    today: 'bg-[#FEF9E7] dark:bg-[#3D3829] text-[#D9C582] dark:text-[#E8C06F]'
  };

  return (
    <div className={`${themes[type]} p-10 rounded-[48px] border-4 border-white dark:border-[#2A332E]/30 shadow-[0_10px_0_rgba(0,0,0,0.03)] flex items-center justify-between transform transition-transform hover:-rotate-2`}>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.25em] mb-1 opacity-60">{label}</p>
        <p className="text-5xl font-serif font-black">{value}</p>
      </div>
      <div className={`w-16 h-16 bg-white/80 dark:bg-black/20 rounded-full flex items-center justify-center shadow-lg ${highlight ? 'animate-bounce' : ''}`}>
        {React.cloneElement(icon, { size: 28, strokeWidth: 3 })}
      </div>
    </div>
  );
}

function PlantCard({ plant, onWater, onClick }) {
  const nextDue = calculateNextDue(plant.lastWatered, plant.frequency);
  const status = getStatus(nextDue);

  return (
    <div className="bg-white dark:bg-[#232B26] rounded-[50px] border-2 border-[#F2E8D5] dark:border-[#2A332E] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_25px_60px_-15px_rgba(167,192,128,0.2)] dark:hover:shadow-none hover:-translate-y-3 transition-all group flex flex-col relative">
      <div className="h-64 bg-[#FFF9F2] dark:bg-[#1A211D] relative cursor-pointer m-3 mb-0 rounded-[40px] overflow-hidden" onClick={onClick}>
        {plant.photo ? (
          <img src={plant.photo} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#D9E3D8] dark:text-[#232B26]">
            <Sprout size={48} />
          </div>
        )}
        <div className={`absolute top-5 left-5 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] shadow-xl backdrop-blur-md ${
          status === 'overdue' ? 'bg-[#F2C6C2] text-white animate-pulse' : 'bg-white/90 dark:bg-[#2A332E]/90 text-[#A7C080]'
        }`}>
          {status === 'overdue' ? 'Thirsty!' : status === 'today' ? 'Due Today' : 'Comfy'}
        </div>
      </div>
      <div className="p-8 flex-1 flex flex-col">
        <div className="flex-1 mb-6 cursor-pointer" onClick={onClick}>
          <h3 className="text-2xl font-serif font-black text-[#5C4D42] dark:text-white truncate mb-1">{plant.name}</h3>
          <p className="text-xs text-[#A8BDB4] dark:text-[#5B6D65] font-bold uppercase tracking-widest truncate">{plant.species || 'Wild Bud'}</p>
        </div>
        <div className="flex items-center justify-between pt-6 border-t-2 border-dashed border-[#F2E8D5] dark:border-[#2A332E]">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-[#D9E3D8] dark:text-[#415147] uppercase tracking-widest">Next Sip</p>
            <p className="text-xs font-black text-[#A7C080]">{nextDue?.toLocaleDateString()}</p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onWater(plant.id); }}
            className={`p-5 rounded-[24px] transition-all active:scale-90 shadow-lg ${
              status === 'overdue' ? 'bg-[#FDF2F2] dark:bg-[#4D3533] text-[#F2C6C2]' : 'bg-[#EAF2ED] dark:bg-[#2F3932] text-[#A7C080]'
            }`}
          >
            <Droplets size={24} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}


function AddPlantModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [frequency, setFrequency] = useState(7);
  const [lastWatered, setLastWatered] = useState(new Date().toISOString().split('T')[0]);
  const [photo, setPhoto] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef(null);

  const filteredSuggestions = useMemo(() => {
    if (!species || species.length < 2) return [];
    return POPULAR_PLANTS.filter(p => p.toLowerCase().includes(species.toLowerCase())).slice(0, 5);
  }, [species]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setPhoto(await compressImage(file));
    } catch (error) {
      console.error('Failed to compress plant photo', error);
      window.alert('That photo could not be optimized. Choose another image and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#151A17]/70 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="bg-white dark:bg-[#232B26] w-full max-w-2xl rounded-[60px] shadow-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 max-h-[95vh] border-8 border-white dark:border-[#232B26]">
        <div className="p-10 pb-0 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#A7C080] rounded-full flex items-center justify-center text-white"><Stars size={20} /></div>
            <h2 className="text-4xl font-serif font-black text-[#5C4D42] dark:text-white">New Friend</h2>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-[#FFF9F2] dark:hover:bg-[#1A211D] rounded-full transition-colors dark:text-white"><X size={28}/></button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, species, frequency, lastWatered: new Date(lastWatered).toISOString(), photo }); }} className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col md:flex-row gap-10">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full md:w-60 h-60 bg-[#FFF9F2] dark:bg-[#1A211D] border-4 border-dashed border-[#F2E8D5] dark:border-[#2A332E] rounded-[48px] flex items-center justify-center cursor-pointer hover:border-[#A7C080] transition-all shrink-0 overflow-hidden relative shadow-inner"
            >
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-[#D9E3D8] dark:text-[#2A332E] space-y-2">
                  <Camera size={44} strokeWidth={1.5} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Take a Photo</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handlePhoto} className="hidden" accept="image/*" />
            </div>

            <div className="flex-1 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Nickname</label>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Blossom" className="w-full p-6 bg-[#FFF9F2] dark:bg-[#1A211D] dark:text-white rounded-[30px] border-none outline-none ring-4 ring-transparent focus:ring-[#A7C080]/10 transition-all font-bold placeholder-[#D9E3D8] dark:placeholder-[#2A332E]" />
              </div>

              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Variety</label>
                <input value={species} onChange={e => { setSpecies(e.target.value); setShowSuggestions(true); }} placeholder="e.g. Pothos" className="w-full p-6 bg-[#FFF9F2] dark:bg-[#1A211D] dark:text-white rounded-[30px] border-none outline-none ring-4 ring-transparent focus:ring-[#A7C080]/10 transition-all font-bold placeholder-[#D9E3D8] dark:placeholder-[#2A332E]" />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-4 bg-white dark:bg-[#2A332E] border-2 border-[#F2E8D5] dark:border-[#1A211D] rounded-[30px] shadow-2xl z-20 overflow-hidden">
                    {filteredSuggestions.map(s => (
                      <button key={s} type="button" onClick={() => { setSpecies(s); setShowSuggestions(false); }} className="w-full px-6 py-5 text-left hover:bg-[#EAF2ED] dark:hover:bg-[#A7C080]/10 text-sm font-bold dark:text-slate-200 transition-colors">{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Sip Frequency (Days)</label>
              <input type="number" value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full p-6 bg-[#FFF9F2] dark:bg-[#1A211D] dark:text-white rounded-[30px] border-none outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Birth/Join Date</label>
              <input type="date" value={lastWatered} onChange={e => setLastWatered(e.target.value)} className="w-full p-6 bg-[#FFF9F2] dark:bg-[#1A211D] dark:text-white rounded-[30px] border-none outline-none [color-scheme:light] dark:[color-scheme:dark]" />
            </div>
          </div>

          <button type="submit" className="w-full py-8 bg-[#A7C080] text-white rounded-[40px] font-black text-2xl shadow-[0_20px_40px_rgba(167,192,128,0.3)] dark:shadow-none hover:bg-[#96AD73] transition-all active:scale-95 mt-6 border-b-8 border-[#8FA66A] dark:border-transparent">
            WELCOME TO THE FAMILY
          </button>
        </form>
      </div>
    </div>
  );
}

function EditPlantModal({ plant, onClose, onSubmit }) {
  const [name, setName] = useState(plant?.name || '');
  const [species, setSpecies] = useState(plant?.species || '');
  const [frequency, setFrequency] = useState(plant?.frequency ?? 7);
  const [lastWatered, setLastWatered] = useState(() => {
    const iso = plant?.lastWatered ? new Date(plant.lastWatered).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    return iso;
  });
  const [photo, setPhoto] = useState(plant?.photo || null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef(null);

  const filteredSuggestions = useMemo(() => {
    if (!species || species.length < 2) return [];
    return POPULAR_PLANTS.filter(p => p.toLowerCase().includes(species.toLowerCase())).slice(0, 5);
  }, [species]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setPhoto(await compressImage(file));
    } catch (error) {
      console.error('Failed to compress plant photo', error);
      window.alert('That photo could not be optimized. Choose another image and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-[#151A17]/70 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="bg-white dark:bg-[#232B26] w-full max-w-2xl rounded-[60px] shadow-3xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 max-h-[95vh] border-8 border-white dark:border-[#232B26]">
        <div className="p-10 pb-0 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#A7C080] rounded-full flex items-center justify-center text-white"><Sparkles size={20} /></div>
            <h2 className="text-4xl font-serif font-black text-[#5C4D42] dark:text-white">Edit Plant</h2>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-[#FFF9F2] dark:hover:bg-[#1A211D] rounded-full transition-colors dark:text-white"><X size={28}/></button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name,
              species,
              frequency,
              lastWatered: new Date(lastWatered).toISOString(),
              photo
            });
            onClose();
          }}
          className="p-10 space-y-10 overflow-y-auto custom-scrollbar"
        >
          <div className="flex flex-col md:flex-row gap-10">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full md:w-60 h-60 bg-[#FFF9F2] dark:bg-[#1A211D] border-4 border-dashed border-[#F2E8D5] dark:border-[#2A332E] rounded-[48px] flex items-center justify-center cursor-pointer hover:border-[#A7C080] transition-all shrink-0 overflow-hidden relative shadow-inner"
            >
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-[#D9E3D8] dark:text-[#2A332E] space-y-2">
                  <Camera size={44} strokeWidth={1.5} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Add / Change Photo</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handlePhoto} className="hidden" accept="image/*" />
            </div>

            <div className="flex-1 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Nickname</label>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Blossom" className="w-full p-6 bg-[#FFF9F2] dark:bg-[#1A211D] dark:text-white rounded-[30px] border-none outline-none ring-4 ring-transparent focus:ring-[#A7C080]/10 transition-all font-bold placeholder-[#D9E3D8] dark:placeholder-[#2A332E]" />
              </div>

              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Variety</label>
                <input value={species} onChange={e => { setSpecies(e.target.value); setShowSuggestions(true); }} placeholder="e.g. Pothos" className="w-full p-6 bg-[#FFF9F2] dark:bg-[#1A211D] dark:text-white rounded-[30px] border-none outline-none ring-4 ring-transparent focus:ring-[#A7C080]/10 transition-all font-bold placeholder-[#D9E3D8] dark:placeholder-[#2A332E]" />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-4 bg-white dark:bg-[#2A332E] border-2 border-[#F2E8D5] dark:border-[#1A211D] rounded-[30px] shadow-2xl z-20 overflow-hidden">
                    {filteredSuggestions.map(s => (
                      <button key={s} type="button" onClick={() => { setSpecies(s); setShowSuggestions(false); }} className="w-full px-6 py-5 text-left hover:bg-[#EAF2ED] dark:hover:bg-[#A7C080]/10 text-sm font-bold dark:text-slate-200 transition-colors">{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Sip Frequency (Days)</label>
              <input type="number" value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full p-6 bg-[#FFF9F2] dark:bg-[#1A211D] dark:text-white rounded-[30px] border-none outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Last Watered</label>
              <input type="date" value={lastWatered} onChange={e => setLastWatered(e.target.value)} className="w-full p-6 bg-[#FFF9F2] dark:bg-[#1A211D] dark:text-white rounded-[30px] border-none outline-none [color-scheme:light] dark:[color-scheme:dark]" />
            </div>
          </div>

          <button type="submit" className="w-full py-8 bg-[#A7C080] text-white rounded-[40px] font-black text-2xl shadow-[0_20px_40px_rgba(167,192,128,0.3)] dark:shadow-none hover:bg-[#96AD73] transition-all active:scale-95 mt-6 border-b-8 border-[#8FA66A] dark:border-transparent">
            SAVE CHANGES
          </button>
        </form>
      </div>
    </div>
  );
}

