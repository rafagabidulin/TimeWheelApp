// utils/storageUtils.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Day } from '../types/types';
import { STORAGE_KEYS } from '../constants/theme';

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Загружает дни с расписанием из AsyncStorage
 * @throws StorageError если загрузка не удалась
 */
export async function loadDaysFromStorage(): Promise<Day[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.days);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      } catch (parseError) {
        console.warn('Storage parse error:', parseError);
        await AsyncStorage.removeItem(STORAGE_KEYS.days);
        return [];
      }
    }
    return [];
  } catch (error) {
    console.error('Storage load error:', error);
    throw new StorageError('Не удалось загрузить данные из хранилища. Попробуйте позже.');
  }
}

/**
 * Сохраняет дни с расписанием в AsyncStorage
 * @throws StorageError если сохранение не удалось
 */
let saveQueue: Promise<void> = Promise.resolve();

export async function saveDaysToStorage(days: Day[]): Promise<void> {
  const payload = JSON.stringify(days);
  const queuedSave = saveQueue.then(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.days, payload);
    } catch (error) {
      console.error('Storage save error:', error);
      throw new StorageError('Не удалось сохранить данные. Изменения могут быть потеряны.');
    }
  });

  saveQueue = queuedSave.catch(() => {});
  return queuedSave;
}

/**
 * Удаляет все данные из хранилища (опасная операция)
 */
export async function clearStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.days);
  } catch (error) {
    console.error('Storage clear error:', error);
    throw new StorageError('Не удалось очистить хранилище.');
  }
}
