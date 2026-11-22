"use client";

import { useState, useEffect } from "react";
import { Folder, Trash2, Check } from "lucide-react";
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
  orderedKeys?: string[];
  onSelectRange?: (orderedKeys: string[], endKey: string) => void;
}

export default function FolderCard({ prefix, variant = 'grid', orderedKeys = [], onSelectRange }: FolderCardProps) {
  const { setCurrentPrefix, deleteFolder, selectedKeys, toggleSelectWithAnchor } = useObjectStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [stats, setStats] = useState<{ count: number; totalSize: number } | null>(null);

  const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
  const isSelected = selectedKeys.includes(normalizedPrefix) || selectedKeys.includes(prefix);

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

  const handleClick = (e: React.MouseEvent) => {
    // Tổ hợp phím Ctrl (hoặc Cmd trên macOS): chọn hoặc bỏ chọn folder
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelectWithAnchor(normalizedPrefix);
      return;
    }

    // Tổ hợp phím Shift: chọn một dải folder/file liên tiếp
    if (e.shiftKey && orderedKeys.length > 0 && onSelectRange) {
      e.preventDefault();
      e.stopPropagation();
      onSelectRange(orderedKeys, normalizedPrefix);
      return;
    }

    // Click bình thường: mở thư mục
    open();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.shiftKey && orderedKeys.length > 0 && onSelectRange) {
      onSelectRange(orderedKeys, normalizedPrefix);
    } else {
      toggleSelectWithAnchor(normalizedPrefix);
    }
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
        className={`flex flex-row items-center gap-2 sm:gap-3 cursor-pointer select-none hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-all group border ${
          isSelected
            ? "ring-2 ring-amber-500 border-amber-500/80 bg-amber-500/[0.06] dark:bg-amber-500/[0.1]"
            : "border-black/5 dark:border-white/[0.08]"
        }`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            open();
          } else if (e.key === " ") {
            e.preventDefault();
            toggleSelectWithAnchor(normalizedPrefix);
          }
        }}
      >
        <CardContent className="flex flex-row items-center gap-2 sm:gap-3 w-full py-2 sm:py-3 px-2 sm:px-4 relative">
          {/* Checkbox chọn folder trên List */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleSelectWithAnchor(normalizedPrefix);
            }}
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer shrink-0 border ${
              isSelected
                ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                : "border-black/20 dark:border-white/20 hover:border-amber-500 dark:hover:border-amber-400 bg-white dark:bg-slate-800 opacity-60 group-hover:opacity-100"
            }`}
            title={isSelected ? "Bỏ chọn" : "Chọn thư mục"}
          >
            <Check className={`w-3.5 h-3.5 ${isSelected ? "opacity-100 stroke-[3]" : "opacity-0"}`} />
          </div>

          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-amber-500/10 dark:bg-amber-500/15 rounded-xl flex items-center justify-center border border-amber-500/20">
            <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 dark:text-amber-400 group-hover:scale-105 transition-transform" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-semibold truncate text-gray-800 dark:text-slate-100 select-text">{name}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 truncate">
              {stats == null
                ? "Loading..."
                : `${formatFileCount(stats.count)} file${stats.count !== 1 ? "s" : ""} · ${formatBytes(stats.totalSize)}`}
            </p>
          </div>
          <button
            onClick={handleDeleteClick}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
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
      className={`flex flex-col cursor-pointer select-none group border transition-all relative ${
        isSelected
          ? "ring-2 ring-amber-500 border-amber-500/80 bg-amber-500/[0.04] dark:bg-amber-500/[0.08] shadow-md shadow-amber-500/10"
          : "border-black/5 dark:border-white/[0.08] hover:border-amber-500/30 dark:hover:border-amber-500/30"
      }`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          open();
        } else if (e.key === " ") {
          e.preventDefault();
          toggleSelectWithAnchor(normalizedPrefix);
        }
      }}
    >
      <CardContent className="flex flex-col items-center justify-center relative p-1.5 sm:p-2">
        {/* Nút Checkbox chọn thư mục ở góc trên bên trái */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleSelectWithAnchor(normalizedPrefix);
          }}
          className={`absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            isSelected
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-100"
              : "bg-black/25 hover:bg-black/45 text-white opacity-0 group-hover:opacity-100 backdrop-blur-md border border-white/20"
          }`}
          title={isSelected ? "Bỏ chọn" : "Chọn thư mục"}
        >
          <Check className={`w-3.5 h-3.5 ${isSelected ? "opacity-100 stroke-[3]" : "opacity-0 group-hover:opacity-70"}`} />
        </div>

        <div className="w-full h-32 sm:h-44 bg-slate-100/70 dark:bg-slate-800/60 rounded-xl mb-2 sm:mb-3 flex flex-col items-center justify-center border border-black/5 dark:border-white/[0.08] group-hover:bg-amber-500/[0.08] dark:group-hover:bg-amber-500/[0.12] transition-colors relative">
          <Folder className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500 dark:text-amber-400 group-hover:scale-105 transition-transform duration-200" />
          <p className="absolute bottom-1.5 sm:bottom-2 left-0 right-0 text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 text-center px-1 truncate">
            {stats == null
              ? "Loading..."
              : `${formatFileCount(stats.count)} file${stats.count !== 1 ? "s" : ""} · ${formatBytes(stats.totalSize)}`}
          </p>
        </div>
        <p className="text-xs sm:text-sm font-semibold truncate w-full text-center text-gray-800 dark:text-slate-100 select-text px-1">
          {name}
        </p>
        <button
          onClick={handleDeleteClick}
          className="absolute top-2 right-2 p-1.5 sm:p-2 rounded-lg bg-black/20 hover:bg-red-500 text-white transition-colors opacity-0 group-hover:opacity-100 backdrop-blur-md"
          title="Delete folder"
        >
          <Trash2 className="w-3.5 h-3.5" />
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
