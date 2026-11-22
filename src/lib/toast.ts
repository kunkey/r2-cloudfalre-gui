'use client';

import { sileo } from 'sileo';

const DARK_TOAST_FILL = '#161e31';

export const toast = {
  success: (title: string, description?: string, duration?: number) => {
    return sileo.success({
      title,
      description,
      duration: duration ?? 3500,
      fill: DARK_TOAST_FILL,
    });
  },
  error: (title: string, description?: string, duration?: number) => {
    return sileo.error({
      title,
      description,
      duration: duration ?? 4500,
      fill: DARK_TOAST_FILL,
    });
  },
  info: (title: string, description?: string, duration?: number) => {
    return sileo.info({
      title,
      description,
      duration: duration ?? 3500,
      fill: DARK_TOAST_FILL,
    });
  },
  warning: (title: string, description?: string, duration?: number) => {
    return sileo.warning({
      title,
      description,
      duration: duration ?? 4000,
      fill: DARK_TOAST_FILL,
    });
  },
  raw: sileo,
};
