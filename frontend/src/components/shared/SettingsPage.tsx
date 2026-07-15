import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PatchInstaller from './PatchInstaller';
import { Settings, Download, Info } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from 'react-i18next';

export default function SettingsPage() {
  const { currency, setCurrency, storeName, setStoreName } = useSettingsStore();
  const { t } = useTranslation();

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-blue-500" />
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">{t('common.general')}</TabsTrigger>
          <TabsTrigger value="updates">{t('settings.updates')}</TabsTrigger>
          <TabsTrigger value="about">{t('common.about')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.general')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.storeName')}</label>
                <input
                  type="text"
                  placeholder={t('settings.storeNamePlaceholder')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.currency')}</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="XOF">CFA Franc (XOF)</option>
                  <option value="GHS">Ghanaian Cedi (GHS)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="USD">US Dollar ($)</option>
                </select>
                <p className="text-sm text-slate-500 mt-1">
                  {t('settings.currencyHelp')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                {t('settings.updates')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PatchInstaller />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                {t('common.about')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">{t('settings.appName')}</p>
                <p className="text-lg font-semibold">Djati</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('settings.version')}</p>
                <p className="text-lg font-semibold">v1.0.0</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('settings.copyright')}</p>
                <p className="text-sm">{t('settings.copyrightText')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}