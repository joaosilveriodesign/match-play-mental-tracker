const DB_NAME = "match-play-mental-tracker";
const DB_VERSION = 1;

function request(requestObject) {
  return new Promise((resolve, reject) => {
    requestObject.onsuccess = () => resolve(requestObject.result);
    requestObject.onerror = () => reject(requestObject.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase() {
  const opening = indexedDB.open(DB_NAME, DB_VERSION);
  opening.onupgradeneeded = () => {
    const database = opening.result;
    if (!database.objectStoreNames.contains("sessions")) {
      const sessions = database.createObjectStore("sessions", { keyPath: "id" });
      sessions.createIndex("date", "date");
      sessions.createIndex("status", "status");
    }
    if (!database.objectStoreNames.contains("points")) {
      const points = database.createObjectStore("points", { keyPath: "id" });
      points.createIndex("sessionId", "sessionId");
      points.createIndex("sessionNumber", ["sessionId", "number"], { unique: true });
    }
  };
  return request(opening);
}

async function withStore(names, mode, callback) {
  const database = await openDatabase();
  const tx = database.transaction(names, mode);
  const done = transactionDone(tx);
  const result = await callback(tx);
  await done;
  database.close();
  return result;
}

export const db = {
  async sessions() {
    const rows = await withStore(["sessions"], "readonly", (tx) => request(tx.objectStore("sessions").getAll()));
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  },
  async activeSession() {
    const sessions = await this.sessions();
    return sessions.find((session) => session.status === "active") || null;
  },
  async saveSession(session) {
    await withStore(["sessions"], "readwrite", (tx) => request(tx.objectStore("sessions").put(session)));
    return session;
  },
  async deleteSession(id) {
    await withStore(["sessions", "points"], "readwrite", async (tx) => {
      const pointStore = tx.objectStore("points");
      const keys = await request(pointStore.index("sessionId").getAllKeys(id));
      keys.forEach((key) => pointStore.delete(key));
      tx.objectStore("sessions").delete(id);
    });
  },
  async points(sessionId) {
    const rows = await withStore(["points"], "readonly", (tx) => request(tx.objectStore("points").index("sessionId").getAll(sessionId)));
    return rows.sort((a, b) => a.number - b.number);
  },
  async allPoints() {
    return withStore(["points"], "readonly", (tx) => request(tx.objectStore("points").getAll()));
  },
  async savePoint(point) {
    await withStore(["points"], "readwrite", (tx) => request(tx.objectStore("points").put(point)));
    return point;
  },
  async deletePoint(id) {
    await withStore(["points"], "readwrite", (tx) => request(tx.objectStore("points").delete(id)));
  },
  async importBackup(sessions, points) {
    return withStore(["sessions", "points"], "readwrite", async (tx) => {
      const sessionStore = tx.objectStore("sessions");
      const pointStore = tx.objectStore("points");
      let addedSessions = 0;
      let addedPoints = 0;
      let skippedSessions = 0;
      for (const session of sessions) {
        if (await request(sessionStore.get(session.id))) {
          skippedSessions += 1;
          continue;
        }
        sessionStore.add({ ...session, status: "ended" });
        addedSessions += 1;
        for (const point of points.filter((item) => item.sessionId === session.id)) {
          pointStore.add(point);
          addedPoints += 1;
        }
      }
      return { addedSessions, addedPoints, skippedSessions };
    });
  }
};

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
