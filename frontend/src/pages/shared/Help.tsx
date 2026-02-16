import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useTranslation } from 'react-i18next';
import { 
  Search, BookOpen, HelpCircle, Bug, Send, Loader2, 
  CheckCircle2, Keyboard, Package, ShoppingCart, 
  BarChart3, Smartphone, Settings, LifeBuoy,
  MessageSquare, ExternalLink, ArrowRight
} from 'lucide-react';
import { Logger } from '@/utils/Logger';
import { LicenseService } from '@/services/LicenseService';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HELP_CONTENT } from './HelpContent';
import { cn } from '@/lib/utils';

export default function HelpPage() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [deviceHash, setDeviceHash] = useState('...');
  const [activeCategory, setActiveModule] = useState('guide');

  useEffect(() => {
    LicenseService.getDeviceHash().then(setDeviceHash);
  }, []);

  const currentLang = i18n.language || 'fr';
  const content = HELP_CONTENT[currentLang] || HELP_CONTENT['fr'];

  const handleReportBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDescription.trim()) return;

    setIsSubmitting(true);
    try {
      await Logger.error('USER_REPORTED_BUG', {
        notes: bugDescription,
        new_value: `DeviceID: ${deviceHash}`
      });
      toast.success(t('helpCenter.successMessage'));
      setBugDescription('');
    } catch (err) {
      toast.error(t('helpCenter.errorMessage'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqItems = useMemo(() => [
    { id: 'sync', ...t('helpCenter.questions.sync', { returnObjects: true }) as { q: string, a: string } },
    { id: 'storage', ...t('helpCenter.questions.storage', { returnObjects: true }) as { q: string, a: string } },
    { id: 'devices', ...t('helpCenter.questions.devices', { returnObjects: true }) as { q: string, a: string } },
  ], [t]);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery) return faqItems;
    return faqItems.filter(item => 
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [faqItems, searchQuery]);

  const categories = [
    { 
      id: 'keyboard',
      icon: Keyboard, 
      title: t('helpCenter.categories.keyboard.title'),
      description: t('helpCenter.categories.keyboard.description'),
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      id: 'inventory',
      icon: Package, 
      title: t('helpCenter.categories.inventory.title'),
      description: t('helpCenter.categories.inventory.description'),
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    { 
      id: 'sales',
      icon: ShoppingCart, 
      title: t('helpCenter.categories.sales.title'),
      description: t('helpCenter.categories.sales.description'),
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    { 
      id: 'reports',
      icon: BarChart3, 
      title: t('helpCenter.categories.reports.title'),
      description: t('helpCenter.categories.reports.description'),
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
  ];

  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-transparent pb-20">
      {/* Hero Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 text-center space-y-6">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary animate-bounce-subtle">
            <LifeBuoy className="h-10 w-10" />
          </div>
          <h1 className="text-4xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white">
            {t('helpCenter.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg lg:text-xl max-w-2xl mx-auto font-medium">
            {t('helpCenter.subtitle')}
          </p>
          
          <div className="relative max-w-2xl mx-auto mt-8 group">
            <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/30 transition-all rounded-full opacity-50" />
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder={t('helpCenter.searchPlaceholder')}
                className="pl-12 h-14 text-lg shadow-xl border-none bg-white dark:bg-slate-800 rounded-2xl focus-visible:ring-2 focus-visible:ring-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-8">
        {/* Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {categories.map((cat) => (
            <Card 
              key={cat.id} 
              className="group relative overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-none ring-1 ring-slate-200 dark:ring-slate-800"
            >
              <CardHeader className="p-6">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", cat.bgColor)}>
                  <cat.icon className={cn("h-6 w-6", cat.color)} />
                </div>
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{cat.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed mt-1">{cat.description}</CardDescription>
              </CardHeader>
              <div className="absolute bottom-0 left-0 h-1 w-0 bg-primary group-hover:w-full transition-all duration-500" />
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Documentation & FAQ */}
          <div className="lg:col-span-8 space-y-8">
            <Tabs defaultValue="guide" className="w-full">
              <TabsList className="w-full justify-start h-12 bg-transparent gap-2 p-0 border-b rounded-none mb-6">
                <TabsTrigger 
                  value="guide" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 h-full font-bold text-sm"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Documentation
                </TabsTrigger>
                <TabsTrigger 
                  value="faq"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 h-full font-bold text-sm"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  FAQ
                </TabsTrigger>
              </TabsList>

              <TabsContent value="guide" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
                  <CardContent className="pt-8 px-8 prose dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:text-slate-600 dark:prose-p:text-slate-400">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  </CardContent>
                  <CardFooter className="bg-slate-50 dark:bg-slate-900/50 border-t p-6 flex justify-between items-center">
                    <span className="text-sm text-slate-500 font-medium">Was this guide helpful?</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="rounded-full">Yes</Button>
                      <Button variant="outline" size="sm" className="rounded-full">No</Button>
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="faq" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="shadow-sm border-slate-200 dark:border-slate-800">
                  <CardHeader className="px-8 pt-8">
                    <CardTitle className="text-2xl font-black">{t('helpCenter.faq')}</CardTitle>
                    <CardDescription>{t('helpCenter.faqSubtitle')}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    {filteredFaqs.length > 0 ? (
                      <Accordion type="single" collapsible className="w-full">
                        {filteredFaqs.map((item) => (
                          <AccordionItem key={item.id} value={item.id} className="border-slate-100 dark:border-slate-800">
                            <AccordionTrigger className="text-base font-semibold hover:no-underline text-left py-4">
                              {item.q}
                            </AccordionTrigger>
                            <AccordionContent className="text-slate-500 dark:text-slate-400 leading-relaxed pb-4">
                              {item.a}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <div className="text-center py-12 space-y-4">
                        <div className="inline-flex p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">
                          <Search className="h-8 w-8" />
                        </div>
                        <p className="text-slate-500 font-medium">No results found for "{searchQuery}"</p>
                        <Button variant="outline" onClick={() => setSearchQuery('')}>Clear search</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column: Support & Status */}
          <div className="lg:col-span-4 space-y-6">
            {/* Bug Report Form */}
            <Card className="border-none shadow-2xl bg-slate-900 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Bug className="h-32 w-32 rotate-12" />
              </div>
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-2 text-2xl font-black">
                  <Bug className="h-6 w-6 text-primary" />
                  {t('helpCenter.reportBug')}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {t('helpCenter.reportBugSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10">
                <form onSubmit={handleReportBug} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bug-description" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      {t('helpCenter.bugDescription')}
                    </Label>
                    <Textarea
                      id="bug-description"
                      placeholder={t('helpCenter.bugDescriptionPlaceholder')}
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      rows={5}
                      className="resize-none border-slate-800 focus-visible:ring-primary bg-slate-800/50 text-white placeholder:text-slate-600"
                      required
                    />
                  </div>
                  
                  <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 flex flex-col gap-1">
                    <div className="text-[10px] text-primary font-black uppercase tracking-widest">
                      Device Signature
                    </div>
                    <div className="text-[11px] font-mono break-all text-slate-300">
                      {deviceHash}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 font-black uppercase tracking-widest shadow-xl shadow-primary/20 group"
                    disabled={isSubmitting || !bugDescription.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('helpCenter.submitting')}
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        {t('helpCenter.submitReport')}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* System Status Card */}
            <Card className="shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
                <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-tighter">
                  <Settings className="h-4 w-4 text-slate-400" />
                  System Integrity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Local Engine</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-tighter">
                    <CheckCircle2 className="h-3 w-3" /> Healthy
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-bold">Cloud Cluster</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-tighter">
                    <CheckCircle2 className="h-3 w-3" /> Synchronized
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="text-[10px] text-slate-400">
                    Version <span className="font-bold text-slate-600 dark:text-slate-300">1.0.4 stable</span>
                  </div>
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] uppercase font-bold text-primary">
                    Release Notes <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* External Links */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="text-xs font-bold py-6 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition-colors">
                <ExternalLink className="h-4 w-4 mr-2" /> API Docs
              </Button>
              <Button variant="outline" className="text-xs font-bold py-6 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition-colors">
                <LifeBuoy className="h-4 w-4 mr-2" /> Direct Chat
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}