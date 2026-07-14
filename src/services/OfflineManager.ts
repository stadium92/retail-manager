import { toast } from '@/hooks/use-toast';
import i18n from '@/i18n/config';

export interface QueuedTransaction {
  id: string;
  type: 'sale' | 'delivery_update' | 'stock_update';
  data: any;
  timestamp: number;
  retries: number;
}

export class OfflineManager {
  private static QUEUE_KEY = 'offline_queue';
  private static MAX_RETRIES = 3;
  private static syncInProgress = false;

  static addToQueue(type: QueuedTransaction['type'], data: any): void {
    const queue = this.getQueue();
    const transaction: QueuedTransaction = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(transaction);
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('queueUpdated', { detail: queue.length }));
    
    toast({
      title: i18n.t('sync.offlineMode'),
      description: i18n.t('sync.transactionQueued'),
    });
  }

  static getQueue(): QueuedTransaction[] {
    const queue = localStorage.getItem(this.QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  }

  static getQueueSize(): number {
    return this.getQueue().length;
  }

  static clearQueue(): void {
    localStorage.removeItem(this.QUEUE_KEY);
    window.dispatchEvent(new CustomEvent('queueUpdated', { detail: 0 }));
  }

  static removeFromQueue(id: string): void {
    const queue = this.getQueue().filter(item => item.id !== id);
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('queueUpdated', { detail: queue.length }));
  }

  static async syncQueue(
    syncHandlers: {
      sale?: (data: any) => Promise<boolean>;
      delivery_update?: (data: any) => Promise<boolean>;
      stock_update?: (data: any) => Promise<boolean>;
    }
  ): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress) {
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    const queue = this.getQueue();
    let success = 0;
    let failed = 0;

    for (const transaction of queue) {
      try {
        const handler = syncHandlers[transaction.type];
        if (handler) {
          const result = await handler(transaction.data);
          if (result) {
            this.removeFromQueue(transaction.id);
            success++;
          } else {
            transaction.retries++;
            if (transaction.retries >= this.MAX_RETRIES) {
              this.removeFromQueue(transaction.id);
              failed++;
            }
          }
        }
      } catch (error) {
        console.error('Sync error:', error);
        transaction.retries++;
        if (transaction.retries >= this.MAX_RETRIES) {
          this.removeFromQueue(transaction.id);
          failed++;
        }
      }
    }

    // Update queue with retry counts
    const updatedQueue = this.getQueue();
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(updatedQueue));

    this.syncInProgress = false;

    if (success > 0 || failed > 0) {
      toast({
        title: i18n.t('sync.syncComplete'),
        description: i18n.t('sync.syncResults', { success, failed }),
      });
    }

    return { success, failed };
  }

  static setupAutoSync(syncHandlers: any): void {
    // Drain anything left over from a previous session immediately, rather
    // than only on the next offline->online transition - otherwise items
    // queued while online (e.g. a direct write that failed) sit untouched
    // for the rest of a session that never toggles network state.
    if (navigator.onLine && this.getQueueSize() > 0) {
      this.syncQueue(syncHandlers);
    }

    window.addEventListener('online', () => {
      toast({
        title: i18n.t('sync.backOnline'),
        description: i18n.t('sync.syncingQueued'),
      });
      this.syncQueue(syncHandlers);
    });
  }

  static isOnline(): boolean {
    return navigator.onLine;
  }

  static exportQueue(): string {
    return JSON.stringify(this.getQueue());
  }

  static importQueue(data: string): void {
    try {
      const queue = JSON.parse(data);
      localStorage.setItem(this.QUEUE_KEY, data);
      window.dispatchEvent(new CustomEvent('queueUpdated', { detail: queue.length }));
    } catch (error) {
      console.error('Failed to import queue:', error);
    }
  }
}
