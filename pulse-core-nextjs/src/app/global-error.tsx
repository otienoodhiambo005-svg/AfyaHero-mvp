'use client';

import { AppErrorFallback } from '@/components/errors/AppErrorFallback';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans bg-content-bg text-charcoal antialiased">
        <AppErrorFallback
          error={error}
          reset={reset}
          title="System error"
          description="AfyaHero encountered an unexpected error. Please try again."
          showErrorId
        />
      </body>
    </html>
  );
}
