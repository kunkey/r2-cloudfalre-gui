'use client';

import { useEffect } from 'react';
import { sileo } from 'sileo';

interface ToastProps {
  message: string;
  show: boolean;
}

export function Toast({ message, show }: ToastProps) {
  useEffect(() => {
    if (show && message) {
      sileo.success({ title: message });
    }
  }, [show, message]);

  return null;
}
