import { DelivererDashboard } from '@/components/deliverer/Dashboard/DelivererDashboard';
import { useEffect } from 'react';

export default function DelivererDashboardPage() {
  useEffect(() => {
    console.log('DelivererDashboardPage: Route component mounted');
  }, []);

  return <DelivererDashboard />;
}
