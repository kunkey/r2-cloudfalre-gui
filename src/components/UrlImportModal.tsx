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
        className="w-full border px-3 py-2 rounded mb-4"
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

              // 1. Fetch file
              const res = await fetch("/api/fetch-file", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
                },
                body: JSON.stringify({ url }),
              });

              if (!res.ok) throw new Error("Failed to fetch external file");

              const blob = await res.blob();

              // 2. Generate filename
              const ext = blob.type.split("/")[1] || "bin";
              const fileName = `import-${Date.now()}.${ext}`;

              const file = new File([blob], fileName, { type: blob.type });

              // 3. Upload to R2
              const formData = new FormData();
              const base = currentPrefix || "";
              const key = `${base}${file.name}`;

              formData.append("file", file);
              formData.append("key", key);

              const uploadRes = await fetch("/api/uploads/direct", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
                },
                body: formData,
              });

              if (!uploadRes.ok) throw new Error("Upload failed");

              // refresh list upload
              await fetchObjects();

              // 4. Get signed link
              const linkRes = await fetch('/api/objects/signed-get', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${process.env.NEXT_PUBLIC_APP_PASSWORD}`,
                },
                body: JSON.stringify({ key: key }),
                signal: controller.signal,
              });
              if (!linkRes.ok) throw new Error('failed');
              
              const data = (await linkRes.json()) as { url?: string };
              const links = data.url ? [data.url] : [];
              showLinksModal(links);
              
              
              onClose();
            } catch (err) {
              console.error(err);
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
