"use client";

import { useState, useEffect, useRef } from "react";
import { Toast } from "./ui/Toast";
import { Card, CardContent, CardFooter } from "./ui/Card";
import { Link2, Download, Trash2, Loader2 } from "lucide-react";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { useObjectStore } from "@/hooks/useObjectStore";
import moment from "moment";
import { filesize } from "filesize";

interface ItemCardProps {
  object: any;
  variant?: 'grid' | 'list';
  orderedKeys?: string[];
  onSelectRange?: (orderedKeys: string[], endKey: string) => void;
}

export function ItemCard({ object, variant = 'grid', orderedKeys = [], onSelectRange }: ItemCardProps) {

  const [copied, setCopied] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedKeys, toggleSelectWithAnchor, deleteOne, setFocusedKey } = useObjectStore();
  const isSelected = selectedKeys.includes(object.Key);
  const visibleRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const el = visibleRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setIsVisible(true);
        }
      },
      { root: null, rootMargin: "400px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    const loadPreview = async () => {
      setIsLoading(true);
      setImageUrl(null);
      setVideoUrl(null);
      setIsImage(false);
      setIsVideo(false);

      // Check if it's an image or video by file extension and content type
      const imageExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".bmp",
        ".svg",
      ];
      const videoExtensions = [".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"];
      const hasImageExtension = imageExtensions.some((ext) =>
        object.Key?.toLowerCase().endsWith(ext)
      );
      const hasImageContentType = object.ContentType?.startsWith("image/");
      const hasVideoExtension = videoExtensions.some((ext) =>
        object.Key?.toLowerCase().endsWith(ext)
      );
      const hasVideoContentType = object.ContentType?.startsWith("video/");

      const isImg = hasImageExtension || hasImageContentType;
      const isVid = hasVideoExtension || hasVideoContentType;

      if (!(isImg || isVid)) {
        if (!aborted) setIsLoading(false);
        return;
      }
      setIsImage(isImg);
      setIsVideo(isVid);

      // Only load when visible
      if (!isVisible) {
        if (!aborted) setIsLoading(false);
        return;
      }

      try {
        if (isImg) {
          const thumbBase = process.env.NEXT_PUBLIC_THUMBNAIL_URL || "";
          if (thumbBase) {
            const params = new URLSearchParams();
            params.set("key", object.Key);
            params.set("w", "800");
            params.set("h", "800");
            params.set("q", "75");
            params.set("fit", "cover");
            const u = thumbBase.replace(/\/$/, "") + "?" + params.toString();
            if (!aborted) setImageUrl(u);
          } else {
            const link = `${process.env.NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC}/${object.Key}`;
            setImageUrl(link ?? null);
          }
        }

        if (isVideo) {
          const response = await fetch("/api/objects/signed-get", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
            },
            body: JSON.stringify({ key: object.Key }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("failed");
          const data = (await response.json()) as { url?: string };
          if (!aborted) setVideoUrl(data.url ?? null);
        }
      } catch (error) {
        if (!aborted) console.error("Failed to load preview:", error);
      }

      if (!aborted) setIsLoading(false);
    };

    if (object.Key) {
      loadPreview();
    }
    return () => {
      aborted = true;
      try {
        controller.abort();
      } catch {}
    };
  }, [object.Key, object.ContentType, isVisible]);

  const copyLink = async () => {
    try {
      const link = `${process.env.NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC}/${object.Key}`;
      if (link) {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const downloadFile = async () => {
    const filename = object.Key?.split("/").pop() || "file";
    // Always use same-origin endpoint to avoid CORS and force attachment
    try {
      const sameOrigin = `/api/download/file?key=${encodeURIComponent(
        object.Key
      )}`;
      const fileResp = await fetch(sameOrigin, {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
        },
      });
      if (!fileResp.ok) throw new Error("fetch-failed");
      const blob = await fileResp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Last resort: open signed link flow (may open in tab)
      try {
        const res = await fetch("/api/objects/signed-get", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
          },
          body: JSON.stringify({ key: object.Key }),
        });
        const data = (await res.json()) as { url?: string };
        const fallbackUrl = data?.url;
        if (fallbackUrl) {
          const a = document.createElement("a");
          a.href = fallbackUrl;
          a.download = filename;
          a.target = "_blank";
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } catch {}
    }
  };

  const deleteFile = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    await deleteOne(object.Key);
  };

  const openFocus = () => {
    setFocusedKey(object.Key);
  };

  const renderPreview = (compact?: boolean) => {
    if (isLoading) {
      return compact ? (
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      ) : (
        <div className="text-sm text-gray-400">Loading...</div>
      );
    }

    if (isImage && imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={object.Key}
          className="max-h-full max-w-full object-contain rounded"
          onError={() => setImageUrl(null)}
        />
      );
    }

    if (isImage && !imageUrl) {
      return <div className="text-sm text-red-400">Failed to load</div>;
    }

    if (isVideo && videoUrl) {
      return <div className="text-sm text-black-400">Video</div>;
    }

    if (isVideo && !videoUrl) {
      return <div className="text-sm text-red-400">Failed to load</div>;
    }

    return <div className="text-sm text-gray-400">No preview</div>;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.shiftKey && orderedKeys.length > 0 && onSelectRange) {
      onSelectRange(orderedKeys, object.Key);
    } else {
      toggleSelectWithAnchor(object.Key);
    }
  };

  const listRow = (
    <>
      <Card
        className={`flex flex-row items-center gap-3 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
          isSelected ? "ring-2 ring-blue-500" : ""
        }`}
        onClick={() => openFocus()}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            openFocus();
          } else if (e.key === " ") {
            e.preventDefault();
            toggleSelectWithAnchor(object.Key);
          }
        }}
      >
        <CardContent className="flex flex-row items-center gap-3 w-full py-3 px-4">
          <div
            className="w-12 h-12 shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10"
            ref={visibleRef}
          >
            {renderPreview(true)}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200 select-text">
              {object.Key?.split("/").pop() || object.Key}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {object?.LastModified ? moment(object.LastModified).format("MM/DD/YYYY HH:mm") : ""} • {filesize(object.Size)}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); copyLink(); }}
              className="p-2 rounded-md hover:bg-gray-200/70 dark:hover:bg-gray-600/70 transition-colors"
              title="Copy Link"
            >
              <Link2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); downloadFile(); }}
              className="p-2 rounded-md hover:bg-gray-200/70 dark:hover:bg-gray-600/70 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteFile(); }}
              className="p-2 rounded-md hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </CardContent>
        <Toast message="Copied!" show={copied} />
      </Card>
      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete file"
        message={`Delete file "${object.Key?.split("/").pop() || object.Key}"? This action cannot be undone.`}
      />
    </>
  );

  if (variant === 'list') {
    return <>{listRow}</>;
  }

  return (
    <>
      <Card
        className={`flex flex-col cursor-pointer select-none ${
          isSelected ? "ring-2 ring-blue-500" : ""
        }`}
        onClick={() => openFocus()}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            openFocus();
          } else if (e.key === " ") {
            e.preventDefault();
            toggleSelectWithAnchor(object.Key);
          }
        }}
      >
        <CardContent className="flex flex-col items-center justify-center relative">
          <div
            className="w-full h-44 bg-gray-100 dark:bg-gray-700 rounded-xl mb-3 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/10"
            ref={visibleRef}
          >
            {renderPreview()}
          </div>
          <p
            className="text-sm font-medium truncate w-full text-center text-gray-800 dark:text-gray-200 select-text"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {object.Key?.split("/").pop() || object.Key}
          </p>
        </CardContent>
        <CardFooter className="pt-0">
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyLink();
              }}
              className="p-2 rounded-md hover:bg-gray-200/70 dark:hover:bg-gray-600/70 transition-colors"
              title="Copy Link"
            >
              <Link2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadFile();
              }}
              className="p-2 rounded-md hover:bg-gray-200/70 dark:hover:bg-gray-600/70 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteFile();
              }}
              className="p-2 rounded-md hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </CardFooter>
        <Toast message="Copied!" show={copied} />
      </Card>
      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete file"
        message={`Delete file "${object.Key?.split("/").pop() || object.Key}"? This action cannot be undone.`}
      />
    </>
  );
}
