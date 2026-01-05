import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Plus,
  Droplets,
  Calendar,
  Trash2,
  ArrowLeft,
  LayoutGrid,
  List as ListIcon,
  X,
  Sparkles,
  Download,
  Sprout,
  Flower2,
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


// --- IndexedDB Configuration ---
const DB_NAME = 'PlantTrackerDB_CuteCozy';
const DB_VERSION = 1;
const STORE_NAME = 'plants';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getAllPlants = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const savePlantToDB = async (plant) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(STORE_NAME).put(plant);
  });
};

const deletePlantFromDB = async (id) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
    transaction.objectStore(STORE_NAME).delete(id);
  });
};

// --- Constants ---
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

// --- Main App Component ---
export default function App() {
  const [plants, setPlants] = useState([]);
  const [view, setView] = useState('dashboard');
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBoxRef = useRef(null);

  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('plantTrackerTheme') === 'dark';
  });

  const [session, setSession] = useState(null);
  const user = session?.user ?? null;
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        console.error('Failed to get session', error);
        return;
      }
      setSession(data?.session ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadPlants = async () => {
      setIsLoading(true);
      try {
        const uid = user?.id;
        if (!uid) {
          const local = await getAllPlants();
          setPlants(local);
          return;
        }

        setIsSyncing(true);

        const local = await getAllPlants().catch(() => []);
        const { data: rows, error } = await supabase
          .from('plants')
          .select('id, data, created_at, updated_at')
          .eq('user_id', uid);

        if (error) throw error;

        const cloud = (rows ?? []).map((r) => ({ ...(r.data || {}), id: r.id }));

        // One-time-ish merge: if there are local plants not yet in cloud, push them up.
        const cloudIds = new Set(cloud.map((p) => p?.id).filter(Boolean));
        const missingLocal = (local ?? []).filter((p) => p?.id && !cloudIds.has(p.id));

        if (missingLocal.length) {
          const payload = missingLocal.map((p) => ({
            id: p.id,
            user_id: uid,
            data: p,
          }));

          const { error: upErr } = await supabase.from('plants').upsert(payload, { onConflict: 'id' });
          if (upErr) throw upErr;

          cloud.push(...missingLocal);
        }

        setPlants(cloud);
      } catch (e) {
        console.error('Failed to load plants (cloud)', e);

        // Fallback: show local data so the app still works even if cloud is down.
        try {
          const local = await getAllPlants();
          setPlants(local);
        } catch (e2) {
          console.error('Failed to load plants (local fallback)', e2);
        }
      } finally {
        setIsSyncing(false);
        setIsLoading(false);
      }
    };

    loadPlants();
  }, [user?.id]);

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
    const onMouseDown = (e) => {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(e.target)) {
        setIsSearchOpen(false);
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
      if (e.key === 'Escape') setIsSearchOpen(false);
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

  const upsertPlantToCloud = async (plant, uid) => {
    const { error } = await supabase.from('plants').upsert(
      {
        id: plant.id,
        user_id: uid,
        data: plant,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
  };

  const deletePlantFromCloud = async (id, uid) => {
    const { error } = await supabase.from('plants').delete().eq('id', id).eq('user_id', uid);
    if (error) throw error;
  };

  const addPlant = async (newPlant) => {
    const plant = { ...newPlant, id: Date.now().toString(), createdAt: new Date() };

    // Always keep local cache so the app works offline.
    await savePlantToDB(plant);

    // If signed in, sync to cloud too.
    if (user?.id) {
      try {
        await upsertPlantToCloud(plant, user.id);
      } catch (e) {
        console.error('Cloud sync failed (addPlant)', e);
      }
    }

    setPlants([...plants, plant]);
    setIsModalOpen(false);
  };

  const updatePlant = async (id, updates) => {
    const existing = plants.find((p) => p.id === id);
    if (!existing) return;

    const newPlant = { ...existing, ...updates };

    // Always update local cache so the app works offline.
    await savePlantToDB(newPlant);

    // If signed in, sync to cloud too.
    if (user?.id) {
      try {
        await upsertPlantToCloud(newPlant, user.id);
      } catch (e) {
        console.error('Cloud sync failed (updatePlant)', e);
      }
    }

    setPlants(plants.map((p) => (p.id === id ? newPlant : p)));
  };

  const deletePlant = async (id) => {
    // Always delete from local cache.
    await deletePlantFromDB(id);

    // If signed in, delete from cloud too.
    if (user?.id) {
      try {
        await deletePlantFromCloud(id, user.id);
      } catch (e) {
        console.error('Cloud sync failed (deletePlant)', e);
      }
    }

    setPlants(plants.filter((p) => p.id !== id));
    setSelectedPlantId(null);
    setView('dashboard');
  };

  
  const sendMagicLink = async () => {
    const email = authEmail.trim();
    if (!email) return;

    setIsAuthBusy(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setAuthMessage('Check your email for a sign-in link ✨');
    } catch (e) {
      console.error('Failed to send magic link', e);
      setAuthMessage('Could not send sign-in link. Double-check the email and try again.');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const signOut = async () => {
    setIsAuthBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setAuthMessage('');
      setAuthEmail('');
    } catch (e) {
      console.error('Failed to sign out', e);
    } finally {
      setIsAuthBusy(false);
    }
  };

const markWatered = (id) => {
    const now = new Date();
    updatePlant(id, { lastWatered: now.toISOString() });
  };

  const exportData = () => {
    const dataStr = JSON.stringify(plants);
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
        for (const plant of imported) await savePlantToDB(plant);
        setPlants(imported);
      } catch (err) { console.error("Import failed", err); }
    };
    reader.readAsText(file);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FFF9F2] dark:bg-[#151A17]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-bounce">
            <Sprout size={48} className="text-[#A7C080]" />
          </div>
          <p className="font-serif italic text-[#A7C080]">Waking up the seedlings...</p>
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
                <Flower2 size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-black tracking-tight text-[#8FA66A] dark:text-[#B8D194]">Bud & Bloom</h1>
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
              <NavItem active={false} icon={<Calendar size={22}/>} label="Care Tracker" disabled />
            </nav>

            <div className="mt-auto space-y-4">               <div className="bg-gradient-to-tr from-[#FDF2F0] to-[#FFF9F2] dark:from-[#232B26] dark:to-[#1A211D] rounded-[32px] p-6 text-center border-2 border-dashed border-[#F2C6C2]/30 dark:border-[#A7C080]/10 relative overflow-hidden group">
                <Stars className="absolute -top-2 -right-2 text-[#F2C6C2] dark:text-[#E8C06F] opacity-40 group-hover:rotate-12 transition-transform" size={40} />
                <p className="text-xs font-bold text-[#D98E82] dark:text-[#E8C06F] mb-1">Coziness Tip</p>
                <p className="text-sm italic opacity-70 dark:text-slate-400">Dust your leaves gently with a damp cloth today! ✨</p>
              </div>
			<div className="px-2">
  {user ? (
    <button
      type="button"
      onClick={signOut}
      disabled={isAuthBusy}
      className="w-full px-5 py-3 rounded-[22px] font-black border-2 border-black dark:border-[#2A332E] bg-white dark:bg-[#232B26] text-[#5C4D42] dark:text-white hover:translate-y-[-1px] active:translate-y-[0px] transition disabled:opacity-50"
      title={user.email || 'Signed in'}
    >
      Sign out
    </button>
  ) : (
    <button
      type="button"
      onClick={() => { setIsAuthModalOpen(true); setAuthMessage(''); }}
      className="w-full px-5 py-3 rounded-[22px] font-black border-2 border-black dark:border-[#2A332E] bg-white dark:bg-[#232B26] text-[#5C4D42] dark:text-white hover:translate-y-[-1px] active:translate-y-[0px] transition"
    >
      Sign in
    </button>
  )}
</div>



              <div className="flex justify-between px-2">
                <button onClick={exportData} title="Backup" className="p-3 text-[#A8BDB4] dark:text-[#5B6D65] hover:text-[#8FA66A] hover:bg-white dark:hover:bg-[#2A332E] rounded-full transition-all">
                  <Download size={18} />
                </button>
                <label className="p-3 text-[#A8BDB4] dark:text-[#5B6D65] hover:text-[#8FA66A] hover:bg-white dark:hover:bg-[#2A332E] rounded-full cursor-pointer transition-all">
                  <Upload size={18} />
                  <input type="file" className="hidden" accept=".json" onChange={importData} />
                </label>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-24 px-8 lg:px-12 flex items-center justify-between sticky top-0 z-40">
            <div className="flex items-center gap-6 flex-1">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-3 bg-white dark:bg-[#232B26] shadow-sm rounded-2xl dark:text-white transition-colors">
                <Menu size={20} />
              </button>
              <div ref={searchBoxRef} className="relative w-full max-w-xl group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#D9E3D8] dark:text-[#415147] group-focus-within:text-[#A7C080] transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Find a friend by name..." 
                  className="w-full pl-14 pr-8 py-4 bg-white dark:bg-[#1A211D] border-2 border-transparent focus:border-[#A7C080]/30 dark:focus:border-[#A7C080]/20 rounded-[40px] shadow-[0_4px_15px_rgba(0,0,0,0.02)] dark:shadow-none outline-none text-sm transition-all placeholder-[#D9E3D8] dark:placeholder-[#415147] dark:text-white"
                  value={searchQuery}
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                />

                {isSearchOpen && searchQuery.trim() && (
                  <div className="absolute left-0 right-0 mt-3 bg-white dark:bg-[#232B26] border-2 border-[#F2E8D5] dark:border-[#2A332E] rounded-[28px] overflow-hidden shadow-2xl z-50">
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
                          Tip: press Enter if there’s only one match
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
            </div>
            
            <div className="flex items-center gap-4 ml-2 sm:ml-4 lg:ml-8">
              <div className="flex items-center gap-3">
  {isSyncing && (
    <span className="hidden md:inline-flex items-center px-4 py-2 rounded-[18px] border-2 border-dashed border-[#E8D7B8] dark:border-[#2A332E] bg-[#F7F2E8] dark:bg-[#232B26] text-[11px] font-black uppercase tracking-widest text-[#8AA79B] dark:text-[#A8BDB4]">
      Syncing…
    </span>
  )}


              </div>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-4 bg-white dark:bg-[#232B26] text-[#E8C06F] rounded-[24px] shadow-sm hover:rotate-12 transition-all active:scale-90 border-2 border-transparent dark:border-[#2A332E]"
              >
                {isDarkMode ? <Sun size={24} fill="currentColor" /> : <Moon size={24} fill="currentColor" />}
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#A7C080] hover:bg-[#96AD73] text-white px-8 py-4 rounded-[30px] font-black text-sm flex items-center gap-3 shadow-[0_10px_25px_rgba(167,192,128,0.4)] dark:shadow-none transition-all active:scale-95"
              >
                <Plus size={22} strokeWidth={3} /> ADD PLANT
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

        {isAuthModalOpen && (
          <AuthModal
            onClose={() => { setIsAuthModalOpen(false); setAuthMessage(''); }}
            email={authEmail}
            setEmail={setAuthEmail}
            onSendLink={sendMagicLink}
            busy={isAuthBusy}
            message={authMessage}
          />
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
        <StickerCard label="Tasks" value={today.length} icon={<CheckCircle2 />} type="today" />
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
      if (next && next > n + 1) out.push("…");
    }
    return out;
  }, [page, totalPages, showPagination]);

  const Pagination = ({ className = "" }) => {
    if (!showPagination) return null;

    return (
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}>
        <div className="text-[11px] font-black uppercase tracking-widest text-[#A8BDB4] dark:text-[#5B6D65]">
          Showing{" "}
          <span className="text-[#5C4D42] dark:text-white">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, plants.length)}
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
              if (it === "…") {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="px-3 py-2 text-xs font-black text-[#A8BDB4] dark:text-[#5B6D65]"
                  >
                    …
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
      {showPagination && <Pagination className="mb-8" />}

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
          {showPagination && <Pagination className="mt-10" />}
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
          
<div className="p-12 lg:p-16 space-y-12">
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
<h1 className="text-4xl lg:text-5xl font-serif font-black text-[#5C4D42] dark:text-white leading-tight break-words [overflow-wrap:anywhere]">
  {plant.name}
</h1>




  </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="bg-[#FEF9E7] dark:bg-[#2F332A] p-8 rounded-[40px] border-2 border-white dark:border-transparent shadow-sm transition-colors">
                <p className="text-[10px] font-black text-[#D9C582] dark:text-[#E8C06F] uppercase tracking-[0.25em] mb-2 text-center">Interval</p>
                <p className="text-2xl font-black text-[#5C4D42] dark:text-[#E8DCCB] text-center">{plant.frequency} Days</p>
              </div>
              <div className={`p-8 rounded-[40px] border-2 border-white dark:border-transparent shadow-sm transition-colors ${status === 'overdue' ? 'bg-[#FFF4F2] dark:bg-[#3D2B29]' : 'bg-[#EAF2ED] dark:bg-[#2A332E]'}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.25em] mb-2 text-center ${status === 'overdue' ? 'text-[#D98E82]' : 'text-[#8FA66A]'}`}>Feeling</p>
                <p className={`text-2xl font-black text-center capitalize ${status === 'overdue' ? 'text-[#D98E82]' : 'text-[#8FA66A]'}`}>
                  {status === 'overdue' ? 'Thirsty' : 'Happy'}
                </p>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t-4 border-dotted border-[#F2E8D5] dark:border-[#2A332E]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-[#5B6D65] font-bold uppercase tracking-widest text-[10px]">Last Hydration</span>
                <span className="font-black text-[#5C4D42] dark:text-[#CBD5D0]">{(plant.lastWatered ? new Date(plant.lastWatered).toLocaleDateString() : '—')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-[#5B6D65] font-bold uppercase tracking-widest text-[10px]">Next Best Time</span>
                <span className="font-black text-[#A7C080]">{nextDue?.toLocaleDateString()}</span>
              </div>
            </div>

            <button 
              onClick={() => onWater(plant.id)}
              className="w-full py-8 bg-gradient-to-r from-[#8DA399] to-[#A7C080] text-white rounded-[40px] font-black shadow-[0_15px_40px_rgba(167,192,128,0.4)] dark:shadow-none flex items-center justify-center gap-4 hover:scale-[1.02] transition-all active:scale-95 text-xl"
            >
              <Droplets size={32} /> MARK AS REFRESHED
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


function AuthModal({ onClose, email, setEmail, onSendLink, busy, message }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-[#1D241F] border-2 border-black dark:border-[#2A332E] rounded-[32px] shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-black text-[#5C4D42] dark:text-white">Sign in to sync</div>
              <div className="text-sm font-bold text-[#8AA79B] dark:text-[#A8BDB4] mt-1">
                We’ll email you a magic link. No password.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[18px] font-black border-2 border-black dark:border-[#2A332E] bg-[#F7F2E8] dark:bg-[#232B26] hover:translate-y-[-1px] active:translate-y-[0px] transition"
            >
              Close
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-5 py-4 rounded-[22px] border-2 border-black dark:border-[#2A332E] bg-white dark:bg-[#232B26] text-[#5C4D42] dark:text-white font-bold outline-none focus:ring-2 focus:ring-[#A7C080]/40"
            />

            <button
              type="button"
              onClick={onSendLink}
              disabled={busy || !email.trim()}
              className="w-full px-6 py-4 rounded-[22px] font-black text-white bg-[#A7C080] hover:bg-[#96AD73] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_25px_rgba(167,192,128,0.35)] dark:shadow-none transition"
            >
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>

            {message && (
              <div className="text-sm font-bold text-[#5C4D42] dark:text-[#D9E3D8] bg-[#F7F2E8] dark:bg-[#232B26] border-2 border-dashed border-[#E8D7B8] dark:border-[#2A332E] rounded-[22px] px-5 py-4">
                {message}
              </div>
            )}

            <div className="text-[11px] font-bold uppercase tracking-widest text-[#A8BDB4] dark:text-[#5B6D65]">
              Tip: you’ll stay logged in on this device.
            </div>
          </div>
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

  const handlePhoto = (e) => {
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
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

  const handlePhoto = (e) => {
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
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

const styles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #EBE3D5;
    border-radius: 20px;
    border: 3px solid transparent;
    background-clip: content-box;
  }
  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #2A332E;
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin-slow {
    animation: spin-slow 12s linear infinite;
  }
  [color-scheme="dark"]::-webkit-calendar-picker-indicator {
    filter: invert(1);
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}