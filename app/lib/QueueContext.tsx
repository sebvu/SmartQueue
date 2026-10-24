"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { QueueEntry, Service } from "./types";
import { mockQueueEntry } from "./mockData";
import { apiGet, apiRequest } from "./api";
import { toCurrentEntry, type ApiMyEntry } from "./apiMappers";

type QueueContextType = {
  queueEntry: QueueEntry | null;
  serviceName: string | null; // name of the queue from the API, when known
  error: string | null; // last problem from the server, for the screen to show
  joinQueue: (service: Service) => Promise<boolean>;
  leaveQueue: () => Promise<void>;
  advance: () => void;
};

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export function QueueProvider({ children }: { children: ReactNode }) {
  // Start with the sample entry, then load the signed-in user's real one.
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(mockQueueEntry);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<ApiMyEntry[]>("/api/me/entries").then((data) => {
      if (cancelled || !data) return;
      if (data.length === 0) {
        setQueueEntry(null);
        setServiceName(null);
        return;
      }
      const current = toCurrentEntry(data[0]);
      setQueueEntry(current.entry);
      setServiceName(current.serviceName);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Returns true if the user is now in the queue.
  async function joinQueue(service: Service): Promise<boolean> {
    setError(null);
    const result = await apiRequest<ApiMyEntry>(`/api/queues/${service.id}/join`, "POST");
    if (result.ok && result.data) {
      const current = toCurrentEntry(result.data);
      setQueueEntry(current.entry);
      setServiceName(current.serviceName);
      return true;
    }
    if (result.status === 401) {
      // Not logged in: keep the old sample behavior so the screens still work.
      setQueueEntry({
        id: `q-${Date.now()}`,
        serviceId: service.id,
        position: service.queueLength + 1,
        estimatedWaitMinutes: service.estimatedWaitMinutes,
        status: "waiting",
      });
      setServiceName(service.name);
      return true;
    }
    setError(result.message ?? "Could not join the queue.");
    return false;
  }

  async function leaveQueue(): Promise<void> {
    setError(null);
    const current = queueEntry;
    if (current) {
      const result = await apiRequest(`/api/queues/${current.serviceId}/leave`, "POST");
      if (!result.ok && result.status !== 401 && result.status !== 404) {
        setError(result.message ?? "Could not leave the queue.");
        return;
      }
    }
    setQueueEntry(null);
    setServiceName(null);
  }

  function advance() {
    setQueueEntry((current) => {
      if (!current) return null;

      if (current.status === "waiting") {
        if (current.position > 1) {
          return {
            ...current,
            position: current.position - 1,
            estimatedWaitMinutes: Math.max(0, current.estimatedWaitMinutes - 5),
          };
        }

        return {
          ...current,
          position: 1,
          estimatedWaitMinutes: 0,
          status: "almost_ready",
        };
      }

      if (current.status === "almost_ready") {
        return {
          ...current,
          position: 0,
          estimatedWaitMinutes: 0,
          status: "served",
        };
      }

      return current;
    });
  }

  return (
    <QueueContext.Provider
      value={{ queueEntry, serviceName, error, joinQueue, leaveQueue, advance }}
    >
      {children}
    </QueueContext.Provider>
  );
}

export function useQueue() {
  const context = useContext(QueueContext);

  if (!context) {
    throw new Error("useQueue must be used inside QueueProvider");
  }

  return context;
}
