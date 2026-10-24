"use client";
import styles from "../ui/queue-status/queue-status.module.css";
import { useQueue } from "../lib/QueueContext";
import { mockServices } from "../lib/mockData";

export default function QueueStatusPage() {
  const { queueEntry, serviceName, error, leaveQueue, advance } = useQueue();
  const service = mockServices.find(
    (item) => item.id === queueEntry?.serviceId
    );

  if (!queueEntry) {
    return (
      <main>
        <h1>Queue Status</h1>
        <p>You are not currently in a queue.</p>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <h1>Queue Status</h1>
      <div className={styles.card}>
    
      <h2>{serviceName ?? service?.name}</h2>

      <p>
        Current position: {queueEntry.position}
      </p>

      <p>
        Estimated wait: {queueEntry.estimatedWaitMinutes} minutes
      </p>

      <p>
        Status: {queueEntry.status}
      </p>

      {queueEntry.status !== "served" && (
        <button onClick={advance}>
          Simulate Next Step
        </button>
      )}

      {error && <p role="alert">{error}</p>}

      <button onClick={leaveQueue}>
        Leave Queue
      </button>
      </div>
    </main>
  );
}