'use client';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/Toast';
import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  const latestToast = toasts[0];

  return (
    <ToastProvider>
      {latestToast && (
        <Toast key={latestToast.id} {...latestToast}>
          <div className="grid gap-1 group/toast">
            {latestToast.title && <ToastTitle>{latestToast.title}</ToastTitle>}
            {latestToast.description && (
              <ToastDescription>{latestToast.description}</ToastDescription>
            )}
          </div>
          {latestToast.action}
          <ToastClose />
        </Toast>
      )}
      <ToastViewport />
      <style jsx global>{`
        .group/toast:hover {
          opacity: 0.7;
          transition: opacity 0.2s;
        }
      `}</style>
    </ToastProvider>
  );
}
