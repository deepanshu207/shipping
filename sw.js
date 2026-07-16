/**
 * Background poller for SERVER-mode jobs only.
 * Persists pending jobs so polling resumes after the SW restarts.
 */
const POLL_MS = 3000;
const DB_NAME = "meesho-sw";
const PENDING_STORE = "pending";
const DONE_STORE = "completed";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const jobs = await loadAllPending();
      jobs.forEach((job) => {
        if (job.serverMode) schedulePoll(job.requestId);
      });
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "TRACK_JOB" && data.requestId && data.serverMode) {
    const job = {
      requestId: data.requestId,
      origin: String(data.origin || self.location.origin).replace(/\/$/, ""),
      modeName: data.modeName || "Optimization",
      isLingerie: !!data.isLingerie,
      isAuto: !!data.isAuto,
      serverMode: true,
      startedAt: data.startedAt || Date.now(),
      maxMs: data.maxMs || 45 * 60 * 1000,
    };
    savePending(job).then(() => schedulePoll(job.requestId));
  }
  if (data.type === "UNTRACK_JOB" && data.requestId) {
    deletePending(data.requestId);
  }
  if (data.type === "PING_JOB" && data.requestId) {
    schedulePoll(data.requestId);
  }
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: "requestId" });
      }
      if (!db.objectStoreNames.contains(DONE_STORE)) {
        db.createObjectStore(DONE_STORE, { keyPath: "requestId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function savePending(job) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readwrite");
    tx.objectStore(PENDING_STORE).put(job);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadPending(requestId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readonly");
    const get = tx.objectStore(PENDING_STORE).get(requestId);
    get.onsuccess = () => resolve(get.result || null);
    get.onerror = () => reject(get.error);
  });
}

async function loadAllPending() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, "readonly");
    const req = tx.objectStore(PENDING_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deletePending(requestId) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE, "readwrite");
      tx.objectStore(PENDING_STORE).delete(requestId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    /* ignore */
  }
}

async function saveDone(requestId, payload) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DONE_STORE, "readwrite");
      tx.objectStore(DONE_STORE).put({ requestId, ...payload, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    /* ignore */
  }
}

async function loadDone(requestId) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DONE_STORE, "readonly");
      const get = tx.objectStore(DONE_STORE).get(requestId);
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
    });
  } catch {
    return null;
  }
}

const pollTimers = new Map();

function schedulePoll(requestId) {
  if (pollTimers.has(requestId)) return;
  const timer = setTimeout(() => {
    pollTimers.delete(requestId);
    pollJob(requestId);
  }, 50);
  pollTimers.set(requestId, timer);
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

async function showDoneNotification(modeName, requestId) {
  if (!self.registration.showNotification) return;
  try {
    await self.registration.showNotification("Meesho images ready", {
      body: modeName + " — tap to view results",
      tag: "meesho-job-" + requestId,
      renotify: true,
      data: { requestId },
    });
  } catch (e) {
    /* permission denied */
  }
}

async function pollJob(requestId) {
  const meta = await loadPending(requestId);
  if (!meta) return;

  if (Date.now() - meta.startedAt > meta.maxMs) {
    await deletePending(requestId);
    notifyClients({ type: "JOB_FAILED", requestId, message: "Timed out on server" });
    return;
  }

  try {
    const res = await fetch(meta.origin + "/api/meesho/request-status/" + requestId, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error("status " + res.status);
    const data = await res.json();

    notifyClients({
      type: "JOB_UPDATE",
      requestId,
      progress: data.progress,
      progressLabel: data.progressLabel,
    });

    if (data.status === "completed" && data.results && data.results.length) {
      await deletePending(requestId);
      const payload = {
        results: data.results,
        modeName: meta.modeName,
        isLingerie: meta.isLingerie,
      };
      await saveDone(requestId, payload);
      await showDoneNotification(meta.modeName, requestId);
      notifyClients({ type: "JOB_DONE", requestId, ...payload });
      return;
    }

    if (data.status === "failed") {
      await deletePending(requestId);
      notifyClients({
        type: "JOB_FAILED",
        requestId,
        message: data.message || data.progressLabel || "Optimization failed",
      });
      return;
    }
  } catch (e) {
    /* server waking or network blip */
  }

  setTimeout(() => pollJob(requestId), POLL_MS);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestId = event.notification.data && event.notification.data.requestId;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.length) {
        clients[0].focus();
        clients[0].postMessage({ type: "OPEN_JOB", requestId });
        return;
      }
      const url = requestId ? "/?resumeJob=" + encodeURIComponent(requestId) : "/";
      await self.clients.openWindow(url);
    })()
  );
});
