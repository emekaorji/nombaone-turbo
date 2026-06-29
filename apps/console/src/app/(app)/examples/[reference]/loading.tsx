import { Skeleton } from '@nombaone/ui/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
