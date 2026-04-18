export default function ShopLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header skeleton */}
      <section className="bg-primary py-12 px-6 md:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <div className="h-10 bg-white/20 rounded mb-3 max-w-xs mx-auto animate-pulse" />
          <div className="h-5 bg-white/15 rounded max-w-lg mx-auto animate-pulse" />
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search bar skeleton */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 h-10 bg-gray-100 rounded animate-pulse" />
          <div className="w-20 h-10 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Category pills skeleton */}
        <div className="flex gap-2 flex-wrap mb-5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
          ))}
        </div>

        {/* Filter bar skeleton */}
        <div className="flex gap-3 pt-4 border-t border-gray-100 mb-6">
          <div className="h-9 w-36 bg-gray-100 rounded animate-pulse" />
          <div className="h-9 w-36 bg-gray-100 rounded animate-pulse" />
          <div className="h-9 w-36 bg-gray-100 rounded animate-pulse ml-auto" />
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="h-72 bg-gray-100 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-3 bg-gray-100 rounded w-20 animate-pulse" />
                <div className="h-5 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse" />
                <div className="h-5 bg-gray-100 rounded w-1/3 animate-pulse mt-1" />
                <div className="h-9 bg-gray-100 rounded mt-3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
