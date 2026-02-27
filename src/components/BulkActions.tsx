"use client";

import { useState } from 'react';
import { useObjectStore } from '@/hooks/useObjectStore';
import { Button } from './ui/Button';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { StorageQuotaBar } from './StorageQuotaBar';
import { ArrowLeft, Home, Folder, ChevronRight } from 'lucide-react';

export function BulkActions() {
  const {
    selectedKeys,
    selectAll,
    clearSelection,
    bulkCopyLinks,
    bulkDownload,
    bulkDelete,
    gridLimit,
    setGridLimit,
    currentPrefix,
    setCurrentPrefix,
    showOnlyUploaded,
    setShowOnlyUploaded,
  } = useObjectStore();

  const hasSelection = selectedKeys.length > 0;
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const breadcrumbs = (() => {
    const p = (currentPrefix || '').replace(/^\/+|\/+$/g, '');
    if (!p) return [];
    return p.split('/').filter(Boolean);
  })();

  const navigateTo = (prefix: string) => {
    const normalized = prefix ? prefix.replace(/^\/+|\/+$/g, '') + '/' : '';
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('prefix', normalized.replace(/\/+$/, ''));
      window.history.pushState({ prefix: normalized }, '', url.toString());
    } catch {}
    setCurrentPrefix(normalized);
  };

  return (
    <div className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-md border-b border-black/5 dark:border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {showOnlyUploaded && (
          <div className="flex items-center gap-2 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 mb-2">
            <span className="text-sm text-amber-800 dark:text-amber-200">Click to view uploaded files</span>
            <Button size="sm" variant="outline" onClick={() => setShowOnlyUploaded(false)} className="cursor-pointer shrink-0">
              View all
            </Button>
          </div>
        )}
        <div className="flex items-center gap-1.5 py-2 min-h-0 overflow-x-auto flex-nowrap scrollbar-thin">
          <button
            onClick={() => navigateTo('')}
            className="cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition shrink-0"
            title="Home"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">Home</span>
          </button>
          {breadcrumbs.map((name, i) => {
            const prefix = breadcrumbs.slice(0, i + 1).join('/') + '/';
            return (
              <span key={prefix} className="cursor-pointer flex items-center gap-1.5 shrink-0">
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <button
                  onClick={() => navigateTo(prefix)}
                  className="cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition max-w-[180px]"
                  title={prefix}
                >
                  <Folder className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium truncate">{name}</span>
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex flex-nowrap gap-2 items-center h-16 flex-nowrap scrollbar-thin">
          {currentPrefix ? (
            <Button
              variant="outline"
              onClick={() => { try { window.history.back(); } catch { } }}
              className="gap-2 shrink-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => selectAll()} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">Select All</Button>
          {hasSelection && (
            <>
              <Button variant="outline" onClick={clearSelection} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">Unselect</Button>
              <div className="mx-2 h-6 w-px bg-black/10 dark:bg-white/20" />
              <Button variant="outline" onClick={bulkCopyLinks} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">Copy Links</Button>
              <Button variant="outline" onClick={bulkDownload} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">Download</Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                disabled={!hasSelection}
                className="font-semibold text-white bg-red-500 hover:bg-red-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
              >
                Delete
              </Button>
            </>
          )}
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            {hasSelection ? `${selectedKeys.length}  selected` : null}
          </span>
          <div className="mx-2 h-6 w-px bg-black/10 dark:bg-white/20" />
          <label className="text-sm text-gray-600 dark:text-gray-400">Show</label>
          <select
            className="text-sm border border-black/10 dark:border-white/20 rounded-md px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-200"
            value={gridLimit}
            onChange={(e) => setGridLimit(Number(e.target.value))}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
            <option value={2000}>2000</option>
            <option value={5000}>5000</option>
            <option value={10000}>10.000</option>
          </select>
          <div className="flex-1 min-w-0 flex justify-end pl-4">
            <StorageQuotaBar />
          </div>
        </div>
      </div>
      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={bulkDelete}
        title="Delete multiple files"
        message={`Delete ${selectedKeys.length.toLocaleString('de-DE')} selected files? This action cannot be undone.`}
      />
    </div>
  );
}


