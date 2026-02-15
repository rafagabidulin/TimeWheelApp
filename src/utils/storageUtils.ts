// utils/storageUtils.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import CryptoJS from 'crypto-js';
import { Day, Template } from '../types/types';
import { STORAGE_KEYS } from '../constants/theme';
import i18n from '../i18n';
import { logger } from './logger';

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

const ENCRYPTION_KEY_STORAGE = 'timewheel.encryptionKey';
const ENCRYPTED_PREFIX = 'enc:';

async function getEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
  if (existing) return existing;

  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const wordArray = CryptoJS.lib.WordArray.create(Array.from(randomBytes));
  const key = CryptoJS.enc.Base64.stringify(wordArray);

  await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE, key);
  return key;
}

async function encryptPayload(payload: string): Promise<string> {
  const key = await getEncryptionKey();
  const encrypted = CryptoJS.AES.encrypt(payload, key).toString();
  return `${ENCRYPTED_PREFIX}${encrypted}`;
}

async function decryptPayload(encryptedPayload: string): Promise<string> {
  const key = await getEncryptionKey();
  const decrypted = CryptoJS.AES.decrypt(encryptedPayload, key).toString(CryptoJS.enc.Utf8);
  if (!decrypted) {
    throw new StorageError(i18n.t('errors.storageDecrypt'));
  }
  return decrypted;
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
        const payload = stored.startsWith(ENCRYPTED_PREFIX)
          ? await decryptPayload(stored.slice(ENCRYPTED_PREFIX.length))
          : stored;
        const parsed = JSON.parse(payload);
        return Array.isArray(parsed) ? parsed : [];
      } catch (parseError) {
        logger.warn('Storage parse error:', parseError);
        await AsyncStorage.removeItem(STORAGE_KEYS.days);
        return [];
      }
    }
    return [];
  } catch (error) {
    logger.error('Storage load error:', error);
    throw new StorageError(i18n.t('errors.storageLoad'));
  }
}

/**
 * Загружает шаблоны из AsyncStorage
 * @throws StorageError если загрузка не удалась
 */
export async function loadTemplatesFromStorage(): Promise<Template[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.templates);
    if (stored) {
      try {
        const payload = stored.startsWith(ENCRYPTED_PREFIX)
          ? await decryptPayload(stored.slice(ENCRYPTED_PREFIX.length))
          : stored;
        const parsed = JSON.parse(payload);
        return Array.isArray(parsed) ? parsed : [];
      } catch (parseError) {
        logger.warn('Templates parse error:', parseError);
        await AsyncStorage.removeItem(STORAGE_KEYS.templates);
        return [];
      }
    }
    return [];
  } catch (error) {
    logger.error('Templates load error:', error);
    throw new StorageError(i18n.t('errors.storageLoad'));
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
      const encryptedPayload = await encryptPayload(payload);
      await AsyncStorage.setItem(STORAGE_KEYS.days, encryptedPayload);
    } catch (error) {
      logger.error('Storage save error:', error);
      throw new StorageError(i18n.t('errors.storageSave'));
    }
  });

  saveQueue = queuedSave.catch(() => {});
  return queuedSave;
}

export async function saveTemplatesToStorage(templates: Template[]): Promise<void> {
  const payload = JSON.stringify(templates);
  const queuedSave = saveQueue.then(async () => {
    try {
      const encryptedPayload = await encryptPayload(payload);
      await AsyncStorage.setItem(STORAGE_KEYS.templates, encryptedPayload);
    } catch (error) {
      logger.error('Templates save error:', error);
      throw new StorageError(i18n.t('errors.storageSave'));
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
    await AsyncStorage.removeItem(STORAGE_KEYS.templates);
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY_STORAGE);
  } catch (error) {
    logger.error('Storage clear error:', error);
    throw new StorageError(i18n.t('errors.storageClear'));
  }
}
