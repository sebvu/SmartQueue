"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { mockServices } from "../lib/mockData";
import { useQueue } from "../lib/QueueContext";
import { apiGet } from "../lib/api";
import { toService, type ApiQueueListItem } from "../lib/apiMappers";
import type { Service } from "../lib/types";
import styles from "../ui/join-queue/join-queue.module.css";

export default function JoinQueuePage() {
  const router = useRouter();
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const { queueEntry, error, joinQueue, leaveQueue } = useQueue();

  // Start with the sample services, then load the real queues from the API.
  const [services, setServices] = useState<Service[]>(mockServices);

  useEffect(() => {
    let cancelled = false;
    apiGet<ApiQueueListItem[]>("/api/queues").then((data) => {
      if (!cancelled && data) setServices(data.map(toService));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedService = services.find(
    (service) => service.id === selectedServiceId
  );

  async function handleJoin() {
    if (!selectedService || !selectedService.isOpen) {
      return;
    }

    const joined = await joinQueue(selectedService);
    if (joined) router.push("/queue-status");
  }

  return (
    <main className={styles.container}>
      <h1>Join Queue</h1>

      <p>Select a service to join.</p>

      <div className={styles.card}>
        <select
          value={selectedServiceId}
          onChange={(event) => setSelectedServiceId(event.target.value)}
        >
          <option value="">Select a service</option>

          {services.map((service) => (
            <option
              key={service.id}
              value={service.id}
              disabled={!service.isOpen}
            >
              {service.name}
              {!service.isOpen ? " (Closed)" : ""}
            </option>
          ))}
        </select>

        {selectedService && (
          <div>
            <h2>{selectedService.name}</h2>

            <p>{selectedService.description}</p>

            <p>
              Estimated wait: {selectedService.estimatedWaitMinutes} minutes
            </p>

            <p>People in queue: {selectedService.queueLength}</p>

            <button
              onClick={handleJoin}
              disabled={!selectedService.isOpen}
            >
              Join Queue
            </button>
          </div>
        )}

        {error && <p role="alert">{error}</p>}

        {queueEntry && (
          <div>
            <p>You are currently in a queue.</p>

            <button onClick={leaveQueue}>Leave Queue</button>
          </div>
        )}
      </div>
    </main>
  );
}