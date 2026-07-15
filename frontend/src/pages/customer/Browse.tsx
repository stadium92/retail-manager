import { CustomerBrowse } from '@/components/customer/Browse/CustomerBrowse';
import { useEffect } from 'react';

export default function CustomerBrowsePage() {
  useEffect(() => {
    console.log('CustomerBrowsePage: Route component mounted');
  }, []);

  return <CustomerBrowse />;
}
