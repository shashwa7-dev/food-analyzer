interface LoadingSkeletonProps {
  count?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ count = 3 }) => (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
    {[...Array(count)].map((_, i) => (
      <div key={i} className="bg-gray-200 h-48 rounded-xl"></div>
    ))}
  </div>
);
