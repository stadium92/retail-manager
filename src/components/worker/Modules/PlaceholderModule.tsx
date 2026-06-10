import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PlaceholderModuleProps {
  title: string;
  description?: string;
}

export function PlaceholderModule({ title, description }: PlaceholderModuleProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-[hsl(60,80%,85%)] dark:bg-transparent">
      <div className="glass-card p-12 text-center max-w-md">
        <Construction className="h-16 w-16 mx-auto mb-6 text-primary opacity-50" />
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground">
          {description || t('common.loading')}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <span className="px-3 py-1 bg-warning/20 text-warning rounded-full text-sm">
            {t('common.unknown')}
          </span>
        </div>
      </div>
    </div>
  );
}