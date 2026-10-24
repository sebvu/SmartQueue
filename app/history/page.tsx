"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockHistory } from "@/app/lib/mockData";
import { apiGet } from "@/app/lib/api";
import { toHistoryItem, type ApiHistoryItem } from "@/app/lib/apiMappers";
import type { HistoryItem } from "@/app/lib/types";
import UserHeader from "@/app/ui/UserHeader";
import styles from "@/app/ui/history/history.module.css";

const OUTCOME_LABELS: Record<HistoryItem["outcome"], string> = {
  served: "Served",
  left: "Left the queue",
  removed: "Removed by staff",
};

const OUTCOME_CLASS: Record<HistoryItem["outcome"], string> = {
  served: styles.served,
  left: styles.left,
  removed: styles.removed,
};

// History dates are plain "YYYY-MM-DD" strings. Parsing them directly treats them
// as UTC and can show the day before in US time zones, so parse as a local date.
function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HistoryPage() {
  // Start with the sample data, then replace it with the signed-in user's real history.
  const [history, setHistory] = useState<HistoryItem[]>(mockHistory);

  useEffect(() => {
    let cancelled = false;
    apiGet<ApiHistoryItem[]>("/api/me/history").then((data) => {
      if (!cancelled && data) setHistory(data.map(toHistoryItem));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Newest first. ISO dates sort correctly as strings.
  const items = [...history].sort((a, b) => b.date.localeCompare(a.date));
  const servedCount = items.filter((item) => item.outcome === "served").length;

  return (
    <>
      <UserHeader />
      <main className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>History</h1>
          <p className={styles.summary}>
            {items.length === 0
              ? "No past visits"
              : `${items.length} ${items.length === 1 ? "visit" : "visits"}, ${servedCount} served`}
          </p>
        </header>

        {items.length === 0 ? (
          <section className={styles.empty}>
            <h2 className={styles.emptyTitle}>No history yet</h2>
            <p className={styles.emptyText}>
              Once you&apos;ve joined a queue, your past visits will show up here.
            </p>
            <Link href="/user-dashboard" className={styles.emptyLink}>
              Go to dashboard
            </Link>
          </section>
        ) : (
          <div className={styles.card}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>Past queue visits, newest first</caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.th}>
                    Date
                  </th>
                  <th scope="col" className={styles.th}>
                    Service
                  </th>
                  <th scope="col" className={styles.th}>
                    Outcome
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={styles.row}>
                    <td className={styles.date}>
                      <time dateTime={item.date}>{formatDate(item.date)}</time>
                    </td>
                    <td className={styles.service}>{item.serviceName}</td>
                    <td className={styles.outcomeCell}>
                      <span className={`${styles.badge} ${OUTCOME_CLASS[item.outcome]}`}>
                        <span className={styles.dot} aria-hidden="true" />
                        {OUTCOME_LABELS[item.outcome]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
