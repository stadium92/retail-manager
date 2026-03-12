import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';
import { Logger } from '@/utils/Logger';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'bm', name: 'Bamanankan' },
  ];

  const handleLanguageChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
    await Logger.info('LANGUAGE_CHANGED', { 
      new_value: lang,
      notes: `User changed UI language to ${lang}`
    });
  };

  return (
    <Select value={i18n.language || 'en'} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[140px]">
        <Globe className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background z-50">
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
