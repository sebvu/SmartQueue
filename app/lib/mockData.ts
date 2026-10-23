import type { Service, QueueEntry, HistoryItem, AppNotification } from "./types";

export const mockServices: Service[] = [
  {
    id: "s1",
    name: "General Advising",
    description: "Walk-in academic advising",
    expectedDurationMinutes: 15,
    priority: "medium",
    estimatedWaitMinutes: 30,
    queueLength: 6,
    isOpen: true,
  },
  {
    id: "s2",
    name: "Financial Aid",
    description: "Questions about aid and billing",
    expectedDurationMinutes: 20,
    priority: "high",
    estimatedWaitMinutes: 45,
    queueLength: 9,
    isOpen: true,
  },
  {
    id: "s3",
    name: "IT Help Desk",
    description: "Account and device support",
    expectedDurationMinutes: 10,
    priority: "low",
    estimatedWaitMinutes: 10,
    queueLength: 2,
    isOpen: false,
  },
  {
    id: "s4",
    name: "Registrar",
    description: "Transcripts, enrollment verification, and records",
    expectedDurationMinutes: 12,
    priority: "medium",
    estimatedWaitMinutes: 25,
    queueLength: 5,
    isOpen: true,
  },
  {
    id: "s5",
    name: "Career Services",
    description: "Resume reviews and interview prep",
    expectedDurationMinutes: 30,
    priority: "low",
    estimatedWaitMinutes: 60,
    queueLength: 4,
    isOpen: true,
  },
];

export const mockQueueEntry: QueueEntry = {
  id: "q1",
  serviceId: "s1",
  position: 3,
  estimatedWaitMinutes: 15,
  status: "waiting",
};

export const mockHistory: HistoryItem[] = [
  { id: "h1", date: "2026-09-28", serviceName: "IT Help Desk", outcome: "served" },
  { id: "h2", date: "2026-09-21", serviceName: "Financial Aid", outcome: "left" },
  { id: "h3", date: "2026-09-14", serviceName: "Registrar", outcome: "served" },
  { id: "h4", date: "2026-09-09", serviceName: "General Advising", outcome: "removed" },
  { id: "h5", date: "2026-09-02", serviceName: "Career Services", outcome: "served" },
  { id: "h6", date: "2026-08-26", serviceName: "Financial Aid", outcome: "served" },
];

export const mockNotifications: AppNotification[] = [
  {
    id: "n1",
    message: "You're next in line for General Advising",
    type: "status_change",
    read: false,
    timestamp: "2026-10-05T10:15:00",
  },
  {
    id: "n2",
    message: "Your wait time changed to 15 minutes",
    type: "queue_update",
    read: false,
    timestamp: "2026-10-05T10:05:00",
  },
  {
    id: "n3",
    message: "Your position moved up to 3 in General Advising",
    type: "queue_update",
    read: false,
    timestamp: "2026-10-05T09:50:00",
  },
  {
    id: "n4",
    message: "You joined the General Advising queue",
    type: "queue_update",
    read: true,
    timestamp: "2026-10-05T09:30:00",
  },
  {
    id: "n5",
    message: "You were served at the IT Help Desk",
    type: "status_change",
    read: true,
    timestamp: "2026-09-28T14:20:00",
  },
  {
    id: "n6",
    message: "You left the Financial Aid queue",
    type: "queue_update",
    read: true,
    timestamp: "2026-09-21T09:45:00",
  },
];