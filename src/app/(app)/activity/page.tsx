
import ActivityFeed from '@/components/activity-feed';

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-headline text-3xl font-bold">Activity Feed</h1>
      <p className="text-muted-foreground">
        A log of recent system and user activities.
      </p>
      <ActivityFeed />
    </div>
  );
}
