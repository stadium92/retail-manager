import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFormatters } from '@/utils/formatting';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { OfflineStoreService } from '@/services/OfflineStoreService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useMasterDashboardStore } from '@/stores/useMasterDashboardStore';
import { GestionModule } from '@/components/shared/GestionModule';

export function MobileDashboard() {
    const { t } = useTranslation();
    const { formatCurrency } = useFormatters();
    const navigate = useNavigate();
    const { selectedStoreIds, isAllStoresSelected, version } = useMasterDashboardStore();

    const [metrics, setMetrics] = useState({
        todaySales: 0,
        weekSales: 0,
        totalStores: 0,
        lowStockItems: 0,
        stockValuation: 0,
    });
    const [salesStatus, setSalesStatus] = useState<'good' | 'bad' | 'worse'>('good');
    const [loading, setLoading] = useState(true);
    const [subTab, setSubTab] = useState<'overview' | 'analytics'>('overview');
    const [activeStoreIds, setActiveStoreIds] = useState<string[]>([]);
    const [allStores, setAllStores] = useState<any[]>([]);

    useEffect(() => {
        loadDashboardData();
    }, [version, selectedStoreIds, isAllStoresSelected]);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const { data: storesList } = await OfflineStoreService.getStores();
            const list = storesList || [];
            setAllStores(list);

            const resolvedIds = isAllStoresSelected 
                ? (list.map(s => s.id) || [])
                : selectedStoreIds;
            setActiveStoreIds(resolvedIds);

            let combinedToday = 0;
            let combinedWeek = 0;
            let combinedLowStock = 0;
            let combinedValuation = 0;

            await Promise.all(resolvedIds.map(async (sid) => {
                const [salesRes, stockRes, valRes] = await Promise.all([
                    OfflineSalesService.getSaleMetrics(sid),
                    OfflineInventoryService.getLowStockItems(10, sid),
                    OfflineInventoryService.getStockValuation(sid)
                ]);
                combinedToday += salesRes.todaySales || 0;
                combinedWeek += salesRes.weekSales || 0;
                combinedLowStock += stockRes.data?.length || 0;
                combinedValuation += valRes.total_retail || 0;
            }));

            let status: 'good' | 'bad' | 'worse' = 'good';
            if (combinedToday === 0) status = 'worse';
            else if (combinedToday < combinedWeek / 7) status = 'bad';

            setMetrics({
                todaySales: combinedToday,
                weekSales: combinedWeek,
                totalStores: resolvedIds.length,
                lowStockItems: combinedLowStock,
                stockValuation: combinedValuation,
            });
            setSalesStatus(status);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-rs-surface text-rs-on-surface min-h-screen flex flex-col pt-[56px] pb-[64px] dark">
            {/* TopAppBar */}
            <header className="fixed top-0 w-full h-[56px] bg-rs-surface border-b border-rs-surface-container-highest flex justify-between items-center px-4 z-50">
                <div className="flex items-center gap-2">
                    <button className="bg-rs-surface-container-highest rounded-full px-3 py-1 flex items-center gap-1 text-rs-on-surface border border-rs-outline/50 text-xs font-medium hover:bg-rs-surface-variant transition-colors h-[32px]">
                        <span className="truncate max-w-[120px]">{isAllStoresSelected ? "Toutes les boutiques" : "Boutique filtrée"}</span>
                        <span className="material-symbols-outlined text-[16px]">expand_more</span>
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <button className="text-rs-on-surface-variant hover:text-rs-on-surface transition-colors w-[48px] h-[48px] flex items-center justify-center rounded-full hover:bg-rs-surface-container-high">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 px-4 py-5 flex flex-col gap-6 overflow-y-auto">
                {/* Status Bar */}
                <div className="flex items-center justify-between">
                    <span className="text-rs-on-surface-variant">Statut des commandes:</span>
                    <span className={`px-2 py-1 rounded-full text-xs uppercase tracking-wider font-bold ${salesStatus === 'good' ? 'bg-rs-secondary-container text-rs-on-secondary-container' : salesStatus === 'bad' ? 'bg-rs-surface-tint text-rs-on-primary' : 'bg-rs-error-container text-rs-error'}`}>
                        {salesStatus === 'good' ? 'BONNES COMMANDES' : salesStatus === 'bad' ? 'MOYEN' : 'CRITIQUE'}
                    </span>
                </div>

                {/* View Selector Pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 snap-x scrollbar-hide -mx-4 px-4 shrink-0">
                    <button 
                        onClick={() => setSubTab('overview')}
                        className={`snap-start shrink-0 h-[40px] px-5 rounded-full transition-transform active:scale-95 shadow-sm font-semibold text-xs ${subTab === 'overview' ? 'bg-rs-secondary text-rs-on-secondary' : 'bg-rs-surface-container border border-rs-outline text-rs-on-surface'}`}
                    >
                        Vue d'ensemble
                    </button>
                    <button 
                        onClick={() => setSubTab('analytics')}
                        className={`snap-start shrink-0 h-[40px] px-5 rounded-full transition-transform active:scale-95 shadow-sm font-semibold text-xs ${subTab === 'analytics' ? 'bg-rs-secondary text-rs-on-secondary' : 'bg-rs-surface-container border border-rs-outline text-rs-on-surface'}`}
                    >
                        Analyses & Stats
                    </button>
                </div>

                {subTab === 'analytics' ? (
                    <div className="flex flex-col gap-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-rs-on-surface-variant">
                                <span className="material-symbols-outlined animate-spin text-[32px] text-rs-surface-tint mb-2">refresh</span>
                                <span>Chargement des analyses...</span>
                            </div>
                        ) : activeStoreIds.length === 0 ? (
                            <div className="text-center py-12 text-rs-on-surface-variant">Aucune boutique disponible</div>
                        ) : (
                            activeStoreIds.map(sid => (
                                <div key={`mobile-anal-${sid}`} className="bg-rs-surface-container-low border border-rs-outline rounded-2xl p-4 flex flex-col gap-3 shadow-md">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-rs-surface-tint border-b border-rs-outline/35 pb-2">
                                        {allStores.find(s => s.id === sid)?.name || "Restaurant"}
                                    </h3>
                                    <div className="h-[350px] overflow-hidden rounded-xl border border-rs-outline bg-[#141414] mt-2">
                                        <GestionModule storeId={sid} mode="tableau-bord" />
                                    </div>
                                    <div className="h-[350px] overflow-hidden rounded-xl border border-rs-outline bg-[#141414] mt-2">
                                        <GestionModule storeId={sid} mode="statistiques" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <>
                        {/* Metric Cards Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-rs-surface-container-low border border-rs-outline rounded-xl p-3 shadow-sm flex flex-col gap-2 min-h-[104px]">
                                <h3 className="text-xs text-rs-on-surface-variant leading-tight">Commandes d'aujourd'hui</h3>
                                <div className="text-xl font-bold text-rs-on-surface mt-auto">
                                    {loading ? "..." : formatCurrency(metrics.todaySales)}
                                </div>
                            </div>
                            <div className="bg-rs-surface-container-low border border-rs-outline rounded-xl p-3 shadow-sm flex flex-col gap-2 min-h-[104px]">
                                <h3 className="text-xs text-rs-on-surface-variant leading-tight">Commandes de la week</h3>
                                <div className="text-xl font-bold text-rs-on-surface mt-auto">
                                    {loading ? "..." : formatCurrency(metrics.weekSales)}
                                </div>
                            </div>
                            <div className="bg-rs-surface-container-low border border-rs-outline rounded-xl p-3 shadow-sm flex flex-col gap-2 min-h-[104px]">
                                <h3 className="text-xs text-rs-on-surface-variant leading-tight">Valeur du stock</h3>
                                <div className="text-xl font-bold text-rs-on-surface mt-auto">
                                    {loading ? "..." : formatCurrency(metrics.stockValuation)}
                                </div>
                            </div>
                            <div className="bg-rs-surface-container-low border border-rs-outline rounded-xl p-3 shadow-sm flex flex-col gap-2 min-h-[104px]">
                                <h3 className="text-xs text-rs-on-surface-variant leading-tight">Total des restaurants</h3>
                                <div className="text-xl font-bold text-rs-on-surface mt-auto">{loading ? "..." : metrics.totalStores}</div>
                            </div>
                            <div className={`col-span-2 rounded-xl p-3 flex items-center justify-between min-h-[72px] ${metrics.lowStockItems > 0 ? 'bg-rs-error-container/20 border border-rs-error/30' : 'bg-rs-surface-container-low border border-rs-outline'}`}>
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined ${metrics.lowStockItems > 0 ? 'text-rs-error' : 'text-rs-on-surface-variant'}`}>warning</span>
                                    <h3 className={`font-medium ${metrics.lowStockItems > 0 ? 'text-rs-error' : 'text-rs-on-surface-variant'}`}>Plats en rupture de stock</h3>
                                </div>
                                <span className={`text-2xl font-bold ${metrics.lowStockItems > 0 ? 'text-rs-error' : 'text-rs-on-surface'}`}>{loading ? "..." : metrics.lowStockItems}</span>
                            </div>
                        </div>

                        {/* Welcome Banner */}
                        <div className="bg-rs-surface-container rounded-xl border border-rs-outline overflow-hidden flex flex-col">
                            <div className="bg-rs-surface-container-high px-4 py-2 border-b border-rs-outline">
                                <h2 className="font-semibold text-rs-on-surface">Bienvenue dans votre Gestionnaire</h2>
                            </div>
                            <div className="p-4 flex flex-col gap-5">
                                <div>
                                    <h3 className="text-rs-caption-sm text-rs-on-surface-variant mb-2 uppercase tracking-wider font-bold">Actions rapides</h3>
                                    <ul className="flex flex-col gap-1">
                                        <li className="h-[48px] flex items-center justify-between bg-rs-surface-container-low px-4 rounded-lg hover:bg-rs-surface-container-highest transition-colors border border-rs-outline/50 cursor-pointer" onClick={() => navigate('/worker/dashboard')}>
                                            <span className="text-rs-on-surface">Nouvelle commande</span>
                                            <span className="material-symbols-outlined text-rs-on-surface-variant">arrow_forward</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};
