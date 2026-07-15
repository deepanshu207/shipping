/**
 * Background job poller — keeps checking optimization status while the tab is
 * in the background and notifies when results are ready.
 */
const ACTIVE_JOBS = new Map();
const POLL_MS = 2500;
const RESULTS_DB = "meesho-sw";
const RESULTS_STORE = "completed";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "TRACK_JOB" && data.requestId) {
    ACTIVE_JOBS.set(data.requestId, {
      requestId: data.requestId,
      origin: String(data.origin || self.location.origin).replace(/\/$/, ""),
      modeName: data.modeName || "Optimization",
      isLingerie: !!data.isLingerie,
      isAuto: !!data.isAuto,
      startedAt: Date.now(),
      maxMs: data.maxMs || 45 * 60 * 1000,
    });
    pollJob(data.requestId);
  }
  if (data.type === "UNTRACK_JOB" && data.requestId) {
    ACTIVE_JOBS.delete(data.requestId);
  }
});

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(RESULTS_DB, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(RESULTS_STORE, { keyPath: "requestId" });
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function saveCompletedJob(requestId, payload) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(RESULTS_STORE, "readwrite");
      tx.objectStore(RESULTS_STORE).put({ requestId, ...payload, savedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    /* ignore quota errors */
  }
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
  const meta = ACTIVE_JOBS.get(requestId);
  if (!meta) return;

  if (Date.now() - meta.startedAt > meta.maxMs) {
    ACTIVE_JOBS.delete(requestId);
    notifyClients({ type: "JOB_FAILED", requestId, message: "Timed out" });
    return;
  }

  try {
    const res = await fetch(meta.origin + "/api/meesho/request-status/" + requestId, {
      credentials: "include",
      cache: "no-store",
    });
    const data = await res.json();

    notifyClients({
      type: "JOB_UPDATE",
      requestId,
      progress: data.progress,
      progressLabel: data.progressLabel,
    });

    if (data.status === "completed" && data.results && data.results.length) {
      ACTIVE_JOBS.delete(requestId);
      const payload = {
        results: data.results,
        modeName: meta.modeName,
        isLingerie: meta.isLingerie,
      };
      await saveCompletedJob(requestId, payload);
      await showDoneNotification(meta.modeName, requestId);
      notifyClients({ type: "JOB_DONE", requestId, ...payload });
      return;
    }

    if (data.status === "failed") {
      ACTIVE_JOBS.delete(requestId);
      notifyClients({
        type: "JOB_FAILED",
        requestId,
        message: data.message || data.progressLabel || "Optimization failed",
      });
      return;
    }
  } catch (e) {
    /* network blip — keep polling */
  }

  setTimeout(() => pollJob(requestId), POLL_MS);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestId = event.notification.data && event.notification.data.requestId;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length) {
        const client = clients[0];
        client.focus();
        client.postMessage({ type: "OPEN_JOB", requestId });
        return;
      }
      return self.clients.openWindow("/");
    })
  );
});
