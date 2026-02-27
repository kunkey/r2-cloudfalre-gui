"use client";

import { useState, useEffect } from "react";
import { Folder, Trash2 } from "lucide-react";
import { Card, CardContent } from "./ui/Card";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { useObjectStore } from "@/hooks/useObjectStore";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatFileCount(n: number): string {
  return n.toLocaleString('de-DE'); // 16443 -> "16.443"
}

interface FolderCardProps {
  prefix: string; // e.g. photos/ or photos/2024/
  variant?: 'grid' | 'list';
}

export default function FolderCard({ prefix, variant = 'grid' }: FolderCardProps) {
  const { setCurrentPrefix, deleteFolder } = useObjectStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [stats, setStats] = useState<{ count: number; totalSize: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/folders/stats?prefix=${encodeURIComponent(prefix)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: unknown) => {
        const d = data as { count?: number; totalSize?: number } | null;
        if (!cancelled && d && typeof d.count === 'number' && typeof d.totalSize === 'number') {
          setStats({ count: d.count, totalSize: d.totalSize });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [prefix]);

  const name = (() => {
    const p = prefix.replace(/\/+$/, "");
    const parts = p.split("/");
    return parts[parts.length - 1] || p;
  })();

  const open = () => {
    const next = prefix;
    // push URL state so mouse back navigates correctly
    try {
      const url = new URL(window.location.href);
      url.searchParams.set(
        "prefix",
        next.replace(/\/+$/, "").replace(/^\/+/, "")
      );
      window.history.pushState({ prefix: next }, "", url.toString());
    } catch {}
    setCurrentPrefix(next);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    await deleteFolder(prefix);
  };

  if (variant === 'list') {
    return (
      <>
      <Card
        className="flex flex-row items-center gap-3 cursor-pointer select-none hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-colors group"
        onClick={open}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
      >
        <CardContent className="flex flex-row items-center gap-3 w-full py-3 px-4">
          <div className="w-10 h-10 shrink-0 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center border border-black/5 dark:border-white/10">
            <Folder className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200 select-text">{name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {stats == null
                ? "Đang tải..."
                : `${formatFileCount(stats.count)} file${stats.count !== 1 ? "s" : ""} · ${formatBytes(stats.totalSize)}`}
            </p>
          </div>
          <button
            onClick={handleDeleteClick}
            className="p-2 rounded-md hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
            title="Delete folder"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </CardContent>
      </Card>
      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete folder"
        message={`Delete folder "${name}"? All files inside will be deleted permanently.`}
      />
    </>
    );
  }

  return (
    <>
    <Card
      className="flex flex-col cursor-pointer select-none group"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <CardContent className="flex flex-col items-center justify-center relative">
        <div className="w-full h-44 bg-amber-50 dark:bg-amber-900/30 rounded-xl mb-3 flex flex-col items-center justify-center border border-black/5 dark:border-white/10 relative">
          <Folder className="w-12 h-12 text-amber-500 dark:text-amber-400" />
          <p className="absolute bottom-2 left-0 right-0 text-xs text-gray-500 dark:text-gray-400 text-center">
            {stats == null
              ? "Getting..."
              : `${formatFileCount(stats.count)} file${stats.count !== 1 ? "s" : ""} · ${formatBytes(stats.totalSize)}`}
          </p>
        </div>
        <p className="text-sm font-medium truncate w-full text-center text-gray-800 dark:text-gray-200 select-text">
          {name}
        </p>
        <button
          onClick={handleDeleteClick}
          className="absolute top-2 right-2 p-2 rounded-md hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete folder"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </CardContent>
    </Card>
    <ConfirmDeleteModal
      open={showDeleteModal}
      onClose={() => setShowDeleteModal(false)}
      onConfirm={handleConfirmDelete}
      title="Delete folder"
      message={`Delete folder "${name}"? All files inside will be deleted permanently.`}
    />
    </>
  );
}
