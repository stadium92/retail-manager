import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Sparkles } from 'lucide-react';
import { useDataCollection } from '@/hooks/useDataCollection';

export function DataCollectionProgress({ storeId }: { storeId?: string }) {
  const { daysCollected, daysRemaining, progress, aiEnabled, isLoading } = useDataCollection(storeId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (aiEnabled) {
    return (
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            AI Features Active
          </CardTitle>
          <CardDescription>
            AI-powered insights are now available for your business
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Collecting Data for AI Features
        </CardTitle>
        <CardDescription>
          AI features will activate after 30 days of sales data collection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{daysCollected} / 30 days</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <div className="text-sm text-muted-foreground">
          {daysRemaining} days remaining until AI activation
        </div>
      </CardContent>
    </Card>
  );
}
