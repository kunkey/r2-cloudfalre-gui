"use client";

import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: string;
  confirmLabel?: string;
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title = "Confirm delete",
  message,
  confirmLabel = "Delete",
}: ConfirmDeleteModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
      alert((err as Error)?.message || "Cannot delete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleConfirm}
            disabled={loading}
            className="font-semibold text-white bg-red-500 hover:bg-red-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Deleting..." : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-gray-600 dark:text-gray-300">{message}</p>
    </Modal>
  );
}
