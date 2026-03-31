import { Toaster } from 'sonner';

export { toast } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'bg-card border-border text-foreground',
          error: 'border-destructive',
          success: 'border-green-10',
        },
      }}
    />
  );
}
