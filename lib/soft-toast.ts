import type { CSSProperties, ReactNode } from 'react';
import { toast as baseToast } from 'sonner';

type ToastOptions = Parameters<typeof baseToast.success>[1];

type SoftToastOptions = ToastOptions & {
  style?: CSSProperties;
};

const softStyle = (colorVar: string): CSSProperties => ({
  '--normal-bg': `color-mix(in oklab, var(${colorVar}) 10%, var(--background))`,
  '--normal-text': `var(${colorVar})`,
  '--normal-border': `var(${colorVar})`,
} as CSSProperties);

const softSuccessStyle = (): CSSProperties => ({
  '--normal-bg':
    'color-mix(in oklab, light-dark(var(--color-green-600), var(--color-green-400)) 10%, var(--background))',
  '--normal-text': 'light-dark(var(--color-green-600), var(--color-green-400))',
  '--normal-border': 'light-dark(var(--color-green-600), var(--color-green-400))',
} as CSSProperties);

const withSoftStyle = (colorVar: string, options?: SoftToastOptions): SoftToastOptions => ({
  ...options,
  style: {
    ...softStyle(colorVar),
    ...(options?.style ?? {}),
  } as CSSProperties,
});

const softToast = {
  info: (message: ReactNode, options?: SoftToastOptions) =>
    baseToast.info(message, withSoftStyle('--primary', options)),
  success: (message: ReactNode, options?: SoftToastOptions) =>
    baseToast.success(message, {
      ...options,
      style: {
        ...softSuccessStyle(),
        ...(options?.style ?? {}),
      } as CSSProperties,
    }),
  warning: (message: ReactNode, options?: SoftToastOptions) =>
    baseToast.warning(message, withSoftStyle('--warning', options)),
  error: (message: ReactNode, options?: SoftToastOptions) =>
    baseToast.error(message, withSoftStyle('--destructive', options)),
};

export { softToast };
