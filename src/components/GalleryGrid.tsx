'use client';

import { useObjectStore } from '@/hooks/useObjectStore';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';

import { ItemCard } from './ItemCard';
import FolderCard from './FolderCard';
import { Lightbox } from './Lightbox';
import { Pagination } from './Pagination';
import { Loader2 } from 'lucide-react';
import { traverseDataTransferItems } from '@/lib/dnd';

export function GalleryGrid() {
  const {
    objects,
    prefixes,
    fetchObjects,
    page,
    searchQuery,
    currentPrefix,
    startDnDUpload,
    isLoading,
    isLoadingMore,
    viewMode,
    sortOrder,
    setDisplayOrderedKeys,
    selectRange,
    toggleSelectAll,
    showOnlyUploaded,
    recentlyUploadedKeys,
  } = useObjectStore();
  const [dragOver, setDragOver] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchObjects();
  }, [fetchObjects, currentPrefix]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(prev => prev + 1);
    if (e.dataTransfer.types?.includes('Files')) {
      setDragOver(true);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(prev => {
      const newDepth = prev - 1;
      if (newDepth === 0) {
        setDragOver(false);
      }
      return newDepth;
    });
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    try {
      const items = e.dataTransfer.items;
      const { files, dirs } = await traverseDataTransferItems(items);
      if (files.length === 0) return;
      await startDnDUpload(files as any, dirs);
    } catch (err) {
      console.error('Drop failed', err);
    }
  }, [startDnDUpload]);

  const filtered = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();

    // Loại bỏ thư mục: Key kết thúc "/"
    let filesOnly = objects.filter((o: any) => {
      return !o.Key.endsWith('/');
    });

    // Chỉ hiển thị file vừa upload
    if (showOnlyUploaded && recentlyUploadedKeys.length > 0) {
      const keySet = new Set(recentlyUploadedKeys);
      filesOnly = filesOnly.filter((o: any) => keySet.has(o.Key));
    }

    if (q) {
      filesOnly = filesOnly.filter((o: any) =>
        (o.Key || '').toLowerCase().includes(q)
      );
    }

    // Sort theo LastModified (R2/S3 không hỗ trợ sort phía server, sort client-side)
    const sorted = [...filesOnly].sort((a: any, b: any) => {
      const dateA = a.LastModified ? new Date(a.LastModified).getTime() : 0;
      const dateB = b.LastModified ? new Date(b.LastModified).getTime() : 0;
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return sorted;
  }, [objects, searchQuery, sortOrder, showOnlyUploaded, recentlyUploadedKeys]);

  const orderedKeys = useMemo(() => filtered.map((o: any) => o.Key).filter(Boolean), [filtered]);

  useEffect(() => {
    setDisplayOrderedKeys(orderedKeys);
  }, [orderedKeys, setDisplayOrderedKeys]);

  // Cuộn lên đầu khi chuyển trang (bỏ qua lần mount đầu tiên)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const el = gridRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [page]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        toggleSelectAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSelectAll]);

  const isEmpty = !isLoading && filtered.length === 0 && prefixes.length === 0;

  return (
    <div
      id="grid-dropzone"
      ref={gridRef}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative scroll-mt-4"
    >
      {dragOver && (
        <div className="absolute inset-0 z-10 rounded-xl border-2 border-dashed border-blue-400 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 font-medium pointer-events-none">
          Drop to upload into {currentPrefix || '/'}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-12 h-12 text-amber-500 dark:text-amber-400 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải thư mục...</p>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 gap-2 text-center px-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {searchQuery?.trim()
              ? 'Không tìm thấy kết quả nào'
              : 'Thư mục này trống'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {searchQuery?.trim()
              ? 'Thử từ khoá khác hoặc xoá bộ lọc'
              : 'Kéo thả file vào đây để upload'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col gap-2">
          {!showOnlyUploaded && prefixes.map((p) => (
            <FolderCard key={p} prefix={p.replace(/^\/+/, '')} variant="list" />
          ))}
          {filtered.map((object: any) => (
            <ItemCard key={object.Key} object={object} variant="list" orderedKeys={orderedKeys} onSelectRange={selectRange} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-5 grid-cols-2 md:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {!showOnlyUploaded && prefixes.map((p) => (
            <FolderCard key={p} prefix={p.replace(/^\/+/, '')} />
          ))}
          {filtered.map((object: any) => (
            <ItemCard key={object.Key} object={object} orderedKeys={orderedKeys} onSelectRange={selectRange} />
          ))}
        </div>
      )}

      {/* Overlay khi đang tải trang mới (giữ layout không nhảy) */}
      {isLoadingMore && (
        <div className="flex items-center justify-center py-8 gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          Đang tải trang tiếp theo...
        </div>
      )}

      {/* Thanh phân trang */}
      {!isLoading && <Pagination />}

      <Lightbox orderedKeys={orderedKeys} objects={filtered} />
    </div>
  );
}
