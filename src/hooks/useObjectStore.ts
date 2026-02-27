import { create } from 'zustand';

interface ObjectState {
  objects: any[];
  prefixes: string[]; // folder names (CommonPrefixes)
  selectedKeys: string[];
  searchQuery: string;
  gridLimit: number;
  currentPrefix: string; // path we are viewing
  fetchObjects: () => Promise<void>;
  loadMoreObjects: () => Promise<void>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
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
  startDnDUpload: (entries: { file: File; relativePath: string }[], dirPaths: string[]) => Promise<void>;
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

  fetchObjects: async () => {
    const limit = get().gridLimit;
    const prefix = get().currentPrefix;
    set({ isLoading: true, hasMore: false });
    const q = new URLSearchParams();
    q.set('limit', String(limit));
    if (prefix) q.set('prefix', prefix);
    const res = await fetch(`/api/objects?${q.toString()}` , {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
    });
    const data = (await res.json()) as any;
    set({ 
      objects: data.Contents || [],
      prefixes: (data.CommonPrefixes || []).map((p: any) => p.Prefix).filter(Boolean),
      isLoading: false,
      hasMore: Boolean(data.IsTruncated && data.NextContinuationToken),
    });
    // Stash continuation token in a module-scoped place via closure
    (useObjectStore as any)._nextToken = data.NextContinuationToken || undefined;
  },

  loadMoreObjects: async () => {
    if (get().isLoadingMore || !get().hasMore) return;
    const limit = get().gridLimit;
    const prefix = get().currentPrefix;
    const token = (useObjectStore as any)._nextToken as string | undefined;
    if (!token) return;
    set({ isLoadingMore: true });
    const q = new URLSearchParams();
    q.set('limit', String(limit));
    if (prefix) q.set('prefix', prefix);
    q.set('continuationToken', token);
    const res = await fetch(`/api/objects?${q.toString()}` , {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
    });
    const data = (await res.json()) as any;
    set((state) => ({
      objects: [...(state.objects || []), ...(data.Contents || [])],
      // prefixes only matter from the first page; keep as-is
      isLoadingMore: false,
      hasMore: Boolean(data.IsTruncated && data.NextContinuationToken),
    }));
    (useObjectStore as any)._nextToken = data.NextContinuationToken || undefined;
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),
  setGridLimit: (n: number) => set({ gridLimit: n }),
  setCurrentPrefix: (p: string) => {
    const next = p.replace(/^\/+|\/+$/g, '') ? p.replace(/^\/+|\/+$/g, '') + '/' : '';
    set({ currentPrefix: next, selectedKeys: [], lastSelectedKey: null });
  },
  setViewMode: (m: 'grid' | 'list') => set({ viewMode: m }),
  setSortOrder: (o: 'newest' | 'oldest') => set({ sortOrder: o }),
  goUp: () => {
    const cur = get().currentPrefix;
    if (!cur) return;
    const parts = cur.replace(/\/+$/,'').split('/');
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
      throw new Error(message);
    }
    await get().fetchObjects();
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
      uploadTasks: state.uploadTasks.map((t) => ({ ...t, status: t.status === 'done' ? t.status : 'canceled' })),
    }));
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
    await fetch('/api/objects', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
      body: JSON.stringify({ keys }),
    });
    // Optimistically remove deleted keys from local objects
    const remaining = get().objects.filter((o: any) => !keys.includes(o.Key));
    set({ objects: remaining, selectedKeys: [] });
  },

  deleteOne: async (key: string) => {
    if (!key) return;
    await fetch('/api/objects', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
      body: JSON.stringify({ keys: [key] }),
    });
    const remaining = get().objects.filter((o: any) => o.Key !== key);
    const remainingSelected = get().selectedKeys.filter((k) => k !== key);
    set({ objects: remaining, selectedKeys: remainingSelected });
  },

  deleteFolder: async (prefix: string) => {
    if (!prefix) return;
    const res = await fetch('/api/folders', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
      body: JSON.stringify({ prefix }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      throw new Error(err?.error || 'Failed to delete folder');
    }
    await get().fetchObjects();
  },

  bulkDownload: async () => {
    const keys = get().selectedKeys;
    if (keys.length === 0) return;
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
      body: JSON.stringify({ keys }),
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
  },

  bulkCopyLinks: async () => {
    const keys = get().selectedKeys;
    if (keys.length === 0) return;
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
      },
      body: JSON.stringify({ keys }),
    });
    const { links } = (await res.json()) as { links?: string[] };
    set({ linksModalOpen: true, modalLinks: links || [] });
  },
}));

// ---- Upload helpers (module scope, use get()/set()) ----

type Store = ReturnType<typeof useObjectStore.getState>;

const uploadControllers = new Map<string, XMLHttpRequest>();
const fileBlobs = new Map<string, File>();

async function enqueueUploads(entries: { file: File; relativePath: string }[], dirPaths?: string[]) {
  const { currentPrefix } = useObjectStore.getState();
  const normalizedBase = (currentPrefix || '').replace(/^\/+|\/+$/g, '');
  const base = normalizedBase ? normalizedBase + '/' : '';

  // Compute intended keys
  let tasks: UploadTask[] = entries.map(({ file, relativePath }) => {
    const rel = String(relativePath || file.name).replace(/^\/+/, '');
    const key = base + rel.replace(/\\/g, '/');
    return { key, name: rel, size: file.size, progress: 0, status: 'queued' as UploadStatus };
  });

  // Collision check
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
    } else {
      // overwrite -> nothing to change
    }
  }

  if (!tasks.length) return;

  // Stash original files mapped to final task keys
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
      fileBlobs.set(t.key, f); // also cache for retries
    }
  }

  const state = useObjectStore.getState();
  useObjectStore.setState({ uploadTasks: [...state.uploadTasks, ...tasks], uploadOpen: true });
  runQueue(fileMap);

  // Create empty directory markers (only for dropped directories with no files)
  if (Array.isArray(dirPaths) && dirPaths.length) {
    const fileKeys = tasks.map((t) => t.key);
    for (const dir of dirPaths) {
      const rel = String(dir).replace(/^\/+|\/+$/g, '');
      if (!rel) continue;
      const full = base + rel + '/';
      const hasFile = fileKeys.some((k) => k.startsWith(full));
      if (!hasFile) {
        // Derive parent and name for API
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

async function promptCollisionChoice(): Promise<{ policy: 'overwrite' | 'skip' | 'rename' }>
{
  // Minimal prompt for Phase 1. Could be replaced with a nice modal.
  const msg = 'Some files already exist. Type one of: overwrite, skip, rename';
  // eslint-disable-next-line no-alert
  let input = window.prompt(msg) || '';
  input = input.toLowerCase();
  if (input.startsWith('s')) return { policy: 'skip' };
  if (input.startsWith('r')) return { policy: 'rename' };
  return { policy: 'overwrite' };
}

function runQueue(fileMap?: Map<string, File>) {
  const concurrency = 5;
  let active = 0;

  const pump = () => {
    const { uploadTasks } = useObjectStore.getState();
    if (!uploadTasks.some((t) => t.status === 'queued' || t.status === 'uploading')) {
      // done - refresh the grid and store keys of uploaded files for filter
      const doneKeys = uploadTasks.filter((t) => t.status === 'done').map((t) => t.key);
      const { fetchObjects } = useObjectStore.getState();
      useObjectStore.setState({ recentlyUploadedKeys: doneKeys });
      fetchObjects();
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
      // mark uploading
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
          // tick
          setTimeout(pump, 0);
        });
    }
  };
  pump();
}

function uploadOne(file: File, key: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('key', key);
    const xhr = new XMLHttpRequest();
    uploadControllers.set(key, xhr);
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
        uploadControllers.delete(key);
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => {
      uploadControllers.delete(key);
      reject(new Error('Network error'));
    };
    xhr.onabort = () => {
      uploadControllers.delete(key);
      useObjectStore.setState((s) => ({
        uploadTasks: s.uploadTasks.map((t) => (t.key === key ? { ...t, status: 'canceled' } : t)),
      }));
      reject(new Error('aborted'));
    };
    xhr.send(form);
  });
}

function abortAll() {
  uploadControllers.forEach((xhr) => {
    try { xhr.abort(); } catch {}
  });
  uploadControllers.clear();
}
