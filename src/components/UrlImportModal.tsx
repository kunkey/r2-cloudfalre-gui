"use client";

import { useState } from "react";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { useObjectStore } from "@/hooks/useObjectStore";
import { buildPublicUrl } from "@/lib/public-url";
import { toast } from "@/lib/toast";
import { Link2, Loader2 } from "lucide-react";

export default function UrlImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const { currentPrefix, fetchObjects, showLinksModal } = useObjectStore();

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Import file from URL">
      <div className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Enter direct URL to download and save directly to your Cloudflare R2 bucket.
        </p>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <Link2 className="w-4 h-4" />
          </div>
          <input
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/[0.1] bg-white dark:bg-[#07090e] text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            placeholder="https://example.com/video.mp4"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button
            variant="secondary"
            className="rounded-xl px-4 py-2 cursor-pointer border border-black/5 dark:border-white/[0.08]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={loading || !url.trim()}
            onClick={async () => {
              try {
                if (!url.trim()) return;
                setLoading(true);

                const uploadRes = await fetch("/api/uploads/direct", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
                  },
                  body: JSON.stringify({
                    url: url.trim(),
                    folder: currentPrefix || "",
                  }),
                });

                if (!uploadRes.ok) {
                  const err = (await uploadRes.json().catch(() => ({}))) as { error?: string };
                  throw new Error(err?.error || "Upload failed");
                }

                const data = (await uploadRes.json()) as { urls?: string[]; uploaded?: string[] };

                // refresh list and clear cache
                await fetchObjects(true);

                const links = data.urls && data.urls.length > 0
                  ? data.urls
                  : (data.uploaded || []).map((key) => buildPublicUrl(key));

                toast.success("URL Imported", "File imported successfully to your bucket");
                showLinksModal(links);
                onClose();
              } catch (error: any) {
                console.error("URL Import failed:", error);
                toast.error("Import failed", error?.message || "Failed to import file from URL");
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-xl px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-medium cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importing...</span>
              </span>
            ) : (
              "Import"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
