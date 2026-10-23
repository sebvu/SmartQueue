export type QueueStatus = "waiting" | "almost_ready" | "served";
export type Priority = "low" | "medium" | "high";

export type Service = {
  id: string;
  name: string;
  description: string;
  expectedDurationMinutes: number;
  priority: Priority;
  estimatedWaitMinutes: number;
  queueLength: number;
  isOpen: boolean;
};

export type QueueEntry = {
  id: string;
  serviceId: string;
  position: number;
  estimatedWaitMinutes: number;
  status: QueueStatus;
};

export type HistoryItem = {
  id: string;
  date: string;
  serviceName: string;
  outcome: "served" | "left" | "removed";
};

export type AppNotification = {
  id: string;
  message: string;
  type: "queue_update" | "status_change";
  read: boolean;
  timestamp: string;
};