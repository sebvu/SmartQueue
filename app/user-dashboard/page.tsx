"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useNotifications } from "@/app/lib/NotificationContext";
import { mockQueueEntry, mockServices } from "@/app/lib/mockData";
import { apiGet } from "@/app/lib/api";
import { toCurrentEntry, type ApiMyEntry } from "@/app/lib/apiMappers";
import { TYPE_LABELS, formatTime, formatWait } from "@/app/lib/format";
import type { QueueEntry, QueueStatus } from "@/app/lib/types";
import UserHeader from "@/app/ui/UserHeader";
import styles from "@/app/ui/user-dashboard/user-dashboard.module.css";

// Routes owned by the Join Queue / Queue Status screens. Change here if they differ.
const JOIN_QUEUE_PATH = "/join-queue";
const QUEUE_STATUS_PATH = "/queue-status";

const LATEST_NOTIFICATION_COUNT = 3;

const STATUS_COPY: Record<QueueStatus, { label: string; hint: string }> = {
  waiting: {
    label: "Waiting",
    hint: "You're in line. We'll let you know when you're close.",
  },
  almost_ready: {
    label: "Almost ready",
    hint: "You're almost up. Head to the service area.",
  },
  served: {
    label: "Served",
    hint: "You've been served. Thanks for waiting.",
  },
};

const STATUS_CLASS: Record<QueueStatus, string> = {
  waiting: styles.waiting,
  almost_ready: styles.almostReady,
  served: styles.served,
};

// The signed-in user's current queue, from the API. Falls back to the sample entry
// if the request fails (for example, not logged in yet).
type Current = { entry: QueueEntry | null; serviceName: string | null };

function useCurrentEntry(): Current {
  const [current, setCurrent] = useState<Current>({
    entry: mockQueueEntry,
    serviceName: null,
  });

  useEffect(() => {
    let cancelled = false;
    apiGet<ApiMyEntry[]>("/api/me/entries").then((data) => {
      if (cancelled || !data) return;
      setCurrent(data.length > 0 ? toCurrentEntry(data[0]) : { entry: null, serviceName: null });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return current;
}

export default function UserDashboardPage() {
  const { notifications, unreadCount } = useNotifications();
  const { entry, serviceName } = useCurrentEntry();

  const currentService = entry
    ? mockServices.find((s) => s.id === entry.serviceId)
    : undefined;

  const openServices = mockServices.filter((s) => s.isOpen);
  const closedCount = mockServices.length - openServices.length;

  const latest = useMemo(
    () =>
      [...notifications]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, LATEST_NOTIFICATION_COUNT),
    [notifications]
  );

  return (
    <>
      <UserHeader />
      <main className={styles.page}>
        <h1 className={styles.title}>Dashboard</h1>

        <section className={styles.statusCard} aria-labelledby="status-heading">
          <h2 id="status-heading" className={styles.sectionTitle}>
            Your queue
          </h2>

          {entry ? (
            <>
              <div className={styles.statusTop}>
                <p className={styles.serviceName}>
                  {serviceName ?? currentService?.name ?? "Your queue"}
                </p>
                <span className={`${styles.badge} ${STATUS_CLASS[entry.status]}`}>
                  <span className={styles.dot} aria-hidden="true" />
                  {STATUS_COPY[entry.status].label}
                </span>
              </div>

              {entry.status !== "served" && (
                <dl className={styles.stats}>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>Position</dt>
                    <dd className={styles.statValue}>{entry.position}</dd>
                  </div>
                  <div className={styles.stat}>
                    <dt className={styles.statLabel}>Estimated wait</dt>
                    <dd className={styles.statValue}>
                      {formatWait(entry.estimatedWaitMinutes)}
                    </dd>
                  </div>
                </dl>
              )}

              <p className={styles.hint}>{STATUS_COPY[entry.status].hint}</p>
              <Link href={QUEUE_STATUS_PATH} className={styles.primaryLink}>
                View queue status
              </Link>
            </>
          ) : (
            <div className={styles.emptyInline}>
              <p className={styles.emptyTitle}>You&apos;re not in a queue</p>
              <p className={styles.emptyText}>
                Pick a service below to join the line and track your spot.
              </p>
            </div>
          )}
        </section>

        <div className={styles.columns}>
          <section className={styles.panel} aria-labelledby="services-heading">
            <h2 id="services-heading" className={styles.sectionTitle}>
              Open services
            </h2>

            {openServices.length === 0 ? (
              <p className={styles.emptyText}>
                No services are open right now. Check back soon.
              </p>
            ) : (
              <ul className={styles.list}>
                {openServices.map((service) => {
                  const isCurrent = entry?.serviceId === service.id;
                  return (
                    <li key={service.id} className={styles.serviceRow}>
                      <div className={styles.serviceInfo}>
                        <p className={styles.serviceTitle}>{service.name}</p>
                        <p className={styles.meta}>
                          About {formatWait(service.estimatedWaitMinutes)} wait
                          <span className={styles.sep} aria-hidden="true">
                            /
                          </span>
                          {service.queueLength} in line
                        </p>
                      </div>
                      {isCurrent ? (
                        <span className={styles.joined}>You&apos;re in this queue</span>
                      ) : (
                        <Link
                          href={`${JOIN_QUEUE_PATH}?service=${service.id}`}
                          className={styles.joinLink}
                          aria-label={`Join ${service.name}`}
                        >
                          Join
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {closedCount > 0 && (
              <p className={styles.note}>
                {closedCount === 1
                  ? "1 service is closed right now."
                  : `${closedCount} services are closed right now.`}
              </p>
            )}
          </section>

          <section
            className={styles.panel}
            aria-labelledby="notifications-heading"
          >
            <div className={styles.panelHeader}>
              <h2 id="notifications-heading" className={styles.sectionTitle}>
                Notifications
              </h2>
              <p className={styles.unreadCount} aria-live="polite">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>

            {latest.length === 0 ? (
              <p className={styles.emptyText}>
                Updates about your place in line will show up here.
              </p>
            ) : (
              <ul className={styles.list}>
                {latest.map((n) => (
                  <li
                    key={n.id}
                    className={`${styles.noteRow} ${
                      n.read ? styles.read : styles.unread
                    }`}
                  >
                    <p className={styles.noteMessage}>
                      {!n.read && <span className={styles.srOnly}>Unread: </span>}
                      {n.message}
                    </p>
                    <p className={styles.meta}>
                      {TYPE_LABELS[n.type]}
                      <span className={styles.sep} aria-hidden="true">
                        /
                      </span>
                      <time dateTime={n.timestamp}>{formatTime(n.timestamp)}</time>
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <Link href="/notifications" className={styles.viewAll}>
              View all notifications
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
