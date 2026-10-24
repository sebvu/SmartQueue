"use client";

import styles from "@/app/ui/admin-dashboard/admin-dashboard.module.css";
import { useEffect, useRef, useState } from "react";

class User {
  id: number;
  name: string;
  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}

class Queue {
  id: number;
  name: string;
  currQueueLength: number;
  open: boolean;
  users: User[];
  currentUser: User | null;
  expectedDuration: number;
  description: string;
  constructor(id: number, name: string, description: string, expectedDuration: number) {
    this.id = id;
    this.name = name;
    this.currQueueLength = 0;
    this.open = true;
    this.users = [];
    this.currentUser = null;
    this.description = description;
    this.expectedDuration = expectedDuration;
  }

  addUser(user: User) {
    this.users.push(user);
    this.currQueueLength = this.currQueueLength + 1;
  }

  removeUser(user: User) {
    this.users = this.users.filter((currentUser) => currentUser !== user);
    this.currQueueLength = this.currQueueLength - 1;
  }

  serviceNextUser() {
    this.users.pop();
    this.currQueueLength = this.users.length;
  }
}

interface queueTest {
    queue_id: number;
    org_id: number;
    name: string;
    description: string;
    expected_duration_minutes: number;
    priority_level: string;
    is_active: boolean;
    max_capacity: number;
    is_gated: boolean;
    waitlist_enabled: boolean;
    geofence_enabled: boolean;
    target_latitude: number | null;
    target_longitude: number | null;
    allowed_radius_meters: number;
    created_at: string;
}

export default function Page() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(null);
  const [expectedDuration, setExpectedDuration] = useState("");
  const [creatingQueue, setCreatingQueue] = useState(false);
  const [queueName, setQueueName] = useState("");
  const [queueDescription, setQueueDescription] = useState("");
  const [testQueues, setTestQueues] = useState<queueTest[]>([]);
  const selectedQueue = queues.find((queue) => queue.id === selectedQueueId);

  const currQueueId = useRef(1);

  useEffect(() => {
    // try {
      const fetchQueues = async () => {
      const queueRes = await (fetch("../api/getQueues"));
      
      // if (!queueRes.ok) {
      //   throw new Error("Failed to fetch queues");
      // }

      const data: queueTest[] = await queueRes.json();
      setTestQueues(data);
      console.log(data);
    // } catch (error) {
    //   console.error("LOLLLL", error);
    // } finally {
    //   console.log("bozo");
    // }
    }
  // }
  fetchQueues();
}, []);

  async function createQueue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const newQueue = new Queue(
      currQueueId.current,
      queueName,
      queueDescription,
      Number(expectedDuration),
    );

    const res = await fetch("../api/addQueue", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        queueId: currQueueId,
        orgId: "o0",
        name: queueName,
        description: queueDescription,
        expectedDuration: Number(expectedDuration),
        priorityLevel: "LOW",
        maxCapacity: 50
      })
    });

    currQueueId.current += 1;

    setQueues((currentQueues) => [
      ...currentQueues,
      newQueue,
    ]);

    setQueueName("");
    setQueueDescription("");
    setExpectedDuration("");
    setCreatingQueue(false);
  }

  function deleteQueue(id: number) {
    setQueues((currentQueues) => currentQueues.filter((queue) => queue.id !== id))
  }

  function updateQueueStatus(queue: Queue) {
    queue.open = (queue.open ? false : true);
  }


  function QueueList() {
    return (
      <div className={styles.queueListContainer}>
          <h1 onClick={() => setSelectedQueueId(null)}>Queue List</h1>
          {creatingQueue ? (
          <form onSubmit={createQueue}>
            <input
              type="text"
              placeholder="Queue name"
              value={queueName}
              onChange={(e) => setQueueName(e.target.value)}
              required
            />

            <textarea
              placeholder="Description"
              value={queueDescription}
              onChange={(e) => setQueueDescription(e.target.value)}
              required
            />

            <input
              type="number"
              placeholder="Expected duration (minutes)"
              value={expectedDuration}
              onChange={(e) => setExpectedDuration(e.target.value)}
              min="1"
              required
            />

            <button type="submit">
              Create
            </button>

            <button
              type="button"
              onClick={() => setCreatingQueue(false)}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            className={styles.createQueueButton}
            onClick={() => setCreatingQueue(true)}
          >
            Create Queue
          </button>
        )}
          <ul className={styles.queueList}>
            {queues.map((queue) => (
              <li
                key={queue.id}
                className={styles.queueItem}
                onClick={() => setSelectedQueueId(queue.id)}>
                {queue.name}
              </li>
            ))}
          </ul>
      </div>
    )
  }

  function Panel() {
    return (
      <div className={styles.mainContent}>
          <ul className={styles.queuePanel}>
            {queues.map((queue) => (
              <li key={queue.id} className={styles.panelItem}>
                <div className={styles.panelItemInfo}>
                  <p>{"Name: " + queue.name}</p>
                  <p>{"ID: " + queue.id}</p>
                  <p>{"Status: " + (queue.open ? "Open" : "Closed")}</p>
                  <p>{queue.expectedDuration + " minute wait"}</p>
                </div>

                <div className={styles.panelItemButtons}>
                  <button onClick={() => updateQueueStatus(queue)}>Open/Close</button>
                  <button onClick={() => setSelectedQueueId(queue.id)}>Manage Queue</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
    )
  }

  function ManageQueue() {
    return (
      <div className={styles.mainContent}>
        <div className={styles.manageTitle}>
          <span>{selectedQueue?.name}</span>
          <span>{"ID: " + selectedQueue?.id}</span>
        </div>
        <div className={styles.description}>Description: {selectedQueue?.description}</div>
        <div className={styles.divider}></div>
        <div className={styles.queueStatusInfo}>
          <p>{selectedQueue?.open ? "Open" : "Closed"}</p>
          <p>{selectedQueue?.currQueueLength + " in Line"}</p>
          <p>{selectedQueue?.expectedDuration + " minute wait"}</p>
          <p>{"Current User: " + (selectedQueue?.currentUser ? selectedQueue?.currentUser : "None")}</p>
        </div>
        <div className={styles.queueActions}>
          <button onClick={selectedQueue?.serviceNextUser}>Service Next User</button>
          <button onClick={() => selectedQueue?.addUser(new User(Date.now(), "TestUser"))}>Add TestUser</button>
        </div>
        <ul className={styles.manageUsersList}>
          {selectedQueue?.users.map((user) => (
            <li key={user.id}>
              {user.name}
              <button onClick={() => selectedQueue.removeUser(user)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    // must always return a root!
    <div className={styles.main}>
      <QueueList/>
      {selectedQueue ? (
        <ManageQueue/>
      ) : (
        <Panel />
      )}
    </div>
  );
}