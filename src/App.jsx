import { useState, useEffect, useMemo, useRef } from 'react';
import {
  deletePlantFromDB,
  deleteLocalPlantsFromDB,
  getAllPlants,
  getAllPlantsFromIndexedDB,
  getCachedPlantsFromIndexedDB,
  replaceIndexedDBCache,
  replacePlantsInDB,
  savePlantToDB,
} from './plantStorage';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Auth from './Auth';
import { auth } from './firebase';
import {
  AddPlantModal,
  DashboardView,
  DetailView,
  EditPlantModal,
  ListView,
  NavItem,
} from './components/PlantViews';
import {
  calculateNextDue,
  compressOversizedPlantPhotos,
  createPlantId,
  getStatus,
  normalizeImportedPlant,
} from './plantUtils';
import {
  Plus,
  LayoutGrid,
  X,
  Download,
  Sprout,
  Stars,
  Home,
  Upload,
  Menu,
  Search,
  Sun,
  Moon
} from 'lucide-react';

// --- Constants ---
const BASE_URL = import.meta.env.BASE_URL;

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
  const [loadError, setLoadError] = useState('');
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
      setLoadError('');
      let indexedDbPlants = [];

      try {
        indexedDbPlants = await getAllPlantsFromIndexedDB();
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

          await deleteLocalPlantsFromDB(migratedLocalPlants.map((plant) => plant.id));

          const migrationErrors = migrationResults
            .filter((result) => result.status === 'rejected')
            .map((result) => result.reason);

          if (migrationErrors.length > 0) {
            console.error('Failed to migrate some local plants', migrationErrors);
            window.alert('Some local plants could not be synced to Firestore. Check your Firebase Firestore rules and any large plant photos, then try again.');
          }
        }

        if (isActive) {
          const loadedPlants = [...optimizedFirestorePlants, ...migratedLocalPlants];
          await replaceIndexedDBCache(loadedPlants);
          setPlants(loadedPlants);
        }
      } catch (e) {
        console.error('Failed to load plants', e);
        const cachedPlants = await getCachedPlantsFromIndexedDB().catch((cacheError) => {
          console.error('Failed to load cached plants', cacheError);
          return indexedDbPlants;
        });
        const fallbackPlants = cachedPlants.length > 0 ? cachedPlants : indexedDbPlants;

        if (isActive) {
          setPlants(fallbackPlants);
          setLoadError(
            fallbackPlants.length > 0
              ? 'Could not reach Firebase, so Root Record is showing the latest saved local copy.'
              : 'Could not reach Firebase, and there is no saved local copy on this device yet.'
          );
        }
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
    try {
      const plant = { ...newPlant, id: createPlantId(), createdAt: new Date().toISOString() };
      await savePlantToDB(plant);
      setPlants((current) => [...current, plant]);
    } catch (error) {
      console.error('Failed to add plant', error);
      window.alert('Root Record could not save this plant. Check your connection and try again.');
      throw error;
    }
  };

  const updatePlant = async (id, updates) => {
    const existing = plants.find((p) => p.id === id);
    if (!existing) return;

    const newPlant = { ...existing, ...updates };

    try {
      await savePlantToDB(newPlant);
      setPlants((current) => current.map((p) => (p.id === id ? newPlant : p)));
    } catch (error) {
      console.error('Failed to update plant', error);
      window.alert('Root Record could not save these changes. Check your connection and try again.');
      throw error;
    }
  };

  const deletePlant = async (id) => {
    const plant = plants.find((p) => p.id === id);
    const plantName = plant?.name || 'this plant';
    const shouldDelete = window.confirm(`Delete ${plantName}? This cannot be undone.`);

    if (!shouldDelete) return;

    try {
      await deletePlantFromDB(id);
      setPlants((current) => current.filter((p) => p.id !== id));
      setSelectedPlantId(null);
      setView('dashboard');
    } catch (error) {
      console.error('Failed to delete plant', error);
      window.alert('Root Record could not delete this plant. Please try again.');
    }
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

        const shouldRestore = window.confirm(
          `Restore ${normalized.length} plants from this backup? This will replace every plant currently in Root Record.`
        );

        if (!shouldRestore) {
          return;
        }

        await replacePlantsInDB(normalized);
        setPlants(normalized);
        setSelectedPlantId(null);
        setView('dashboard');
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
        {loadError && (
          <div className="fixed left-1/2 top-4 z-[130] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-[24px] border border-[#F2C6C2]/70 bg-white/95 px-5 py-4 text-center text-sm font-bold text-[#D98E82] shadow-2xl dark:border-[#B17F7A]/40 dark:bg-[#232B26]/95 dark:text-[#F2C6C2]">
            {loadError}
          </div>
        )}

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
        <aside className={`fixed inset-y-0 left-0 z-50 w-[18rem] max-w-[86vw] bg-white/70 dark:bg-[#1A211D]/90 backdrop-blur-xl border-r border-[#F2E8D5] dark:border-[#2A332E] transition-all duration-500 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 shadow-2xl lg:shadow-none`}>
          <div className="flex h-full flex-col p-4 sm:p-6">
            <div className="flex items-center gap-3 px-1 py-5 sm:gap-4 sm:py-8 sm:px-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#A7C080] to-[#8FA66A] text-white shadow-[0_8px_20px_rgba(167,192,128,0.3)] sm:h-12 sm:w-12 sm:rounded-[22px]">
               <img src={`${BASE_URL}logo.png`} alt="Root Record" />
              </div>
              <div>
                <h1 className="text-xl font-serif font-black tracking-tight text-[#8FA66A] dark:text-[#B8D194] sm:text-2xl">Root Record</h1>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-50 dark:text-[#A7C080]">Garden Journal</p>
              </div>
              <button
                type="button"
                aria-label="Close sidebar"
                onClick={() => setIsSidebarOpen(false)}
                className="ml-auto rounded-2xl bg-white p-2.5 shadow-sm transition-colors dark:bg-[#232B26] dark:text-white lg:hidden"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 space-y-2 sm:space-y-3">
              <NavItem active={view === 'dashboard'} onClick={() => { setView('dashboard'); setSelectedPlantId(null); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} icon={<Home size={22}/>} label="Home Sweet Home" />
              <NavItem active={view === 'list'} onClick={() => { setView('list'); setSelectedPlantId(null); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} icon={<LayoutGrid size={22}/>} label="My Planties" />
             
            </nav>

            <div className="mt-auto space-y-4">
              <div className="relative overflow-hidden rounded-[24px] border-2 border-dashed border-[#F2C6C2]/30 bg-gradient-to-tr from-[#FDF2F0] to-[#FFF9F2] p-4 text-center dark:from-[#232B26] dark:to-[#1A211D] dark:border-[#A7C080]/10 sm:rounded-[32px] sm:p-6">
                <Stars className="absolute -top-2 -right-2 text-[#F2C6C2] dark:text-[#E8C06F] opacity-40 group-hover:rotate-12 transition-transform" size={40} />
                <p className="text-xs font-bold text-[#D98E82] dark:text-[#E8C06F] mb-1">Coziness Tip</p>
                <p className="text-sm italic opacity-70 dark:text-slate-400">Dust your leaves gently with a damp cloth today! *</p>
              </div>

              <div className="rounded-[24px] border border-white/70 bg-white/45 p-3 shadow-sm dark:border-[#2A332E] dark:bg-[#17201B]/80 sm:rounded-[30px]">
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
<header className="sticky top-0 z-40 flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:h-24 lg:px-12">
  {/* Left side: menu (mobile) */}
  <div className="flex items-center gap-3 min-w-0">
    <button
      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      className="shrink-0 rounded-2xl bg-white p-2.5 shadow-sm transition-colors dark:bg-[#232B26] dark:text-white lg:hidden sm:p-3"
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
        className="rounded-[18px] border-2 border-transparent bg-white p-2.5 text-[#8FA66A] shadow-sm transition-all active:scale-90 dark:bg-[#232B26] dark:text-[#A7C080] dark:border-[#2A332E] sm:rounded-[24px] sm:p-4 sm:hover:rotate-6"
        aria-label="Open search"
        aria-expanded={isSearchPanelOpen}
      >
        <Search size={22} />
      </button>

      {isSearchPanelOpen && (
        <div
          className="
            fixed left-3 right-3 top-16 z-[80]
            lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-3
            lg:w-[520px]
            bg-white dark:bg-[#232B26]
            border-2 border-[#F2E8D5] dark:border-[#2A332E]
            rounded-[22px] sm:rounded-[28px]
            shadow-2xl
            overflow-hidden
          "
        >
          <div className="p-3 sm:p-4">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D9E3D8] dark:text-[#415147]"
                size={20}
              />
              <input
                id="header-search-input"
                type="text"
                placeholder="Find a friend by name..."
                className="w-full rounded-[18px] border-2 border-transparent bg-[#FFF9F2] py-3 pl-12 pr-12 text-base outline-none placeholder-[#D9E3D8] focus:border-[#A7C080]/30 dark:bg-[#1A211D] dark:text-white dark:placeholder-[#415147] dark:focus:border-[#A7C080]/20 sm:rounded-[22px] sm:py-4"
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
      className="shrink-0 rounded-[18px] border-2 border-transparent bg-white p-2.5 text-[#E8C06F] shadow-sm transition-all active:scale-90 dark:bg-[#232B26] dark:border-[#2A332E] sm:rounded-[24px] sm:p-4 sm:hover:rotate-12"
      aria-label="Toggle theme"
    >
      {isDarkMode ? <Sun size={22} fill="currentColor" /> : <Moon size={22} fill="currentColor" />}
    </button>

    {/* Add plant: icon-only on xs so it won't push Search to a new line */}
    <button
      onClick={() => setIsModalOpen(true)}
      className="flex shrink-0 items-center gap-2 rounded-[20px] bg-[#A7C080] px-3 py-2.5 text-sm font-black text-white shadow-[0_10px_25px_rgba(167,192,128,0.4)] transition-all hover:bg-[#96AD73] active:scale-95 dark:shadow-none sm:rounded-[30px] sm:px-6 sm:py-4"
    >
      <Plus size={20} strokeWidth={3} />
      <span className="hidden sm:inline">ADD PLANT</span>
    </button>
  </div>
</header>



          <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 lg:p-12">
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



