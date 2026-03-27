import * as Sentry from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import ReactDOM from 'react-dom/client';

import Loader from './components/loader';
import { routeTree } from './routeTree.gen';
import { queryClient, trpc } from './utils/trpc';

if (import.meta.env.PROD && !import.meta.env.VITE_SENTRY_DSN) {
  console.warn('[Sentry] VITE_SENTRY_DSN not set — error capture disabled');
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: import.meta.env.PROD ? 'production' : 'development',
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.1,
  ignoreErrors: [
    // These match the `.name` property of error classes (not message text)
    'ZodError',
  ],
});

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent: () => <Loader />,
  context: { trpc, queryClient },
  Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Root element not found');
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <Sentry.ErrorBoundary
      fallback={(props) => (
        <div style={{ padding: '2rem' }}>
          <h1>Something went wrong</h1>
          {props.eventId && (
            <p>
              Reference: <code>{props.eventId}</code>
            </p>
          )}
          <button onClick={() => props.resetError()}>Try again</button>
        </div>
      )}
    >
      <RouterProvider router={router} />
    </Sentry.ErrorBoundary>
  );
}
