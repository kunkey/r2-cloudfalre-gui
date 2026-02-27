'use client';

import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';

const GB = 1024 * 1024 * 1024;
const DEFAULT_LIMIT_GB = 10; // R2 free tier

function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

export function StorageQuotaBar() {
  const [usage, setUsage] = useState<{ totalSize: number; objectCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/r2/usage', {
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
          },
        });
        if (cancelled) return;
        if (!res.ok) {
          setError('Không thể tải');
          return;
        }
        const data = (await res.json()) as { totalSize: number; objectCount: number };
        setUsage(data);
        setError(null);
      } catch {
        if (!cancelled) setError('Lỗi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUsage();
    const interval = setInterval(fetchUsage, 60000); // refresh mỗi phút
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const limitGb = process.env.NEXT_PUBLIC_R2_STORAGE_LIMIT_GB
    ? parseFloat(process.env.NEXT_PUBLIC_R2_STORAGE_LIMIT_GB)
    : DEFAULT_LIMIT_GB;
  const limitBytes = (Number.isNaN(limitGb) ? DEFAULT_LIMIT_GB : limitGb) * GB;

  if (loading) {
    return (
      <div className="flex items-center gap-2 min-w-[140px]">
        <Database className="w-4 h-4 text-gray-400 dark:text-gray-500 animate-pulse" />
        <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" />
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="flex items-center gap-2 min-w-[100px]" title={error || 'Không có dữ liệu'}>
        <Database className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span className="text-xs text-gray-500 dark:text-gray-400">{error || '—'}</span>
      </div>
    );
  }

  const percent = Math.min(100, (usage.totalSize / limitBytes) * 100);
  const isOverLimit = usage.totalSize > limitBytes;

  return (
    <div
      className="flex items-center gap-2 min-w-[200px] max-w-[260px]"
      title={`${formatBytes(usage.totalSize)} / ${formatBytes(limitBytes)} • ${usage.objectCount} objects`}
    >
      <Database className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverLimit
                ? 'bg-red-500 dark:bg-red-600'
                : percent > 80
                  ? 'bg-amber-500 dark:bg-amber-500'
                  : 'bg-blue-500 dark:bg-blue-600'
            }`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400 shrink-0 tabular-nums whitespace-nowrap">
        {formatBytes(usage.totalSize)} / {formatBytes(limitBytes)}
      </span>
    </div>
  );
}
