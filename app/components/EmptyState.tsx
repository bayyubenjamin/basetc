import { Users } from "lucide-react";

type EmptyStateProps = {
  title?: string;
  description?: string;
};

export default function EmptyState({
  title = "No builders found yet",
  description = "Be the first to join the leaderboard",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      {/* Icon */}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <Users className="h-7 w-7 text-gray-400" />
      </div>

      {/* Text */}
      <h3 className="text-base font-semibold text-gray-900">
        {title}
      </h3>
      <p className="mt-1 text-sm text-gray-500 max-w-xs">
        {description}
      </p>
    </div>
  );
}
