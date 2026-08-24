/**
 * Общий интерфейс хранилища данных.
 *
 * Идея: весь остальной код (clientService, caseService, documentService,
 * taskService) работает ТОЛЬКО через этот интерфейс и никогда напрямую
 * не обращается к localStorage.
 *
 * Благодаря этому на следующем этапе можно будет создать
 * SupabaseAdapter<T>, реализующий тот же интерфейс, и просто
 * подменить создание адаптера в каждом сервисе — без единой правки
 * в компонентах или страницах.
 *
 * Все методы асинхронные (возвращают Promise), хотя localStorage
 * синхронный — это сделано намеренно, чтобы код уже сегодня был
 * совместим с будущим асинхронным API (Supabase / REST).
 */
export interface StorageAdapter<T extends { id: string }> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(item: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  /** Полностью заменить содержимое коллекции (используется редко, для служебных операций). */
  replaceAll(items: T[]): Promise<void>;
}

const isBrowser = typeof window !== "undefined";

function readRaw<T>(key: string): T[] | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T[];
  } catch (error) {
    console.error(`[storageAdapter] Не удалось прочитать ключ "${key}"`, error);
    return null;
  }
}

function writeRaw<T>(key: string, items: T[]): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch (error) {
    console.error(`[storageAdapter] Не удалось записать ключ "${key}"`, error);
  }
}

/**
 * Реализация StorageAdapter поверх localStorage.
 *
 * @param storageKey ключ в localStorage, под которым хранится массив записей
 * @param seedData начальные (mock) данные — записываются один раз,
 *   если в localStorage ещё ничего нет
 */
export function createLocalStorageAdapter<T extends { id: string }>(
  storageKey: string,
  seedData: T[] = []
): StorageAdapter<T> {
  function ensureSeeded(): T[] {
    const existing = readRaw<T>(storageKey);
    if (existing !== null) return existing;
    writeRaw(storageKey, seedData);
    return seedData;
  }

  return {
    async getAll() {
      return ensureSeeded();
    },

    async getById(id: string) {
      const all = ensureSeeded();
      return all.find((item) => item.id === id) ?? null;
    },

    async create(item: T) {
      const all = ensureSeeded();
      const next = [...all, item];
      writeRaw(storageKey, next);
      return item;
    },

    async update(id: string, patch: Partial<T>) {
      const all = ensureSeeded();
      let updated: T | null = null;
      const next = all.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...patch };
        return updated;
      });
      if (updated) writeRaw(storageKey, next);
      return updated;
    },

    async remove(id: string) {
      const all = ensureSeeded();
      const next = all.filter((item) => item.id !== id);
      const removed = next.length !== all.length;
      if (removed) writeRaw(storageKey, next);
      return removed;
    },

    async replaceAll(items: T[]) {
      writeRaw(storageKey, items);
    },
  };
}
