import type { Tab } from '../../types';

// ============================================================================
// Tab Storage - localStorage persistence for guitar tabs
// ============================================================================

const STORAGE_KEY_PREFIX = 'guitar_tab_';
const TAB_INDEX_KEY = 'guitar_tab_index';

export interface TabMetadata {
  id: string;
  title: string;
  artist: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get the storage key for a tab
 */
function getTabKey(id: string): string {
  return `${STORAGE_KEY_PREFIX}${id}`;
}

/**
 * Load the tab index (list of tab IDs and metadata)
 */
function loadTabIndex(): TabMetadata[] {
  try {
    const stored = localStorage.getItem(TAB_INDEX_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as TabMetadata[];
  } catch {
    return [];
  }
}

/**
 * Save the tab index
 */
function saveTabIndex(index: TabMetadata[]): void {
  localStorage.setItem(TAB_INDEX_KEY, JSON.stringify(index));
}

export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/**
 * Save a tab to storage
 * @throws StorageQuotaError if localStorage quota is exceeded
 */
export function saveTab(tab: Tab): void {
  const now = new Date().toISOString();
  const key = getTabKey(tab.id);

  try {
    // Save the full tab data
    localStorage.setItem(key, JSON.stringify(tab));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new StorageQuotaError('Storage quota exceeded. Try deleting some tabs to free up space.');
    }
    throw e;
  }

  // Update the index
  const index = loadTabIndex();
  const existingIndex = index.findIndex((t) => t.id === tab.id);

  const metadata: TabMetadata = {
    id: tab.id,
    title: tab.title,
    artist: tab.artist,
    createdAt: existingIndex >= 0 ? index[existingIndex].createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    index[existingIndex] = metadata;
  } else {
    index.push(metadata);
  }

  saveTabIndex(index);
}

/**
 * Load a tab by ID
 */
export function loadTab(id: string): Tab | null {
  try {
    const stored = localStorage.getItem(getTabKey(id));
    if (!stored) return null;
    return JSON.parse(stored) as Tab;
  } catch {
    return null;
  }
}

/**
 * Delete a tab by ID
 */
export function deleteTab(id: string): void {
  localStorage.removeItem(getTabKey(id));

  const index = loadTabIndex();
  const newIndex = index.filter((t) => t.id !== id);
  saveTabIndex(newIndex);
}

/**
 * List all saved tabs (metadata only)
 */
export function listTabs(): TabMetadata[] {
  return loadTabIndex();
}

/**
 * Check if a tab exists
 */
export function tabExists(id: string): boolean {
  return localStorage.getItem(getTabKey(id)) !== null;
}

/**
 * Generate a new unique tab ID
 */
export function generateTabId(): string {
  return crypto.randomUUID();
}

/**
 * Get the count of saved tabs
 */
export function getTabCount(): number {
  return loadTabIndex().length;
}
