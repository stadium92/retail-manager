import { useDevice } from '@/contexts/DeviceContext';
import { WorkerLayout } from '@/components/worker/Layout/WorkerLayout';
import { MobileWorkerLayout } from '@/components/mobile/MobileWorkerLayout';

export default function WorkerDashboardPage() {
  const device = useDevice();
  
  return (
    <>
      {!device.isDesktop ? <MobileWorkerLayout /> : <WorkerLayout />}
    </>
  );
}
