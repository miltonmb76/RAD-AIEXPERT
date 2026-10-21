import assert from "node:assert/strict";
import { test as nodeTest } from "node:test";
import {
  saveActiveSessionAnnexBundle,
  loadActiveSessionAnnexBundle,
  clearActiveSessionAnnexBundle,
} from "../src/lib/activeSessionDraft.ts";

const test = (name, fn) => nodeTest(name, { timeout: 2000 }, fn);

// Synthetic storage only: no browser profile, network, or patient records.
function installStorage({ failures = [], failRead = false, failDelete = false } = {}) {
  const rows = new Map();
  const connections = [];
  globalThis.sessionStorage = { getItem: () => null };
  globalThis.indexedDB = {
    open() {
      const connection = {
        closed: false,
        active: false,
        close() {
          assert.equal(this.active, false, "close only after transaction settles");
          this.closed = true;
        },
        transaction() {
          this.active = true;
          const tx = {
            error: null,
            objectStore: () => ({
              put: (value) => request("put", value),
              get: () => request("get"),
              delete: () => request("delete"),
            }),
          };
          const request = (kind, value) => {
            const failure = kind === "put" ? failures.shift()
              : kind === "get" && failRead ? "abort"
              : kind === "delete" && failDelete ? "abort" : null;
            if (failure === "throw") {
              this.active = false;
              throw new Error("Synthetic structured-clone failure");
            }
            const req = { result: undefined, error: null };
            queueMicrotask(() => {
              this.active = false;
              if (failure) {
                tx.error = new Error("Synthetic storage failure");
                req.error = tx.error;
                if (failure === "abort") tx.onabort?.();
                else tx.onerror?.();
                return;
              }
              if (kind === "put") rows.set(value.id, structuredClone(value));
              if (kind === "get") req.result = structuredClone(rows.get("current"));
              if (kind === "delete") rows.delete("current");
              req.onsuccess?.();
              tx.oncomplete?.();
            });
            return req;
          };
          return tx;
        },
      };
      connections.push(connection);
      const req = { result: connection };
      queueMicrotask(() => req.onsuccess());
      return req;
    },
  };
  return {
    rows,
    connections,
    assertReleased() {
      assert.ok(connections.length > 0);
      assert.ok(connections.every((connection) => connection.closed), "all connections released");
    },
  };
}

const bundle = (index = 0) => ({
  reportFingerprint: "synthetic-study",
  diagnosisAnchor: "Synthetic test data",
  operationalSummaryText: `Synthetic module ${index}`,
  attachedImages: [{ id: "synthetic-image", url: "data:image/png;base64,AAAA" }],
  findings3dRenders: [],
});

test("repeated module saves retain annexes and release every connection", async () => {
  const storage = installStorage();
  for (let i = 0; i < 50; i++) {
    assert.equal(await saveActiveSessionAnnexBundle(bundle(i)), true);
    storage.assertReleased();
  }
  const recovered = await loadActiveSessionAnnexBundle("synthetic-study");
  assert.equal(recovered.operationalSummaryText, "Synthetic module 49");
  assert.deepEqual(recovered.attachedImages, bundle().attachedImages);
  assert.equal(await loadActiveSessionAnnexBundle("different-study"), null);
  await clearActiveSessionAnnexBundle();
  assert.equal(await loadActiveSessionAnnexBundle(), null);
  storage.assertReleased();
});

test("simultaneous saves remain supported", async () => {
  const storage = installStorage();
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => saveActiveSessionAnnexBundle(bundle(i))));
  assert.ok(results.every(Boolean));
  const recovered = await loadActiveSessionAnnexBundle("synthetic-study");
  assert.ok(recovered.operationalSummaryText.startsWith("Synthetic module"));
  assert.deepEqual(recovered.attachedImages, bundle().attachedImages);
  storage.assertReleased();
});

for (const failure of ["error", "abort", "throw"]) {
  test(`${failure}: failed full save releases connection and preserves existing slim retry`, async () => {
    const storage = installStorage({ failures: [failure] });
    assert.equal(await saveActiveSessionAnnexBundle(bundle()), true);
    const recovered = await loadActiveSessionAnnexBundle("synthetic-study");
    assert.equal(recovered.diagnosisAnchor, bundle().diagnosisAnchor);
    assert.deepEqual(recovered.attachedImages, []);
    storage.assertReleased();
  });
}

test("both saves failing returns false and releases both connections", async () => {
  const storage = installStorage({ failures: ["abort", "error"] });
  assert.equal(await saveActiveSessionAnnexBundle(bundle()), false);
  assert.equal(storage.rows.size, 0);
  storage.assertReleased();
});

test("aborted reads and deletes settle and release their connections", async () => {
  const storage = installStorage({ failRead: true, failDelete: true });
  assert.equal(await loadActiveSessionAnnexBundle(), null);
  await clearActiveSessionAnnexBundle();
  storage.assertReleased();
});
