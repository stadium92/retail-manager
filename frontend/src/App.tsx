import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LicenseProvider } from "@/contexts/LicenseContext";
import { ShortcutsProvider } from "@/contexts/ShortcutsContext";
import { PrinterProvider } from "@/contexts/PrinterContext";
import { ScannerProvider } from "@/contexts/ScannerContext";
import { ShortcutsHelpOverlay } from "@/components/shared/ShortcutsHelpOverlay";
import { AppUpdater } from "@/components/shared/AppUpdater";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MasterLayout } from "@/components/master/Layout/MasterLayout";
import Index from "./pages/Index";
import AuthPage from "@/components/auth/AuthPage";
import MasterDashboard from "./pages/master/Dashboard";
import StoresPage from "./pages/master/Stores";
import StoreDetailsPage from "./pages/master/stores/StoreDetails";
import InventoryPage from "./pages/master/Inventory";
import SalesPage from "./pages/master/Sales";
import PurchasesPage from "./pages/master/Purchases";
import DeliverersPage from "./pages/master/Deliverers";
import DeliveriesPage from "./pages/master/Deliveries";
import AnalyticsPage from "./pages/master/Analytics";
import InvitationsPage from "./pages/master/Invitations";
import TeamPage from "./pages/master/Team";
import FilesPage from "./pages/master/Files";
import AuditLogsPage from "./pages/master/AuditLogs";
import CloudSyncPage from "./pages/master/CloudSync";
import HelpPage from "./pages/shared/Help";
import WorkerDashboard from "./pages/worker/Dashboard";
import POSPage from "./pages/worker/POS";
import ProformaList from "./pages/worker/ProformaList";
import DelivererDashboard from "./pages/deliverer/Dashboard";
import CustomerBrowse from "./pages/customer/Browse";
import NotFound from "./pages/NotFound";

import { TermsOfServiceGate } from "@/components/license/TermsOfServiceGate";
import { DeviceProvider } from "@/contexts/DeviceContext";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <DeviceProvider>
      <QueryClientProvider client={queryClient}>
      <LicenseProvider>
        <ShortcutsProvider>
          <PrinterProvider>
            <ScannerProvider>
              <AuthProvider>
                <TooltipProvider>
                <Toaster />
                <Sonner />
                <ShortcutsHelpOverlay />
                <AppUpdater />
                <TermsOfServiceGate>
                  <HashRouter>
                    <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<AuthPage />} />

                    {/* Master routes with layout */}
                    <Route path="/master" element={
                      <ProtectedRoute role="master">
                        <MasterLayout />
                      </ProtectedRoute>
                    }>
                      <Route path="dashboard" element={<MasterDashboard />} />
                      <Route path="stores" element={<StoresPage />} />
                      <Route path="stores/:id" element={<StoreDetailsPage />} />
                      <Route path="inventory" element={<InventoryPage />} />
                      <Route path="sales" element={<SalesPage />} />
                      <Route path="purchases" element={<PurchasesPage />} />
                      <Route path="deliverers" element={<DeliverersPage />} />
                      <Route path="deliveries" element={<DeliveriesPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />
                      <Route path="files" element={<FilesPage />} />
                      <Route path="invitations" element={<InvitationsPage />} />
                      <Route path="team" element={<TeamPage />} />
                      <Route path="audit-logs" element={<AuditLogsPage />} />
                      <Route path="cloud-sync" element={<CloudSyncPage />} />
                      <Route path="help" element={<HelpPage />} />
                    </Route>
                    <Route path="/worker" element={<Navigate to="/worker/dashboard" replace />} />
                    <Route
                      path="/worker/dashboard"
                      element={
                        <ErrorBoundary>
                          <ProtectedRoute role="worker">
                            <WorkerDashboard />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      }
                    />
                    {/* Temporary route for testing - remove after debugging */}
                    <Route
                      path="/worker/test"
                      element={
                        <ErrorBoundary>
                          <WorkerDashboard />
                        </ErrorBoundary>
                      }
                    />
                    {/* Deliverer routes - accessible by master, worker, and deliverer */}
                    <Route path="/deliverer" element={<Navigate to="/deliverer/dashboard" replace />} />
                    <Route
                      path="/deliverer/dashboard"
                      element={
                        <ErrorBoundary>
                          <ProtectedRoute role="deliverer">
                            <DelivererDashboard />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      }
                    />
                    {/* Temporary route for testing - remove after debugging */}
                    <Route
                      path="/deliverer/test"
                      element={
                        <ErrorBoundary>
                          <DelivererDashboard />
                        </ErrorBoundary>
                      }
                    />
                    {/* Customer/Merchant routes - public access, accessible by all authenticated users */}
                    <Route path="/customer" element={<Navigate to="/customer/browse" replace />} />
                    <Route
                      path="/customer/browse"
                      element={
                        <ErrorBoundary>
                          <CustomerBrowse />
                        </ErrorBoundary>
                      }
                    />
                    {/* Temporary route for testing - remove after debugging */}
                    <Route
                      path="/customer/test"
                      element={
                        <ErrorBoundary>
                          <CustomerBrowse />
                        </ErrorBoundary>
                      }
                    />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </HashRouter>
                </TermsOfServiceGate>
                </TooltipProvider>
              </AuthProvider>
            </ScannerProvider>
          </PrinterProvider>
        </ShortcutsProvider>
      </LicenseProvider>
    </QueryClientProvider>
    </DeviceProvider>
  </ErrorBoundary>
);

export default App;

