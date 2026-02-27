"use client";

import { useObjectStore } from '@/hooks/useObjectStore';
import { Button } from './ui/Button';
import { Check } from 'lucide-react';
import { filesize } from 'filesize';

function formatSize(bytes: number): string {
  return String(filesize(bytes, { base: 2 }));
}

export default function UploadManager() {
  const { uploadOpen, uploadTasks, cancelAllUploads, retryFailed, hideUploadPanel, setShowOnlyUploaded } = useObjectStore();
  if (!uploadOpen) return null;
  const total = uploadTasks.length;
  const done = uploadTasks.filter((t) => t.status === 'done').length;
  const failed = uploadTasks.filter((t) => t.status === 'error').length;
  const uploading = uploadTasks.filter((t) => t.status === 'uploading').length;
  // Overall progress: done/error/canceled count as complete; uploading uses live progress
  const overall = total
    ? uploadTasks.reduce((acc, t) => {
        if (t.status === 'done' || t.status === 'error' || t.status === 'canceled') return acc + 1;
        if (t.status === 'uploading') return acc + Math.max(0, Math.min(1, t.progress || 0));
        return acc; // queued -> 0
      }, 0) / total
    : 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,420px)] rounded-xl bg-white/90 dark:bg-gray-800/95 backdrop-blur border border-black/10 dark:border-white/10 shadow-xl">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Uploads Progress  </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{done}/{total} done • {uploading} running • {failed} failed</div>
        </div>
        <div className="flex items-center gap-2">
          {failed > 0 && (
            <Button size="sm" variant="outline" onClick={retryFailed} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">Retry</Button>
          )}  
          {uploading > 0 && (
            <Button size="sm" variant="outline" onClick={cancelAllUploads} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">Cancel</Button>
          )}
          {done > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowOnlyUploaded(true)} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">Click to view uploaded files</Button>
              <Button size="sm" variant="outline" onClick={hideUploadPanel} className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">Hide</Button>
            </>
          )}
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div
            className={`h-full transition-[width] duration-300 ease-out ${
              uploading > 0
                ? 'bg-amber-400 dark:bg-amber-500 upload-progress-stripes'
                : 'bg-blue-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, overall * 100))}%` }}
          />
        </div>
      </div>
      <div className="max-h-64 overflow-auto px-2 pb-2">
        {uploadTasks.slice(-8).map((t) => {
          const totalBytes = t.size || 0;
          const uploadedBytes = Math.round((t.progress || 0) * totalBytes);
          return (
            <div key={t.key} className="flex flex-col gap-0.5 px-2 py-1.5 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-300" title={t.name}>{t.name}</div>
                <div className="shrink-0 flex items-center gap-1">
                  {t.status === 'done' ? (
                    <Check className="w-4 h-4 text-blue-500" />
                  ) : t.status === 'uploading' ? (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{Math.round((t.progress || 0) * 100)}%</span>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t.status}</span>
                  )}
                </div>
              </div>
              {(t.status === 'uploading' || t.status === 'queued' || t.status === 'done') && totalBytes > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t.status === 'uploading'
                    ? `${formatSize(uploadedBytes)} / ${formatSize(totalBytes)}`
                    : formatSize(totalBytes)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

