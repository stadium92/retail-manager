import { useEffect, useState } from 'react';
import { usePOSStore } from '@/stores/usePOSStore';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { POSLayout } from './components/POSLayout';
import { POSGrid } from './components/POSGrid';
import { ProductInfoPanel } from './components/ProductInfoPanel';
import { OfflineSalesService } from '@/services/OfflineSalesService';
import { OfflineInventoryService } from '@/services/OfflineInventoryService';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types';
import { CheckoutModal } from './components/CheckoutModal';
import { Button } from '@/components/ui/button';
import { getDataClient } from '@/lib/dataClient';
import { OfflineAuthService } from '@/services/OfflineAuthService';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/utils/formatting';
import { useRegisterShortcuts } from '@/contexts/ShortcutsContext';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function POSPage() {
    const { t, i18n } = useTranslation();
    const { formatCurrency } = useFormatters();
    const {
        cart,
        activeRow,
        addItem,
        setActiveRow,
        updateQuantity,
        removeItem,
        setCommandOpen,
        saleType,
        setSaleType
    } = usePOSStore();

    const { toast } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const { getKeyForAction } = useSettingsStore();
    const keyPay = getKeyForAction('ACTION_PAY') || 'F2'; // Default F2 in this specific POS view
    const keySearch = getKeyForAction('ACTION_SEARCH') || 'F3';
    // const keyToggle = getKeyForAction('ACTION_TOGGLE') || 'F4'; // Keeping F4 fixed for now or needs new action

    useRegisterShortcuts([
        {
            key: keyPay,
            label: t('worker.sales.cart.pay'),
            action: () => {
                if (cart.length > 0) setIsCheckoutOpen(true);
            },
            group: 'POS'
        },
        {
            key: keySearch,
            label: t('common.search'),
            action: () => setCommandOpen(true),
            group: 'POS'
        },
        {
            key: 'F4', // TODO: Make dynamic if user requests toggle mapping
            label: t('menu.sales.retail') + '/' + t('menu.sales.billingWholesale'),
            action: () => {
                const newType = saleType === 'detail' ? 'gros' : 'detail';
                setSaleType(newType);
                toast({
                    title: t('menu.program.preferences'),
                    description: newType === 'detail' ? t('menu.sales.retail') : t('menu.sales.billingWholesale'),
                });
            },
            group: 'POS'
        },
        {
            key: 'F5',
            label: t('common.refresh'),
            action: () => {
                loadProducts();
                toast({ description: t('common.loading') });
            },
            group: 'POS'
        }
    ]);

    const { isLocalFirst } = getDataClient();

    const loadProducts = async () => {
        setIsLoading(true);

        let storeId: string | undefined = undefined;
        const offlineSession = await OfflineAuthService.getOfflineSession();
        if (offlineSession?.user?.user_metadata?.store_id) {
            storeId = offlineSession.user.user_metadata.store_id;
        }

        const { data } = await OfflineInventoryService.getInventory(storeId, { notify: false });

        if (data) {
            const mappedProducts: Product[] = data.map(item => ({
                id: item.id,
                store_id: item.store_id,
                name: item.name,
                description: item.description,
                sku: item.sku,
                barcode: item.sku,
                unit_price: Number(item.price) || 0,
                wholesale_price: Number(item.wholesale_price) || 0,
                cost_price: Number(item.cost) || 0,
                quantity: item.quantity,
                min_quantity: item.low_stock_threshold,
                image_url: item.image_url,
                created_at: item.created_at,
                updated_at: item.updated_at,
            }));
            setProducts(mappedProducts);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadProducts();
    }, []);

    useBarcodeScanner({
        onScan: (code) => {
            const product = products.find(p => p.barcode === code || p.sku === code);
            if (product) {
                addItem(product);
                toast({
                    title: t('common.success'),
                    description: product.name,
                    duration: 1000,
                });
            } else {
                toast({
                    variant: "destructive",
                    title: t('worker.sales.itemNotFound'),
                    description: `Barcode: ${code}`,
                });
            }
        }
    });

    // Navigation Shortcuts (Manual listener kept for navigation only as it's complex context-dependent logic)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isCheckoutOpen && cart.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveRow(Math.min(activeRow + 1, cart.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveRow(Math.max(activeRow - 1, 0));
                } else if (e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) {
                    if (activeRow >= 0) removeItem(activeRow);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, activeRow, setActiveRow, removeItem, isCheckoutOpen]);

    const handleCheckout = async (data: {
        amountData: { total: number };
        paymentMethod: 'cash' | 'card' | 'mobile' | 'credit';
        saleType: 'detail' | 'gros' | 'proforma';
        customerName?: string;
        customerPhone?: string;
    }) => {
        const dbPaymentMethod = data.paymentMethod === 'mobile' ? 'cash' : data.paymentMethod;
        setIsProcessing(true);
        try {
            let userId = '';
            let storeId = '';

            const offlineSession = await OfflineAuthService.getOfflineSession();
            if (offlineSession?.user) {
                userId = offlineSession.user.id;
                storeId = offlineSession.user.user_metadata?.store_id;
            }

            if (!storeId) {
                toast({ variant: "destructive", title: t('common.error'), description: t('worker.sales.noStoreAssigned') });
                return;
            }

            const { error } = await OfflineSalesService.createSale({
                store_id: storeId,
                worker_id: userId,
                items: cart,
                total_price: data.amountData.total,
                payment_method: dbPaymentMethod,
                sale_type: data.saleType,
                customer_name: data.customerName,
                customer_phone: data.customerPhone
            });

            if (error) throw error;

            toast({
                title: data.saleType === 'proforma' ? t('menu.sales.proforma') : t('worker.sales.saleRecorded'),
                description: `${t('worker.sales.total')}: ${formatCurrency(data.amountData.total)}`,
            });

            usePOSStore.getState().clearCart();
            setIsCheckoutOpen(false);

        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: t('common.error'), description: t('worker.sales.errorRecording') });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <POSLayout>
            <div className="grid grid-cols-12 h-full gap-4 p-4">
                <div className="col-span-8 bg-card rounded-lg border shadow-sm flex flex-col overflow-hidden">
                    <POSGrid
                        items={cart}
                        activeRow={activeRow}
                        onRowClick={setActiveRow}
                        onUpdateQuantity={updateQuantity}
                    />
                </div>

                <div className="col-span-4 flex flex-col gap-4">
                    <ProductInfoPanel
                        product={activeRow >= 0 ? cart[activeRow]?.product : undefined}
                    />

                    <div className="bg-card rounded-lg border p-4 shadow-sm flex-1 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-lg">{t('worker.sales.cart.summary')}</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSaleType(saleType === 'detail' ? 'gros' : 'detail')}
                                    className={saleType === 'gros' ? 'bg-amber-100 text-amber-800 border-amber-200' : ''}
                                >
                                    {saleType === 'detail' ? `${t('menu.sales.retail')} (F4)` : `${t('menu.sales.billingWholesale')} (F4)`}
                                </Button>
                            </div>
                            <div className="flex justify-between text-2xl font-bold mt-4">
                                <span>{t('worker.sales.total')}</span>
                                <span>{formatCurrency(usePOSStore.getState().getTotal())}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {t('worker.sales.cart.items', { count: cart.reduce((acc, item) => acc + item.quantity, 0) })}
                            </p>
                        </div>

                                                    <div className="grid gap-2">
                                                    <Button
                                                        size="lg"
                                                        className="w-full text-lg h-12"
                                                        onClick={() => setIsCheckoutOpen(true)}
                                                        disabled={cart.length === 0}
                                                    >
                                                        {t('worker.sales.cart.pay')} ({keyPay})
                                                    </Button>
                                                    <Button                                variant="outline"
                                onClick={() => usePOSStore.getState().clearCart()}
                                disabled={cart.length === 0}
                            >
                                {t('worker.sales.cart.clear')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <CheckoutModal
                open={isCheckoutOpen}
                onOpenChange={setIsCheckoutOpen}
                onConfirm={handleCheckout}
                isLoading={isProcessing}
            />
        </POSLayout>
    );
}