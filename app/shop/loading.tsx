export default function ShopLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section Skeleton */}
      <section className="bg-primary text-white py-16 px-6 md:px-12">
        <div className="max-w-5xl mx-auto text-center">
          <div className="h-12 bg-white/20 rounded mb-4 max-w-3xl mx-auto animate-pulse" />
          <div className="h-6 bg-white/20 rounded max-w-2xl mx-auto animate-pulse" />
        </div>
      </section>

      {/* Products Grid Skeleton */}
      <section className="py-12 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Image Skeleton */}
                <div className="aspect-square bg-gray-200 animate-pulse" />
                {/* Content Skeleton */}
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                  <div className="h-6 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse mt-2" />
                  <div className="h-10 bg-gray-200 rounded mt-4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
