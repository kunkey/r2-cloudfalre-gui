"use client";
import { useState } from "react";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { useObjectStore } from "@/hooks/useObjectStore";

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
  const controller = new AbortController();

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Import file from URL">
      <input
        className="w-full border border-black/10 dark:border-white/20 px-3 py-2 rounded mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
        placeholder="Paste file URL here..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <div className="flex justify-end gap-3">
        <Button
          variant="secondary"
          className="rounded-full p-2 bg-gray-500 text-white transition"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          disabled={loading}
          onClick={async () => {
            try {
              if (url == "" || url == null) return;
              setLoading(true);

              // Upload directly via server endpoint which detects magic bytes and preserves extensions
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

              // refresh list upload
              await fetchObjects();

              // Public link for popup
              const links = data.urls && data.urls.length > 0
                ? data.urls
                : (data.uploaded || []).map((key) => {
                    const base = (process.env.NEXT_PUBLIC_CLOUDFLARE_BUCKET_URL_PUBLIC || "").replace(/\/+$/, "");
                    return base ? `${base}/${key.replace(/^\/+/, "")}` : `/${key}`;
                  });

              showLinksModal(links);
              onClose();
            } catch (error: any) {
              console.error("URL Import failed:", error);
              alert(error?.message || "Failed to import file from URL");
            } finally {
              setLoading(false);
            }
          }}
          className="rounded-full p-2 bg-gray-500 text-white transition"
        >
          {loading ? "Processing..." : "Import"}
        </Button>
      </div>
    </Modal>
  );
}
