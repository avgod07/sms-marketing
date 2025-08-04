import { apiRequest } from "@/lib/queryClient";

export interface BusinessHoursCheck {
  isBusinessHours: boolean;
  currentTime: string;
  nextBusinessHour: string | null;
  willBeQueued: boolean;
  businessTimezone: string;
  businessHours: string;
}

type BusinessHoursSubscriber = (check: BusinessHoursCheck | null) => void;

/**
 * Centralized Business Hours Service
 * Manages single polling instance and notifies all subscribers
 * Eliminates duplicate API calls from multiple components
 */
class BusinessHoursService {
  private static instance: BusinessHoursService;
  private status: BusinessHoursCheck | null = null;
  private subscribers: Set<BusinessHoursSubscriber> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isEnabled = false;

  private constructor() {}

  static getInstance(): BusinessHoursService {
    if (!BusinessHoursService.instance) {
      BusinessHoursService.instance = new BusinessHoursService();
    }
    return BusinessHoursService.instance;
  }

  /**
   * Subscribe to business hours updates
   * @param callback Function to call when status changes
   * @returns Unsubscribe function
   */
  subscribe(callback: BusinessHoursSubscriber): () => void {
    this.subscribers.add(callback);

    // Send current status immediately if available
    if (this.status) {
      callback(this.status);
    }

    // Start polling if this is the first subscriber
    this.startPollingIfNeeded();

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      this.stopPollingIfNoSubscribers();
    };
  }

  /**
   * Enable/disable the service (typically based on user authentication)
   * @param enabled Whether the service should be active
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (enabled) {
      this.startPollingIfNeeded();
    } else {
      this.stopPolling();
      this.status = null;
      this.notifySubscribers();
    }
  }

  /**
   * Force refresh business hours data immediately
   * Useful when timezone settings change
   */
  async forceRefresh(): Promise<void> {
    if (this.isEnabled) {
      await this.fetchBusinessHours();
    }
  }

  /**
   * Get current status synchronously
   */
  getCurrentStatus(): BusinessHoursCheck | null {
    return this.status;
  }

  private startPollingIfNeeded(): void {
    if (this.isPolling || !this.isEnabled || this.subscribers.size === 0) {
      return;
    }

    this.isPolling = true;

    // Fetch immediately
    this.fetchBusinessHours();

    // Set up polling interval
    this.pollInterval = setInterval(() => {
      this.fetchBusinessHours();
    }, 60000); // Poll every 60 seconds
  }

  private stopPollingIfNoSubscribers(): void {
    if (this.subscribers.size === 0) {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  private async fetchBusinessHours(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const res = await apiRequest({
        method: "GET",
        url: "/api/business/hours-check",
      });
      const newStatus: BusinessHoursCheck = await res.json();

      // Only notify subscribers if status actually changed
      if (JSON.stringify(newStatus) !== JSON.stringify(this.status)) {
        this.status = newStatus;
        this.notifySubscribers();
      }
    } catch (error) {
      console.error("Failed to fetch business hours:", error);
      // Don't clear status on error - keep last known good state
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(this.status);
      } catch (error) {
        console.error("Error in business hours subscriber:", error);
      }
    });
  }
}

export const businessHoursService = BusinessHoursService.getInstance();
