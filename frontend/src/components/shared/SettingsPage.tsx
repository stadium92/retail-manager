import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PatchInstaller from './PatchInstaller';
import { Settings, Download, Info } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function SettingsPage() {
  const { currency, setCurrency, storeName, setStoreName } = useSettingsStore();

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-blue-500" />
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="updates">Updates & Patches</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Store Name</label>
                <input
                  type="text"
                  placeholder="Enter store name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Currency</label>
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
                  Changes will be applied immediately across the application.
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
                Updates & Patches
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
                About
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Application Name</p>
                <p className="text-lg font-semibold">Retail Manager</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Version</p>
                <p className="text-lg font-semibold">v1.0.0</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Copyright</p>
                <p className="text-sm">© 2026 Retail Manager. All rights reserved.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}