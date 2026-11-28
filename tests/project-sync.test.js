import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { conflictCopy, syncDecision } from "../src/project-sync.js";
import { newDraft } from "../supabase/functions/_shared/domain.js";

test("online and local revisions preserve both divergent projects", () => {
  const based = { cloudRevision: 3, cloudFingerprint: "base" };
  assert.equal(syncDecision(based, 3, "base", "edit"), "save");
  assert.equal(syncDecision(based, 4, "remote", "base"), "load");
  assert.equal(syncDecision(based, 4, "remote", "edit"), "copy");
  assert.equal(syncDecision(based, 4, "edit", "edit"), "match");
  assert.equal(syncDecision({ cloudRevision: 3 }, 4, "remote", "local"), "copy");
  const original = { ...based, cloudOwner: "owner", draft: newDraft(), worksheets: [{ id: "sheet" }] };
  const copy = conflictCopy(original);
  assert.notEqual(copy.draft.id, original.draft.id);
  assert.deepEqual(copy.worksheets, original.worksheets);
  assert.equal(copy.cloudRevision, 0);
  assert.equal(copy.cloudOwner, null);
});

test("autosaves new worksheets after reconnect and lets the owner choose which version to open", async () => {
  const dom = new JSDOM("<!doctype html><html lang='de'><head><title>Sync</title></head><body></body></html>", {
    url: "https://example.test/", pretendToBeVisual: true,
  });
  for (const [name, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, MutationObserver: dom.window.MutationObserver,
    HTMLElement: dom.window.HTMLElement,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  }))
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  dom.window.confirm = () => true;
  dom.window.scrollTo = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};

  const draft = newDraft();
  draft.context.thema = "Online-Seminar";
  draft.learning = ["per"];
  const key = "7rizons:project:v1:" + draft.id;
  localStorage.setItem("7rizons:active-project", draft.id);
  localStorage.setItem("7rizons:tour-intro:v2", "seen");
  localStorage.setItem(key, JSON.stringify({ draft, worksheets: [], cloudRevision: 1, step: 4 }));
  let remote = { id: draft.id, revision: 1, updated_at: "2026-11-28T09:20:00Z", payload: { draft, worksheets: [] }, admin_shared_at: null };
  function changeOnline(topic) {
    remote = {
      ...remote, revision: remote.revision + 1,
      payload: { ...remote.payload, draft: {
        ...remote.payload.draft,
        revision: remote.payload.draft.revision + 1,
        context: { ...remote.payload.draft.context, thema: topic },
      } },
    };
  }
  let changeBeforeWrite = false;
  let online = true;
  Object.defineProperty(navigator, "onLine", { get: () => online });
  const writes = [];
  const created = new Map();
  const ok = (data) => ({ data, error: null });
  const fakeCloud = {
    auth: {
      getSession: async () => ok({ session: { user: { id: "account" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from(table) {
      const filters = {};
      const query = {
        select: () => query,
        eq(col, val) { filters[col] = val; return query; },
        order: () => query,
        abortSignal: () => query,
        then(fn) {
          return Promise.resolve(ok(table === "configurations" ? [remote, ...created.values()] : [])).then(fn);
        },
        single: async () => ok(null),
        maybeSingle: async () => {
          assert.equal(table, "configurations");
          assert.equal(filters.owner_id, "account");
          assert.ok(online, "connection was checked before querying");
          return ok(structuredClone(filters.id === draft.id ? remote : created.get(filters.id) || null));
        },
      };
      return query;
    },
    async rpc(name, args) {
      if (name !== "save_configuration" && name !== "save_configuration_for_administration")
        return ok([]);
      assert.ok(online);
      if (args.p_id === remote.id && changeBeforeWrite) {
        changeBeforeWrite = false;
        changeOnline("Zeitgleich online bearbeitet");
        return { error: new Error("Stale revision") };
      }
      const previous = args.p_id === remote.id ? remote : created.get(args.p_id);
      assert.equal(args.p_revision, previous?.revision || 0);
      writes.push(name);
      const updated = {
        ...previous, id: args.p_id, revision: args.p_revision + 1,
        payload: structuredClone(args.p_payload),
      };
      if (args.p_id === remote.id) remote = updated;
      else created.set(args.p_id, updated);
      return ok(updated.revision);
    },
  };
  globalThis.projectSyncTestCloud = fakeCloud;
  const temp = resolve("tests", `.sync-${process.pid}.mjs`);
  const bundle = await build({
    entryPoints: ["src/App.jsx"], bundle: true, packages: "external",
    format: "esm", platform: "node", write: false,
    loader: { ".png": "dataurl" },
    plugins: [{
      name: "cloud-test",
      setup(builder) {
        builder.onResolve({ filter: /^\.\/cloud\.js$/ }, () => ({ path: "cloud", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const cloud = globalThis.projectSyncTestCloud;
          export const unwrap = ({data,error}) => { if(error) throw error; return data; };
          export function callFunction() { throw Error("Unexpected Edge Function"); }`,
        }));
      },
    }],
  });
  await writeFile(temp, bundle.outputFiles[0].text);
  const React = await import("react");
  const { render, screen, waitFor, cleanup, act } = await import("@testing-library/react");
  const person = (await import("@testing-library/user-event")).default.setup({ document });
  try {
    const { default: App } = await import(pathToFileURL(temp).href);
    render(React.createElement(App));
    const status = () => document.querySelector(".configurator-meta .save-status").textContent;
    const click = (name) => person.click(screen.getByRole("button", { name }));
    await waitFor(() => assert.equal(JSON.parse(localStorage.getItem(key)).cloudOwner, "account"), { timeout: 2500 });
    assert.deepEqual(writes, [], "attaching an unchanged legacy project does not write it");
    online = false;
    await click(/^5\s*Arbeitsblatt/);
    await waitFor(() => assert.equal(JSON.parse(localStorage.getItem(key)).worksheets.length, 1));
    assert.match(status(), /Offline/);
    assert.equal(remote.payload.worksheets.length, 0);

    online = true;
    await act(async () => window.dispatchEvent(new window.Event("online")));
    await waitFor(() => assert.equal(remote.payload.worksheets.length, 1), { timeout: 2500 });
    assert.deepEqual(writes, ["save_configuration"]);
    assert.equal(remote.admin_shared_at, null);
    assert.equal(Object.hasOwn(remote.payload, "cloudOwner"), false);
    await waitFor(() => assert.equal(status(), "Lokal und online gespeichert"));

    online = false;
    await click(/^1\s*Organisatorisches/);
    const topic = screen.getByLabelText(/Thema des Seminars/);
    await person.clear(topic);
    await person.type(topic, "Laptop-Änderung");
    changeOnline("Handy-Änderung");
    online = true;
    await act(async () => window.dispatchEvent(new window.Event("online")));
    await screen.findByRole("heading", { name: "Neuere Online-Version verfügbar" });
    assert.equal(topic.value, "Laptop-Änderung", "a newer online version never replaces the open editor by itself");
    assert.deepEqual(writes, ["save_configuration"], "it never overwrites the other device");
    assert.equal(screen.queryByRole("button", { name: "Beide behalten" }), null);
    await click("Versionen vergleichen");
    assert.ok(screen.getByRole("heading", { name: "Online-Version 3" }));
    assert.ok(screen.getByText("Handy-Änderung", { selector: ".sync-version strong" }));
    assert.equal(document.querySelectorAll(".sync-version time").length, 2);
    await click("Beide behalten");
    await waitFor(() => assert.notEqual(localStorage.getItem("7rizons:active-project"), draft.id));
    const copyId = localStorage.getItem("7rizons:active-project");
    const workingCopy = JSON.parse(localStorage.getItem("7rizons:project:v1:" + copyId));
    assert.equal(workingCopy.draft.context.thema, "Laptop-Änderung");
    assert.match(workingCopy.projectName, /^Laptop-Änderung · Lokale Fassung vom /);
    assert.equal(workingCopy.worksheets.length, 1);
    assert.equal(workingCopy.cloudRevision, 0);
    assert.equal(workingCopy.syncCopy, true);
    assert.equal(JSON.parse(localStorage.getItem(key)).draft.context.thema, "Handy-Änderung");
    assert.deepEqual(writes, ["save_configuration"], "the local copy has not been uploaded");

    await person.click(document.querySelector(".project-menu summary"));
    await click("Online speichern");
    await waitFor(() => assert.equal(created.get(copyId)?.revision, 1));
    assert.equal(created.get(copyId).payload.projectName, workingCopy.projectName);
    assert.deepEqual(writes, ["save_configuration", "save_configuration_for_administration"]);

    await person.click(document.querySelector(".project-menu summary"));
    await click(/Handy-Änderung/);
    await waitFor(() => assert.equal(localStorage.getItem("7rizons:active-project"), draft.id));
    changeOnline("Online-Version zum Öffnen");
    await act(async () => window.dispatchEvent(new window.Event("focus")));
    await screen.findByRole("heading", { name: "Neuere Online-Version verfügbar" });
    await click("Versionen vergleichen");
    dom.window.confirm = () => false;
    await click("Lokale Änderungen verwerfen");
    assert.equal(JSON.parse(localStorage.getItem(key)).draft.context.thema, "Handy-Änderung");
    dom.window.confirm = () => true;
    await click("Lokale Änderungen verwerfen");
    await waitFor(() => assert.equal(JSON.parse(localStorage.getItem(key)).draft.context.thema, "Online-Version zum Öffnen"));
    assert.equal(Object.keys(localStorage).filter((name) => name.startsWith("7rizons:project:v1:")).length, 2);

    await click(/^1\s*Organisatorisches/);
    online = false;
    const editedTopic = screen.getByLabelText(/Thema des Seminars/);
    await person.clear(editedTopic);
    await person.type(editedTopic, "Mein Offline-Stand");
    changeOnline("Stärkerer Online-Stand");
    online = true;
    await act(async () => window.dispatchEvent(new window.Event("online")));
    await screen.findByRole("heading", { name: "Neuere Online-Version verfügbar" });
    await click("Versionen vergleichen");

    changeOnline("Seit Öffnen des Vergleichs bearbeitet");
    await click("Lokalen Stand behalten");
    await screen.findByText(/Online-Version wurde inzwischen geändert/);
    assert.equal(remote.payload.draft.context.thema, "Seit Öffnen des Vergleichs bearbeitet");

    changeBeforeWrite = true;
    await click("Lokalen Stand behalten");
    await screen.findByText(/Online-Version wurde inzwischen geändert/);
    assert.equal(remote.payload.draft.context.thema, "Zeitgleich online bearbeitet");
    assert.equal(editedTopic.value, "Mein Offline-Stand");
    assert.equal(writes.length, 2);

    await click("Lokalen Stand behalten");
    await waitFor(() => assert.equal(remote.payload.draft.context.thema, "Mein Offline-Stand"));
    await waitFor(() => assert.equal(status(), "Lokal und online gespeichert"));
    assert.equal(remote.admin_shared_at, null);
    assert.deepEqual(writes, ["save_configuration", "save_configuration_for_administration", "save_configuration"]);
  } finally {
    cleanup();
    dom.window.close();
    delete globalThis.projectSyncTestCloud;
    await rm(temp, { force: true });
  }
});
