'use client';

import Link from 'next/link';

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-4">
          Oops!
        </h1>
        <p className="text-gray-600 mb-8">
          Something went wrong while loading our shop. We&apos;re looking into it!
        </p>

        {process.env.NODE_ENV === 'development' && error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded text-left">
            <p className="text-sm text-red-600 font-mono">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="bg-accent text-primary-dark px-6 py-2 font-semibold rounded hover:bg-accent-light transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="border border-gray-300 text-gray-900 px-6 py-2 font-semibold rounded hover:bg-gray-100 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
