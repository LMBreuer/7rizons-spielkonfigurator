import {
  cardTypeKey,
  cardTypeName,
  worksheetCards,
  worksheetEdits,
} from "../supabase/functions/_shared/card-text.js";
import { printWorksheet } from "./WorksheetCards.jsx";
import CardPrintEditor from "./CardPrintEditor.jsx";
import {
  exportCardFile,
  importCardFile,
  parseCardFile,
} from "./card-exchange.js";
import {
  readCardPrint,
  savedCardPrint,
} from "../supabase/functions/_shared/card-print.js";
import ContentLibrary from "./ContentLibrary.jsx";
import Members, { WorkshopRoster } from "./Members.jsx";
import {
  catalogFor,
  validateContent,
} from "../supabase/functions/_shared/content.js";
import InfoPage, { INFO_PAGES } from "./InfoPages.jsx";
import {
  AdminProjectList,
  ProjectRequests,
  WorkshopInvite,
  WorkshopManagement,
  WorkshopProjectList,
} from "./ProjectModeration.jsx";
import {
  isProjectId,
  readExchange,
  nextExchange,
  projectFingerprint,
  importDecision,
} from "./project-exchange.js";
import { t, useLanguage, getLanguage } from "./i18n.js";
import React, { useEffect, useId, useRef, useState } from "react";
import { cloud, unwrap, callFunction } from "./cloud.js";
import {
  PROVIDERS,
  DEFAULT_SETTINGS,
  newDraft,
  applyContentEdition,
  settingsOf,
  conflicts,
  requestFor,
  makePrompt,
  parseResult,
  templateResult,
  markdown,
  readSnapshot,
  originalWorksheetResult,
  createWorksheet,
} from "../supabase/functions/_shared/domain.js";
import { trackInputMethod } from "./focus.js";
import {
  orderedMechanisms,
  priorityOf,
} from "../supabase/functions/_shared/priority.js";
import Priority from "./Priority.jsx";
import Worksheet from "./Worksheet.jsx";
import ContextField from "./ContextField.jsx";
import { download, jsonFilename } from "./downloads.js";
import WorksheetExport from "./WorksheetExport.jsx";
import Logo from "./Logo.jsx";
import AppearanceSwitch from "./AppearanceSwitch.jsx";
import GuidedTour, {
  rememberTourIntro,
  TourButton,
  TourInvitation,
  tourIntroSeen,
} from "./GuidedTour.jsx";
import { adminTour, projectTour } from "./tour-steps.js";
import {
  APPEARANCE_KEY,
  BACKGROUND_KEY,
  LAYOUT_KEY,
  initialAppearance,
  initialBackground,
  initialLayout,
} from "./appearance.js";
const API_KEY_GUIDES = {
  openai: "https://developers.openai.com/api/docs/quickstart",
  anthropic: "https://platform.claude.com/docs/en/get-api-key",
  gemini: "https://ai.google.dev/gemini-api/docs/api-key",
};
const onlineAccessNotice =
  "Beim Online-Speichern geben Sie dieses Projekt samt Arbeitsblättern für die Administration frei. Sie kann es einsehen und Workshops zuordnen. Die Workshopmoderation sieht bei einer Zuordnung den Titel und das Änderungsdatum.";
const projectTourSteps = projectTour.filter((step) =>
  cloud ? !step.offline : !step.online,
);

function ApiKeyHelp({ provider }) {
  return (
    <p className="muted">
      <a
        href={API_KEY_GUIDES[provider]}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("API-Key bei {0} erstellen", { 0: PROVIDERS[provider] })}
      </a>
      {" · "}
      {t("Beim Anbieter anmelden, einen Key erstellen und hier einfügen.")}
    </p>
  );
}

const invitationKey = "7rizons:workshop-invitation";
function initialInvite() {
  const code = new URLSearchParams(window.location.search)
    .get("workshop")
    ?.trim();
  try {
    if (code && /^[a-z0-9-]{16,80}$/i.test(code)) {
      sessionStorage.setItem(invitationKey, code);
      const url = new URL(window.location.href);
      url.searchParams.delete("workshop");
      url.searchParams.set("view", "account");
      window.history.replaceState(null, "", url.href);
      return code;
    }
    return sessionStorage.getItem(invitationKey) || "";
  } catch {
    return code || "";
  }
}
function locationShareToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get("projekt");
}

function sharedProjectLink(token) {
  return new URL(
    window.location.pathname + "#projekt=" + token,
    window.location.origin,
  ).href;
}

const STORAGE = "7rizons:draft:v1";
const steps = [
  "Organisatorisches",
  "Lernerlebnisse",
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
      const { draft, exchange, importCopy, cloudRevision, openedAt } =
        JSON.parse(localStorage.getItem(key));
      projects.push({
        id: draft.id,
        title: draft.context.thema || draft.context.name,
        projectId: readExchange(exchange)?.projectId || draft.id,
        importCopy: importCopy === true,
        cloudRevision: cloudRevision || 0,
        openedAt: Number.isFinite(openedAt) ? openedAt : 0,
      });
    } catch {}
  }
  return projects.sort((a, b) => b.openedAt - a.openedAt);
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
        openedAt: x.openedAt,
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
    fresh: true,
    draft: newDraft({}),
    worksheets: [],
    activeWorksheetId: null,
    pendingRequest: null,
    cloudRevision: 0,
  };
}
const fileText = async (file) => {
  if (!file) return "";
  if (file.size > 2000000) throw new Error(t("Datei zu groß (max. 2 MB)."));
  return file.text();
};
const defaultEditionFields = "content,default_edition_id,content_editions(title)";
function defaultEditionOf(row) {
  return {
    id: row.default_edition_id,
    title: row.content_editions?.title,
    content: row.content || {},
  };
}
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
function ProjectListRow({ title, detail, busy, onOpen, onDelete }) {
  const detailId = useId();
  return (
    <div className="project-library-row">
      <button
        type="button"
        className="text-button project-open"
        disabled={busy}
        onClick={onOpen}
        aria-label={t("„{0}“ öffnen", { 0: title })}
        aria-describedby={detail ? detailId : undefined}
      >
        <strong>{title}</strong>
        {detail && <small id={detailId}>{detail}</small>}
      </button>
      <button
        type="button"
        className="text-button project-delete"
        disabled={busy}
        onClick={onDelete}
        aria-label={t("„{0}“ löschen", { 0: title })}
      >
        {t("Löschen ")}
      </button>
    </div>
  );
}
function HeaderPreferences({ children }) {
  return (
    <details className="switch-menu preferences-menu">
      <summary
        aria-label={t("Darstellung und Sprache")}
        title={t("Darstellung und Sprache")}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="19"
          height="19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <path d="M3 7h7m4 0h7M3 17h11m4 0h3" />
          <circle cx="12" cy="7" r="2" />
          <circle cx="16" cy="17" r="2" />
        </svg>
        <span>{t("Darstellung")}</span>
      </summary>
      <div className="menu-body">{children}</div>
    </details>
  );
}
function Card({ children, className = "" }) {
  return <section className={"panel " + className}>{children}</section>;
}
function WorkspaceLayout({ heading, rail, children, className = "" }) {
  return (
    <>
      {heading}
      <div className={`workspace-layout ${className}`.trim()}>
        {rail}
        <div className="workspace-content">{children}</div>
      </div>
    </>
  );
}
function runPrintMenuAction(event, action) {
  const menu = event.currentTarget.closest("details");
  menu.open = false;
  menu.querySelector("summary").focus();
  action();
}
function ConfiguratorHeading({ step, projectTitle, hasDocument }) {
  const intro = (
    <>
      {t("Gestalten Sie")} <Logo wordmark /> {t("für Ihre Lehre.")}
    </>
  );
  const ProjectHeading = hasDocument ? "p" : "h1";
  return (
    <header className="configurator-intro no-print">
      <div className="configurator-heading-line">
        {step === 1 ? (
          <h1 className="configurator-title">{intro}</h1>
        ) : (
          <>
            <span
              className="configurator-title intro-height"
              aria-hidden="true"
            >
              {intro}
            </span>
            <ProjectHeading
              className="configurator-title current-project-title"
              title={projectTitle}
            >
              {projectTitle}
            </ProjectHeading>
          </>
        )}
      </div>
      <p className="configurator-subtitle">
        {step === 1
          ? t("Von der Spielidee zum Seminar")
          : t("Schritt {0} von {1}", { 0: step, 1: steps.length })}
      </p>
    </header>
  );
}
function AdminConfigurationSummary({ draft }) {
  const { LE, MK } = catalogFor(draft);
  const selection = [
    [
      t("Lernerlebnisse"),
      priorityOf(draft).learningOrder.filter((id) =>
        draft.learning.includes(id),
      ),
      LE,
    ],
    [t("Mechaniken"), orderedMechanisms(draft), MK],
  ];
  return (
    <details>
      <summary>{t("Konfiguration ansehen")}</summary>
      {selection.map(([label, ids, catalog]) => (
        <section key={label}>
          <h2>{label}</h2>
          {ids.length ? (
            <ol>
              {ids.map((id) => (
                <li key={id}>
                  {t(catalog.find((item) => item.id === id)?.label || id)}
                </li>
              ))}
            </ol>
          ) : (
            <p>{t("Keine Auswahl")}</p>
          )}
        </section>
      ))}
    </details>
  );
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
  const selfStudy =
    new URLSearchParams(window.location.search).get("modus") ===
    "selbststudium";
  const { LE, MK } = catalogFor(draft);
  const [published, setPublished] = useState(null);
  const [publicEditions, setPublicEditions] = useState([]);
  const [cardPrint, setCardPrint] = useState(() =>
    readCardPrint(saved.cardPrint),
  );
  const [cardPrintOpen, setCardPrintOpen] = useState(false);
  const [worksheets, setWorksheets] = useState(saved.worksheets || []);
  const [activeWorksheetId, setActiveWorksheetId] = useState(
    saved.activeWorksheetId,
  );
  const [request, setRequest] = useState(saved.pendingRequest || null);
  const [editingId, setEditingId] = useState(null);
  const [originalId, setOriginalId] = useState(null);
  const [worksheetExport, setWorksheetExport] = useState(null);
  const activeWorksheet =
    worksheets.find((w) => w.id === activeWorksheetId) || null;
  const result = activeWorksheet?.result || null;
  const showingOriginal =
    originalId === activeWorksheetId && Boolean(activeWorksheet?.original);
  const visibleResult = showingOriginal
    ? originalWorksheetResult(activeWorksheet)
    : result;
  const source = activeWorksheet?.source || null;
  const resultSettings = activeWorksheet?.resultSettings || DEFAULT_SETTINGS;
  const resultDraft = activeWorksheet?.draft || draft;
  const [cloudRevision, setCloudRevision] = useState(saved.cloudRevision || 0);
  const projectOpenedAt = useRef(saved.openedAt || Date.now());
  const [tour, setTour] = useState(null);
  const [offerTour, setOfferTour] = useState(() => !tourIntroSeen());
  const [savedStep, setStep] = useState(
    !selfStudy &&
      saved.step === 5 &&
      !saved.worksheets.length &&
      !saved.buildingSheet
      ? 4
      : saved.step || 1,
  );
  const step = (!tour?.admin && projectTourSteps[tour?.index]?.screen) || savedStep;
  const [buildingSheet, setBuildingSheet] = useState(
    saved.buildingSheet === true,
  );
  const lastConfigStep = useRef(
    saved.configStep || (saved.step < 5 ? saved.step : 1),
  );
  if (savedStep < 5) lastConfigStep.current = savedStep;
  const projectMenu = useRef(null);
  const sheetMenu = useRef(null);
  const cardImportField = useRef(null);
  useEffect(() => {
    function closeMenus(event) {
      if (event.target.closest?.(".guided-tour")) return;
      const escape = event.type === "keydown" && event.key === "Escape";
      if (event.type === "keydown" && !escape) return;
      for (const menu of document.querySelectorAll(
        "details.switch-menu[open]",
      )) {
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
  const [inviteCode] = useState(initialInvite);
  const [shareToken, setShareToken] = useState(locationShareToken);
  const [page, navigate] = useState(() => {
    if (shareToken) return "shared-project";
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (Object.hasOwn(INFO_PAGES, view) || view === "about") return view;
    if (
      ["share", "save"].includes(view) &&
      params.get("project") === saved.draft.id
    )
      return "project-" + view;
    return inviteCode || view === "account" ? "account" : "app";
  });
  const editorDirty = useRef(false);
  function setPage(next) {
    if (
      page === "content" &&
      next !== "content" &&
      editorDirty.current &&
      !window.confirm(t("Unveröffentlichte Änderungen verwerfen?"))
    )
      return;
    navigate(next);
  }
  const projectAction =
    page === "project-share"
      ? "share"
      : page === "project-save"
        ? "save"
        : null;
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SETTINGS);
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [superadmin, setSuperadmin] = useState(false);
  const [adminTab, setAdminTab] = useState("workshops");
  const [moderatedWorkshops, setModeratedWorkshops] = useState([]);
  const [moderation, setModeration] = useState(null);
  const [workshopLinks, setWorkshopLinks] = useState([]);
  const [projectShare, setProjectShare] = useState(null);
  const [shareStatus, setShareStatus] = useState("loading");
  const [shareAttempt, setShareAttempt] = useState(0);
  const projectTitle =
    draft.context.thema || draft.context.name || t("Unbenanntes Projekt");
  const [sharedProject, setSharedProject] = useState(null);
  const [sharedSheetId, setSharedSheetId] = useState("");
  const [shareLoaded, setShareLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [layout, setLayout] = useState(() =>
    initialLayout({ getItem: (key) => localStorage.getItem(key) }),
  );
  const [theme, setTheme] = useState(() =>
    initialAppearance({ getItem: (key) => localStorage.getItem(key) }),
  );
  const [background, setBackground] = useState(() =>
    initialBackground({ getItem: (key) => localStorage.getItem(key) }),
  );
  const showBackground = layout === "modern" && theme !== "contrast";
  const mainRef = useRef(null);
  const lastView = useRef({ page, step, result: null, preview: null });
  const [sortMessage, setSortMessage] = useState("");
  const [withInstructions, setWithInstructions] = useState(true);
  const [mode, setMode] = useState("template");
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [importText, setImportText] = useState("");
  const [answerError, setAnswerError] = useState("");
  const configImportRef = useRef(null);
  const answerImportRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminLogin, setAdminLogin] = useState(false);
  const [workshops, setWorkshops] = useState([]);
  const [workshopId, setWorkshopId] = useState("");
  const [code, setCode] = useState(inviteCode);
  const accountId = session?.user.id;
  const [archive, setArchive] = useState(null);
  const [archiveVersion, setArchiveVersion] = useState(0);
  const accountArchive = archive?.owner === accountId ? archive : null;
  const entries = accountArchive?.entries || [];
  const onlineById = new Map(entries.map((entry) => [entry.id, entry]));
  const localIds = new Set(projects.map((project) => project.id));
  const recentProjects = [
    ...projects.map((project) => ({
      ...project,
      online: onlineById.get(project.id),
      local: true,
    })),
    ...entries
      .filter((entry) => !localIds.has(entry.id))
      .map((entry) => ({
        ...entry,
        openedAt: Date.parse(entry.updated_at) || 0,
      })),
  ]
    .filter((project) => project.id !== draft.id)
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, 3);
  const archiveStatus = accountArchive?.status || "loading";
  const refreshArchive = () => setArchiveVersion((version) => version + 1);
  const [submissions, setSubmissions] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [adminWorkshops, setAdminWorkshops] = useState([]);
  const [editionOptions, setEditionOptions] = useState([]);
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
  const storedCardPrint = savedCardPrint(cardPrint);
  const payload = () => ({
    draft,
    ...(storedCardPrint ? { cardPrint: storedCardPrint } : {}),
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
  async function act(fn, reportError = setError) {
    setError("");
    setMessage("");
    if (reportError !== setError) reportError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      reportError(t(e.message || "Etwas hat nicht funktioniert."));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    document.documentElement.dataset.layout = layout;
    try {
      localStorage.setItem(LAYOUT_KEY, layout);
    } catch {}
  }, [layout]);
  useEffect(() => {
    document.documentElement.dataset.background = background;
    try {
      localStorage.setItem(BACKGROUND_KEY, background);
    } catch {}
  }, [background]);
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
    lastView.current = {
      page,
      step,
      activeWorksheetId,
      preview,
      showingOriginal,
      inTour: Boolean(tour),
    };
    let heading;
    if (changed)
      heading = mainRef.current?.querySelector(
        page === "app" ? ".workspace h2, .worksheet h1" : "h1",
      );
    else if (
      (activeWorksheetId && activeWorksheetId !== old.activeWorksheetId) ||
      (preview && preview !== old.preview) ||
      showingOriginal !== (old.showingOriginal || false)
    )
      heading = mainRef.current?.querySelector(".worksheet h1");
    if (heading && !tour && !old.inTour) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [page, step, activeWorksheetId, preview, showingOriginal, tour]);
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
        openedAt: projectOpenedAt.current,
        step: savedStep,
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
    cardPrint,
    worksheets,
    activeWorksheetId,
    request,
    cloudRevision,
    savedStep,
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
      .select("value," + defaultEditionFields)
      .eq("id", true)
      .single()
      .then(({ data, error }) => {
        if (alive) {
          if (data) {
            setSettings(settingsOf(data.value));
            const edition = defaultEditionOf(data);
            setPublished(edition);
            if (saved.fresh)
              setDraft((d) =>
                d.id === saved.draft.id &&
                d.edition === saved.draft.edition &&
                !d.editionInfo &&
                !d.learning.length
                  ? applyContentEdition(d, edition)
                  : d,
              );
          } else if (error)
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
    if (!cloud || page !== "app" || step !== 1) return;
    let alive = true;
    cloud
      .from("content_editions")
      .select("id,title")
      .eq("is_public", true)
      .order("title")
      .then(({ data }) => {
        if (alive) setPublicEditions(data || []);
      });
    return () => {
      alive = false;
    };
  }, [page, step]);
  useEffect(() => {
    let alive = true;
    setAdmin(false);
    setSuperadmin(false);
    setAdminTab("workshops");
    setTour((current) => (current?.admin ? null : current));
    setModeratedWorkshops([]);
    setModeration(null);
    setCredentials([]);
    setCentralKey("");
    setMode((mode) =>
      ["saved", "workshop"].includes(mode) ? "template" : mode,
    );
    setWorkshops([]);
    setWorkshopId("");
    setMySubmissions([]);
    if (session) {
      cloud.rpc("is_admin").then(({ data }) => {
        if (alive) setAdmin(!!data);
      });
      cloud.rpc("is_superadmin").then(({ data }) => {
        if (alive) setSuperadmin(!!data);
      });
      cloud.rpc("my_moderated_workshops").then(({ data }) => {
        if (alive) setModeratedWorkshops(data || []);
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
    if (!cloud || !accountId) {
      setArchive(null);
      return;
    }
    const request = new AbortController();
    setArchive((previous) => ({
      owner: accountId,
      entries: previous?.owner === accountId ? previous.entries : [],
      status: "loading",
    }));
    cloud
      .from("configurations")
      .select("id,title,revision,updated_at,admin_shared_at")
      .eq("owner_id", accountId)
      .order("updated_at", { ascending: false })
      .abortSignal(request.signal)
      .then(({ data, error }) => {
        if (!request.signal.aborted)
          setArchive((previous) => ({
            owner: accountId,
            entries: error ? previous?.entries || [] : data || [],
            status: error ? "error" : "ready",
          }));
      });
    return () => request.abort();
  }, [accountId, archiveVersion]);
  useEffect(() => {
    let alive = true;
    setWorkshopLinks([]);
    if (session) {
      cloud
        .rpc("my_workshop_project_links", { p_project: draft.id })
        .then(({ data }) => {
          if (alive) setWorkshopLinks(data || []);
        });
    }
    return () => {
      alive = false;
    };
  }, [session?.user.id, draft.id]);
  useEffect(() => {
    function followLink() {
      const token = locationShareToken();
      setShareToken(token);
      if (token) {
        setShareLoaded(false);
        setSharedProject(null);
        setSharedSheetId("");
        setPage("shared-project");
      } else {
        setPage((current) => (current === "shared-project" ? "app" : current));
      }
    }
    window.addEventListener("hashchange", followLink);
    return () => window.removeEventListener("hashchange", followLink);
  }, []);
  function openConfigurator() {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (selfStudy ? "?modus=selbststudium" : ""),
    );
    setShareToken(null);
    setMessage("");
    setError("");
    setPage("app");
  }
  useEffect(() => {
    if (!shareToken) return;
    let alive = true;
    async function read() {
      try {
        if (!cloud || !isProjectId(shareToken)) return;
        const data = unwrap(
          await cloud.rpc("read_project_share", { p_token: shareToken }),
        );
        if (!data || !alive) return;
        const snapshot = readSnapshot(data.project);
        setSharedProject({ ...data, snapshot });
        setSharedSheetId(snapshot.activeWorksheetId || "");
      } catch (error) {
        if (alive) setError(t(error.message));
      } finally {
        if (alive) setShareLoaded(true);
      }
    }
    read();
    return () => {
      alive = false;
    };
  }, [shareToken]);
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
  const editionInfo = draft.editionInfo;
  const editionLocked = Boolean(editionInfo?.workshopId);
  const listedEdition = publicEditions.some((row) => row.id === editionInfo?.id);
  async function switchEdition(id) {
    const edition = unwrap(
      await cloud
        .from("content_editions")
        .select("id,title,content")
        .eq("id", id)
        .eq("is_public", true)
        .maybeSingle(),
    );
    if (!edition) {
      setPublicEditions((rows) => rows.filter((row) => row.id !== id));
      throw new Error(t("Diese Fassung ist nicht mehr öffentlich verfügbar."));
    }
    const next = applyContentEdition(draft, edition);
    const removed =
      next.learning.length !== draft.learning.length ||
      next.mechanisms.length !== draft.mechanisms.length;
    change(() => next);
    setRequest(null);
    setMessage(
      [
        t("Fassung gewechselt."),
        removed && t("Auswahlen, die in dieser Fassung fehlen, wurden entfernt."),
        worksheets.length > 0 &&
          t("Bisherige Arbeitsblätter behalten ihren Stand."),
      ].filter(Boolean).join(" "),
    );
  }
  function toggleLearning(id) {
    change((d) => ({
      ...d,
      learning: d.learning.includes(id)
        ? d.learning.filter((x) => x !== id)
        : [...d.learning, id],
    }));
  }
  function toggleMechanism(id) {
    if (MK.find((m) => m.id === id)?.kern && draft.mechanisms.includes(id))
      return;
    change((d) => ({
      ...d,
      mechanisms: d.mechanisms.includes(id)
        ? d.mechanisms.filter((x) => x !== id)
        : [...d.mechanisms, id],
      ...(d.priority && !d.mechanisms.includes(id)
        ? {
            priority: {
              ...d.priority,
              finalSelection: [...d.priority.finalSelection, id],
            },
          }
        : {}),
    }));
  }
  function selectBaseGame() {
    const base = MK.filter((m) => !m.archived && (m.basis || m.kern)).map(
      (m) => m.id,
    );
    change((d) => ({
      ...d,
      mechanisms: [...new Set([...d.mechanisms, ...base])],
      ...(d.priority
        ? {
            priority: {
              ...d.priority,
              finalSelection: [
                ...new Set([...d.priority.finalSelection, ...base]),
              ],
            },
          }
        : {}),
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
    const edition = unwrap(
      await cloud.rpc("workshop_edition", { p_workshop: id }),
    );
    validateContent(edition.content);
    if (!worksheets.length && !cloudRevision && !exchange)
      setDraft((d) =>
        d.id === draft.id && d.revision === 1 && !d.learning.length
          ? applyContentEdition(d, edition, id)
          : d,
      );

    setCode("");
    try {
      sessionStorage.removeItem(invitationKey);
    } catch {}
    setMessage(t("Sie sind dem Workshop beigetreten."));
  }
  async function saveOnline({ confirmed = false } = {}) {
    if (!session) throw new Error(t("Bitte zuerst anmelden."));
    if (
      !confirmed &&
      !onlineById.get(draft.id)?.admin_shared_at &&
      !window.confirm(
        `${t(onlineAccessNotice)}\n\n${t("Projekt online speichern?")}`,
      )
    ) {
      return null;
    }
    const rev = unwrap(
      await cloud.rpc("save_configuration_for_administration", {
        p_id: draft.id,
        p_revision: cloudRevision,
        p_title: (
          draft.context.thema ||
          draft.context.name ||
          "Seminar-Hack"
        ).slice(0, 300),
        p_payload: payload(),
      }),
    );
    setCloudRevision(rev);
    refreshArchive();
    setMessage(t("Projekt und Arbeitsblätter wurden online gespeichert."));
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
  const canEditWorksheet =
    result &&
    result.templateVariant !== "overview" &&
    !showingOriginal &&
    (!selfStudy || editingId === activeWorksheetId);
  function updateWorksheetResult(update) {
    setWorksheets((items) =>
      items.map((sheet) =>
        sheet.id === activeWorksheetId
          ? {
              ...sheet,
              original: sheet.original ?? worksheetEdits(sheet.result),
              result: update(sheet.result),
            }
          : sheet,
      ),
    );
  }
  function updateWorksheetCards(update) {
    updateWorksheetResult((previous) => {
      const { playtest } = previous.answers || {};
      const cards = update(worksheetCards(previous));
      const ids = new Set(cards.map((card) => card.id));
      return {
        ...previous,
        cards,
        ...(previous.notes
          ? {
              notes: previous.notes.map((note) =>
                note.after && !ids.has(note.after)
                  ? { ...note, after: undefined }
                  : note,
              ),
            }
          : {}),
        answers: playtest !== undefined ? { playtest } : {},
      };
    });
  }
  function workshopSheet() {
    const match = [activeWorksheet, ...worksheets].find(
      (w) =>
        w &&
        w.draft.revision === draft.revision &&
        w.result.templateVariant === "guided",
    );
    if (match) setActiveWorksheetId(match.id);
    else {
      const result = templateResult(draft, settings, "guided");
      addWorksheet({ ...result, answers: {} }, { kind: "template" }, settings);
    }
    setBuildingSheet(false);
    setPreview(null);
  }
  function goStep(next, openBuilder = false) {
    setMessage("");
    setError("");
    if (next > 1 && !draft.context.thema?.trim()) {
      setStep(1);
      setError(t("Bitte geben Sie das Seminarthema ein."));
      window.requestAnimationFrame(() =>
        document.getElementById("context-thema")?.focus(),
      );
      return;
    }
    if (next > 2 && !draft.learning.length) {
      setStep(2);
      setError(t("Bitte wählen Sie mindestens ein Lernerlebnis."));
      return;
    }
    if (next === 5 && openBuilder) {
      setMode("external");
      setPreview(null);
      focusWorksheetBuilder();
    } else if (next === 5 && !selfStudy) {
      try {
        workshopSheet();
      } catch (error) {
        setStep(4);
        setError(t(error.message));
        return;
      }
    }
    setStep(next);
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
    if (!selfStudy && !remaining.length) setStep(4);
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
      setMessage(t("Ihr Arbeitsblatt ist fertig – ohne KI erstellt."));
      return;
    }
    if (mode === "external") {
      const r = requestFor(draft, settings);
      setRequest(r);
      setImportText("");
      setAnswerError("");
      setPreview(null);
      setMessage(
        t(
          "Ihr KI-Auftrag ist vorbereitet. Kopieren Sie ihn oder laden Sie ihn herunter.",
        ),
      );
      return;
    }
    if (!session) throw new Error(t("Für direkte KI-Nutzung bitte anmelden."));
    if (mode === "personal" && !apiKey.trim())
      throw new Error(t("Tragen Sie Ihren eigenen API-Key ein."));
    if (mode === "workshop" && !workshopId)
      throw new Error(
        t("Treten Sie zuerst mit Ihrem Code einem Workshop bei."),
      );
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
        "Ihr KI-Arbeitsblatt ist fertig. Prüfen Sie bitte die fachlichen Beispiele.",
      ),
    );
  }
  function applySnapshot(x, revision = 0, resumeStep, options = {}) {
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
    if (!options.discardCurrent) persistProject();
    projectOpenedAt.current = Date.now();
    setExchange(metadata.exchange);
    setExchangeBase(metadata.base);
    setImportCopy(metadata.copy);
    setProjects(listProjects());
    setEditingId(null);
    setOriginalId(null);
    setImportText("");
    setAnswerError("");
    setApiKey("");
    setSubmissionConsent(false);
    setMode("template");
    setWithInstructions(true);
    setDraft(x.draft);
    setCardPrint(readCardPrint(x.cardPrint));
    setCardPrintOpen(false);
    setLanguage(x.draft.language || "de");
    setWorksheets(x.worksheets);
    setActiveWorksheetId(x.activeWorksheetId);
    setRequest(x.pendingRequest);
    setBuildingSheet(builderWasOpen);
    lastConfigStep.current = previousStep;
    if (projectMenu.current) projectMenu.current.open = false;
    setCloudRevision(revision);
    setStep(
      !selfStudy && !x.worksheets.length && resumeStep === 5 && !builderWasOpen
        ? 4
        : resumeStep || (x.worksheets.length ? 5 : 1),
    );
    setPage(options.page || "app");
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
  async function newConfiguration(forWorkshop = "") {
    let edition = published;
    if (forWorkshop) {
      edition = unwrap(
        await cloud.rpc("workshop_edition", { p_workshop: forWorkshop }),
      );
    } else if (cloud) {
      const { data: row } = await cloud
        .from("app_settings")
        .select(defaultEditionFields)
        .eq("id", true)
        .single();
      if (row) {
        edition = defaultEditionOf(row);
        setPublished(edition);
      } else
        setMessage(
          t(
            "Offline angelegt. Dieses Projekt verwendet die zuletzt im Browser verfügbare Inhaltsfassung.",
          ),
        );
    }
    const next = { ...newDraft({}), language };
    setWorkshopId(forWorkshop);
    applySnapshot({
      draft: edition ? applyContentEdition(next, edition, forWorkshop) : next,
    });
  }
  function openArchive() {
    setProjects(listProjects());
    if (accountId) refreshArchive();
    setPage("archive");
  }
  function openLocalProject(id) {
    if (id === draft.id) {
      if (projectMenu.current) projectMenu.current.open = false;
      setPage("app");
      return;
    }
    const snapshot = JSON.parse(localStorage.getItem(PROJECT_PREFIX + id));
    if (!snapshot)
      throw new Error(
        t("Dieses Projekt ist auf diesem Gerät nicht mehr verfügbar."),
      );
    applySnapshot(snapshot, snapshot.cloudRevision, snapshot.step);
  }

  function removeLocalProject(project) {
    if (
      !window.confirm(
        t("„{0}“ von diesem Gerät löschen?", {
          0: project.title || t("Unbenanntes Projekt"),
        }),
      )
    )
      return;
    localStorage.removeItem(PROJECT_PREFIX + project.id);
    if (project.id === draft.id) {
      localStorage.removeItem(ACTIVE_PROJECT);
      const blank = { ...newDraft({}), language };
      applySnapshot(
        { draft: published ? applyContentEdition(blank, published) : blank },
        0,
        1,
        { discardCurrent: true, page: "archive" },
      );
    } else setProjects(listProjects());
  }

  async function removeOnlineProject(project) {
    if (
      !accountId ||
      !window.confirm(
        t(
          "Diesen Online-Entwurf löschen? Bestehende Workshop-Abgaben bleiben separat erhalten.",
        ),
      )
    )
      return;
    unwrap(
      await cloud
        .from("configurations")
        .delete()
        .eq("owner_id", accountId)
        .eq("id", project.id),
    );
    setArchive((previous) =>
      previous?.owner === accountId
        ? {
            ...previous,
            entries: previous.entries.filter(
              (entry) => entry.id !== project.id,
            ),
          }
        : previous,
    );
    refreshArchive();
    if (draft.id === project.id) setCloudRevision(0);
    else {
      const key = PROJECT_PREFIX + project.id;
      const local = JSON.parse(localStorage.getItem(key));
      if (local) {
        localStorage.setItem(
          key,
          JSON.stringify({ ...local, cloudRevision: 0 }),
        );
        setProjects(listProjects());
      }
    }
  }
  async function openOnlineProject(id) {
    if (!accountId) return;
    if (
      localStorage.getItem(PROJECT_PREFIX + id) &&
      !window.confirm(
        t("Den lokalen Stand dieses Projekts durch die Online-Version ersetzen?"),
      )
    )
      return;
    const row = unwrap(
      await cloud
        .from("configurations")
        .select("payload,revision")
        .eq("owner_id", accountId)
        .eq("id", id)
        .single(),
    );
    applySnapshot(row.payload, row.revision);
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
    setEditionOptions(
      unwrap(
        await cloud.from("content_editions").select("id,title").order("title"),
      ),
    );
    setPage("admin");
  }
  async function openAdminSection(id) {
    setAdminTab(id);
    if (id === "settings") {
      const row = unwrap(
        await cloud
          .from("app_settings")
          .select("value")
          .eq("id", true)
          .single(),
      );
      const current = settingsOf(row.value);
      setSettings(current);
      setSettingsDraft(current);
    }
    if (id === "submissions") {
      setSubmissions(
        unwrap(
          await cloud
            .from("submissions")
            .select("id,title,status,created_at,workshop_id,payload")
            .order("created_at", { ascending: false }),
        ),
      );
    }
    if (id !== "credentials") return;
    const data = await callFunction("credentials", {
      action: "status",
      provider: "openai",
    });
    setCredentials(data.credentials);
  }
  async function changeWorkshopLink(id, link) {
    if (link && !(await saveOnline())) return;
    unwrap(
      await cloud.rpc("set_workshop_project", {
        p_workshop: id,
        p_project: draft.id,
        p_link: link,
      }),
    );
    setWorkshopLinks(
      unwrap(
        await cloud.rpc("my_workshop_project_links", { p_project: draft.id }),
      ),
    );
    setMessage(
      t(
        link
          ? "Projekt dem Workshop zugeordnet."
          : "Projektzuordnung entfernt.",
      ),
    );
  }
  async function loadModeration(workshop) {
    const [projects, entries] = await Promise.all([
      cloud.rpc("list_workshop_projects", { p_workshop: workshop.id }),
      cloud
        .from("submissions")
        .select("id,title,status,created_at,workshop_id,payload")
        .eq("workshop_id", workshop.id)
        .order("created_at", { ascending: false }),
    ]);
    setModeration({
      workshop,
      projects: unwrap(projects),
      submissions: unwrap(entries),
    });
    setPage("moderation");
  }
  useEffect(() => {
    if (page !== "project-share" || !session) return;
    let alive = true;
    setShareStatus("loading");
    setProjectShare(null);
    cloud
      .rpc("my_project_share", { p_project: draft.id })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setShareStatus("error");
          setError(error.message);
          return;
        }
        setProjectShare(data?.[0] || null);
        setShareStatus("ready");
      });
    return () => {
      alive = false;
    };
  }, [page, session?.user.id, draft.id, shareAttempt]);
  function openProjectShare() {
    setProjectShare(null);
    setShareStatus("loading");
    setError("");
    setMessage("");
    setPage("project-share");
  }
  async function publishProjectShare() {
    const revision = await saveOnline();
    if (!revision) return;
    const token = unwrap(
      await cloud.rpc("create_project_share", {
        p_project: draft.id,
        p_revision: revision,
      }),
    );
    setProjectShare({ token, shared_revision: revision });
    setMessage(t("Freigabelink erstellt."));
  }
  function openAdminProject(project, payload) {
    const snapshot = readSnapshot(payload);
    setSharedProject({
      title: project.title,
      project: payload,
      snapshot,
      stand:
        project.admin_access || project.is_owner
          ? project.revision
          : project.shared_revision,
      currentOnlineStand: project.admin_access || project.is_owner,
      adminAccountId: accountId,
    });
    setSharedSheetId(snapshot.activeWorksheetId || "");
    setPage("admin-project");
  }
  function downloadSharedProject(title, snapshot) {
    download(
      JSON.stringify(snapshot, null, 2),
      jsonFilename(title),
      "application/json",
    );
  }
  const activeSharedSheet = sharedProject?.snapshot.worksheets.find(
    (w) => w.id === sharedSheetId,
  );
  const adminSections = [
    ["projects", t("Projekte")],
    ["workshops", t("Workshops")],
    ["submissions", t("Abgaben")],
    ["credentials", t("KI-Zugänge")],
    ["members", t("Mitglieder")],
    ["settings", t("KI-Einstellungen")],
  ];
  function showTourStep(index, current = tour) {
    const step = (current.admin ? adminTour : projectTourSteps)[index];
    if (!step) return;
    setTour({ ...current, index });
    if (step.section) {
      if (adminTab !== step.section) act(() => openAdminSection(step.section));
    } else if (step.archive) {
      if (page !== "archive") openArchive();
    } else if (page !== "app") {
      setPage("app");
    }
  }
  function dismissTourInvitation() {
    rememberTourIntro();
    setOfferTour(false);
  }
  function startTour(event) {
    const isAdminTour = page === "admin";
    if (!isAdminTour) dismissTourInvitation();
    showTourStep(0, {
      admin: isAdminTour,
      origin: page,
      trigger: event.currentTarget,
    });
  }
  function closeTour() {
    if (!tour.admin && page !== tour.origin) setPage(tour.origin);
    setTour(null);
  }
  const notices = (
    <>
      {error && (
        <div className="notice error" role="alert">
          {t(error)}{" "}
          <button
            className="notice-close"
            onClick={() => setError("")}
            aria-label={t("Meldung schließen")}
          >
            ×
          </button>
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {t(message)}{" "}
          <button
            className="notice-close"
            onClick={() => setMessage("")}
            aria-label={t("Meldung schließen")}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
  const hasWorksheet = step === 5 && result && !buildingSheet && !preview;
  const activeCards = hasWorksheet ? worksheetCards(visibleResult) : [];
  const printCardCatalog = hasWorksheet ? catalogFor(resultDraft).MK : [];
  const worksheetTypeName = (id) => {
    const name = printCardCatalog.find((item) => item.id === id)?.label;
    return cardTypeName(visibleResult, id, name ? t(name) : t("Spielkarte"));
  };
  function downloadCards(template) {
    const content = exportCardFile({
      result: visibleResult,
      worksheetId: activeWorksheetId,
      settings: cardPrint,
      typeName: worksheetTypeName,
      template,
      t,
    });
    download(
      JSON.stringify(content, null, 2),
      jsonFilename(projectTitle, template ? "kartenvorlage" : "karten"),
      "application/json",
    );
  }
  async function loadCards(file) {
    const json = parseCardFile(await fileText(file));
    const imported = importCardFile(json, result, activeWorksheetId, cardPrint);
    updateWorksheetResult((previous) => {
      const { playtest } = previous.answers || {};
      return {
        ...previous,
        cards: [...worksheetCards(previous), ...imported.added],
        ...(Object.keys(imported.types).length
          ? { cardTypes: imported.types }
          : {}),
        answers: playtest === undefined ? {} : { playtest },
      };
    });
    setCardPrint(imported.settings);
    setMessage(
      t("{0} Karten importiert, {1} bereits vorhanden.", {
        0: imported.added.length,
        1: imported.skipped,
      }),
    );
  }
  const sheetTools = step === 5 && worksheets.length > 0 && (
    <div
      className="sheet-tools no-print"
      role="group"
      aria-label={t("Arbeitsblatt verwalten")}
    >
      <details className="switch-menu sheet-menu" ref={sheetMenu}>
        <summary data-tour="worksheet-menu">
          {t("Arbeitsblatt")}{" "}
          {activeWorksheet && worksheets.indexOf(activeWorksheet) + 1}
        </summary>
        <div className="menu-body">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              sheetMenu.current.open = false;
              setPreview(null);
              focusWorksheetBuilder();
            }}
          >
            + {t("Neues Blatt")}
          </button>
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
                    setOriginalId(null);
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
                              w.result.templateVariant === "guided"
                                ? "Mit Arbeitsaufträgen"
                                : "Nur Übersicht",
                            ),
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : w.source.kind === "import"
                        ? t("KI-Import")
                        : PROVIDERS[w.source.provider] || t("KI")}{" "}
                    ·{" "}
                    {new Date(w.createdAt).toLocaleString(
                      language === "en" ? "en-GB" : "de-AT",
                      { timeZone: "Europe/Vienna" },
                    )}
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
          {activeWorksheet?.original && !showingOriginal && (
            <button
              type="button"
              onClick={() => {
                setOriginalId(activeWorksheetId);
                setBuildingSheet(false);
                setPreview(null);
                sheetMenu.current.open = false;
              }}
            >
              {t("Original anzeigen")}
            </button>
          )}
          {hasWorksheet && (
            <>
              <button
                type="button"
                onClick={() =>
                  download(
                    markdown(resultDraft, visibleResult),
                    "7rizons-arbeitsblatt.md",
                    "text/markdown;charset=utf-8",
                  )
                }
              >
                {t("Markdown herunterladen ")}
              </button>
              <button
                type="button"
                onClick={() => {
                  sheetMenu.current.open = false;
                  sheetMenu.current.querySelector("summary").focus();
                  setWorksheetExport(markdown(resultDraft, visibleResult));
                }}
              >
                {t("Markdown anzeigen und kopieren")}
              </button>
            </>
          )}
        </div>
      </details>
      <div className="sheet-actions">
        {buildingSheet && !preview && (
          <button type="button" onClick={() => setBuildingSheet(false)}>
            {t("Zurück zum Blatt")}
          </button>
        )}
        {selfStudy &&
          hasWorksheet &&
          !showingOriginal &&
          result.templateVariant !== "overview" && (
            <Button
              secondary
              data-tour="edit-worksheet"
              onClick={() => {
                setEditingId(canEditWorksheet ? null : activeWorksheetId);
              }}
            >
              {t(
                canEditWorksheet
                  ? "Bearbeitung beenden"
                  : "Arbeitsblatt bearbeiten",
              )}
            </Button>
          )}

        {hasWorksheet && result.templateVariant !== "overview" && (
          <details className="switch-menu sheet-cards-menu">
            <summary data-tour="card-menu">{t("Karten")}</summary>
            <div className="menu-body">
              {!showingOriginal && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={(event) =>
                    runPrintMenuAction(event, () =>
                      cardImportField.current?.click(),
                    )
                  }
                >
                  {t("Karten importieren")}
                </button>
              )}
              {activeCards.length > 0 && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(event) =>
                      runPrintMenuAction(event, () =>
                        act(() => downloadCards(false)),
                      )
                    }
                  >
                    {t("Karten als JSON exportieren")}
                  </button>
                  <button
                    type="button"
                    data-tour="print-cards"
                    onClick={(event) =>
                      runPrintMenuAction(event, () => setCardPrintOpen(true))
                    }
                  >
                    {t("Karten drucken")}
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={(event) =>
                  runPrintMenuAction(event, () =>
                    act(() => downloadCards(true)),
                  )
                }
              >
                {t("JSON-Vorlage für Karten")}
              </button>
              <input
                ref={cardImportField}
                type="file"
                accept=".json,.txt,.md,application/json,text/plain,text/markdown"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) act(() => loadCards(file));
                }}
              />
            </div>
          </details>
        )}
        {hasWorksheet && (
          <Button secondary onClick={() => printWorksheet()}>
            {t("Arbeitsblatt drucken")}
          </Button>
        )}
      </div>
    </div>
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
      <header className="topbar-shell no-print">
        <div className="topbar">
          <a
            className="brand"
            href={window.location.pathname}
            onClick={(e) => {
              e.preventDefault();
              openConfigurator();
            }}
          >
            <Logo />
            <small>{t("Spielkonfigurator")}</small>
          </a>
          <nav className="primary-nav" aria-label={t("Hauptnavigation")}>
            <button
              aria-current={
                [
                  "app",
                  "project-save",
                  "project-share",
                  "project-workshops",
                ].includes(page)
                  ? "page"
                  : undefined
              }
              onClick={openConfigurator}
            >
              {t("Konfigurator")}
            </button>
            {session && admin && (
              <button
                disabled={busy}
                aria-current={page === "content" ? "page" : undefined}
                onClick={() => setPage("content")}
              >
                {t("Inhalte")}
              </button>
            )}
            {session && admin && (
              <button
                disabled={busy}
                aria-current={
                  ["admin", "admin-project"].includes(page) ? "page" : undefined
                }
                onClick={() => {
                  setAdminTab("projects");
                  act(loadAdmin);
                }}
              >
                {t("Administration")}
              </button>
            )}
            {session && !admin && moderatedWorkshops.length > 0 && (
              <button
                aria-current={
                  ["moderation-home", "moderation"].includes(page)
                    ? "page"
                    : undefined
                }
                onClick={() => setPage("moderation-home")}
              >
                {t("Moderation")}
              </button>
            )}
          </nav>
          <nav className="header-tools" aria-label={t("Werkzeuge")}>
            <HeaderPreferences>
              <div className="preference-section">
                <span>{t("Farbmodus")}</span>
                <AppearanceSwitch value={theme} onChange={setTheme} />
              </div>
              <div className="preference-section">
                <span>{t("Oberfläche")}</span>
                <div
                  className="layout-picker"
                  role="group"
                  aria-label={t("Layout des Konfigurators")}
                >
                  <button
                    type="button"
                    aria-pressed={layout === "modern"}
                    onClick={() => setLayout("modern")}
                  >
                    {t("Neue Ansicht")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={layout === "classic"}
                    onClick={() => setLayout("classic")}
                  >
                    {t("Klassische Ansicht")}
                  </button>
                </div>
              </div>
              {showBackground && (
                <label className="preference-section background-picker">
                  <span>{t("Hintergrund")}</span>
                  <select
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                  >
                    <option value="wave-grid">{t("Wellengitter")}</option>
                    <option value="cosmic-cliffs">Cosmic Cliffs</option>
                  </select>
                </label>
              )}
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
            </HeaderPreferences>
            <button
              className="account-link"
              aria-current={
                page === "account" || (page === "archive" && session)
                  ? "page"
                  : undefined
              }
              disabled={busy}
              onClick={() => {
                setPage("account");
                setMessage("");
                setError("");
              }}
            >
              {session ? t("Konto") : t("Anmelden")}
            </button>
          </nav>
        </div>
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
                "Zu diesem Projekt gibt es bereits einen anderen Stand. Möchten Sie ihn überschreiben oder die Datei als neues Projekt laden?",
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
          <WorkspaceLayout
            heading={
              <ConfiguratorHeading
                step={step}
                projectTitle={projectTitle}
                hasDocument={Boolean(hasWorksheet || (step === 5 && preview))}
              />
            }
            rail={
              <aside
                className="configurator-rail no-print"
                aria-label={t("Projekt und Schritte")}
              >
                <details
                  ref={projectMenu}
                  className="switch-menu project-menu"
                  onToggle={(e) => {
                    if (e.currentTarget.open) {
                      setProjects(listProjects());
                      if (accountId) refreshArchive();
                    }
                  }}
                >
                  <summary data-tour="project-switcher">{t("Projekte")}</summary>
                  <div className="menu-body">
                    <section className="project-current">
                      <strong>{projectTitle}</strong>
                      {savedLocally && (
                        <span className="save-status">
                          {t("Im Browser gespeichert")}
                        </span>
                      )}
                    </section>
                    {cloud && (
                      <>
                        <button
                          data-tour="save-online"
                          disabled={busy}
                          onClick={() => {
                            projectMenu.current.open = false;
                            if (session) {
                              projectMenu.current
                                .querySelector("summary")
                                .focus();
                              act(saveOnline);
                            } else {
                              setError("");
                              setMessage("");
                              setPage("project-save");
                            }
                          }}
                        >
                          {t("Online speichern")}
                        </button>
                        <button disabled={busy} onClick={openProjectShare}>
                          {t("Projekt per Link teilen")}
                        </button>
                      </>
                    )}
                    <hr />
                    {recentProjects.map((project) => {
                      const newer =
                        project.local &&
                        project.online?.revision >
                          (project.id === draft.id
                            ? cloudRevision
                            : project.cloudRevision);
                      return (
                        <button
                          key={project.id}
                          disabled={busy}
                          onClick={() =>
                            act(() =>
                              project.local
                                ? openLocalProject(project.id)
                                : openOnlineProject(project.id),
                            )
                          }
                        >
                          {project.title || t("Unbenanntes Projekt")}
                          {project.importCopy && " · " + t("Importkopie")}
                          {newer && <small>{t("Neuer Online-Stand")}</small>}
                          {!project.local && <small>{t("Online")}</small>}
                        </button>
                      );
                    })}
                    <button
                      disabled={busy}
                      onClick={() => act(() => newConfiguration())}
                    >
                      + {t("Neues Projekt")}
                    </button>
                    <hr />
                    <button disabled={busy} onClick={openArchive}>
                      {t("Projekte verwalten")}
                    </button>
                  </div>
                </details>
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
                      onClick={() => goStep(i + 1)}
                    >
                      <span>{i + 1}</span>
                      {i === 4 && worksheets.length
                        ? `${t("Arbeitsblätter")} (${worksheets.length})`
                        : t(label)}
                    </button>
                  ))}
                </nav>
                <label className="step-jump mobile-step-jump no-print">
                  <span className="sr-only">
                    {t("Direkt zu einem Schritt springen ")}
                  </span>
                  <select
                    value={step}
                    onChange={(e) => goStep(Number(e.target.value))}
                  >
                    {steps.map((label, index) => (
                      <option key={t(label)} value={index + 1}>
                        {index + 1}/{steps.length} · {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
              </aside>
            }
          >
            <div className="workspace no-print" aria-busy={busy}>
              <fieldset disabled={busy} aria-label={t("Spielkonfiguration")}>
                {step === 1 && (
                  <Card>
                    <div className="section-title">
                      <h2>{t("Schritt 1: Organisatorisches")}</h2>
                    </div>
                    <div className="field-grid context-grid">
                      {[
                        [
                          "thema",
                          t("Thema des Seminars (Pflichtfeld)"),
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
                        ["semester", "Semester"],
                        ["datum", t("Datum"), t("z.B. 14.11.2025")],
                      ].map(([key, label, placeholder]) => (
                        <ContextField
                          key={draft.id + ":" + key}
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
                      <label className="context-edition">
                        {t("Inhaltsfassung")}
                        <select
                          value={editionInfo?.id || ""}
                          disabled={editionLocked || !publicEditions.length}
                          aria-describedby={
                            editionLocked ? "edition-workshop-hint" : undefined
                          }
                          onChange={(event) => {
                            const id = event.target.value;
                            if (id) act(() => switchEdition(id));
                          }}
                        >
                          {(editionLocked || !listedEdition) && (
                            <option value={editionInfo?.id || ""} disabled>
                              {editionInfo?.title || t("Gespeicherte Fassung")}
                            </option>
                          )}
                          {!editionLocked &&
                            publicEditions.map((edition) => (
                              <option key={edition.id} value={edition.id}>
                                {edition.title}
                              </option>
                            ))}
                        </select>
                        {editionLocked && (
                          <small className="muted" id="edition-workshop-hint">
                            {t("Diese Fassung ist dem Workshop zugewiesen.")}
                          </small>
                        )}
                      </label>
                    </div>
                  </Card>
                )}
                {step === 2 && (
                  <Card className="learning-step">
                    <div className="section-title">
                      <h2 data-tour="learning">{t("Schritt 2: Lernerlebnisse wählen")}</h2>
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
                        </h3>
                        <div className="option-grid">
                          {LE.filter(
                            (l) => l.group === group && !l.archived,
                          ).map((l) => (
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
                            >
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
                              {l.fuer && <small>{t(l.fuer)}</small>}
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
                      <h2 data-tour="mechanics">{t("Schritt 3: Mechaniken wählen")}</h2>
                      <p>
                        {t(
                          "Wählen Sie zunächst alle Mechaniken aus, die für Ihr Seminar interessant sind. Oben stehen die Mechaniken mit einem primären Beitrag zu Ihren Lernerlebnissen und die Kernelemente. Weitere Mechaniken finden Sie darunter. In der Übersicht legen Sie die endgültige Auswahl fest. ",
                        )}
                      </p>
                      <p>
                        {t(
                          "P = primärer Beitrag, S = unterstützender Beitrag. IMMER kennzeichnet den verbindlichen Safety-Rahmen, KERN die festen Spielmechaniken und BASIS weitere Elemente des Basisspiels.",
                        )}
                      </p>
                      <p>
                        {t(
                          "Falls der Safety-Rahmen für Ihr Fach ungeeignet erscheint, können Sie mit Luca Voges und Harald Eckmüller in einem Workshop Alternativen besprechen.",
                        )}
                      </p>
                      <Button secondary onClick={selectBaseGame}>
                        {t("Basisspiel auswählen")}
                      </Button>
                    </div>
                    <MechanismChoices
                      mechanisms={MK.filter((m) => !m.archived).filter(
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
                          "Hier finden Sie weitere Mechaniken für Ihr Seminar. ",
                        )}
                      </p>
                      <MechanismChoices
                        mechanisms={MK.filter((m) => !m.archived).filter(
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
                    {!selfStudy && !result && !buildingSheet && (
                      <Button data-tour="worksheet-entry" onClick={() => goStep(5)}>
                        {t("Arbeitsblatt öffnen")}
                      </Button>
                    )}
                    {!preview && (buildingSheet || (selfStudy && !result)) && (
                      <Card className="worksheet-builder">
                        {sheetTools}
                        <div className="section-title">
                          <h2 data-tour="worksheet-entry" tabIndex={-1}>
                            {worksheets.length
                              ? t("Weiteres Arbeitsblatt hinzufügen")
                              : t("Wählen Sie Ihren Weg.")}
                          </h2>
                          <p>
                            {t(
                              "Wählen Sie eine Vorlage oder lassen Sie Vorschläge für Ihr Seminarthema ausarbeiten. ",
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
                                "Ihre Auswahl, feste Anleitungen und Platz für eigene Karten.",
                              ),
                            ],
                            [
                              "external",
                              "02",
                              t("Mit Ihrer KI-App"),
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
                                "Verwenden Sie Ihren privaten API-Key aus der Administration.",
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
                                "Ohne Häkchen erhalten Sie die Übersicht Ihrer Auswahl.",
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
                                  {t("Ihr API-Key ")}
                                  <input
                                    type="password"
                                    autoComplete="off"
                                    value={apiKey}
                                    maxLength={1000}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={t("API-Key für diese Sitzung")}
                                  />
                                </label>
                                <ApiKeyHelp provider={provider} />
                                <p className="muted">
                                  {t(
                                    "Der Key wird nur im Arbeitsspeicher gehalten und für den Aufruf verschlüsselt an unser Backend übertragen. Er wird nicht in Entwürfen oder Downloads gespeichert. Der Anbieter rechnet die Nutzung mit Ihrem API-Konto ab. ",
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
                                      "Die Workshop-KI verwendet einen zentralen Zugang. Sie benötigen keinen eigenen API-Key. Nur für freigeschaltete Workshops und innerhalb ihres Limits verfügbar. ",
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
                              <h3>{t("Ihr Auftrag für eine KI Ihrer Wahl")}</h3>
                              <p>
                                {t(
                                  "Der Auftrag enthält Thema, Fach, Mechaniken und ein JSON-Antwortformat. Fügen Sie ihn in Ihrer KI-App ein. ",
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
                                {t("JSON-Antwort Ihrer KI ")}
                                <textarea
                                  rows={6}
                                  value={importText}
                                  onChange={(e) => {
                                    setImportText(e.target.value);
                                    setAnswerError("");
                                  }}
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
                                    act(async () => {
                                      setImportText(await fileText(file));
                                    }, setAnswerError);
                                }}
                              />
                              <Button
                                secondary
                                disabled={busy}
                                aria-describedby={
                                  answerError ? "answer-error" : undefined
                                }
                                onClick={() =>
                                  act(async () => {
                                    setPreview(
                                      parseResult(importText, request),
                                    );
                                    setMessage(
                                      t(
                                        "Antwort geprüft. Kontrollieren Sie die Vorschau und übernehmen Sie sie anschließend.",
                                      ),
                                    );
                                  }, setAnswerError)
                                }
                              >
                                {t("Antwort prüfen ")}
                              </Button>
                              {answerError && (
                                <p
                                  className="notice error answer-error"
                                  id="answer-error"
                                  role="alert"
                                >
                                  {answerError}
                                </p>
                              )}
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
                      onClick={() => goStep(step - 1)}
                    >
                      {t("← Zurück ")}
                    </Button>

                    <div className="step-next">
                      {step === 4 && !selfStudy && (
                        <Button secondary onClick={() => goStep(5, true)}>
                          {t("KI-Optionen")}
                        </Button>
                      )}
                      <Button
                        disabled={step === 2 && !draft.learning.length}
                        onClick={() => goStep(step + 1)}
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
                  </div>
                )}
              </fieldset>
            </div>
            {step === 5 && preview && (
              <Worksheet
                screenLanguage={language}
                screenHeader={
                  <>
                    {sheetTools}
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
                            setAnswerError("");
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
                  </>
                }
                draft={draft}
                result={preview}
                source={{ kind: "import" }}
              />
            )}
            {hasWorksheet && (
              <>
                <Worksheet
                  screenLanguage={language}
                  key={activeWorksheetId + (showingOriginal ? "-original" : "")}
                  screenHeader={
                    <>
                      {sheetTools}
                      {!isCurrent && (
                        <div className="notice error">
                          {t(
                            "Dieses Arbeitsblatt gehört zu einer früheren Konfiguration. Für Ihre aktuelle Auswahl können Sie ein weiteres Arbeitsblatt hinzufügen. ",
                          )}
                        </div>
                      )}
                      {showingOriginal && (
                        <div className="notice original-notice">
                          <strong>
                            {t("Original vor der ersten Bearbeitung")}
                          </strong>
                          <Button secondary onClick={() => setOriginalId(null)}>
                            {t("Zurück zur Bearbeitung")}
                          </Button>
                        </div>
                      )}
                    </>
                  }
                  onCards={canEditWorksheet ? updateWorksheetCards : undefined}
                  onCardType={
                    canEditWorksheet
                      ? (id, value) =>
                          updateWorksheetResult((previous) => {
                            const cardTypes = { ...previous.cardTypes };
                            if (value.trim())
                              cardTypes[cardTypeKey(id)] = value;
                            else delete cardTypes[cardTypeKey(id)];
                            const { cardTypes: _, ...rest } = previous;
                            return Object.keys(cardTypes).length
                              ? { ...rest, cardTypes }
                              : rest;
                          })
                      : undefined
                  }
                  onNotes={
                    canEditWorksheet
                      ? (update) =>
                          updateWorksheetResult((previous) => ({
                            ...previous,
                            notes: update(previous.notes || []),
                          }))
                      : undefined
                  }
                  onReflections={
                    canEditWorksheet
                      ? (update) =>
                          updateWorksheetResult((previous) => ({
                            ...previous,
                            reflections: update(previous.reflections || []),
                          }))
                      : undefined
                  }
                  onAnswer={
                    canEditWorksheet
                      ? (key, value) =>
                          updateWorksheetResult((previous) => ({
                            ...previous,
                            answers: { ...previous.answers, [key]: value },
                          }))
                      : undefined
                  }
                  draft={resultDraft}
                  result={visibleResult}
                  source={source}
                  worksheetId={activeWorksheetId}
                  cardPrint={cardPrint}
                />
                {cardPrintOpen && activeCards.length > 0 && (
                  <CardPrintEditor
                    cards={activeCards}
                    cardType={(card) => worksheetTypeName(card.mechanismId)}
                    worksheetId={activeWorksheetId}
                    settings={cardPrint}
                    onSettings={setCardPrint}
                    onCardGroup={
                      showingOriginal
                        ? undefined
                        : (id, group) =>
                            updateWorksheetCards((cards) =>
                              cards.map((card) =>
                                card.id === id ? { ...card, group } : card,
                              ),
                            )
                    }
                    onClose={() => setCardPrintOpen(false)}
                    t={t}
                    language={language}
                  />
                )}
                {session && isCurrent && !showingOriginal && (
                  <Card className="no-print">
                    <h2>{t("Mit der Workshopmoderation teilen")}</h2>
                    <p>
                      {t(
                        "Mit der Abgabe erhält die Moderation das gewählte Arbeitsblatt samt Kontextangaben, Notizen und Ergebnisblättern. Eine Projektzuordnung zeigt nur Titel und Änderungsdatum.",
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
                    {workshops.some((w) => w.id === workshopId && w.active) &&
                      !workshopLinks.some(
                        (link) => link.workshop_id === workshopId,
                      ) && (
                        <Button
                          secondary
                          disabled={busy}
                          onClick={() =>
                            act(() => changeWorkshopLink(workshopId, true))
                          }
                        >
                          {t("Projekt diesem Workshop zuordnen")}
                        </Button>
                      )}
                    {workshopLinks.map((link) => (
                      <div className="archive-row" key={link.workshop_id}>
                        <span>{link.title}</span>
                        <Button
                          secondary
                          disabled={busy}
                          onClick={() =>
                            act(() =>
                              changeWorkshopLink(link.workshop_id, false),
                            )
                          }
                        >
                          {t("Zuordnung entfernen")}
                        </Button>
                      </div>
                    ))}
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={submissionConsent}
                        onChange={(e) => setSubmissionConsent(e.target.checked)}
                      />
                      {t(
                        "Diesen Stand samt Kontextangaben für die Workshopmoderation freigeben. ",
                      )}
                    </label>
                    <Button
                      disabled={busy || !workshopId || !submissionConsent}
                      onClick={() =>
                        act(async () => {
                          if (!(await saveOnline())) return;
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
            )}
          </WorkspaceLayout>
        )}
        {(page === "account" || (projectAction && !session)) && (
          <Card className={session ? "account-page" : "auth-page"}>
            <h1>
              {projectAction === "save"
                ? t("Online speichern")
                : projectAction === "share"
                  ? t("Projekt per Link teilen")
                  : session
                    ? t("Konto")
                    : t("Anmelden")}
            </h1>
            {projectAction === "save" && (
              <p>
                {t("Melden Sie sich an, um „{0}“ online zu speichern.", {
                  0: projectTitle,
                })}
              </p>
            )}
            {projectAction === "share" && (
              <p>
                {t(
                  "Melden Sie sich an, um einen Freigabelink für „{0}“ zu erstellen.",
                  { 0: projectTitle },
                )}
              </p>
            )}
            {session ? (
              <>
                <p className="account-identity">
                  {t("Angemeldet als ")}
                  {session.user.email}
                </p>
                <div className="actions account-actions">
                  <Button secondary disabled={busy} onClick={openArchive}>
                    {t("Projekte verwalten")}
                  </Button>
                </div>
                {admin && (
                  <details className="account-section settings-disclosure">
                    <summary>
                      {t("Passwort für den Adminzugang setzen oder ändern")}
                    </summary>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const fields = new FormData(form);
                        act(async () => {
                          const nextPassword = fields.get("new-password");
                          if (nextPassword !== fields.get("confirm-password")) {
                            throw new Error(
                              t("Die Passwörter stimmen nicht überein."),
                            );
                          }
                          const { error } = await cloud.auth.updateUser({
                            password: nextPassword,
                          });
                          if (error?.code === "reauthentication_needed") {
                            throw new Error(
                              t(
                                "Melden Sie sich mit einem neuen Magic Link an und versuchen Sie es erneut.",
                              ),
                            );
                          }
                          if (error) throw error;
                          form.reset();
                          setMessage(
                            t(
                              "Passwort gespeichert. Sie können sich jetzt per E-Mail und Passwort anmelden.",
                            ),
                          );
                        });
                      }}
                    >
                      <p className="muted">
                        {t(
                          "Das Passwort gehört zu Ihrem bestehenden Konto. Sie können sich auch weiterhin per Magic Link anmelden.",
                        )}
                      </p>
                      <label>
                        {t("Neues Passwort")}
                        <input
                          name="new-password"
                          type="password"
                          autoComplete="new-password"
                          required
                          disabled={busy}
                        />
                      </label>
                      <label>
                        {t("Passwort wiederholen")}
                        <input
                          name="confirm-password"
                          type="password"
                          autoComplete="new-password"
                          required
                          disabled={busy}
                        />
                      </label>
                      <Button type="submit" disabled={busy}>
                        {t("Passwort speichern")}
                      </Button>
                    </form>
                  </details>
                )}
                {moderatedWorkshops.length > 0 && (
                  <section className="account-section">
                    <h2>{t("Meine moderierten Workshops")}</h2>
                    <div className="actions">
                      {moderatedWorkshops.map((w) => (
                        <Button
                          key={w.id}
                          secondary
                          disabled={busy}
                          onClick={() => act(() => loadModeration(w))}
                        >
                          {w.title}
                        </Button>
                      ))}
                    </div>
                  </section>
                )}
                <ProjectRequests act={act} busy={busy} message={setMessage} />
                <section className="account-section">
                  <h2>{t("Workshops")}</h2>
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
                  {workshopId && (
                    <Button
                      secondary
                      disabled={busy}
                      onClick={() => act(() => newConfiguration(workshopId))}
                    >
                      {t("Neues Projekt mit Workshop-Inhalten starten")}
                    </Button>
                  )}
                </section>
                <section className="account-section">
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
                </section>
                <Button
                  secondary
                  onClick={() =>
                    act(async () => {
                      unwrap(await cloud.auth.signOut());
                      setMessage(
                        t(
                          "Abgemeldet. Ihr lokaler Entwurf bleibt in diesem Browser.",
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
                        "Sie erhalten einen Anmeldelink per E-Mail. Ein Passwort brauchen Sie nicht.",
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
                                location.origin +
                                location.pathname +
                                (projectAction
                                  ? "?view=" +
                                    projectAction +
                                    "&project=" +
                                    draft.id
                                  : ""),
                            },
                          }),
                        );
                        setMessage(
                          t(
                            "Anmeldelink angefordert. Prüfen Sie Ihr E-Mail-Postfach.",
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
                <p className="muted account-privacy">
                  <a href="?view=privacy">
                    {t("Datenschutz bei der Anmeldung")}
                  </a>
                </p>
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
          <section className="project-library">
            <header className="project-library-heading">
              <h1 data-tour="project-archive">{t("Projekte verwalten")}</h1>
              <div className="project-library-actions">
                <button
                  type="button"
                  className="text-button project-create"
                  disabled={busy}
                  onClick={() => act(() => newConfiguration())}
                >
                  <span aria-hidden="true">+</span> {t("Neues Projekt")}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => configImportRef.current?.click()}
                  aria-label={t("Projekt importieren")}
                >
                  {t("Import")}
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => act(exportProject)}
                  aria-label={t("Aktuelles Projekt exportieren")}
                >
                  {t("Export")}
                </button>
              </div>
              {session &&
                (workshops.some((w) => w.active) || workshopLinks.length > 0) && (
                  <div className="project-library-actions">
                    <button
                      className="text-button"
                      data-tour="project-workshop"
                      disabled={busy}
                      onClick={() => setPage("project-workshops")}
                    >
                      {t("Projekt einem Workshop zuordnen")}
                    </button>
                    {workshops
                      .filter((w) => w.id === workshopId && w.active)
                      .map((w) => (
                        <button
                          key={w.id}
                          className="text-button"
                          disabled={busy}
                          onClick={() => act(() => newConfiguration(w.id))}
                        >
                          {t("Neues Projekt für {0}", { 0: w.title })}
                        </button>
                      ))}
                  </div>
                )}
            </header>
            <input
              ref={configImportRef}
              hidden
              type="file"
              accept=".json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) act(() => importProject(file));
              }}
            />
            <div className="panel project-library-list">
              <section
                className="project-library-section"
                aria-labelledby="local-projects-heading"
              >
                <h2 id="local-projects-heading">{t("Auf diesem Gerät")}</h2>
                {projects.map((project) => (
                  <ProjectListRow
                    key={project.id}
                    title={project.title || t("Unbenanntes Projekt")}
                    detail={
                      project.id === draft.id
                        ? t("Aktuelles Projekt")
                        : project.importCopy
                          ? t("Importkopie")
                          : ""
                    }
                    busy={busy}
                    onOpen={() => act(() => openLocalProject(project.id))}
                    onDelete={() => act(() => removeLocalProject(project))}
                  />
                ))}
                {!projects.length && (
                  <p className="muted">{t("Keine Projekte auf diesem Gerät.")}</p>
                )}
              </section>
              {cloud && (
                <section
                  className="project-library-section"
                  aria-labelledby="online-projects-heading"
                >
                  <div className="editor-heading">
                    <h2 id="online-projects-heading">{t("Online-Projekte")}</h2>
                    {accountId && (
                      <button
                        className="text-button"
                        disabled={busy || archiveStatus === "loading"}
                        onClick={refreshArchive}
                      >
                        {t("Aktualisieren")}
                      </button>
                    )}
                  </div>
                  {!accountId && (
                    <button
                      className="text-button"
                      onClick={() => setPage("account")}
                    >
                      {t("Anmelden")}
                    </button>
                  )}
                  {accountId && archiveStatus === "loading" && (
                    <p role="status">{t("Online-Projekte werden geladen …")}</p>
                  )}
                  {accountId && archiveStatus === "error" && (
                    <p role="alert">
                      {t("Online-Projekte konnten nicht geladen werden.")}
                    </p>
                  )}
                  {entries.map((project) => (
                    <ProjectListRow
                      key={project.id}
                      title={project.title || t("Unbenanntes Projekt")}
                      detail={
                        new Date(project.updated_at).toLocaleString(
                          language === "en" ? "en-GB" : "de-AT",
                        ) +
                        t(" · Online-Version ") +
                        project.revision
                      }
                      busy={busy}
                      onOpen={() => act(() => openOnlineProject(project.id))}
                      onDelete={() => act(() => removeOnlineProject(project))}
                    />
                  ))}
                  {accountId && archiveStatus === "ready" && !entries.length && (
                    <p className="muted">
                      {t("Noch keine Online-Entwürfe gespeichert.")}
                    </p>
                  )}
                </section>
              )}
            </div>
          </section>
        )}
        {page === "project-save" && session && (
          <Card className="project-dialog">
            <h1>{t("„{0}“ online speichern", { 0: projectTitle })}</h1>
            <p>{t(onlineAccessNotice)}</p>
            <div className="actions">
              <Button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await saveOnline({ confirmed: true });
                    setPage("app");
                    window.history.replaceState(
                      null,
                      "",
                      window.location.pathname,
                    );
                  })
                }
              >
                {t("Online speichern")}
              </Button>
              <Button secondary onClick={openConfigurator}>
                {t("Abbrechen")}
              </Button>
            </div>
          </Card>
        )}
        {page === "project-share" && session && (
          <Card className="project-dialog">
            <h1>{t("„{0}“ teilen", { 0: projectTitle })}</h1>
            <p>
              {t(
                "Alle mit dem Link können diesen Projektstand samt Arbeitsblättern ohne Anmeldung lesen und als Kopie übernehmen. Spätere Änderungen werden erst sichtbar, wenn Sie einen neuen Link erstellen.",
              )}
            </p>
            {projectShare && (
              <>
                <label>
                  {t("Freigabelink")}
                  <input
                    readOnly
                    value={sharedProjectLink(projectShare.token)}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </label>
                <p className="muted">
                  {t("Stand {0}", { 0: projectShare.shared_revision })}
                </p>
              </>
            )}
            <div className="actions">
              {projectShare && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await navigator.clipboard.writeText(
                        sharedProjectLink(projectShare.token),
                      );
                      setMessage(t("Freigabelink kopiert."));
                    })
                  }
                >
                  {t("Freigabelink kopieren")}
                </Button>
              )}
              {shareStatus === "ready" ? (
                <Button
                  secondary={Boolean(projectShare)}
                  disabled={busy}
                  onClick={() => act(publishProjectShare)}
                >
                  {t(
                    projectShare
                      ? "Link für den aktuellen Stand ersetzen"
                      : "Freigabelink erstellen",
                  )}
                </Button>
              ) : shareStatus === "error" ? (
                <Button
                  secondary
                  onClick={() => {
                    setError("");
                    setShareAttempt((n) => n + 1);
                  }}
                >
                  {t("Erneut versuchen")}
                </Button>
              ) : (
                <span role="status">{t("Projekt wird geladen …")}</span>
              )}
              {projectShare && (
                <Button
                  secondary
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      unwrap(
                        await cloud.rpc("revoke_project_share", {
                          p_project: draft.id,
                        }),
                      );
                      setProjectShare(null);
                      setMessage(t("Freigabelink widerrufen."));
                    })
                  }
                >
                  {t("Freigabelink widerrufen")}
                </Button>
              )}
              <Button secondary onClick={openConfigurator}>
                {t("Zum Konfigurator")}
              </Button>
            </div>
          </Card>
        )}
        {(page === "shared-project" ||
          (page === "admin-project" &&
            admin &&
            sharedProject?.adminAccountId === accountId)) && (
          <>
            <Card className="no-print">
              <h1>{sharedProject?.title || t("Geteiltes Projekt")}</h1>
              {!sharedProject && (
                <p>
                  {t(
                    shareLoaded
                      ? "Dieser Freigabelink ist nicht mehr gültig."
                      : "Projekt wird geladen …",
                  )}
                </p>
              )}
              {sharedProject && (
                <>
                  <p>
                    {t(
                      sharedProject.currentOnlineStand
                        ? "Online-Version {0}"
                        : "Freigegebener Stand {0}",
                      { 0: sharedProject.stand },
                    )}
                  </p>
                  {sharedProject.snapshot.worksheets.length > 0 && (
                    <label>
                      {t("Arbeitsblatt")}
                      <select
                        value={sharedSheetId}
                        onChange={(e) => setSharedSheetId(e.target.value)}
                      >
                        {sharedProject.snapshot.worksheets.map((w, index) => (
                          <option key={w.id} value={w.id}>
                            {index + 1}. {w.result.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {(page === "admin-project" ||
                    !sharedProject.snapshot.worksheets.length) && (
                    <dl className="shared-context">
                      {[
                        ["thema", "Thema"],
                        ["fach", "Fach / Disziplin"],
                        ["name", "Name der Lehrveranstaltung"],
                        ["dozent", "Dozent:in"],
                        ["semester", "Semester"],
                        ["datum", "Datum"],
                      ]
                        .filter(
                          ([key]) => sharedProject.snapshot.draft.context[key],
                        )
                        .map(([key, label]) => (
                          <div key={key}>
                            <dt>{t(label)}</dt>
                            <dd>{sharedProject.snapshot.draft.context[key]}</dd>
                          </div>
                        ))}
                    </dl>
                  )}
                  {page === "admin-project" && (
                    <AdminConfigurationSummary
                      draft={sharedProject.snapshot.draft}
                    />
                  )}
                  <div className="actions">
                    {page === "shared-project" && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            const incoming = {
                              ...sharedProject.snapshot,
                              exchange: readExchange(
                                sharedProject.project.exchange,
                              ),
                            };
                            acceptImport(
                              incoming,
                              await projectFingerprint(incoming),
                              null,
                              true,
                            );
                            openConfigurator();
                          })
                        }
                      >
                        {t("Als eigenes Projekt übernehmen")}
                      </Button>
                    )}
                    <Button
                      secondary
                      onClick={() =>
                        downloadSharedProject(
                          sharedProject.title,
                          sharedProject.project,
                        )
                      }
                    >
                      {t("Projekt herunterladen")}
                    </Button>
                    {activeSharedSheet && (
                      <Button secondary onClick={() => printWorksheet()}>
                        {t("Drucken")}
                      </Button>
                    )}
                    {activeSharedSheet &&
                      worksheetCards(activeSharedSheet.result).length > 0 && (
                        <Button
                          secondary
                          onClick={() => printWorksheet("cards")}
                        >
                          {t("Karten drucken")}
                        </Button>
                      )}
                    {page === "admin-project" && (
                      <Button secondary onClick={() => setPage("admin")}>
                        {t("Zurück zur Projektübersicht")}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </Card>
            {activeSharedSheet && (
              <Worksheet
                draft={activeSharedSheet.draft}
                result={activeSharedSheet.result}
                source={activeSharedSheet.source}
                worksheetId={activeSharedSheet.id}
                cardPrint={sharedProject.snapshot.cardPrint}
              />
            )}
          </>
        )}
        {page === "project-workshops" && session && (
          <Card className="project-dialog">
            <h1>{t("Projekt einem Workshop zuordnen")}</h1>
            <p>
              {t(
                "Die Moderation sieht Titel und Änderungsdatum. Arbeitsblätter können Sie gesondert abgeben.",
              )}
            </p>
            {[
              ...workshopLinks.map((link) => ({
                id: link.workshop_id,
                title: link.title,
                linked: true,
              })),
              ...workshops.filter(
                (w) =>
                  w.active &&
                  !workshopLinks.some((link) => link.workshop_id === w.id),
              ),
            ].map((w) => (
              <div className="archive-row" key={w.id}>
                <span>{w.title}</span>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => act(() => changeWorkshopLink(w.id, !w.linked))}
                >
                  {t(w.linked ? "Zuordnung entfernen" : "Projekt zuordnen")}
                </Button>
              </div>
            ))}
            <Button secondary onClick={openConfigurator}>
              {t("Zum Konfigurator")}
            </Button>
          </Card>
        )}
        {page === "moderation-home" &&
          session &&
          moderatedWorkshops.length > 0 && (
            <Card className="project-dialog">
              <h1>{t("Meine moderierten Workshops")}</h1>
              <div className="actions">
                {moderatedWorkshops.map((workshop) => (
                  <Button
                    key={workshop.id}
                    secondary
                    disabled={busy}
                    onClick={() => act(() => loadModeration(workshop))}
                  >
                    {workshop.title}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        {page === "moderation" && session && moderation && (
          <Card className="account-page">
            <h1>{moderation.workshop.title}</h1>
            {moderation.workshop.active && (
              <WorkshopInvite
                workshop={moderation.workshop}
                act={act}
                message={setMessage}
              />
            )}
            <section className="account-section">
              <h2>{t("Zugeordnete Projekte")}</h2>
              <WorkshopProjectList projects={moderation.projects} />
            </section>
            <section className="account-section">
              <h2>{t("Mitglieder")}</h2>
              <WorkshopRoster
                key={moderation.workshop.id}
                workshop={moderation.workshop}
                act={act}
                busy={busy}
              />
            </section>
            <section className="account-section">
              <h2>{t("Abgaben")}</h2>
              <SubmissionList
                submissions={moderation.submissions}
                workshops={[moderation.workshop]}
                act={act}
                onReview={(id) =>
                  setModeration((current) => ({
                    ...current,
                    submissions: current.submissions.map((s) =>
                      s.id === id ? { ...s, status: "gesichtet" } : s,
                    ),
                  }))
                }
              />
            </section>
          </Card>
        )}
        {page === "content" && session && admin && (
          <ContentLibrary
            key={session.user.id}
            act={act}
            busy={busy}
            message={setMessage}
            dirtyRef={editorDirty}
          />
        )}
        {page === "admin" && admin && (
          <WorkspaceLayout
            className="admin-workspace"
            heading={<h1 className="admin-title">{t("Administration")}</h1>}
            rail={
              <div className="admin-rail">
                <nav
                  className="admin-tabs"
                  aria-label={t("Administrationsbereiche")}
                >
                  {adminSections.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-current={adminTab === id ? "page" : undefined}
                      disabled={busy}
                      onClick={() => act(() => openAdminSection(id))}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
                <label className="admin-section-picker">
                  {t("Administrationsbereiche")}
                  <select
                    value={adminTab}
                    disabled={busy}
                    onChange={(e) => {
                      const section = e.target.value;
                      act(() => openAdminSection(section));
                    }}
                  >
                    {adminSections.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            }
          >
            {adminTab === "projects" && (
              <Card>
                <AdminProjectList
                  act={act}
                  busy={busy}
                  openProject={openAdminProject}
                  superadmin={superadmin}
                  workshops={adminWorkshops}
                />
              </Card>
            )}
            {adminTab === "members" && (
              <Members
                act={act}
                busy={busy}
                superadmin={superadmin}
                workshops={adminWorkshops}
              />
            )}
            {adminTab === "settings" && (
              <Card>
                <h2>{t("KI-Einstellungen")}</h2>
                <p>
                  {t(
                    "Diese Einstellungen gelten für neue KI-Aufträge. Eigene Spielkarten werden im Arbeitsblatt hinzugefügt.",
                  )}
                </p>
                <div className="field-grid">
                  {[
                    [
                      "cardsPerMechanism",
                      t("KI-Kartenvorschläge je Mechanik"),
                      5,
                    ],
                    ["hourlyLimit", t("KI-Aufrufe je Person / Stunde"), 30],
                  ].map(([k, label, max]) => (
                    <label key={k}>
                      {t(label)}
                      <input
                        type="number"
                        min="1"
                        max={max}
                        value={settingsDraft[k]}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
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
                        value={settingsDraft.models[id]}
                        maxLength={100}
                        placeholder={t("Leer = Anbieter deaktiviert")}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
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
                      const s = settingsOf(settingsDraft);
                      unwrap(
                        await cloud
                          .from("app_settings")
                          .update({ value: s })
                          .eq("id", true),
                      );
                      setSettings(s);
                      setSettingsDraft(s);
                      setMessage(t("Einstellungen veröffentlicht."));
                    })
                  }
                >
                  {t("Einstellungen veröffentlichen ")}
                </Button>
              </Card>
            )}
            {adminTab === "credentials" && (
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
                <ApiKeyHelp provider={centralProvider} />
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
            )}
            {adminTab === "workshops" && (
              <Card>
                <h2>{t("Workshops")}</h2>
                <p className="muted">
                  {t(
                    "Teilen Sie den Einladungslink oder QR-Code. Nach dem Beitritt können Teilnehmende ein Projekt zuordnen und Arbeitsblätter abgeben.",
                  )}
                </p>
                <form
                  className="workshop-form"
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
                  <Button type="submit" disabled={busy} data-tour="admin-workshops">
                    {t("Workshop anlegen ")}
                  </Button>
                </form>
                {adminWorkshops.map((w) => (
                  <div className="workshop-admin" key={w.id}>
                    <h3>{w.title}</h3>
                    <label className="member-scope">
                      {t("Inhaltsfassung für neue Projekte")}
                      <select
                        value={w.edition_id || ""}
                        disabled={busy}
                        onChange={(e) => {
                          const edition_id = e.target.value || null;
                          act(async () => {
                            const saved = unwrap(
                              await cloud
                                .from("workshops")
                                .update({ edition_id })
                                .eq("id", w.id)
                                .select("edition_id")
                                .single(),
                            );
                            setAdminWorkshops((previous) =>
                              previous.map((row) =>
                                row.id === w.id ? { ...row, ...saved } : row,
                              ),
                            );
                            setMessage(t("Inhaltsfassung zugewiesen."));
                          });
                        }}
                      >
                        <option value="">
                          {t("Aktuellen Standard verwenden")}
                        </option>
                        {editionOptions.map((ed) => (
                          <option key={ed.id} value={ed.id}>
                            {ed.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {w.active && (
                      <WorkshopInvite
                        workshop={w}
                        act={act}
                        message={setMessage}
                      />
                    )}
                    <details className="settings-disclosure">
                      <summary>{t("Workshop-Einstellungen")}</summary>
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
                              setMessage(
                                t("Sie sind dem Workshop beigetreten."),
                              );
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
                      <label className="member-scope">
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
                    </details>
                    <WorkshopManagement workshop={w} act={act} busy={busy} />
                  </div>
                ))}
              </Card>
            )}
            {adminTab === "submissions" && (
              <Card>
                <h2 data-tour="admin-submissions">{t("Abgaben an die Moderation")}</h2>
                <p>
                  {t(
                    "Hier erscheinen ausdrücklich eingereichte Arbeitsblätter. Online-Projekte finden Sie unter „Projekte“. ",
                  )}
                </p>
                <SubmissionList
                  submissions={submissions}
                  workshops={adminWorkshops}
                  act={act}
                  onReview={(id) =>
                    setSubmissions((rows) =>
                      rows.map((s) =>
                        s.id === id ? { ...s, status: "gesichtet" } : s,
                      ),
                    )
                  }
                />
              </Card>
            )}
          </WorkspaceLayout>
        )}
        {page === "about" && (
          <Card className="info-page">
            <div className="eyebrow about-kicker">
              {t("Spielerisch Lehre gestalten. Lehre spielerisch gestalten. ")}
            </div>
            <h1>{t("Über den Spielkonfigurator")}</h1>
            <h2>{t("Vom Lernziel zum Spiel")}</h2>
            <p>
              {t(
                "Mit dem Spielkonfigurator passen Sie 7’rizons für Ihr Hochschulseminar an. Aus Ihrem Thema, den gewünschten Lernerlebnissen und den Spielmechaniken entsteht ein ausfüllbares Arbeitsblatt. In der separaten Variante können Sie zusätzlich KI-Vorschläge anfordern. ",
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
            <Button secondary onClick={openConfigurator}>
              {t("Zum Spielkonfigurator → ")}
            </Button>
          </Card>
        )}
        {Object.hasOwn(INFO_PAGES, page) && (
          <InfoPage page={page} online={Boolean(cloud)} />
        )}
      </main>
      {page === "app" && offerTour && !tour && (
        <TourInvitation
          onStart={startTour}
          onDismiss={dismissTourInvitation}
          disabled={busy}
        />
      )}
      {worksheetExport !== null && (
        <WorksheetExport
          text={worksheetExport}
          onClose={() => setWorksheetExport(null)}
        />
      )}
      {tour && (!tour.admin || (admin && page === "admin")) && (
        <GuidedTour
          steps={tour.admin ? adminTour : projectTourSteps}
          index={tour.index}
          onChange={showTourStep}
          onClose={closeTour}
          returnFocus={tour.trigger}
        />
      )}
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
          {["app", "archive", "admin"].includes(page) && (
            <TourButton onClick={startTour} disabled={busy} />
          )}
          <a
            href={`mailto:info@lmbreuer.de?subject=${encodeURIComponent("7’rizons · Feedback" + (page === "app" ? " · " + t(steps[step - 1]) : ""))}`}
          >
            {t("Feedback per E-Mail")}
          </a>
          <a href="?view=about">{t("Über das Tool ")}</a>
          {Object.entries(INFO_PAGES).map(([view, label]) => (
            <a key={view} href={`?view=${view}`}>
              {t(label)}
            </a>
          ))}
        </div>
        {showBackground && background === "cosmic-cliffs" && (
          <p className="background-credit">
            <a href="https://esawebb.org/images/weic2205a/">Cosmic Cliffs</a>
            {" · NASA, ESA, CSA, and STScI · "}
            <a href="https://creativecommons.org/licenses/by/4.0/">
              CC BY 4.0
            </a>
            {" · "}
            {t("Ausschnitt und Farben angepasst")}
          </p>
        )}
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
  const { LE } = catalogFor(draft);
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
              aria-disabled={
                (m.kern && draft.mechanisms.includes(m.id)) || undefined
              }
            >
              <span className="check" aria-hidden="true" />
              <span>
                <strong id={`mechanism-${m.id}-label`}>{t(m.label)}</strong>
                <span className="badges" id={`mechanism-${m.id}-relevance`}>
                  {m.pflicht && <small>{t("IMMER")}</small>}
                  {m.kern && <small>{t("KERN")}</small>}
                  {m.basis && !m.pflicht && <small>{t("BASIS")}</small>}
                  {draft.learning
                    .filter((id) => ["P", "S"].includes(m.w[id]))
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
          placeholder={t("Code von Ihrer Moderation")}
        />
      </label>
      <Button secondary disabled={!session || !code.trim()} onClick={join}>
        {t("Workshop beitreten ")}
      </Button>
    </div>
  );
}

function SubmissionList({ submissions, workshops, act, onReview }) {
  return (
    <>
      {submissions.map((s) => (
        <div className="archive-row" key={s.id}>
          <span>
            <strong>{s.title}</strong>
            <small>
              {workshops.find((w) => w.id === s.workshop_id)?.title} ·{" "}
              {new Date(s.created_at).toLocaleString(
                getLanguage() === "en" ? "en-GB" : "de-AT",
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
            onClick={() =>
              act(() => {
                const x = readSnapshot(s.payload);
                download(
                  markdown(x.draft, x.result),
                  "7rizons-abgabe.md",
                  "text/markdown",
                );
              })
            }
          >
            {t("Markdown ")}
          </Button>
          <Button
            secondary
            onClick={() =>
              act(async () => {
                unwrap(await cloud.rpc("review_submission", { p_id: s.id }));
                onReview(s.id);
              })
            }
          >
            {t("Gesichtet ")}
          </Button>
        </div>
      ))}
      {!submissions.length && <p>{t("Noch keine Abgaben.")}</p>}
    </>
  );
}
