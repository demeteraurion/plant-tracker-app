export const POPULAR_PLANTS = [
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

export const parsePlantDate = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : parsePlantDate(value);
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const dateInputToISOString = (value) => {
  const date = parsePlantDate(value);
  return date ? date.toISOString() : new Date().toISOString();
};

export const formatPlantDate = (value) => {
  const date = parsePlantDate(value);
  return date ? date.toLocaleDateString() : '-';
};

export const normalizeFrequency = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export const calculateNextDue = (lastWatered, frequency) => {
  if (!lastWatered || !frequency) return null;
  const date = parsePlantDate(lastWatered);
  if (!date) return null;

  date.setDate(date.getDate() + normalizeFrequency(frequency));
  return date;
};

export const getStatus = (nextDue) => {
  if (!nextDue) return 'unknown';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue);
  due.setHours(0, 0, 0, 0);

  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'today';
  return 'upcoming';
};

export const createPlantId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const normalizeImportedPlant = (plant) => {
  if (!plant || typeof plant !== 'object' || Array.isArray(plant)) return null;

  return {
    ...plant,
    id: plant.id ? String(plant.id) : createPlantId(),
    frequency: normalizeFrequency(plant.frequency),
  };
};

export const compressImage = (input, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
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

export const compressOversizedPlantPhotos = async (plants) => {
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
