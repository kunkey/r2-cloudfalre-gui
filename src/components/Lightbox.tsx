"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useObjectStore } from "@/hooks/useObjectStore";

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"];

interface LightboxProps {
  orderedKeys: string[];
  objects: any[];
}

export function Lightbox({ orderedKeys, objects }: LightboxProps) {
  const { focusedKey, setFocusedKey } = useObjectStore();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentIndex = focusedKey ? orderedKeys.indexOf(focusedKey) : -1;
  const currentObject = focusedKey ? objects.find((o: any) => o.Key === focusedKey) : null;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < orderedKeys.length - 1;

  useEffect(() => {
    if (!focusedKey || !currentObject) return;
    let aborted = false;
    setLoading(true);
    setImageUrl(null);
    setVideoUrl(null);
    setIsImage(false);
    setIsVideo(false);

    const hasImageExt = IMAGE_EXT.some((ext) =>
      (currentObject.Key || "").toLowerCase().endsWith(ext)
    );
    const hasImageContent = (currentObject.ContentType || "").startsWith("image/");
    const hasVideoExt = VIDEO_EXT.some((ext) =>
      (currentObject.Key || "").toLowerCase().endsWith(ext)
    );
    const hasVideoContent = (currentObject.ContentType || "").startsWith("video/");
    const isImg = hasImageExt || hasImageContent;
    const isVid = hasVideoExt || hasVideoContent;

    const load = async () => {
      setIsImage(isImg);
      setIsVideo(isVid);
      try {
        if (isImg) {
          const thumbBase = process.env.NEXT_PUBLIC_THUMBNAIL_URL || "";
          if (thumbBase) {
            const params = new URLSearchParams();
            params.set("key", currentObject.Key);
            params.set("w", "1200");
            params.set("h", "1200");
            params.set("q", "85");
            params.set("fit", "contain");
            const u = thumbBase.replace(/\/$/, "") + "?" + params.toString();
            if (!aborted) setImageUrl(u);
          } else {
            const link = `${process.env.NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC}/${currentObject.Key}`;
            if (!aborted) setImageUrl(link || null);
          }
        }
        if (isVid) {
          const res = await fetch("/api/objects/signed-get", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
            },
            body: JSON.stringify({ key: currentObject.Key }),
          });
          if (!res.ok) throw new Error("failed");
          const data = (await res.json()) as { url?: string };
          if (!aborted) setVideoUrl(data.url ?? null);
        }
      } catch (e) {
        if (!aborted) console.error("Lightbox load failed:", e);
      }
      if (!aborted) setLoading(false);
    };
    load();
    return () => {
      aborted = true;
    };
  }, [focusedKey, currentObject?.Key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!focusedKey) return;
      if (e.key === "Escape") setFocusedKey(null);
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        setFocusedKey(orderedKeys[currentIndex - 1]);
      }
      if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        setFocusedKey(orderedKeys[currentIndex + 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedKey, hasPrev, hasNext, currentIndex, orderedKeys, setFocusedKey]);

  if (!focusedKey) return null;

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPrev) setFocusedKey(orderedKeys[currentIndex - 1]);
  };
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNext) setFocusedKey(orderedKeys[currentIndex + 1]);
  };
  const close = () => setFocusedKey(null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={close}
    >
      {/* Prev arrow */}
      {hasPrev && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Content */}
      <div
        className="max-w-5xl w-full max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full h-[70vh] bg-black rounded-xl overflow-hidden flex items-center justify-center">
          {loading && <div className="text-white/80">Loading...</div>}
          {!loading && isImage && imageUrl && (
            <img
              src={imageUrl}
              alt={currentObject?.Key}
              className="max-w-full max-h-full object-contain"
            />
          )}
          {!loading && isVideo && videoUrl && (
            <video
              src={videoUrl}
              className="max-w-full max-h-full object-contain"
              controls
              autoPlay
              playsInline
            />
          )}
          {!loading && !isImage && !isVideo && (
            <div className="text-white/80">No preview</div>
          )}
        </div>
      </div>

      {/* Next arrow */}
      {hasNext && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}
