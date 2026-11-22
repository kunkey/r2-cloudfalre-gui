import { create } from 'zustand';
import { toast } from '@/lib/toast';

interface ObjectState {
  objects: any[];
  prefixes: string[]; // folder names (CommonPrefixes)
  selectedKeys: string[];
  searchQuery: string;
  gridLimit: number; // số item mỗi trang
  currentPrefix: string; // path we are viewing

  // ─── Pagination ───
  page: number; // trang hiện tại (1-based)
  totalPages: number; // số trang đã biết (>= page)
  isLastPage: boolean; // true khi đã biết chính xác trang cuối
  hasMore: boolean; // còn trang kế tiếp không
  totalCount: number | null; // tổng số object (null = chưa biết)
  searchResultCount: number; // tổng kết quả tìm kiếm (nếu đang search)

  fetchObjects: (forceRefresh?: boolean) => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  firstPage: () => Promise<void>;
  lastPage: () => Promise<void>;

  isLoading: boolean;
  isLoadingMore: boolean;
  toggleSelect: (key: string) => void;
  toggleSelectWithAnchor: (key: string) => void;
  selectRange: (orderedKeys: string[], endKey: string) => void;
  toggleSelectAll: (orderedKeys?: string[]) => void;
  clearSelection: () => void;
  selectAll: (orderedKeys?: string[]) => void;
  lastSelectedKey: string | null;
  displayOrderedKeys: string[];
  setDisplayOrderedKeys: (keys: string[]) => void;
  bulkDelete: () => Promise<void>;
  deleteOne: (key: string) => Promise<void>;
  deleteFolder: (prefix: string) => Promise<void>;
  bulkDownload: () => Promise<void>;
  bulkCopyLinks: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setGridLimit: (n: number) => void;
  setCurrentPrefix: (p: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (m: 'grid' | 'list') => void;
  sortOrder: 'newest' | 'oldest';
  setSortOrder: (o: 'newest' | 'oldest') => void;
  goUp: () => void;
  createFolder: (name: string) => Promise<void>;
  // Upload management
  uploadOpen: boolean;
  uploadTasks: UploadTask[];
  startDnDUpload: (entries: { file: File; relativePath: string }[], dirPaths?: string[]) => Promise<void>;
  addFolderPickerUploads: (entries: { file: File; relativePath: string }[]) => Promise<void>;
  cancelAllUploads: () => void;
  retryFailed: () => void;
  hideUploadPanel: () => void;
  // Links modal state
  linksModalOpen: boolean;
  modalLinks: string[];
  showLinksModal: (links: string[]) => void;
  hideLinksModal: () => void;
  // Lightbox (file preview)
  focusedKey: string | null;
  setFocusedKey: (key: string | null) => void;
  // Filter: chỉ hiển thị file vừa upload
  recentlyUploadedKeys: string[];
  showOnlyUploaded: boolean;
  setShowOnlyUploaded: (v: boolean) => void;
}

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'canceled';
export interface UploadTask {
  key: string;
  name: string;
  size: number;
  progress: number; // 0..1
  status: UploadStatus;
  error?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Cache thư mục đa cấp (hỗ trợ back/forward tức thì mà không cần fetch lại API)
// ───────────────────────────────────────────────────────────────────────────

interface PageData {
  objects: any[];
  prefixes: string[];
  isTruncated: boolean;
}

interface FolderCacheEntry {
  pages: Map<number, PageData>;
  tokens: string[];
  totalCount: number | null;
  totalPages: number;
  timestamp: number;
}

const _folderCache = new Map<string, FolderCacheEntry>();

function getFolderCacheKey(prefix: string, size: number): string {
  return `${prefix}|${size}`;
}

function getCachedFolder(prefix: string, size: number): FolderCacheEntry {
  const key = getFolderCacheKey(prefix, size);
  let entry = _folderCache.get(key);
  if (!entry) {
    entry = {
      pages: new Map<number, PageData>(),
      tokens: [],
      totalCount: null,
      totalPages: 1,
      timestamp: Date.now(),
    };
    _folderCache.set(key, entry);
  }
  return entry;
}

/**
 * Xóa cache thư mục khi có mutation (tạo folder, xóa file/folder, upload file, import URL).
 * Nếu không truyền prefix: xóa toàn bộ cache.
 * Nếu truyền prefix: xóa cache của thư mục đó và các thư mục liên quan.
 */
export function invalidateFolderCache(prefix?: string) {
  if (prefix === undefined) {
    _folderCache.clear();
    _searchResults = null;
    _searchTerm = '';
    return;
  }
  const normalized = prefix.replace(/^\/+|\/+$/g, '');
  for (const key of Array.from(_folderCache.keys())) {
    const [p] = key.split('|');
    const normP = p.replace(/^\/+|\/+$/g, '');
    if (normP === normalized || normP.startsWith(normalized) || normalized.startsWith(normP)) {
      _folderCache.delete(key);
    }
  }
  _searchResults = null;
  _searchTerm = '';
}

/** Kết quả tìm kiếm đã tải về (phân trang client-side) */
let _searchResults: any[] | null = null;
let _searchTerm = '';
let _searchTimer: ReturnType<typeof setTimeout> | null = null;

/** Đếm tổng số object của prefix (lưu trong folder cache). */
async function fetchTotalCount(prefix: string, size: number): Promise<number | null> {
  const entry = getCachedFolder(prefix, size);
  if (entry.totalCount !== null) return entry.totalCount;

  try {
    const q = new URLSearchParams();
    if (prefix) q.set('prefix', prefix);
    const res = await fetch(`/api/objects/count?${q.toString()}`, {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { count?: number };
    const count = typeof data.count === 'number' ? data.count : null;
    entry.totalCount = count;
    return count;
  } catch {
    return null;
  }
}

/** Tải 1 trang từ server (hoặc lấy từ cache thư mục). p là 1-based. */
async function fetchPageData(p: number, prefix: string, size: number): Promise<PageData> {
  const entry = getCachedFolder(prefix, size);
  const cached = entry.pages.get(p);
  if (cached) return cached;

  const token = p >= 2 ? entry.tokens[p - 2] : undefined;
  const q = new URLSearchParams();
  q.set('limit', String(size));
  if (prefix) q.set('prefix', prefix);
  if (token) q.set('continuationToken', token);

  const res = await fetch(`/api/objects?${q.toString()}`, {
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
    },
  });
  const data = (await res.json()) as any;

  const pd: PageData = {
    objects: data.Contents || [],
    prefixes: (data.CommonPrefixes || []).map((item: any) => item.Prefix).filter(Boolean),
    isTruncated: Boolean(data.IsTruncated && data.NextContinuationToken),
  };

  entry.pages.set(p, pd);
  if (pd.isTruncated) entry.tokens[p - 1] = data.NextContinuationToken;
  return pd;
}

/** Tải kết quả tìm kiếm (1 lần, phân trang client-side). */
async function loadSearchResults(term: string, scopePrefix: string): Promise<any[]> {
  const cacheKey = `${scopePrefix}|${term}`;
  if (_searchTerm === cacheKey && _searchResults) return _searchResults;
  const res = await fetch(
    `/api/objects/search?q=${encodeURIComponent(term)}&limit=5000`,
    {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
    },
  );
  const data = (await res.json()) as any;
  let results: any[] = data.Contents || [];
  if (scopePrefix) {
    results = results.filter((o: any) => (o.Key || '').startsWith(scopePrefix));
  }
  _searchResults = results;
  _searchTerm = cacheKey;
  return results;
}

export const useObjectStore = create<ObjectState>((set, get) => ({
  objects: [],
  prefixes: [],
  selectedKeys: [],
  lastSelectedKey: null,
  displayOrderedKeys: [],
  searchQuery: '',
  gridLimit: 96,
  currentPrefix: '',
  uploadOpen: false,
  uploadTasks: [],
  linksModalOpen: false,
  modalLinks: [],
  focusedKey: null,
  setFocusedKey: (key) => set({ focusedKey: key }),
  recentlyUploadedKeys: [],
  showOnlyUploaded: false,
  setShowOnlyUploaded: (v) => set({ showOnlyUploaded: v, ...(!v ? { recentlyUploadedKeys: [] } : {}) }),
  viewMode: 'grid',
  sortOrder: 'newest',
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,

  // ─── Pagination ───
  page: 1,
  totalPages: 1,
  isLastPage: false,
  totalCount: null,
  searchResultCount: 0,

  /**
   * Nạp lại trang. Nếu forceRefresh=true (sau khi upload, delete, create folder):
   * xóa cache thư mục để lấy dữ liệu mới nhất.
   */
  fetchObjects: async (forceRefresh = false) => {
    if (forceRefresh) {
      invalidateFolderCache(get().currentPrefix);
    }
    await get().goToPage(1);
  },

  goToPage: async (target: number) => {
    const state = get();
    const size = state.gridLimit;
    const prefix = state.currentPrefix;
    const term = (state.searchQuery || '').trim().toLowerCase();

    // ── Chế độ tìm kiếm: tải 1 lần, phân trang client-side ──
    if (term) {
      set({ isLoading: true });
      try {
        const results = await loadSearchResults(term, prefix);
        const totalPages = Math.max(1, Math.ceil(results.length / size));
        const p = Math.min(Math.max(1, target), totalPages);
        const start = (p - 1) * size;
        set({
          objects: results.slice(start, start + size),
          prefixes: [],
          page: p,
          totalPages,
          isLastPage: true,
          hasMore: p < totalPages,
          totalCount: results.length,
          searchResultCount: results.length,
          isLoading: false,
        });
      } catch {
        set({ isLoading: false, objects: [], prefixes: [], page: 1, totalPages: 1, isLastPage: true, hasMore: false, totalCount: 0, searchResultCount: 0 });
      }
      return;
    }

    // ── Chế độ danh sách thư mục (có cache đa cấp) ──
    const p = Math.max(1, target);
    const entry = getCachedFolder(prefix, size);

    // Kiểm tra nếu dữ liệu trang này đã có sẵn trong cache
    if (entry.pages.has(p)) {
      const pd = entry.pages.get(p)!;
      const total = entry.totalCount;
      const nextExists = pd.isTruncated;
      const totalPages = total !== null
        ? Math.max(1, Math.ceil(total / size))
        : (nextExists ? Math.max(p + 1, entry.totalPages) : p);

      set({
        objects: pd.objects,
        prefixes: pd.prefixes,
        page: p,
        totalPages,
        isLastPage: total !== null ? p >= Math.ceil(total / size) : !nextExists,
        hasMore: total !== null ? p < Math.ceil(total / size) : nextExists,
        totalCount: total,
        searchResultCount: 0,
        isLoading: false,
      });
      return;
    }

    // Nếu chưa có trong cache: hiển thị loading và fetch tuần tự
    set({ isLoading: true });

    try {
      for (let i = 1; i <= p; i++) {
        await fetchPageData(i, prefix, size);
      }

      const pd = entry.pages.get(p)!;

      let nextExists = false;
      if (pd.isTruncated) {
        try {
          const next = await fetchPageData(p + 1, prefix, size);
          nextExists = next.isTruncated || next.objects.length > 0;
        } catch {
          nextExists = true;
        }
      }

      const total = await fetchTotalCount(prefix, size);
      const computedTotalPages = total !== null
        ? Math.max(1, Math.ceil(total / size))
        : (nextExists ? Math.max(p + 1, get().totalPages) : p);

      entry.totalPages = computedTotalPages;

      set({
        objects: pd.objects,
        prefixes: pd.prefixes,
        page: p,
        totalPages: computedTotalPages,
        isLastPage: total !== null ? p >= Math.ceil(total / size) : !nextExists,
        hasMore: total !== null ? p < Math.ceil(total / size) : nextExists,
        totalCount: total,
        searchResultCount: 0,
        isLoading: false,
      });
    } catch (err) {
      console.error('goToPage failed:', err);
      set({ isLoading: false });
    }
  },

  nextPage: async () => {
    const { page, hasMore, totalPages } = get();
    if (!hasMore && page >= totalPages) return;
    await get().goToPage(page + 1);
  },
  prevPage: async () => {
    const { page } = get();
    if (page <= 1) return;
    await get().goToPage(page - 1);
  },
  firstPage: async () => get().goToPage(1),
  lastPage: async () => get().goToPage(get().totalPages),

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
    if (_searchTimer) clearTimeout(_searchTimer);
    set({ isLoading: true });
    _searchTimer = setTimeout(() => {
      void get().goToPage(1);
    }, 350);
  },
  setGridLimit: (n: number) => {
    set({ gridLimit: n });
    void get().fetchObjects(true);
  },
  setCurrentPrefix: (p: string) => {
    const next = p.replace(/^\/+|\/+$/g, '') ? p.replace(/^\/+|\/+$/g, '') + '/' : '';
    _searchResults = null;
    _searchTerm = '';
    set({ currentPrefix: next, selectedKeys: [], lastSelectedKey: null });
  },
  setViewMode: (m: 'grid' | 'list') => set({ viewMode: m }),
  setSortOrder: (o: 'newest' | 'oldest') => set({ sortOrder: o }),
  goUp: () => {
    const cur = get().currentPrefix;
    if (!cur) return;
    const parts = cur.replace(/\/+$/, '').split('/');
    parts.pop();
    const parent = parts.join('/');
    set({ currentPrefix: parent ? parent + '/' : '' });
  },

  createFolder: async (name: string) => {
    const parentPrefix = get().currentPrefix;
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
      body: JSON.stringify({ parentPrefix, name }),
    });
    if (!res.ok) {
      let message = 'Failed to create folder';
      try { const err = (await res.json()) as { error?: string }; if (err?.error) message = err.error; } catch {}
      toast.error('Failed to create folder', message);
      throw new Error(message);
    }
    invalidateFolderCache(parentPrefix);
    toast.success('Folder created', `Folder "${name}" was created successfully`);
    await get().fetchObjects(true);
  },

  // Uploads
  startDnDUpload: async (entries, dirPaths) => {
    await enqueueUploads(entries, dirPaths);
  },
  addFolderPickerUploads: async (entries) => {
    await enqueueUploads(entries);
  },
  cancelAllUploads: () => {
    abortAll();
    fileBlobs.clear();
    set((state) => ({
      uploadTasks: state.uploadTasks.map((t) =>
        t.status === 'done' ? t : { ...t, status: 'canceled' as UploadStatus }
      ),
    }));
    toast.info('Uploads canceled');
  },
  retryFailed: () => {
    const tasks = get().uploadTasks;
    const toRetry: UploadTask[] = tasks.map((t) =>
      t.status === 'error' || t.status === 'canceled'
        ? { ...t, status: 'queued' as UploadStatus, progress: 0, error: undefined }
        : t
    );
    set({ uploadTasks: toRetry, uploadOpen: true });
    runQueue();
  },
  hideUploadPanel: () => set({ uploadOpen: false }),

  showLinksModal: (links: string[]) => set({ linksModalOpen: true, modalLinks: links }),
  hideLinksModal: () => set({ linksModalOpen: false, modalLinks: [] }),

  toggleSelect: (key: string) => {
    const current = get().selectedKeys;
    const exists = current.includes(key);
    set({ selectedKeys: exists ? current.filter((k) => k !== key) : [...current, key], lastSelectedKey: key });
  },

  toggleSelectWithAnchor: (key: string) => {
    const current = get().selectedKeys;
    const exists = current.includes(key);
    set({ selectedKeys: exists ? current.filter((k) => k !== key) : [...current, key], lastSelectedKey: key });
  },

  selectRange: (orderedKeys: string[], endKey: string) => {
    const anchor = get().lastSelectedKey;
    const startIdx = anchor !== null ? orderedKeys.indexOf(anchor) : -1;
    const endIdx = orderedKeys.indexOf(endKey);
    if (endIdx === -1) return;
    const from = startIdx === -1 ? endIdx : Math.min(startIdx, endIdx);
    const to = startIdx === -1 ? endIdx : Math.max(startIdx, endIdx);
    const range = orderedKeys.slice(from, to + 1);
    set({ selectedKeys: range, lastSelectedKey: endKey });
  },

  toggleSelectAll: (orderedKeys?: string[]) => {
    const keys = orderedKeys ?? get().displayOrderedKeys;
    const current = get().selectedKeys;
    const allSelected = keys.length > 0 && current.length === keys.length;
    set({ selectedKeys: allSelected ? [] : keys, lastSelectedKey: null });
  },

  clearSelection: () => set({ selectedKeys: [], lastSelectedKey: null }),

  setDisplayOrderedKeys: (keys: string[]) => set({ displayOrderedKeys: keys }),

  selectAll: (orderedKeys?: string[]) => {
    const keys = orderedKeys ?? get().displayOrderedKeys;
    set({ selectedKeys: keys, lastSelectedKey: null });
  },

  bulkDelete: async () => {
    const keys = get().selectedKeys;
    if (keys.length === 0) return;
    try {
      toast.info('Đang xóa...', `Đang xóa ${keys.length} mục đã chọn`);

      const folderKeys = keys.filter((k) => k.endsWith('/'));
      const fileKeys = keys.filter((k) => !k.endsWith('/'));

      const deleteRequests: Promise<any>[] = [];

      if (fileKeys.length > 0) {
        deleteRequests.push(
          fetch('/api/objects', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
            },
            body: JSON.stringify({ keys: fileKeys }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(err?.error || 'Xóa file thất bại');
            }
          })
        );
      }

      if (folderKeys.length > 0) {
        deleteRequests.push(
          fetch('/api/folders', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
            },
            body: JSON.stringify({ prefixes: folderKeys }),
          }).then(async (res) => {
            if (!res.ok) {
              const err = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(err?.error || 'Xóa thư mục thất bại');
            }
          })
        );
      }

      await Promise.all(deleteRequests);

      // Loại bỏ các file và folder đã xóa trực tiếp khỏi danh sách hiện tại (KHÔNG reload cả trang)
      const deletedKeySet = new Set(keys);
      const remainingObjects = get().objects.filter((o: any) => !deletedKeySet.has(o.Key));
      const remainingPrefixes = get().prefixes.filter((p: string) => {
        const norm = p.replace(/^\/+|\/+$/g, '') + '/';
        return !deletedKeySet.has(p) && !deletedKeySet.has(norm);
      });

      set({
        objects: remainingObjects,
        prefixes: remainingPrefixes,
        selectedKeys: [],
        lastSelectedKey: null,
      });

      // Vô hiệu hóa cache của thư mục hiện tại để lần sau vào lại có dữ liệu mới
      invalidateFolderCache(get().currentPrefix);

      toast.success('Đã xóa thành công', `Đã xóa ${keys.length} mục`);
    } catch (err: any) {
      toast.error('Xóa thất bại', err?.message || 'Có lỗi xảy ra khi xóa');
    }
  },

  deleteOne: async (key: string) => {
    if (!key) return;
    const filename = key.split('/').pop() || key;
    try {
      toast.info('Đang xóa file...', filename);

      const res = await fetch('/api/objects', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
        },
        body: JSON.stringify({ keys: [key] }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err?.error || 'Xóa file thất bại');
      }

      // Loại bỏ file khỏi danh sách hiện tại ngay lập tức mà KHÔNG reload cả thư mục
      const remaining = get().objects.filter((o: any) => o.Key !== key);
      const remainingSelected = get().selectedKeys.filter((k) => k !== key);
      set({ objects: remaining, selectedKeys: remainingSelected });

      invalidateFolderCache(get().currentPrefix);
      toast.success('Đã xóa thành công', filename);
    } catch (err: any) {
      toast.error('Xóa thất bại', err?.message || 'Không thể xóa file');
    }
  },

  deleteFolder: async (prefix: string) => {
    if (!prefix) return;
    const folderName = prefix.replace(/\/+$/, '').split('/').pop() || prefix;
    try {
      toast.info('Đang xóa thư mục...', folderName);

      const res = await fetch('/api/folders', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
        },
        body: JSON.stringify({ prefix }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err?.error || 'Xóa thư mục thất bại');
      }

      // Loại bỏ thư mục khỏi prefixes hiện tại mà KHÔNG reload cả thư mục
      const norm = prefix.replace(/^\/+|\/+$/g, '') + '/';
      const remainingPrefixes = get().prefixes.filter((p: string) => {
        const np = p.replace(/^\/+|\/+$/g, '') + '/';
        return np !== norm;
      });
      const remainingSelected = get().selectedKeys.filter((k) => {
        const nk = k.replace(/^\/+|\/+$/g, '') + '/';
        return nk !== norm;
      });
      set({ prefixes: remainingPrefixes, selectedKeys: remainingSelected });

      invalidateFolderCache(prefix);
      toast.success('Đã xóa thư mục', `Thư mục "${folderName}" đã được xóa`);
    } catch (err: any) {
      toast.error('Xóa thư mục thất bại', err?.message || 'Không thể xóa thư mục');
    }
  },

  bulkDownload: async () => {
    const keys = get().selectedKeys;
    const fileKeys = keys.filter((k) => !k.endsWith('/'));
    if (fileKeys.length === 0) {
      if (keys.length > 0) {
        toast.info('Tải về', 'Chỉ hỗ trợ tải về trực tiếp đối với file');
      }
      return;
    }
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
        },
        body: JSON.stringify({ keys: fileKeys }),
      });
      const { links } = (await res.json()) as { links?: string[] };
      (links || []).forEach((url: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.rel = 'noopener';
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
      toast.info('Downloading', `Starting download for ${fileKeys.length} file(s)`);
    } catch (err: any) {
      toast.error('Download failed', err?.message);
    }
  },

  bulkCopyLinks: async () => {
    const keys = get().selectedKeys;
    const fileKeys = keys.filter((k) => !k.endsWith('/'));
    if (fileKeys.length === 0) {
      if (keys.length > 0) {
        toast.info('Sao chép link', 'Chỉ hỗ trợ sao chép public link đối với file');
      }
      return;
    }
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
        },
        body: JSON.stringify({ keys: fileKeys }),
      });
      const { links } = (await res.json()) as { links?: string[] };
      set({ linksModalOpen: true, modalLinks: links || [] });
      toast.success('Links ready', `${(links || []).length} public link(s) retrieved`);
    } catch (err: any) {
      toast.error('Failed to get links', err?.message);
    }
  },
}));

async function refreshCurrentPage() {
  const state = useObjectStore.getState();
  const term = (state.searchQuery || '').trim().toLowerCase();
  if (term) {
    _searchResults = null;
  } else {
    invalidateFolderCache(state.currentPrefix);
  }
  await state.goToPage(state.page);
}

// ───────────────────────────────────────────────────────────────────────────
// Upload helpers (hỗ trợ multipart upload cho video/file lớn 2GB - 3GB+)
// ───────────────────────────────────────────────────────────────────────────

const MULTIPART_THRESHOLD = 20 * 1024 * 1024; // 20 MB: file lớn hơn sẽ dùng multipart
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB per chunk

interface ActiveUpload {
  abort: () => void;
}

const activeUploads = new Map<string, ActiveUpload>();
const fileBlobs = new Map<string, File>();

async function enqueueUploads(entries: { file: File; relativePath: string }[], dirPaths?: string[]) {
  const { currentPrefix } = useObjectStore.getState();
  const normalizedBase = (currentPrefix || '').replace(/^\/+|\/+$/g, '');
  const base = normalizedBase ? normalizedBase + '/' : '';

  let tasks: UploadTask[] = entries.map(({ file, relativePath }) => {
    const rel = String(relativePath || file.name).replace(/^\/+/, '');
    const key = base + rel.replace(/\\/g, '/');
    return { key, name: rel, size: file.size, progress: 0, status: 'queued' as UploadStatus };
  });

  const existsMap = await checkExists(tasks.map((t) => t.key));
  const collisions = tasks.filter((t) => existsMap[t.key]);
  if (collisions.length) {
    const choice = await promptCollisionChoice();
    if (choice.policy === 'skip') {
      tasks = tasks.filter((t) => !existsMap[t.key]);
    } else if (choice.policy === 'rename') {
      const used = new Set(tasks.map((t) => t.key));
      tasks = tasks.map((t) => {
        if (!existsMap[t.key]) return t;
        let k = t.key;
        let idx = 1;
        const dot = k.lastIndexOf('.');
        const baseName = dot > 0 ? k.slice(0, dot) : k;
        const ext = dot > 0 ? k.slice(dot) : '';
        do { k = `${baseName} (${idx})${ext}`; idx++; } while (existsMap[k] || used.has(k));
        used.add(k);
        return { ...t, key: k };
      });
    }
  }

  if (!tasks.length) return;

  const byRel = new Map<string, File>();
  for (const { file, relativePath } of entries) {
    const rel = String(relativePath || file.name).replace(/^\/+/, '').replace(/\\/g, '/');
    byRel.set(rel, file);
  }
  const fileMap = new Map<string, File>();
  for (const t of tasks) {
    const f = byRel.get(String(t.name).replace(/\\/g, '/'));
    if (f) {
      fileMap.set(t.key, f);
      fileBlobs.set(t.key, f);
    }
  }

  const state = useObjectStore.getState();
  useObjectStore.setState({ uploadTasks: [...state.uploadTasks, ...tasks], uploadOpen: true });
  runQueue(fileMap);

  if (Array.isArray(dirPaths) && dirPaths.length) {
    const fileKeys = tasks.map((t) => t.key);
    for (const dir of dirPaths) {
      const rel = String(dir).replace(/^\/+|\/+$/g, '');
      if (!rel) continue;
      const full = base + rel + '/';
      const hasFile = fileKeys.some((k) => k.startsWith(full));
      if (!hasFile) {
        const parent = rel.includes('/') ? rel.replace(/\/+[^/]+$/, '/') : '';
        const name = rel.split('/').filter(Boolean).slice(-1)[0];
        try {
          await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}` },
            body: JSON.stringify({ parentPrefix: base + parent, name }),
          });
        } catch {}
      }
    }
  }
}

async function checkExists(keys: string[]): Promise<Record<string, boolean>> {
  try {
    const res = await fetch('/api/objects/exists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}` },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { exists?: Record<string, boolean> };
    return data?.exists || {};
  } catch {
    return {};
  }
}

async function promptCollisionChoice(): Promise<{ policy: 'overwrite' | 'skip' | 'rename' }> {
  const msg = 'Some files already exist. Type one of: overwrite, skip, rename';
  let input = window.prompt(msg) || '';
  input = input.toLowerCase();
  if (input.startsWith('s')) return { policy: 'skip' };
  if (input.startsWith('r')) return { policy: 'rename' };
  return { policy: 'overwrite' };
}

function runQueue(fileMap?: Map<string, File>) {
  const concurrency = 4;
  let active = 0;

  const pump = () => {
    const { uploadTasks } = useObjectStore.getState();
    if (!uploadTasks.some((t) => t.status === 'queued' || t.status === 'uploading')) {
      const doneKeys = uploadTasks.filter((t) => t.status === 'done').map((t) => t.key);
      const { fetchObjects, currentPrefix } = useObjectStore.getState();
      useObjectStore.setState({ recentlyUploadedKeys: doneKeys });

      // Cập nhật lại cache thư mục khi upload hoàn tất
      invalidateFolderCache(currentPrefix);
      fetchObjects(true);

      if (doneKeys.length > 0) {
        toast.success('Upload complete', `${doneKeys.length} file(s) uploaded successfully`);
      }
      return;
    }
    while (active < concurrency) {
      const next = useObjectStore.getState().uploadTasks.find((t) => t.status === 'queued');
      if (!next) break;
      const file = fileMap?.get(next.key) || fileBlobs.get(next.key);
      if (!file) {
        useObjectStore.setState((s) => ({
          uploadTasks: s.uploadTasks.map((t) => (t.key === next.key ? { ...t, status: 'error', error: 'Missing file' } : t)),
        }));
        continue;
      }
      active++;
      useObjectStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => (t.key === next.key ? { ...t, status: 'uploading' } : t)),
      }));
      uploadOne(file, next.key)
        .then(() => {
          useObjectStore.setState((s) => ({
            uploadTasks: s.uploadTasks.map((t) => (t.key === next.key ? { ...t, status: 'done', progress: 1 } : t)),
          }));
        })
        .catch((e: any) => {
          useObjectStore.setState((s) => ({
            uploadTasks: s.uploadTasks.map((t) => (t.key === next.key ? { ...t, status: t.status === 'canceled' ? 'canceled' : 'error', error: e?.message || 'Upload failed' } : t)),
          }));
        })
        .finally(() => {
          active--;
          setTimeout(pump, 0);
        });
    }
  };
  pump();
}

/**
 * Upload 1 file:
 * - Nếu file <= 20MB: upload trực tiếp qua /api/uploads/direct
 * - Nếu file > 20MB (ví dụ video 2GB - 3GB+): tự động dùng S3 Multipart Upload chia nhỏ thành các chunk 10MB
 */
async function uploadOne(file: File, key: string): Promise<void> {
  // File nhỏ: direct upload
  if (file.size <= MULTIPART_THRESHOLD) {
    return new Promise<void>((resolve, reject) => {
      const form = new FormData();
      form.append('file', file);
      form.append('key', key);
      const xhr = new XMLHttpRequest();
      activeUploads.set(key, { abort: () => xhr.abort() });
      xhr.open('POST', '/api/uploads/direct');
      xhr.setRequestHeader('Authorization', `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`);
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const prog = evt.loaded / Math.max(1, evt.total);
        useObjectStore.setState((s) => ({
          uploadTasks: s.uploadTasks.map((t) => (t.key === key ? { ...t, progress: prog } : t)),
        }));
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          activeUploads.delete(key);
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => {
        activeUploads.delete(key);
        reject(new Error('Network error'));
      };
      xhr.onabort = () => {
        activeUploads.delete(key);
        useObjectStore.setState((s) => ({
          uploadTasks: s.uploadTasks.map((t) => (t.key === key ? { ...t, status: 'canceled' } : t)),
        }));
        reject(new Error('aborted'));
      };
      xhr.send(form);
    });
  }

  // File lớn (>20MB, hỗ trợ video 2GB - 3GB+): S3 Multipart chunked upload
  let aborted = false;
  let activeXhr: XMLHttpRequest | null = null;
  let uploadId = '';

  activeUploads.set(key, {
    abort: () => {
      aborted = true;
      if (activeXhr) activeXhr.abort();
      if (uploadId) {
        void fetch('/api/uploads/multipart/abort', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
          },
          body: JSON.stringify({ key, uploadId }),
        }).catch(() => {});
      }
      useObjectStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => (t.key === key ? { ...t, status: 'canceled' } : t)),
      }));
    },
  });

  try {
    // 1. Khởi tạo Multipart Upload
    const initRes = await fetch('/api/uploads/multipart/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
      body: JSON.stringify({ key, contentType: file.type || 'application/octet-stream' }),
    });

    if (!initRes.ok) {
      const err = (await initRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(err?.error || 'Failed to initiate multipart upload');
    }

    const initData = (await initRes.json()) as { uploadId: string };
    uploadId = initData.uploadId;
    if (aborted) throw new Error('aborted');

    // 2. Upload các chunk tuần tự (10MB mỗi chunk)
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts: { PartNumber: number; ETag: string }[] = [];
    let completedBytes = 0;

    for (let i = 0; i < totalChunks; i++) {
      if (aborted) throw new Error('aborted');

      const partNumber = i + 1;
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);
      const chunkFile = new File([chunkBlob], file.name, { type: file.type });

      const partResult = await new Promise<{ partNumber: number; etag: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeXhr = xhr;

        const formData = new FormData();
        formData.append('key', key);
        formData.append('uploadId', uploadId);
        formData.append('partNumber', String(partNumber));
        formData.append('chunk', chunkFile);

        xhr.open('POST', '/api/uploads/multipart/part');
        xhr.setRequestHeader('Authorization', `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`);

        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return;
          const currentTotalLoaded = completedBytes + evt.loaded;
          const prog = Math.min(0.99, currentTotalLoaded / file.size);
          useObjectStore.setState((s) => ({
            uploadTasks: s.uploadTasks.map((t) => (t.key === key ? { ...t, progress: prog } : t)),
          }));
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            activeXhr = null;
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resJson = JSON.parse(xhr.responseText);
                resolve(resJson);
              } catch {
                reject(new Error('Invalid response from part upload'));
              }
            } else {
              reject(new Error(xhr.responseText || `Part ${partNumber} failed HTTP ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => {
          activeXhr = null;
          reject(new Error(`Network error on part ${partNumber}`));
        };

        xhr.onabort = () => {
          activeXhr = null;
          reject(new Error('aborted'));
        };

        xhr.send(formData);
      });

      completedBytes += (end - start);
      parts.push({ PartNumber: partResult.partNumber, ETag: partResult.etag });

      const prog = Math.min(0.99, completedBytes / file.size);
      useObjectStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => (t.key === key ? { ...t, progress: prog } : t)),
      }));
    }

    if (aborted) throw new Error('aborted');

    // 3. Hoàn tất Multipart Upload
    const completeRes = await fetch('/api/uploads/multipart/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
      body: JSON.stringify({ key, uploadId, parts }),
    });

    if (!completeRes.ok) {
      const err = (await completeRes.json().catch(() => ({}))) as { error?: string };
      throw new Error(err?.error || 'Failed to complete multipart upload');
    }

    useObjectStore.setState((s) => ({
      uploadTasks: s.uploadTasks.map((t) => (t.key === key ? { ...t, progress: 1, status: 'done' } : t)),
    }));
  } finally {
    activeUploads.delete(key);
  }
}

function abortAll() {
  activeUploads.forEach((item) => {
    try { item.abort(); } catch {}
  });
  activeUploads.clear();
}
