'use client';

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
    <div className="bg-white/80 dark:bg-[#0f172a]/85 backdrop-blur-md border-b border-black/5 dark:border-white/[0.08] transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {showOnlyUploaded && (
          <div className="flex items-center gap-2 py-2 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-xl px-3 mt-2">
            <span className="text-sm text-amber-700 dark:text-amber-300 flex-1 min-w-0 truncate">
              Click to view uploaded files
            </span>
            <Button size="sm" variant="outline" onClick={() => setShowOnlyUploaded(false)} className="cursor-pointer shrink-0">
              View all
            </Button>
          </div>
        )}

        {/* Breadcrumb — cuộn ngang trên mobile */}
        <div className="flex items-center gap-1.5 py-2 overflow-x-auto flex-nowrap scrollbar-thin">
          <button
            onClick={() => navigateTo('')}
            className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition shrink-0"
            title="Home"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Home</span>
          </button>
          {breadcrumbs.map((name, i) => {
            const prefix = breadcrumbs.slice(0, i + 1).join('/') + '/';
            return (
              <span key={prefix} className="cursor-pointer flex items-center gap-1.5 shrink-0">
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-slate-600" />
                <button
                  onClick={() => navigateTo(prefix)}
                  className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 transition max-w-[120px] sm:max-w-[180px]"
                  title={prefix}
                >
                  <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-sm font-medium truncate">{name}</span>
                </button>
              </span>
            );
          })}
        </div>

        {/* Thanh công cụ: cân bằng hai bên, không bao giờ bị đè hay tràn trên mobile */}
        <div className="flex items-center justify-between gap-2 py-2 md:py-3 min-h-[44px] flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {currentPrefix ? (
              <Button
                variant="outline"
                onClick={() => { try { window.history.back(); } catch { } }}
                className="gap-1.5 shrink-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-600 dark:text-slate-300 border-black/5 dark:border-white/[0.08] transition rounded-xl text-xs sm:text-sm py-1.5 px-2.5 sm:py-2 sm:px-3"
                title="Back"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Back</span>
              </Button>
            ) : null}

            <Button
              variant="outline"
              onClick={() => selectAll()}
              className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-600 dark:text-slate-300 border-black/5 dark:border-white/[0.08] transition shrink-0 rounded-xl text-xs sm:text-sm py-1.5 px-2.5 sm:py-2 sm:px-3"
            >
              Select All
            </Button>

            {hasSelection && (
              <>
                <Button
                  variant="outline"
                  onClick={clearSelection}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-600 dark:text-slate-300 border-black/5 dark:border-white/[0.08] transition shrink-0 rounded-xl text-xs sm:text-sm py-1.5 px-2.5 sm:py-2 sm:px-3"
                >
                  Unselect
                </Button>
                <div className="hidden md:block mx-1 h-5 w-px bg-black/10 dark:bg-white/[0.1]" />
                <Button
                  variant="outline"
                  onClick={bulkCopyLinks}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-600 dark:text-slate-300 border-black/5 dark:border-white/[0.08] transition shrink-0 rounded-xl text-xs sm:text-sm py-1.5 px-2.5 sm:py-2 sm:px-3"
                >
                  Copy Links
                </Button>
                <Button
                  variant="outline"
                  onClick={bulkDownload}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-600 dark:text-slate-300 border-black/5 dark:border-white/[0.08] transition shrink-0 rounded-xl text-xs sm:text-sm py-1.5 px-2.5 sm:py-2 sm:px-3"
                >
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={!hasSelection}
                  className="cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 border-red-500/20 transition shrink-0 rounded-xl text-xs sm:text-sm py-1.5 px-2.5 sm:py-2 sm:px-3"
                >
                  Delete ({selectedKeys.length})
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-auto">
            {/* Bộ chọn số item/trang — chỉ hiện trên sm trở lên */}
            <div className="hidden sm:flex items-center gap-2">
              <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Show</label>
              <select
                className="text-xs sm:text-sm border border-black/10 dark:border-white/20 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-200 cursor-pointer"
                value={gridLimit}
                onChange={(e) => setGridLimit(Number(e.target.value))}
              >
                <option value={24}>24</option>
                <option value={48}>48</option>
                <option value={96}>96</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={2000}>2000</option>
                <option value={5000}>5000</option>
                <option value={10000}>10.000</option>
              </select>
            </div>

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
