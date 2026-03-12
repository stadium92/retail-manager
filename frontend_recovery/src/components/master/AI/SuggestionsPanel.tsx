import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Package, Users, Settings, X, Loader2 } from 'lucide-react';
import { AIService, Suggestion } from '@/services/AIService';
import { useDataCollection } from '@/hooks/useDataCollection';
import { cn } from '@/lib/utils';

interface SuggestionsPanelProps {
  salesData?: any;
  inventoryData?: any;
  storeId: string;
}

const categoryIcons = {
  inventory: Package,
  sales: TrendingUp,
  worker: Users,
  operations: Settings,
};

const priorityColors = {
  high: "destructive",
  medium: "default",
  low: "secondary",
} as const;

export function SuggestionsPanel({ salesData, inventoryData, storeId }: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { aiEnabled } = useDataCollection(storeId);

  useEffect(() => {
    if (aiEnabled && salesData && inventoryData) {
      loadSuggestions();
    }
  }, [aiEnabled, salesData, inventoryData]);

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      const data = await AIService.getSuggestions(salesData, inventoryData, storeId);
      setSuggestions(data);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const dismissSuggestion = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  if (!aiEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
          <CardDescription>
            AI-powered suggestions will be available after 30 days of data collection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Keep recording sales to unlock AI insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Suggestions
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadSuggestions} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
        <CardDescription>
          AI-powered insights analyzing your sales and inventory
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0">
        {isLoading && suggestions.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No suggestions available yet</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={loadSuggestions}>
              Generate Suggestions
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => {
              const Icon = categoryIcons[suggestion.category];
              return (
                <Card key={suggestion.id} className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => dismissSuggestion(suggestion.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <CardTitle className="text-base leading-tight pr-6">
                          {suggestion.title}
                        </CardTitle>
                        <div className="flex gap-2">
                          <Badge variant={priorityColors[suggestion.priority]}>
                            {suggestion.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {suggestion.confidence}% confidence
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      {suggestion.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
