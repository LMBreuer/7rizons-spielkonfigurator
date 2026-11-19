import {
  isProjectId,
  readExchange,
  nextExchange,
  projectFingerprint,
  importDecision,
} from "./project-exchange.js";
import { t, useLanguage } from "./i18n.js";
import React, { useEffect, useRef, useState } from "react";
import { cloud, unwrap, callFunction } from "./cloud.js";
import {
  LE,
  MK,
  PROVIDERS,
  DEFAULT_SETTINGS,
  newDraft,
  settingsOf,
  conflicts,
  requestFor,
  makePrompt,
  parseResult,
  templateResult,
  markdown,
  readSnapshot,
  createWorksheet,
} from "../supabase/functions/_shared/domain.js";
import { trackInputMethod } from "./focus.js";
import { priorityOf } from "../supabase/functions/_shared/priority.js";
import Priority from "./Priority.jsx";
import Worksheet from "./Worksheet.jsx";
import ContextField from "./ContextField.jsx";
import { jsonFilename } from "./downloads.js";
import Logo from "./Logo.jsx";
import AppearanceSwitch from "./AppearanceSwitch.jsx";
import { APPEARANCE_KEY, initialAppearance } from "./appearance.js";
const STORAGE = "7rizons:draft:v1";
const steps = [
  "Kontext",
  "Lerntätigkeiten",
  "Mechaniken",
  "Übersicht",
  "Arbeitsblatt",
];
const PROJECT_PREFIX = "7rizons:project:v1:";
const ACTIVE_PROJECT = "7rizons:active-project";
function listProjects() {
  const projects = [];
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(PROJECT_PREFIX)) continue;
    try {
      const { draft, exchange, importCopy } = JSON.parse(
        localStorage.getItem(key),
      );
      projects.push({
        id: draft.id,
        title: draft.context.thema || draft.context.name,
        projectId: readExchange(exchange)?.projectId || draft.id,
        importCopy: importCopy === true,
      });
    } catch {}
  }
  return projects;
}
function stored() {
  try {
    const x = JSON.parse(
      localStorage.getItem(
        PROJECT_PREFIX + localStorage.getItem(ACTIVE_PROJECT),
      ) || localStorage.getItem(STORAGE),
    );
    if (x) {
      return {
        ...readSnapshot(x),
        cloudRevision: x.cloudRevision || 0,
        step: x.step,
        buildingSheet: x.buildingSheet,
        configStep: x.configStep,
        exchange: readExchange(x.exchange),
        exchangeBase: x.exchangeBase,
        importCopy: x.importCopy === true,
      };
    }
  } catch {}
  return {
    draft: newDraft(),
    worksheets: [],
    activeWorksheetId: null,
    pendingRequest: null,
    cloudRevision: 0,
  };
}
function download(text, name, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileText = async (file) => {
  if (!file) return "";
  if (file.size > 2000000) throw new Error(t("Datei zu groß (max. 2 MB)."));
  return file.text();
};
function Button({ children, secondary = false, type = "button", ...props }) {
  return (
    <button
      type={type}
      className={secondary ? "button secondary" : "button"}
      {...props}
    >
      {children}
    </button>
  );
}
function Card({ children, className = "" }) {
  return <section className={"panel " + className}>{children}</section>;
}
export default function App() {
  const [language, setLanguage] = useLanguage();
  useEffect(() => trackInputMethod(), []);
  const [saved] = useState(stored);
  const [exchange, setExchange] = useState(saved.exchange || null);
  const [exchangeBase, setExchangeBase] = useState(saved.exchangeBase || null);
  const [importCopy, setImportCopy] = useState(saved.importCopy || false);
  const [importConflict, setImportConflict] = useState(null);
  const importDialog = useRef(null);
  const [draft, setDraft] = useState(() => ({
    ...saved.draft,
    language: saved.worksheets?.length ? saved.draft.language : language,
  }));
  const [worksheets, setWorksheets] = useState(saved.worksheets || []);
  const [activeWorksheetId, setActiveWorksheetId] = useState(
    saved.activeWorksheetId,
  );
  const [request, setRequest] = useState(saved.pendingRequest || null);
  const [activeCard, setActiveCard] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const activeWorksheet =
    worksheets.find((w) => w.id === activeWorksheetId) || null;
  const result = activeWorksheet?.result || null;
  const source = activeWorksheet?.source || null;
  const resultSettings = activeWorksheet?.resultSettings || DEFAULT_SETTINGS;
  const resultDraft = activeWorksheet?.draft || draft;
  const [cloudRevision, setCloudRevision] = useState(saved.cloudRevision || 0);
  const [step, setStep] = useState(saved.step || 1);
  const [buildingSheet, setBuildingSheet] = useState(
    saved.buildingSheet === true,
  );
  const lastConfigStep = useRef(
    saved.configStep || (saved.step < 5 ? saved.step : 1),
  );
  if (step < 5) lastConfigStep.current = step;
  const projectMenu = useRef(null);
  const sheetMenu = useRef(null);
  useEffect(() => {
    function closeMenus(event) {
      const escape = event.type === "keydown" && event.key === "Escape";
      if (event.type === "keydown" && !escape) return;
      for (const menu of mainRef.current?.querySelectorAll(
        "details.switch-menu[open]",
      ) || []) {
        if (escape || !menu.contains(event.target)) {
          menu.open = false;
          if (escape && menu.contains(event.target))
            menu.querySelector("summary").focus();
        }
      }
    }
    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeMenus);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeMenus);
    };
  }, []);

  const [projects, setProjects] = useState(() => {
    try {
      return listProjects();
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const refresh = () => setProjects(listProjects());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  const [page, setPage] = useState("app");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(() =>
    initialAppearance({ getItem: (key) => localStorage.getItem(key) }),
  );
  const mainRef = useRef(null);
  const lastView = useRef({ page, step, result: null, preview: null });
  const [sortMessage, setSortMessage] = useState("");
  const [withInstructions, setWithInstructions] = useState(true);
  const [mode, setMode] = useState("template");
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [importText, setImportText] = useState("");
  const configImportRef = useRef(null);
  const answerImportRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminLogin, setAdminLogin] = useState(false);
  const [workshops, setWorkshops] = useState([]);
  const [workshopId, setWorkshopId] = useState("");
  const [code, setCode] = useState("");
  const [entries, setEntries] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [adminWorkshops, setAdminWorkshops] = useState([]);
  const [workshopTitle, setWorkshopTitle] = useState("");
  const [credentials, setCredentials] = useState([]);
  const [centralProvider, setCentralProvider] = useState("openai");
  const [centralKey, setCentralKey] = useState("");
  const [credentialScope, setCredentialScope] = useState("private");
  const [credentialWorkshopId, setCredentialWorkshopId] = useState("");
  const hasSelectedCredential = credentials.some(
    (credential) =>
      credential.provider === centralProvider &&
      credential.workshop_id ===
        (credentialScope === "workshop" ? credentialWorkshopId : null),
  );
  const credentialTarget = {
    provider: centralProvider,
    scope: credentialScope,
    workshopId:
      credentialScope === "workshop" ? credentialWorkshopId : undefined,
  };
  const [submissionConsent, setSubmissionConsent] = useState(false);
  const isCurrent = result?.configurationRevision === draft.revision;
  const payload = () => ({
    draft,
    ...(exchange ? { exchange, exchangeBase, importCopy } : {}),
    result: isCurrent ? result : null,
    request: isCurrent ? activeWorksheet?.request : null,
    source: isCurrent ? source : null,
    resultSettings,
    worksheets,
    activeWorksheetId,
    pendingRequest:
      request?.configurationRevision === draft.revision ? request : null,
  });
  async function act(fn) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(t(e.message || "Etwas hat nicht funktioniert."));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme =
      theme === "dark" ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        theme === "dark"
          ? "#101820"
          : theme === "contrast"
            ? "#ffffff"
            : "#f4f6f9",
      );
    try {
      localStorage.setItem(APPEARANCE_KEY, theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    const old = lastView.current;
    const changed = old.page !== page || old.step !== step;
    lastView.current = { page, step, activeWorksheetId, preview };
    let heading;
    if (changed)
      heading = mainRef.current?.querySelector(
        page === "app" ? ".workspace h2, .worksheet h1" : "h1",
      );
    else if (
      (activeWorksheetId && activeWorksheetId !== old.activeWorksheetId) ||
      (preview && preview !== old.preview)
    )
      heading = mainRef.current?.querySelector(".worksheet h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [page, step, activeWorksheetId, preview]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "en"
        ? "7’rizons · Game configurator"
        : "7’rizons · Spielkonfigurator";
  }, [language]);
  const [savedLocally, setSavedLocally] = useState(false);
  function persistProject() {
    localStorage.setItem(
      PROJECT_PREFIX + draft.id,
      JSON.stringify({
        ...payload(),
        cloudRevision,
        step,
        buildingSheet,
        configStep: lastConfigStep.current,
      }),
    );
    localStorage.setItem(ACTIVE_PROJECT, draft.id);
    localStorage.removeItem(STORAGE);
  }
  useEffect(() => {
    try {
      persistProject();
      setSavedLocally(true);
    } catch {
      setSavedLocally(false);
      setError(
        t(
          "Der Browser kann den Entwurf nicht sichern. Bitte als JSON herunterladen.",
        ),
      );
    }
  }, [
    draft,
    exchange,
    exchangeBase,
    importCopy,
    worksheets,
    activeWorksheetId,
    request,
    cloudRevision,
    step,
    buildingSheet,
  ]);
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    cloud.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const {
      data: { subscription },
    } = cloud.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setApiKey("");
      setCentralKey("");
    });
    cloud
      .from("app_settings")
      .select("value")
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (alive) {
          if (data) setSettings(settingsOf(data.value));
          else if (error)
            setError(
              t(
                "Online-Einstellungen konnten nicht geladen werden. Lokales Arbeiten bleibt möglich.",
              ),
            );
        }
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setAdmin(false);
    setCredentials([]);
    setCentralKey("");
    setMode((mode) =>
      ["saved", "workshop"].includes(mode) ? "template" : mode,
    );
    setWorkshops([]);
    setWorkshopId("");
    setEntries([]);
    setMySubmissions([]);
    if (session) {
      cloud.rpc("is_admin").then(({ data }) => {
        if (alive) setAdmin(!!data);
      });
      cloud.rpc("my_workshops").then(({ data }) => {
        if (alive) setWorkshops(data || []);
      });
      cloud
        .from("submissions")
        .select("id,title,workshop_id,created_at")
        .eq("owner_id", session.user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          if (alive) setMySubmissions(data || []);
        });
    }
    return () => {
      alive = false;
    };
  }, [session?.user.id]);
  useEffect(() => {
    setSubmissionConsent(false);
  }, [draft.revision, result, workshopId]);
  function change(updater) {
    setDraft((d) => {
      const next = { ...updater(d), revision: d.revision + 1 };
      if (next.priority) next.priority = priorityOf(next);
      return next;
    });
    setPreview(null);
    setError("");
  }
  function toggleLearning(id) {
    const le = LE.find((x) => x.id === id);
    if (draft.learning.includes(id))
      change((d) => ({ ...d, learning: d.learning.filter((x) => x !== id) }));
    else if (
      draft.learning.filter(
        (x) => LE.find((l) => l.id === x).group === le.group,
      ).length < (le.group === "inhalt" ? settings.maxInhalt : settings.maxWiss)
    )
      change((d) => ({ ...d, learning: [...d.learning, id] }));
  }
  function toggleMechanism(id) {
    if (id === "m91") return;
    change((d) => ({
      ...d,
      ...(d.priority && !d.mechanisms.includes(id)
        ? {
            priority: {
              ...d.priority,
              finalSelection: [...d.priority.finalSelection, id],
            },
          }
        : {}),
      mechanisms: d.mechanisms.includes(id)
        ? d.mechanisms.filter((x) => x !== id)
        : [...d.mechanisms, id],
    }));
  }
  async function refreshWorkshops() {
    const data = unwrap(await cloud.rpc("my_workshops"));
    setWorkshops(data || []);
    return data;
  }
  async function join() {
    const id = unwrap(
      await cloud.rpc("join_workshop", { p_code: code.trim() }),
    );
    await refreshWorkshops();
    setWorkshopId(id);
    setCode("");
    setMessage(t("Du bist dem Workshop beigetreten."));
  }
  async function saveOnline() {
    if (!session) throw new Error(t("Bitte zuerst anmelden."));
    const rev = unwrap(
      await cloud.rpc("save_configuration", {
        p_id: draft.id,
        p_revision: cloudRevision,
        p_title: draft.context.thema || draft.context.name || "Seminar-Hack",
        p_payload: payload(),
      }),
    );
    setCloudRevision(rev);
    setMessage(t("Entwurf und Arbeitsblätter sind privat online gespeichert."));
    return rev;
  }
  function addWorksheet(
    nextResult,
    nextSource,
    nextSettings,
    nextRequest = null,
  ) {
    const worksheet = createWorksheet({
      draft: structuredClone(draft),
      result: nextResult,
      source: nextSource,
      resultSettings: nextSettings,
      request: nextRequest,
    });
    setWorksheets((items) => [...items, worksheet]);
    setActiveWorksheetId(worksheet.id);
    setBuildingSheet(false);
  }
  function focusWorksheetBuilder() {
    setBuildingSheet(true);
    window.requestAnimationFrame(() => {
      const heading = mainRef.current?.querySelector(".worksheet-builder h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    });
  }
  function deleteWorksheet(id) {
    if (
      !window.confirm(
        t(
          "Dieses Arbeitsblatt löschen? Die anderen Arbeitsblätter bleiben erhalten.",
        ),
      )
    )
      return;
    const remaining = worksheets.filter((w) => w.id !== id);
    const nextActive =
      id === activeWorksheetId
        ? remaining.at(-1)?.id || null
        : activeWorksheetId;
    setWorksheets(remaining);
    setActiveWorksheetId(nextActive);
    setMessage(t("Arbeitsblatt gelöscht."));
    window.requestAnimationFrame(() => {
      if (nextActive)
        mainRef.current
          ?.querySelector(`[data-worksheet-id="${nextActive}"] button`)
          ?.focus();
      else mainRef.current?.querySelector(".worksheet-builder h2")?.focus();
    });
  }
  async function generate() {
    if (mode === "template") {
      const r = templateResult(
        draft,
        settings,
        withInstructions ? "guided" : "overview",
      );
      addWorksheet(r, { kind: "template" }, settings);
      setMessage(t("Dein Arbeitsblatt ist fertig – ohne KI erstellt."));
      return;
    }
    if (mode === "external") {
      const r = requestFor(draft, settings);
      setRequest(r);
      setImportText("");
      setPreview(null);
      setMessage(
        t(
          "Dein KI-Auftrag ist vorbereitet. Kopiere ihn oder lade ihn herunter.",
        ),
      );
      return;
    }
    if (!session) throw new Error(t("Für direkte KI-Nutzung bitte anmelden."));
    if (mode === "personal" && !apiKey.trim())
      throw new Error(t("Trage deinen eigenen API-Key ein."));
    if (mode === "workshop" && !workshopId)
      throw new Error(t("Tritt zuerst mit deinem Code einem Workshop bei."));
    const revision = draft.revision;
    const data = await callFunction("generate", {
      draft,
      provider,
      mode,
      apiKey: mode === "personal" ? apiKey.trim() : undefined,
      workshopId: mode === "workshop" ? workshopId : undefined,
    });
    // Inputs are disabled during generation; revision is also carried in the response.
    if (data.result.configurationRevision !== revision)
      throw new Error(t("Die Antwort gehört zu einem anderen Entwurfsstand."));
    addWorksheet(
      data.result,
      data.source,
      { ...settings, cardsPerMechanism: data.request.cardsPerMechanism },
      data.request,
    );
    setMessage(
      t(
        "Dein KI-Arbeitsblatt ist fertig. Bitte prüfe die fachlichen Beispiele.",
      ),
    );
  }
  function applySnapshot(x, revision = 0, resumeStep) {
    const builderWasOpen = x.buildingSheet === true;
    const previousStep = [1, 2, 3, 4].includes(x.configStep) ? x.configStep : 1;
    const metadata = {
      exchange: readExchange(x.exchange),
      base:
        typeof x.exchangeBase === "string" &&
        /^[0-9a-f]{64}$/.test(x.exchangeBase)
          ? x.exchangeBase
          : null,
      copy: x.importCopy === true,
    };
    x = readSnapshot(x);
    persistProject();
    setExchange(metadata.exchange);
    setExchangeBase(metadata.base);
    setImportCopy(metadata.copy);
    setProjects(listProjects());
    setEditingId(null);
    setImportText("");
    setApiKey("");
    setSubmissionConsent(false);
    setMode("template");
    setWithInstructions(true);
    setDraft(x.draft);
    setLanguage(x.draft.language || "de");
    setWorksheets(x.worksheets);
    setActiveWorksheetId(x.activeWorksheetId);
    setRequest(x.pendingRequest);
    setBuildingSheet(builderWasOpen);
    lastConfigStep.current = previousStep;
    if (projectMenu.current) projectMenu.current.open = false;
    setCloudRevision(revision);
    setStep(resumeStep || (x.worksheets.length ? 5 : 1));
    setPage("app");
    setPreview(null);
  }
  async function exportProject() {
    const snapshot = payload();
    const meta = nextExchange(draft.id, exchange);
    const baseline = await projectFingerprint(snapshot);
    const file = { ...snapshot, exchange: meta };
    delete file.exchangeBase;
    delete file.importCopy;
    download(
      JSON.stringify(file, null, 2),
      jsonFilename(draft.context.thema),
      "application/json",
    );
    setExchange(meta);
    setExchangeBase(baseline);
  }
  function acceptImport(incoming, baseline, target, copy = false) {
    const id =
      target?.draft.id ||
      (copy || !isProjectId(incoming.draft.id)
        ? crypto.randomUUID()
        : incoming.draft.id);
    const projectId =
      incoming.exchange?.projectId ||
      (isProjectId(incoming.draft.id) ? incoming.draft.id : id);
    // Older exports keep the project identity even when no export lineage was recorded.
    const meta = incoming.exchange || nextExchange(projectId, null);
    applySnapshot(
      {
        ...incoming,
        draft: { ...incoming.draft, id },
        exchange: meta,
        exchangeBase: baseline,
        importCopy: copy || target?.importCopy === true,
      },
      target?.cloudRevision || 0,
    );
    setMessage(t(copy ? "Als neues Projekt geladen." : "Projekt geladen."));
  }
  async function importProject(file) {
    const raw = JSON.parse(await fileText(file));
    const incoming = {
      ...readSnapshot(raw),
      exchange: readExchange(raw.exchange),
    };
    const projectId = incoming.exchange?.projectId || incoming.draft.id;
    const related = listProjects().filter(
      (p) => p.projectId === projectId || p.id === incoming.draft.id,
    );
    const baseline = await projectFingerprint(incoming);
    if (!related.length) {
      acceptImport(incoming, baseline, null);
      return;
    }
    const records = related.map((p) =>
      p.id === draft.id
        ? {
            ...payload(),
            cloudRevision,
            step,
            buildingSheet,
            configStep: lastConfigStep.current,
          }
        : JSON.parse(localStorage.getItem(PROJECT_PREFIX + p.id)),
    );
    const exact = records.find(
      (record) => record.draft.id === incoming.draft.id,
    );
    const candidates = [
      exact,
      ...records.filter((record) => record !== exact),
    ].filter(Boolean);
    for (const record of candidates) {
      const decision = importDecision(
        record,
        incoming.exchange,
        await projectFingerprint(record),
        baseline,
      );
      if (decision === "open") {
        if (record.draft.id !== draft.id)
          applySnapshot(record, record.cloudRevision, record.step);
        setMessage(t("Dieses Projekt ist bereits vorhanden."));
        return;
      }
      if (decision === "update") {
        acceptImport(incoming, baseline, record);
        return;
      }
    }
    setImportConflict({ incoming, baseline, target: exact || candidates[0] });
  }
  useEffect(() => {
    if (importConflict && !importDialog.current.open)
      importDialog.current.showModal();
  }, [importConflict]);
  function newConfiguration() {
    applySnapshot({ draft: { ...newDraft(), language } });
  }
  async function loadArchive() {
    setEntries(
      unwrap(
        await cloud
          .from("configurations")
          .select("id,title,revision,updated_at")
          .order("updated_at", { ascending: false }),
      ),
    );
    setPage("archive");
  }
  async function loadAdmin() {
    setAdminWorkshops(
      unwrap(
        await cloud
          .from("workshops")
          .select("*")
          .order("created_at", { ascending: false }),
      ),
    );
    setSubmissions(
      unwrap(
        await cloud
          .from("submissions")
          .select("id,title,status,created_at,workshop_id,payload")
          .order("created_at", { ascending: false }),
      ),
    );
    const data = await callFunction("credentials", {
      action: "status",
      provider: "openai",
    });
    setCredentials(data.credentials);
    setPage("admin");
  }
  const notices = (
    <>
      {error && (
        <div className="notice error" role="alert">
          {t(error)}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {t(message)}
        </div>
      )}
    </>
  );
  return (
    <>
      <a
        className="skip-link no-print"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          mainRef.current?.focus();
          mainRef.current?.scrollIntoView({ block: "start" });
        }}
      >
        {t("Zum Inhalt springen ")}
      </a>
      <header className="topbar no-print">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("app");
          }}
        >
          <Logo />
          <small>{t("Spielkonfigurator · Prototyp")}</small>
        </a>
        <nav aria-label={t("Werkzeuge")}>
          <button
            onClick={() => {
              setPage("about");
              window.scrollTo(0, 0);
            }}
          >
            {t("Über das Tool ")}
          </button>
          <AppearanceSwitch value={theme} onChange={setTheme} />
          <div
            className="language-switch"
            role="group"
            aria-label={t("Sprache")}
          >
            {["de", "en"].map((code) => (
              <button
                key={code}
                type="button"
                lang={code}
                disabled={busy}
                aria-label={code === "de" ? "Deutsch" : "English"}
                aria-pressed={language === code}
                onClick={() => {
                  setLanguage(code);
                  if (draft.language !== code)
                    change((d) => ({ ...d, language: code }));
                }}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          {session && (
            <button disabled={busy} onClick={() => act(loadArchive)}>
              {t("Meine Entwürfe ")}
            </button>
          )}
          {admin && (
            <button disabled={busy} onClick={() => act(loadAdmin)}>
              {t("Administration ")}
            </button>
          )}
          <button disabled={busy} onClick={() => setPage("account")}>
            {session ? t("Mein Zugang") : t("Anmelden")}
          </button>
        </nav>
      </header>
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {t(sortMessage)}
        </div>
        <div className="no-print">{notices}</div>
        {importConflict && (
          <dialog
            ref={importDialog}
            className="project-import-dialog"
            aria-labelledby="project-import-title"
            onCancel={() => setImportConflict(null)}
          >
            <h2 id="project-import-title">{t("Anderer Projektstand")}</h2>
            <p>
              {t(
                "Zu diesem Projekt gibt es bereits einen anderen Stand. Möchtest du ihn überschreiben oder die Datei als neues Projekt laden?",
              )}
            </p>
            <div className="actions">
              <Button
                autoFocus
                secondary
                onClick={() => setImportConflict(null)}
              >
                {t("Abbrechen")}
              </Button>
              <Button
                secondary
                onClick={() => {
                  const { incoming, baseline, target } = importConflict;
                  setImportConflict(null);
                  act(() => acceptImport(incoming, baseline, target));
                }}
              >
                {t("Überschreiben")}
              </Button>
              <Button
                onClick={() => {
                  const { incoming, baseline } = importConflict;
                  setImportConflict(null);
                  act(() => acceptImport(incoming, baseline, null, true));
                }}
              >
                {t("Als neues Projekt laden")}
              </Button>
            </div>
          </dialog>
        )}
        {page === "app" && (
          <>
            <header className="project-head no-print">
              <h1>
                {t("Eure Themen. ")}
                <em>{t("Eure Welten.")}</em>
              </h1>
              <div
                className="project-heading"
                role="group"
                aria-label={t("Projektleiste")}
              >
                {(draft.context.thema || draft.context.name) && (
                  <p className="project-title">
                    {draft.context.thema || draft.context.name}
                  </p>
                )}
                <details
                  ref={projectMenu}
                  className="switch-menu project-menu"
                  onToggle={(e) => {
                    if (e.currentTarget.open) setProjects(listProjects());
                  }}
                >
                  <summary>{t("Projektverwaltung")}</summary>
                  <div className="menu-body">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        disabled={busy}
                        aria-pressed={p.id === draft.id}
                        onClick={() =>
                          act(() => {
                            if (p.id === draft.id) {
                              projectMenu.current.open = false;
                              return;
                            }
                            const next = JSON.parse(
                              localStorage.getItem(PROJECT_PREFIX + p.id),
                            );
                            applySnapshot(next, next.cloudRevision, next.step);
                          })
                        }
                      >
                        {p.title || t("Unbenanntes Projekt")}
                        {p.importCopy && " · " + t("Importkopie")}
                        {projects.some(
                          (other) =>
                            other.id !== p.id && p.title === other.title,
                        ) && " · " + p.id.slice(0, 6)}
                      </button>
                    ))}
                    <button
                      disabled={busy}
                      onClick={() => act(newConfiguration)}
                    >
                      + {t("Neues Projekt")}
                    </button>
                    <fieldset disabled={busy} className="save-bar">
                      <div className="save-actions">
                        <div
                          className="save-file-actions"
                          role="group"
                          aria-label={t("Konfiguration als Datei")}
                        >
                          <Button secondary onClick={() => act(exportProject)}>
                            {t("Projekt herunterladen")}
                            <small className="project-download-format">
                              {t("JSON-Datei")}
                            </small>
                          </Button>
                          <Button
                            secondary
                            onClick={() => configImportRef.current?.click()}
                          >
                            {t("Projekt importieren")}
                          </Button>
                          <input
                            ref={configImportRef}
                            hidden
                            type="file"
                            accept=".json"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              e.target.value = "";
                              if (file) act(() => importProject(file));
                            }}
                          />
                        </div>
                      </div>
                    </fieldset>
                  </div>
                </details>
                <div className="project-storage">
                  {savedLocally && (
                    <span className="save-status">
                      {t("Im Browser gespeichert")}
                    </span>
                  )}
                  {session && (
                    <Button
                      secondary
                      disabled={busy}
                      onClick={() => act(saveOnline)}
                    >
                      {t("Online speichern ")}
                    </Button>
                  )}
                </div>
              </div>
              {step === 1 &&
                !draft.context.thema &&
                !draft.context.name &&
                !worksheets.length && (
                  <p>{t("Gestalte 7’rizons für deine Lehre.")}</p>
                )}
            </header>
            {(worksheets.length > 0 || step === 5) && (
              <nav
                className="area-nav no-print"
                aria-label={t("Projektbereiche")}
              >
                <button
                  disabled={busy}
                  aria-current={step < 5 ? "page" : undefined}
                  onClick={() => setStep(lastConfigStep.current || 1)}
                >
                  {t("Konfiguration")}
                </button>
                <button
                  disabled={busy}
                  aria-current={step === 5 ? "page" : undefined}
                  onClick={() => setStep(5)}
                >
                  {t("Arbeitsblätter")} ({worksheets.length})
                </button>
              </nav>
            )}
            {step < 5 && (
              <nav
                className="steps no-print"
                aria-label={t("Konfigurationsschritte")}
              >
                {steps.map((label, i) => (
                  <button
                    key={t(label)}
                    disabled={busy}
                    className={step === i + 1 ? "active" : ""}
                    aria-current={step === i + 1 ? "step" : undefined}
                    onClick={() => setStep(i + 1)}
                  >
                    <span>{i + 1}</span>
                    {t(label)}
                  </button>
                ))}
              </nav>
            )}
            <div className="workspace no-print" aria-busy={busy}>
              <fieldset disabled={busy} aria-label={t("Spielkonfiguration")}>
                {step === 1 && (
                  <Card>
                    <div className="section-title">
                      <span className="eyebrow">{t("01 · Kontext")}</span>
                      <h2>{t("Schritt 1: Seminar-Kontext")}</h2>
                      <p>
                        {t(
                          "Optional — je mehr du angibst, desto konkreter werden die Beispiele im Arbeitsblatt. ",
                        )}
                      </p>
                    </div>
                    <div className="field-grid context-grid">
                      {[
                        [
                          "thema",
                          t("Thema des Seminars ★"),
                          t(
                            "z.B. Heinrichs VII. Italienzug, Gravitationsfelder, Reliquienwerdung",
                          ),
                        ],
                        [
                          "fach",
                          t("Fach / Disziplin"),
                          t("z.B. Geschichte, Physik, Rechtswissenschaft"),
                        ],
                        [
                          "name",
                          t("Name der Lehrveranstaltung"),
                          t("z.B. Mittelalterliche Geschichte II"),
                        ],
                        ["dozent", "Dozent:in", t("z.B. Prof. Dr. Müller")],
                        ["semester", t("Semester"), t("z.B. WS 2025/26")],
                        ["datum", t("Datum"), t("z.B. 14.11.2025")],
                      ].map(([key, label, placeholder]) => (
                        <ContextField
                          key={key}
                          name={key}
                          label={t(label)}
                          value={draft.context[key] || ""}
                          placeholder={placeholder}
                          onChange={(value) =>
                            change((d) => ({
                              ...d,
                              context: {
                                ...d.context,
                                [key]: value,
                              },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </Card>
                )}
                {step === 2 && (
                  <Card>
                    <div className="section-title">
                      <span className="eyebrow">
                        {t("02 · Lerntätigkeiten")}
                      </span>
                      <h2>{t("Schritt 2: Lernerlebnisse wählen")}</h2>
                      <p>
                        {t("Wähle bis zu ")}
                        {settings.maxInhalt}
                        {t(" inhaltliche und bis zu")} {settings.maxWiss}
                        {t(" wissenschaftliche Lernerlebnisse. ")}
                      </p>
                    </div>
                    {["inhalt", "wiss"].map((group) => (
                      <section
                        className={"learning-group " + group}
                        key={group}
                        aria-labelledby={`learning-${group}-title`}
                      >
                        <h3 id={`learning-${group}-title`}>
                          {group === "inhalt"
                            ? t("Inhaltlich")
                            : t("Wissenschaftlich")}{" "}
                          <small>
                            {
                              draft.learning.filter(
                                (id) =>
                                  LE.find((l) => l.id === id).group === group,
                              ).length
                            }
                            /
                            {group === "inhalt"
                              ? settings.maxInhalt
                              : settings.maxWiss}
                          </small>
                        </h3>
                        {group === "wiss" && (
                          <p className="muted">
                            {t(
                              "Diese fünf Lernerlebnisse bilden die wissenschaftliche Methode ab und sind im Hochschulkontext immer relevant. ",
                            )}
                          </p>
                        )}
                        <div className="option-grid">
                          {LE.filter((l) => l.group === group).map((l) => (
                            <button
                              className={
                                "option " +
                                (draft.learning.includes(l.id)
                                  ? "selected"
                                  : "")
                              }
                              key={l.id}
                              aria-labelledby={`learning-${l.id}-label`}
                              aria-describedby={`learning-${l.id}-description learning-${l.id}-bloom`}
                              aria-pressed={draft.learning.includes(l.id)}
                              onClick={() => toggleLearning(l.id)}
                              disabled={
                                !draft.learning.includes(l.id) &&
                                draft.learning.filter(
                                  (id) =>
                                    LE.find((x) => x.id === id).group === group,
                                ).length >=
                                  (group === "inhalt"
                                    ? settings.maxInhalt
                                    : settings.maxWiss)
                              }
                            >
                              <span className="option-icon" aria-hidden="true">
                                {l.icon}
                              </span>
                              {draft.learning.includes(l.id) && (
                                <span
                                  className="selection-indicator"
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                              )}
                              <strong id={`learning-${l.id}-label`}>
                                {t(l.label)}
                              </strong>
                              <span id={`learning-${l.id}-description`}>
                                {t(l.desc)}
                              </span>
                              <small id={`learning-${l.id}-bloom`}>
                                {t(l.bloom)}
                              </small>
                              {l.hinweis && <small>{t(l.hinweis)}</small>}
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </Card>
                )}
                {step === 3 && (
                  <Card>
                    <div className="section-title">
                      <span className="eyebrow">{t("03 · Mechaniken")}</span>
                      <h2>{t("Schritt 3: Mechaniken wählen")}</h2>
                      <p>
                        {t(
                          "Wähle alles was interessant klingt — erst im nächsten Schritt reduzierst du dann auf das Minimum. Im oberen Abschnitt findest du Mechaniken sortiert nach Relevanz für deine Lerntätigkeiten. Im unteren Abschnitt alle anderen Mechaniken, falls du noch etwas vermisst und dazunehmen willst. ",
                        )}
                      </p>
                      <p>
                        <strong>{t("P")}</strong>
                        {t(" primär trägt · ")}
                        <strong>{t("S")}</strong> {t("sekundär unterstützt · ")}
                        <strong>~</strong>
                        {t(" erzeugt Reibung ")}
                      </p>
                    </div>
                    <MechanismChoices
                      mechanisms={MK.filter(
                        (m) =>
                          m.pflicht ||
                          m.kern ||
                          draft.learning.some((id) => m.w[id] === "P"),
                      )}
                      draft={draft}
                      onToggle={toggleMechanism}
                    />
                    <details>
                      <summary>{t("Weitere Mechaniken entdecken")}</summary>
                      <p className="muted">
                        {t(
                          "Diese Mechaniken dienen anderen Lernerlebnissen als den von dir gewählten. ",
                        )}
                      </p>
                      <MechanismChoices
                        mechanisms={MK.filter(
                          (m) =>
                            !m.pflicht &&
                            !m.kern &&
                            !draft.learning.some((id) => m.w[id] === "P"),
                        )}
                        draft={draft}
                        onToggle={toggleMechanism}
                        groupByLearning
                      />
                    </details>
                  </Card>
                )}
                {step === 4 && (
                  <Priority
                    draft={draft}
                    onChange={change}
                    onAnnounce={setSortMessage}
                    language={language}
                  />
                )}
                {step === 5 && (
                  <>
                    {worksheets.length > 0 && (
                      <div className="sheet-tools">
                        <details
                          className="switch-menu sheet-menu"
                          ref={sheetMenu}
                        >
                          <summary>
                            {result?.answers
                              ? t("Arbeitskopie")
                              : t("Arbeitsblatt")}{" "}
                            {worksheets.indexOf(activeWorksheet) + 1}
                          </summary>
                          <div className="menu-body">
                            <div
                              className="worksheet-list"
                              role="group"
                              aria-label={t("Gespeicherte Arbeitsblätter")}
                            >
                              {worksheets.map((w, index) => (
                                <div
                                  className="worksheet-row"
                                  key={w.id}
                                  data-worksheet-id={w.id}
                                >
                                  <button
                                    className="worksheet-open"
                                    aria-pressed={w.id === activeWorksheetId}
                                    onClick={() => {
                                      sheetMenu.current.open = false;
                                      setBuildingSheet(false);
                                      setActiveWorksheetId(w.id);
                                      setPreview(null);
                                    }}
                                  >
                                    <strong>
                                      {t("Arbeitsblatt ")}
                                      {index + 1}: {w.result.title}
                                    </strong>
                                    <small>
                                      {w.source.kind === "template"
                                        ? [
                                            t("Ohne KI"),
                                            w.result.templateVariant &&
                                              t(
                                                w.result.templateVariant ===
                                                  "guided"
                                                  ? "Mit Arbeitsaufträgen"
                                                  : "Nur Übersicht",
                                              ),
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")
                                        : w.source.kind === "import"
                                          ? t("KI-Import")
                                          : PROVIDERS[w.source.provider] ||
                                            t("KI")}{" "}
                                      ·{" "}
                                      {new Date(w.createdAt).toLocaleString(
                                        language === "en" ? "en-GB" : "de-AT",
                                        { timeZone: "Europe/Vienna" },
                                      )}
                                      {w.result.answers && t(" · Arbeitskopie")}
                                      {w.draft.revision !== draft.revision
                                        ? t(" · früherer Stand")
                                        : ""}
                                    </small>
                                  </button>
                                  <Button
                                    secondary
                                    onClick={() => deleteWorksheet(w.id)}
                                    aria-label={t("Arbeitsblatt {0} löschen", {
                                      0: index + 1,
                                    })}
                                  >
                                    {t("Löschen ")}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                        <button
                          type="button"
                          onClick={() => {
                            if (buildingSheet) {
                              setPreview(null);
                              setBuildingSheet(false);
                            } else focusWorksheetBuilder();
                          }}
                        >
                          {buildingSheet
                            ? t("Zurück zum Blatt")
                            : "+ " + t("Neues Blatt")}
                        </button>
                        {!buildingSheet &&
                          result.templateVariant !== "overview" && (
                            <Button
                              secondary
                              onClick={() => {
                                setActiveCard(
                                  result.mechanisms[0]?.mechanismId + "-0",
                                );
                                if (result.answers) {
                                  setEditingId(
                                    editingId === activeWorksheetId
                                      ? null
                                      : activeWorksheetId,
                                  );
                                } else {
                                  const copy = createWorksheet({
                                    ...activeWorksheet,
                                    result: { ...result, answers: {} },
                                  });
                                  setWorksheets((items) => [...items, copy]);
                                  setActiveWorksheetId(copy.id);
                                  setEditingId(copy.id);
                                }
                              }}
                            >
                              {t(
                                !result.answers
                                  ? "Kopie ausfüllen"
                                  : editingId === activeWorksheetId
                                    ? "Bearbeitung beenden"
                                    : "Weiterbearbeiten",
                              )}
                            </Button>
                          )}
                        {result && !buildingSheet && (
                          <details className="switch-menu export-menu">
                            <summary aria-label={t("Drucken und Exportieren")}>
                              ···
                            </summary>
                            <div className="menu-body">
                              <button
                                onClick={() =>
                                  download(
                                    markdown(
                                      resultDraft,
                                      result,
                                      resultSettings,
                                    ),
                                    result.answers
                                      ? "7rizons-arbeitskopie.md"
                                      : "7rizons-arbeitsblatt.md",
                                    "text/markdown",
                                  )
                                }
                              >
                                {t("Markdown herunterladen ")}
                              </button>
                              <button onClick={() => window.print()}>
                                {t("Arbeitsblatt drucken ")}
                              </button>
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                    {(!result || buildingSheet) && (
                      <Card className="worksheet-builder">
                        <div className="section-title">
                          <span className="eyebrow">
                            {t("05 · Arbeitsblatt")}
                          </span>
                          <h2 tabIndex={-1}>
                            {worksheets.length
                              ? t("Weiteres Arbeitsblatt hinzufügen")
                              : t("Wähle deinen Weg.")}
                          </h2>
                          <p>
                            {t(
                              "Alle Wege führen zum gleichen übersichtlichen Arbeitsblatt. Du entscheidest, ob und wie KI mitarbeitet. ",
                            )}
                          </p>
                        </div>
                        <div
                          className="mode-grid"
                          role="group"
                          aria-label={t("Weg zum Arbeitsblatt")}
                        >
                          {[
                            [
                              "template",
                              "01",
                              t("Ohne KI"),
                              t(
                                "Deine Auswahl, feste Anleitungen und Platz für eigene Karten.",
                              ),
                            ],
                            [
                              "external",
                              "02",
                              t("Mit deiner KI-App"),
                              t(
                                "Auftrag mitnehmen, JSON-Antwort hier wieder einfügen.",
                              ),
                            ],
                            [
                              "personal",
                              "03",
                              t("Mit eigenem API-Zugang"),
                              t("OpenAI, Claude oder Gemini direkt verwenden."),
                            ],
                            [
                              "saved",
                              "04",
                              t("Mit gespeichertem Zugang"),
                              t(
                                "Verwende deinen privaten API-Key aus der Administration.",
                              ),
                            ],
                            [
                              "workshop",
                              "04",
                              t("Mit Workshop-KI"),
                              t("Der Workshop stellt den Zugang bereit."),
                            ],
                          ]
                            .filter(
                              ([id]) =>
                                (id !== "saved" || admin) &&
                                (id !== "workshop" ||
                                  workshops.some(
                                    (w) => w.active && w.central_ai,
                                  )),
                            )
                            .map(([id, n, title, text]) => (
                              <button
                                className={
                                  "mode " + (mode === id ? "selected" : "")
                                }
                                key={id}
                                aria-labelledby={`mode-${id}-label`}
                                aria-describedby={`mode-${id}-description`}
                                aria-pressed={mode === id}
                                onClick={() => {
                                  setMode(id);
                                  setApiKey("");
                                }}
                              >
                                <small aria-hidden="true">{n}</small>
                                {mode === id && (
                                  <span
                                    className="selection-indicator"
                                    aria-hidden="true"
                                  >
                                    ✓
                                  </span>
                                )}
                                <strong id={`mode-${id}-label`}>{title}</strong>
                                <span id={`mode-${id}-description`}>
                                  {text}
                                </span>
                              </button>
                            ))}
                        </div>
                        {mode === "template" && (
                          <div className="template-choice">
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={withInstructions}
                                onChange={(e) =>
                                  setWithInstructions(e.target.checked)
                                }
                                aria-describedby="template-choice-note"
                              />
                              {t("Arbeitsaufträge ergänzen")}
                            </label>
                            <small id="template-choice-note">
                              {t(
                                "Ohne Häkchen erhältst du die Übersicht deiner Auswahl.",
                              )}
                            </small>
                          </div>
                        )}
                        {["personal", "workshop", "saved"].includes(mode) && (
                          <div className="connection">
                            <label>
                              {t("KI-Anbieter ")}
                              <select
                                value={provider}
                                onChange={(e) => {
                                  setProvider(e.target.value);
                                  setApiKey("");
                                }}
                              >
                                {Object.entries(PROVIDERS).map(
                                  ([id, label]) => (
                                    <option value={id} key={id}>
                                      {t(label)}
                                      {settings.models[id]
                                        ? ""
                                        : " · noch nicht eingerichtet"}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <p className="muted">
                              {settings.models[provider]
                                ? t("Modell: {0}", {
                                    0: settings.models[provider],
                                  })
                                : t(
                                    "Die Administration muss zunächst ein Modell für diesen Anbieter freischalten.",
                                  )}
                            </p>
                            {mode === "personal" ? (
                              <>
                                <label>
                                  {t("Dein API-Key ")}
                                  <input
                                    type="password"
                                    autoComplete="off"
                                    value={apiKey}
                                    maxLength={1000}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={t("API-Key für diese Sitzung")}
                                  />
                                </label>
                                <p className="muted">
                                  {t(
                                    "Der Key wird nur im Arbeitsspeicher gehalten und für den Aufruf verschlüsselt an unser Backend übertragen. Er wird nicht in Entwürfen oder Downloads gespeichert. Der Anbieter rechnet die Nutzung mit deinem API-Konto ab. ",
                                  )}
                                </p>
                              </>
                            ) : (
                              mode === "workshop" && (
                                <>
                                  <WorkshopJoin
                                    workshops={workshops}
                                    workshopId={workshopId}
                                    setWorkshopId={setWorkshopId}
                                    code={code}
                                    setCode={setCode}
                                    join={() => act(join)}
                                    session={session}
                                  />
                                  <p className="muted">
                                    {t(
                                      "Die Workshop-KI verwendet einen zentralen Zugang. Du benötigst keinen eigenen API-Key. Nur für freigeschaltete Workshops und innerhalb ihres Limits verfügbar. ",
                                    )}
                                  </p>
                                </>
                              )
                            )}
                            {!session && (
                              <Button
                                secondary
                                onClick={() => setPage("account")}
                              >
                                {t("Für direkte KI anmelden ")}
                              </Button>
                            )}
                          </div>
                        )}
                        <div className="actions">
                          <Button
                            onClick={() => act(generate)}
                            disabled={
                              busy ||
                              (["personal", "workshop", "saved"].includes(
                                mode,
                              ) &&
                                (!cloud ||
                                  !session ||
                                  !settings.models[provider]))
                            }
                          >
                            {busy
                              ? t("Wird erstellt …")
                              : mode === "external"
                                ? t("KI-Auftrag vorbereiten")
                                : worksheets.length
                                  ? t("Arbeitsblatt hinzufügen")
                                  : t("Arbeitsblatt erstellen")}
                          </Button>
                        </div>
                        {mode === "external" &&
                          request &&
                          request.configurationId === draft.id &&
                          request.configurationRevision === draft.revision && (
                            <div className="external-flow">
                              <h3>
                                {t("Dein Auftrag für eine KI deiner Wahl")}
                              </h3>
                              <p>
                                {t(
                                  "Er enthält Thema und Fach, Mechaniken und ein festes JSON-Antwortformat. Füge ihn selbst bei deiner KI ein. Andere Kontextangaben werden nicht mitgegeben. ",
                                )}
                              </p>
                              <textarea
                                readOnly
                                rows={6}
                                value={makePrompt(request)}
                                aria-label={t("KI-Arbeitsauftrag")}
                              />
                              <div className="actions">
                                <Button
                                  secondary
                                  onClick={() =>
                                    act(async () => {
                                      await navigator.clipboard.writeText(
                                        makePrompt(request),
                                      );
                                      setMessage(t("Auftrag kopiert."));
                                    })
                                  }
                                >
                                  {t("Auftrag kopieren ")}
                                </Button>
                                <Button
                                  secondary
                                  onClick={() =>
                                    download(
                                      makePrompt(request),
                                      "7rizons-ki-auftrag.txt",
                                    )
                                  }
                                >
                                  {t("Auftrag herunterladen ")}
                                </Button>
                              </div>
                              <label>
                                {t("JSON-Antwort deiner KI ")}
                                <textarea
                                  rows={6}
                                  value={importText}
                                  onChange={(e) =>
                                    setImportText(e.target.value)
                                  }
                                  placeholder={t("JSON-Antwort hier einfügen")}
                                />
                              </label>
                              <Button
                                secondary
                                onClick={() => answerImportRef.current?.click()}
                              >
                                {t("Oder JSON-Datei wählen ")}
                              </Button>
                              <input
                                ref={answerImportRef}
                                hidden
                                type="file"
                                accept=".json,application/json,text/plain"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  e.target.value = "";
                                  if (file)
                                    act(async () =>
                                      setImportText(await fileText(file)),
                                    );
                                }}
                              />
                              <Button
                                secondary
                                onClick={() =>
                                  act(async () => {
                                    setPreview(
                                      parseResult(importText, request),
                                    );
                                    setMessage(
                                      t(
                                        "Antwort geprüft. Kontrolliere die Vorschau und übernimm sie anschließend.",
                                      ),
                                    );
                                  })
                                }
                              >
                                {t("Antwort prüfen ")}
                              </Button>
                            </div>
                          )}
                      </Card>
                    )}
                  </>
                )}
                {step < 5 && (
                  <div className="step-actions">
                    <Button
                      secondary
                      disabled={step === 1}
                      onClick={() => setStep((s) => s - 1)}
                    >
                      {t("← Zurück ")}
                    </Button>
                    <label className="step-jump">
                      <span className="sr-only">
                        {t("Direkt zu einem Schritt springen ")}
                      </span>
                      <select
                        value={step}
                        onChange={(e) => setStep(Number(e.target.value))}
                      >
                        {steps.map((label, index) => (
                          <option key={t(label)} value={index + 1}>
                            {index + 1} / {steps.length} · {t(label)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      disabled={
                        step === 5 || (step === 2 && !draft.learning.length)
                      }
                      onClick={() => setStep((s) => s + 1)}
                    >
                      {step === 1
                        ? t("Weiter zu den Lernerlebnissen →")
                        : step === 2
                          ? t("Weiter zu den Mechaniken →")
                          : step === 3
                            ? t("Weiter zur Übersicht ({0} gewählt) →", {
                                0: draft.mechanisms.length,
                              })
                            : t("Weiter zum Arbeitsblatt →")}
                    </Button>
                  </div>
                )}
              </fieldset>
            </div>
            {step === 5 && preview && (
              <>
                <div className="no-print">
                  <h2>{t("Importvorschau")}</h2>
                  <div className="actions">
                    <Button
                      disabled={busy}
                      onClick={() => {
                        addWorksheet(
                          preview,
                          { kind: "import" },
                          {
                            ...settings,
                            cardsPerMechanism: request.cardsPerMechanism,
                          },
                          request,
                        );
                        setPreview(null);
                        setImportText("");
                        setMessage(t("KI-Antwort übernommen."));
                      }}
                    >
                      {t("Vorschau übernehmen ")}
                    </Button>
                    <Button secondary onClick={() => setPreview(null)}>
                      {t("Verwerfen ")}
                    </Button>
                  </div>
                </div>
                <Worksheet
                  draft={draft}
                  result={preview}
                  settings={{
                    ...settings,
                    cardsPerMechanism: request.cardsPerMechanism,
                  }}
                  source={{ kind: "import" }}
                />
              </>
            )}
            {step === 5 && result && !buildingSheet && !preview && (
              <>
                {!isCurrent && (
                  <div className="notice error no-print">
                    {t(
                      "Dieses Arbeitsblatt gehört zu einer früheren Konfiguration. Es bleibt erhalten. Für deine aktuelle Auswahl kannst du ein weiteres Arbeitsblatt hinzufügen. ",
                    )}
                  </div>
                )}
                <>
                  <Worksheet
                    key={activeWorksheetId}
                    activeCard={activeCard}
                    onStartEditing={
                      result.answers
                        ? (key) => {
                            setEditingId(activeWorksheetId);
                            setActiveCard(key);
                          }
                        : undefined
                    }
                    onAnswer={
                      editingId === activeWorksheetId
                        ? (key, value) => {
                            setWorksheets((items) =>
                              items.map((w) =>
                                w.id === activeWorksheetId
                                  ? {
                                      ...w,
                                      result: {
                                        ...w.result,
                                        answers: {
                                          ...w.result.answers,
                                          [key]: value,
                                        },
                                      },
                                    }
                                  : w,
                              ),
                            );
                          }
                        : undefined
                    }
                    draft={resultDraft}
                    result={result}
                    settings={resultSettings}
                    source={source}
                  />
                  {session && isCurrent && (
                    <Card className="no-print">
                      <h2>{t("Mit der Workshopmoderation teilen")}</h2>
                      <p>
                        {t(
                          "Dein Entwurf ist privat. Erst mit der Abgabe erhält die Moderation eine Kopie dieses Stands samt Kontextangaben. ",
                        )}
                      </p>
                      <WorkshopJoin
                        {...{
                          workshops,
                          workshopId,
                          setWorkshopId,
                          code,
                          setCode,
                          session,
                        }}
                        join={() => act(join)}
                      />
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={submissionConsent}
                          onChange={(e) =>
                            setSubmissionConsent(e.target.checked)
                          }
                        />
                        {t(
                          "Diesen Stand samt Kontextangaben für die Workshopmoderation freigeben. ",
                        )}
                      </label>
                      <Button
                        disabled={busy || !workshopId || !submissionConsent}
                        onClick={() =>
                          act(async () => {
                            await saveOnline();
                            unwrap(
                              await cloud.rpc("submit_configuration", {
                                p_workshop: workshopId,
                                p_configuration: draft.id,
                              }),
                            );
                            setSubmissionConsent(false);
                            setMySubmissions(
                              unwrap(
                                await cloud
                                  .from("submissions")
                                  .select("id,title,workshop_id,created_at")
                                  .eq("owner_id", session.user.id)
                                  .order("created_at", { ascending: false }),
                              ),
                            );
                            setMessage(
                              t(
                                "Dieser Stand wurde an die Workshopmoderation abgegeben.",
                              ),
                            );
                          })
                        }
                      >
                        {t("Arbeitsblatt abgeben ")}
                      </Button>
                    </Card>
                  )}
                </>
              </>
            )}
          </>
        )}
        {page === "account" && (
          <Card>
            <span className="eyebrow">{t("Dein Zugang")}</span>
            <h1>{session ? t("Dein Zugang") : t("Anmelden")}</h1>
            {session ? (
              <>
                <p>
                  {t("Angemeldet als ")}
                  {session.user.email}
                </p>
                <WorkshopJoin
                  {...{
                    workshops,
                    workshopId,
                    setWorkshopId,
                    code,
                    setCode,
                    session,
                  }}
                  join={() => act(join)}
                />
                <h2>{t("Meine Abgaben")}</h2>
                {mySubmissions.length ? (
                  mySubmissions.map((s) => (
                    <div className="archive-row" key={s.id}>
                      <span>
                        {s.title}
                        <small>
                          {new Date(s.created_at).toLocaleString(
                            language === "en" ? "en-GB" : "de-AT",
                          )}
                        </small>
                      </span>
                      <Button
                        secondary
                        onClick={() =>
                          act(async () => {
                            if (
                              !confirm(
                                t(
                                  "Abgabe zurückziehen? Bereits heruntergeladene Kopien können nicht zurückgerufen werden.",
                                ),
                              )
                            )
                              return;
                            unwrap(
                              await cloud
                                .from("submissions")
                                .delete()
                                .eq("id", s.id),
                            );
                            setMySubmissions((a) =>
                              a.filter((x) => x.id !== s.id),
                            );
                            setMessage(t("Abgabe zurückgezogen."));
                          })
                        }
                      >
                        {t("Zurückziehen ")}
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="muted">{t("Noch keine Abgaben.")}</p>
                )}
                <Button
                  secondary
                  onClick={() =>
                    act(async () => {
                      unwrap(await cloud.auth.signOut());
                      setCloudRevision(0);
                      setMessage(
                        t(
                          "Abgemeldet. Dein lokaler Entwurf bleibt in diesem Browser.",
                        ),
                      );
                    })
                  }
                >
                  {t("Abmelden ")}
                </Button>
              </>
            ) : (
              <>
                <p>
                  {adminLogin
                    ? t(
                        "Administrationszugang mit E-Mail und Passwort. Die Rolle wird separat im Backend vergeben.",
                      )
                    : t(
                        "Du erhältst einen Anmeldelink per E-Mail. Ein Passwort brauchst du nicht.",
                      )}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      if (!cloud)
                        throw new Error(
                          t("Das Backend ist noch nicht eingerichtet."),
                        );
                      if (adminLogin) {
                        unwrap(
                          await cloud.auth.signInWithPassword({
                            email,
                            password,
                          }),
                        );
                        setPassword("");
                      } else {
                        unwrap(
                          await cloud.auth.signInWithOtp({
                            email,
                            options: {
                              emailRedirectTo:
                                location.origin + location.pathname,
                            },
                          }),
                        );
                        setMessage(
                          t(
                            "Anmeldelink angefordert. Prüfe dein E-Mail-Postfach.",
                          ),
                        );
                      }
                    });
                  }}
                >
                  <label>
                    {t("E-Mail ")}
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  {adminLogin && (
                    <label>
                      {t("Passwort ")}
                      <input
                        required
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                  )}
                  <Button type="submit" disabled={busy || !cloud}>
                    {adminLogin ? t("Anmelden") : t("Magic Link senden")}
                  </Button>
                </form>
                <button
                  className="text-button"
                  onClick={() => {
                    setAdminLogin(!adminLogin);
                    setPassword("");
                  }}
                >
                  {adminLogin
                    ? t("Anmeldung für Teilnehmende")
                    : t("Administrationszugang")}
                </button>
              </>
            )}
          </Card>
        )}
        {page === "archive" && (
          <Card>
            <h1>{t("Meine Entwürfe")}</h1>
            <p>
              {t(
                "Privat in deinem Konto gespeichert. Laden ersetzt den aktuellen lokalen Stand. ",
              )}
            </p>
            {entries.length ? (
              entries.map((e) => (
                <div className="archive-row" key={e.id}>
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {new Date(e.updated_at).toLocaleString(
                        language === "en" ? "en-GB" : "de-AT",
                      )}
                      {t(" · Online-Version ")}
                      {e.revision}
                    </small>
                  </span>
                  <Button
                    secondary
                    onClick={() =>
                      act(async () => {
                        if (
                          !confirm(
                            t(
                              "Aktuellen lokalen Stand durch diesen Online-Entwurf ersetzen?",
                            ),
                          )
                        )
                          return;
                        const x = unwrap(
                          await cloud
                            .from("configurations")
                            .select("payload,revision")
                            .eq("id", e.id)
                            .single(),
                        );
                        applySnapshot(x.payload, x.revision);
                      })
                    }
                  >
                    {t("Öffnen ")}
                  </Button>
                  <Button
                    secondary
                    onClick={() =>
                      act(async () => {
                        if (
                          !confirm(
                            t(
                              "Diesen privaten Online-Entwurf löschen? Bestehende Workshop-Abgaben bleiben separat erhalten.",
                            ),
                          )
                        )
                          return;
                        unwrap(
                          await cloud
                            .from("configurations")
                            .delete()
                            .eq("id", e.id),
                        );
                        setEntries((a) => a.filter((x) => x.id !== e.id));
                        if (draft.id === e.id) setCloudRevision(0);
                      })
                    }
                  >
                    {t("Löschen ")}
                  </Button>
                </div>
              ))
            ) : (
              <p>{t("Noch keine Online-Entwürfe gespeichert.")}</p>
            )}
          </Card>
        )}
        {page === "admin" && admin && (
          <div className="admin-grid">
            <Card>
              <span className="eyebrow">{t("Administration")}</span>
              <h1>{t("Administration")}</h1>
              <p>
                {t(
                  "Modelle und Auswahlgrenzen gelten für neue Aufträge. Bereits erstellte Arbeitsblätter behalten ihre Einstellungen. ",
                )}
              </p>
              <div className="field-grid">
                {[
                  ["maxInhalt", t("Inhaltliche Auswahlgrenze"), 4],
                  ["maxWiss", t("Wissenschaftliche Auswahlgrenze"), 5],
                  ["cardsPerMechanism", t("Karten je Mechanik"), 5],
                  ["hourlyLimit", t("KI-Aufrufe je Person / Stunde"), 30],
                ].map(([k, label, max]) => (
                  <label key={k}>
                    {t(label)}
                    <input
                      type="number"
                      min="1"
                      max={max}
                      value={settings[k]}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          [k]: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
                {Object.entries(PROVIDERS).map(([id, label]) => (
                  <label key={id}>
                    {t(label)}
                    {t(" · Modell-ID ")}
                    <input
                      value={settings.models[id]}
                      maxLength={100}
                      placeholder={t("Leer = Anbieter deaktiviert")}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          models: { ...s.models, [id]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const s = settingsOf(settings);
                    unwrap(
                      await cloud
                        .from("app_settings")
                        .update({ value: s })
                        .eq("id", true),
                    );
                    setSettings(s);
                    setMessage(t("Einstellungen veröffentlicht."));
                  })
                }
              >
                {t("Einstellungen veröffentlichen ")}
              </Button>
            </Card>
            <Card>
              <h2>{t("Gespeicherte KI-Zugänge")}</h2>
              <p>
                {t(
                  "API-Keys werden serverseitig verschlüsselt gespeichert und nie wieder angezeigt. ",
                )}
              </p>
              <label>
                {t("Freigabe")}
                <select
                  value={credentialScope}
                  onChange={(e) => {
                    setCredentialScope(e.target.value);
                    setCentralKey("");
                  }}
                >
                  <option value="private">{t("Nur für mich")}</option>
                  <option value="workshop">{t("Für einen Workshop")}</option>
                </select>
              </label>
              {credentialScope === "workshop" && (
                <>
                  <label>
                    {t("Workshop")}
                    <select
                      value={credentialWorkshopId}
                      onChange={(e) => {
                        setCredentialWorkshopId(e.target.value);
                        setCentralKey("");
                      }}
                    >
                      <option value="">{t("Workshop auswählen")}</option>
                      {adminWorkshops.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="muted">
                    {t(
                      "Teilnehmende können den Zugang verwenden, sobald die Workshop-KI für diesen Workshop eingeschaltet ist.",
                    )}
                  </p>
                </>
              )}
              <label>
                {t("Anbieter ")}
                <select
                  value={centralProvider}
                  onChange={(e) => {
                    setCentralProvider(e.target.value);
                    setCentralKey("");
                  }}
                >
                  {Object.entries(PROVIDERS).map(([id, l]) => (
                    <option key={id} value={id}>
                      {t(l)}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {t(
                  hasSelectedCredential
                    ? "API-Key hinterlegt."
                    : "Für diese Auswahl ist kein API-Key hinterlegt.",
                )}
              </p>
              <label>
                {t("Neuer API-Key ")}
                <input
                  type="password"
                  autoComplete="off"
                  value={centralKey}
                  onChange={(e) => setCentralKey(e.target.value)}
                  maxLength={1000}
                />
              </label>
              <div className="actions">
                <Button
                  disabled={
                    busy ||
                    !centralKey.trim() ||
                    (credentialScope === "workshop" && !credentialWorkshopId)
                  }
                  onClick={() =>
                    act(async () => {
                      const d = await callFunction("credentials", {
                        action: "set",
                        ...credentialTarget,
                        apiKey: centralKey.trim(),
                      });
                      setCentralKey("");
                      setCredentials(d.credentials);
                      setMessage(t("Zugang gespeichert."));
                    })
                  }
                >
                  {t("Zugang hinterlegen ")}
                </Button>
                <Button
                  secondary
                  disabled={busy || !hasSelectedCredential}
                  onClick={() =>
                    act(async () => {
                      if (
                        !confirm(t("Diesen gespeicherten API-Key entfernen?"))
                      )
                        return;
                      const d = await callFunction("credentials", {
                        action: "delete",
                        ...credentialTarget,
                      });
                      setCredentials(d.credentials);
                      setMessage(t("Zugang entfernt."));
                    })
                  }
                >
                  {t("Zugang entfernen ")}
                </Button>
              </div>
            </Card>
            <Card>
              <h2>{t("Workshops")}</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(async () => {
                    unwrap(
                      await cloud.from("workshops").insert({
                        title: workshopTitle,
                        join_code: crypto.randomUUID().replaceAll("-", ""),
                      }),
                    );
                    setWorkshopTitle("");
                    setAdminWorkshops(
                      unwrap(
                        await cloud
                          .from("workshops")
                          .select("*")
                          .order("created_at", { ascending: false }),
                      ),
                    );
                    await refreshWorkshops();
                    setMessage(
                      t(
                        "Workshop angelegt. Zentrale KI ist zunächst ausgeschaltet.",
                      ),
                    );
                  });
                }}
              >
                <label>
                  {t("Neuer Workshop ")}
                  <input
                    value={workshopTitle}
                    onChange={(e) => setWorkshopTitle(e.target.value)}
                    required
                    maxLength={200}
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {t("Workshop anlegen ")}
                </Button>
              </form>
              {adminWorkshops.map((w) => (
                <div className="workshop-admin" key={w.id}>
                  <h3>{w.title}</h3>
                  <label>
                    {t("Zugangscode ")}
                    <input readOnly value={w.join_code} />
                  </label>
                  <div className="actions">
                    <Button
                      secondary
                      onClick={() =>
                        act(async () => {
                          unwrap(
                            await cloud.rpc("join_workshop", {
                              p_code: w.join_code,
                            }),
                          );
                          await refreshWorkshops();
                          setMessage(t("Du bist dem Workshop beigetreten."));
                        })
                      }
                    >
                      {t("Selbst beitreten ")}
                    </Button>
                    <Button
                      secondary
                      onClick={() =>
                        act(async () => {
                          unwrap(
                            await cloud
                              .from("workshops")
                              .update({ active: !w.active })
                              .eq("id", w.id),
                          );
                          await loadAdmin();
                          await refreshWorkshops();
                        })
                      }
                    >
                      {w.active
                        ? t("Workshop schließen")
                        : t("Workshop öffnen")}
                    </Button>
                    <Button
                      secondary
                      onClick={() =>
                        act(async () => {
                          unwrap(
                            await cloud
                              .from("workshops")
                              .update({ central_ai: !w.central_ai })
                              .eq("id", w.id),
                          );
                          await loadAdmin();
                          await refreshWorkshops();
                        })
                      }
                    >
                      {w.central_ai
                        ? t("Workshop-KI ausschalten")
                        : t("Workshop-KI einschalten")}
                    </Button>
                  </div>
                  <label>
                    {t("Maximale KI-Aufrufe insgesamt ")}
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      defaultValue={w.generation_limit}
                      onBlur={(e) =>
                        act(async () => {
                          const n = Number(e.target.value);
                          if (!Number.isInteger(n) || n < 1 || n > 10000)
                            throw new Error(
                              t("Limit muss zwischen 1 und 10000 liegen."),
                            );
                          unwrap(
                            await cloud
                              .from("workshops")
                              .update({ generation_limit: n })
                              .eq("id", w.id),
                          );
                          setMessage(t("Workshoplimit gespeichert."));
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </Card>
            <Card>
              <h2>{t("Abgaben an die Moderation")}</h2>
              <p>
                {t(
                  "Hier erscheinen nur ausdrücklich eingereichte Stände, keine privaten Entwürfe. ",
                )}
              </p>
              {submissions.map((s) => (
                <div className="archive-row" key={s.id}>
                  <span>
                    <strong>{s.title}</strong>
                    <small>
                      {
                        adminWorkshops.find((w) => w.id === s.workshop_id)
                          ?.title
                      }{" "}
                      ·{" "}
                      {new Date(s.created_at).toLocaleString(
                        language === "en" ? "en-GB" : "de-AT",
                      )}{" "}
                      · {t(s.status)}
                    </small>
                  </span>
                  <Button
                    secondary
                    onClick={() =>
                      download(
                        JSON.stringify(s.payload, null, 2),
                        jsonFilename(s.payload.draft.context.thema, "abgabe"),
                        "application/json",
                      )
                    }
                  >
                    {t("JSON ")}
                  </Button>
                  <Button
                    secondary
                    onClick={() => {
                      const x = s.payload;
                      download(
                        markdown(x.draft, x.result, x.resultSettings),
                        "7rizons-abgabe.md",
                        "text/markdown",
                      );
                    }}
                  >
                    {t("Markdown ")}
                  </Button>
                  <Button
                    secondary
                    onClick={() =>
                      act(async () => {
                        unwrap(
                          await cloud.rpc("review_submission", { p_id: s.id }),
                        );
                        setSubmissions((a) =>
                          a.map((x) =>
                            x.id === s.id ? { ...x, status: "gesichtet" } : x,
                          ),
                        );
                      })
                    }
                  >
                    {t("Gesichtet ")}
                  </Button>
                </div>
              ))}
              {!submissions.length && <p>{t("Noch keine Abgaben.")}</p>}
            </Card>
          </div>
        )}
        {page === "about" && (
          <Card>
            <div className="eyebrow about-kicker">
              {t("Spielerisch Lehre gestalten. Lehre spielerisch gestalten. ")}
            </div>
            <h1>{t("Über den Spielkonfigurator")}</h1>
            <h2>{t("Vom Lernziel zum Spiel")}</h2>
            <p>
              {t(
                "Der Spielkonfigurator hilft dir, 7’rizons für dein eigenes Hochschulseminar anzupassen. Aus deinem Thema, den gewünschten Lerntätigkeiten und passenden Spielmechaniken entsteht ein Arbeitsblatt mit Anleitungen und Platz für eigene Kartentexte. Du kannst mit festen Vorlagen arbeiten oder dir von einer KI thematische Vorschläge ausarbeiten lassen. ",
              )}
            </p>
            <h2>{t("7’rizons: Create a playful university!")}</h2>
            <p>
              {t(
                "7’rizons ist ein fächerübergreifendes Simulations- und Rollenspielprojekt an der Universität Bonn. Studierende und Lehrende entwerfen gemeinsam eine fiktive Welt und entwickeln deren natürliche und gesellschaftliche Grundlagen weiter. Dabei bringen sie Wissen aus unterschiedlichen Disziplinen ein, übernehmen Rollen und erproben Entscheidungen in imaginativen Szenarien. Das Projekt verbindet digitale und analoge Spielformen mit forschendem Lernen und stärkt Zusammenarbeit, Perspektivwechsel und kreatives Problemlösen. Es ist am IMPULSE – House for Intellectual Innovation and Creativity verortet; das Bonn Lab for Analog Games and Imaginative Play begleitet den gemeinsamen Spielrahmen. ",
              )}
            </p>
            <p>
              <a href="https://www.fiw.uni-bonn.de/gamelab/de/projekte/7rizons">
                {t(
                  "Mehr über 7’rizons auf der Projektseite der Universität Bonn → ",
                )}
              </a>
            </p>
            <Button secondary onClick={() => setPage("app")}>
              {t("Zum Spielkonfigurator → ")}
            </Button>
          </Card>
        )}
        {page === "legal" && (
          <Card>
            <h1>{t("Impressum & Hinweise")}</h1>
            <h2>{t("Menschen hinter dem Werkzeug")}</h2>
            <p>
              {t("Spielkonfigurator by Harald Eckmüller. ")}
              <br />
              {t("Webapp-Umsetzung unterstützt durch LMB. ")}
            </p>
            <h2>{t("Impressum")}</h2>
            <p>
              {t(
                "Verantwortlich: Dr. Ludwig M. Breuer · Bgm.-Rohmüller-Str. 7 · 86554 Pöttmes. Kontakt: info@lmbreuer.de. ",
              )}
            </p>
            <h2>{t("Datenschutz")}</h2>
            <p>
              {t(
                "Diese Website wird über GitHub Pages bereitgestellt. GitHub verarbeitet dabei technische Zugriffsdaten, etwa IP-Adressen, zur Bereitstellung und Absicherung des Dienstes. Es werden keine Trackingdienste oder externen Schriftarten eingebunden. ",
              )}
            </p>
            {!cloud && (
              <p>
                {t(
                  "In dieser Vorschau ist noch kein Backend verbunden. Anmeldung, direkte KI-Nutzung, Online-Speicherung und Abgabe sind deshalb deaktiviert. Deine Konfiguration bleibt in diesem Browser, sofern du sie nicht selbst exportierst oder an eine KI weitergibst. ",
                )}
              </p>
            )}
            <p>
              {t(
                "Entwürfe werden automatisch in diesem Browser gespeichert. Nach Anmeldung kannst du sie zusätzlich privat online speichern und löschen. Erst eine ausdrückliche Abgabe gibt den gewählten Stand samt Kontextangaben an die Workshopmoderation weiter. Abgaben können zurückgezogen werden; bereits heruntergeladene Kopien werden dadurch nicht zurückgerufen. ",
              )}
            </p>
            <p>
              {t(
                "Bei direkter KI-Nutzung werden Thema, Fach und die gewählte Spielkonfiguration über das Backend an den angezeigten Anbieter gesendet. Eigene API-Keys werden nur für die Sitzung im Speicher gehalten; zentrale Workshop-Keys werden serverseitig verschlüsselt gespeichert. E-Mail und Login werden über Supabase verarbeitet. Private Online-Entwürfe bleiben bis zu deiner Löschung gespeichert; Abgaben bis zum Zurückziehen oder einer vereinbarten Bereinigung. Beim Aktivieren des Backends werden dessen konkrete Betriebsangaben und Aufbewahrungsregeln ergänzt. ",
              )}
            </p>
            <h2>{t("KI-Hinweis")}</h2>
            <p>
              {t(
                "Für die Entwicklung des ursprünglichen Spielkonfigurators und seine Umsetzung als Webapp wurde generative KI eingesetzt. Konzeption, Verantwortung und Entscheidungen blieben dabei bei Menschen. Der Einsatz von KI berührt gesellschaftliche, kulturelle und politische Fragen und bedarf weiterhin offener, kritischer Diskussionen. ",
              )}
            </p>
            <p>
              {t(
                "„Ohne KI“ verwendet feste Vorlagen und erzeugt keine neuen KI-Texte. Beim externen Weg übermittelst du den Auftrag selbst an deine KI. Direkte KI-Ausgaben und importierte Antworten sind Vorschläge: Prüfe fachliche Richtigkeit und Eignung für deine Lehrveranstaltung. ",
              )}
            </p>
            <p>
              {t(
                "Die Herkunft des konkreten Arbeitsblatts wird am Dokument ausgewiesen. ",
              )}
            </p>
          </Card>
        )}
      </main>
      <footer className="footer no-print">
        <div className="footer-credit">
          <p>
            {t("Spielkonfigurator by ")}
            <strong>{t("Harald Eckmüller")}</strong>
          </p>
          <p>
            {t("Webapp-Umsetzung unterstützt durch ")}
            <strong>{t("LMB")}</strong>
          </p>
        </div>
        <div className="footer-links">
          <button
            onClick={() => {
              setPage("about");
              window.scrollTo(0, 0);
            }}
          >
            {t("Über das Tool ")}
          </button>
          <button
            onClick={() => {
              setPage("legal");
              window.scrollTo(0, 0);
            }}
          >
            {t("Impressum ")}
          </button>
          <button
            onClick={() => {
              setPage("legal");
              window.scrollTo(0, 0);
            }}
          >
            {t("Datenschutz ")}
          </button>
          <button
            onClick={() => {
              setPage("legal");
              window.scrollTo(0, 0);
            }}
          >
            {t("KI transparent ")}
          </button>
        </div>
      </footer>
    </>
  );
}
function MechanismChoices({
  mechanisms,
  draft,
  onToggle,
  groupByLearning = false,
}) {
  const groupOf = (m) =>
    groupByLearning
      ? (LE.find((l) => m.w[l.id] === "P") || LE.find((l) => m.w[l.id] === "S"))
          ?.label || t("Sonstige")
      : m.kat;
  return [...new Set(mechanisms.map(groupOf))].map((group) => (
    <details open key={group}>
      <summary>
        {t(group)}{" "}
        <small>
          {
            mechanisms.filter(
              (m) => groupOf(m) === group && draft.mechanisms.includes(m.id),
            ).length
          }
          /{mechanisms.filter((m) => groupOf(m) === group).length}
        </small>
      </summary>
      <div className="mechanism-list">
        {mechanisms
          .filter((m) => groupOf(m) === group)
          .sort((a, b) => {
            const rank = (m) =>
              m.pflicht
                ? -1
                : draft.learning.some((id) => m.w[id] === "P")
                  ? 0
                  : draft.learning.some((id) => m.w[id] === "S")
                    ? 1
                    : 2;
            return (
              rank(a) - rank(b) ||
              Number(Boolean(b.kern)) - Number(Boolean(a.kern))
            );
          })
          .map((m) => (
            <button
              className={
                "mechanism " +
                (draft.mechanisms.includes(m.id) ? "selected" : "")
              }
              key={m.id}
              aria-labelledby={`mechanism-${m.id}-label`}
              aria-describedby={`mechanism-${m.id}-description mechanism-${m.id}-relevance`}
              onClick={() => onToggle(m.id)}
              aria-pressed={draft.mechanisms.includes(m.id)}
              aria-disabled={m.pflicht || undefined}
            >
              <span className="check" aria-hidden="true">
                {draft.mechanisms.includes(m.id) ? "✓" : "+"}
              </span>
              <span>
                <strong id={`mechanism-${m.id}-label`}>{t(m.label)}</strong>
                <span className="badges" id={`mechanism-${m.id}-relevance`}>
                  {m.pflicht && <small>{t("IMMER")}</small>}
                  {m.kern && <small>{t("KERN")}</small>}
                  {m.basis && !m.pflicht && <small>{t("BASIS")}</small>}
                  {draft.learning
                    .filter((id) => m.w[id])
                    .map((id) => (
                      <small
                        className={m.w[id] === "~" ? "friction" : "relevance"}
                        key={id}
                      >
                        {m.w[id]}: {t(LE.find((l) => l.id === id).label)}
                      </small>
                    ))}
                </span>
                <span className="description">{t(m.kurz)}</span>
                <span
                  className="description"
                  id={`mechanism-${m.id}-description`}
                >
                  {t(m.desc)}
                </span>
              </span>
            </button>
          ))}
      </div>
    </details>
  ));
}
function WorkshopJoin({
  workshops,
  workshopId,
  setWorkshopId,
  code,
  setCode,
  join,
  session,
}) {
  return (
    <div className="workshop-join">
      {workshops.length > 0 && (
        <label>
          {t("Workshop ")}
          <select
            value={workshopId}
            onChange={(e) => setWorkshopId(e.target.value)}
          >
            <option value="">{t("Workshop auswählen")}</option>
            {workshops.map((w) => (
              <option disabled={!w.active} key={w.id} value={w.id}>
                {w.title}
                {!w.active ? " · geschlossen" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        {t("Workshop-Code ")}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          maxLength={80}
          placeholder={t("Code von deiner Moderation")}
        />
      </label>
      <Button secondary disabled={!session || !code.trim()} onClick={join}>
        {t("Workshop beitreten ")}
      </Button>
    </div>
  );
}
