import React, { useEffect, useState } from "react";
import { cloud, unwrap, callFunction } from "./cloud.js";
import {
  LE,
  MK,
  PROVIDERS,
  DEFAULT_SETTINGS,
  newDraft,
  validateDraft,
  settingsOf,
  conflicts,
  requestFor,
  makePrompt,
  parseResult,
  templateResult,
  markdown,
  readSnapshot,
} from "../supabase/functions/_shared/domain.js";
import Worksheet from "./Worksheet.jsx";
const STORAGE = "7rizons:draft:v1";
const steps = [
  "Kontext",
  "Lerntätigkeiten",
  "Mechaniken",
  "Prioritäten",
  "Arbeitsblatt",
];
function stored() {
  try {
    const x = JSON.parse(localStorage.getItem(STORAGE));
    if (x) {
      validateDraft(x.draft, { maxInhalt: 4, maxWiss: 5 });
      return x;
    }
  } catch {}
  return {
    draft: newDraft(),
    result: null,
    request: null,
    source: null,
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
  if (file.size > 200000) throw new Error("Datei zu groß (max. 200 KB).");
  return file.text();
};
function Button({ children, secondary = false, ...props }) {
  return (
    <button className={secondary ? "button secondary" : "button"} {...props}>
      {children}
    </button>
  );
}
function Card({ children, className = "" }) {
  return <section className={"panel " + className}>{children}</section>;
}
function Gem() {
  return (
    <svg className="gem" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M32 3 56 16 61 40 44 60 19 60 3 40 8 16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M8 16 24 22 32 3 40 22 56 16 47 37 61 40 38 43 44 60 32 48 19 60 25 42 3 40 17 35Z"
        fill="#7f598b"
      />
      <path d="M24 22 40 22 47 37 38 43 25 42 17 35Z" fill="#1cb291" />
      <path d="M32 3 56 16 40 22Z" fill="#2a6fb4" />
      <path d="M38 43 61 40 44 60Z" fill="#61bde4" />
      <path d="M3 40 25 42 19 60Z" fill="#c84b50" />
    </svg>
  );
}
export default function App() {
  const [saved] = useState(stored);
  const [draft, setDraft] = useState(saved.draft);
  const [result, setResult] = useState(saved.result);
  const [request, setRequest] = useState(saved.request);
  const [source, setSource] = useState(saved.source);
  const [resultSettings, setResultSettings] = useState(
    saved.resultSettings || DEFAULT_SETTINGS,
  );
  const [cloudRevision, setCloudRevision] = useState(saved.cloudRevision || 0);
  const [step, setStep] = useState(1);
  const [page, setPage] = useState("app");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return (
        localStorage.getItem("7rizons:theme") ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      );
    } catch {
      return "light";
    }
  });
  const [mode, setMode] = useState("template");
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [importText, setImportText] = useState("");
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
  const [submissionConsent, setSubmissionConsent] = useState(false);
  const isCurrent = result?.configurationRevision === draft.revision;
  const payload = () => ({
    draft,
    result: isCurrent ? result : null,
    request: request?.configurationRevision === draft.revision ? request : null,
    source: isCurrent ? source : null,
    resultSettings,
  });
  async function act(fn) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e.message || "Etwas hat nicht funktioniert.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("7rizons:theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ ...payload(), cloudRevision }),
      );
    } catch {
      setError(
        "Der Browser kann den Entwurf nicht sichern. Bitte als JSON herunterladen.",
      );
    }
  }, [draft, result, request, source, resultSettings, cloudRevision]);
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
              "Online-Einstellungen konnten nicht geladen werden. Lokales Arbeiten bleibt möglich.",
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
    setDraft((d) => ({ ...updater(d), revision: d.revision + 1 }));
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
      mechanisms: d.mechanisms.includes(id)
        ? d.mechanisms.filter((x) => x !== id)
        : [...d.mechanisms, id],
    }));
  }
  function move(id, delta) {
    change((d) => {
      const a = [...d.mechanisms];
      const i = a.indexOf(id),
        j = i + delta;
      if (j < 0 || j >= a.length) return d;
      [a[i], a[j]] = [a[j], a[i]];
      return { ...d, mechanisms: a };
    });
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
    setMessage("Du bist dem Workshop beigetreten.");
  }
  async function saveOnline() {
    if (!session) throw new Error("Bitte zuerst anmelden.");
    const rev = unwrap(
      await cloud.rpc("save_configuration", {
        p_id: draft.id,
        p_revision: cloudRevision,
        p_title: draft.context.thema || draft.context.name || "Seminar-Hack",
        p_payload: payload(),
      }),
    );
    setCloudRevision(rev);
    setMessage("Entwurf und Arbeitsblatt sind privat online gespeichert.");
    return rev;
  }
  async function generate() {
    if (mode === "template") {
      const r = templateResult(draft, settings);
      setResult(r);
      setSource({ kind: "template" });
      setResultSettings(settings);
      setMessage("Dein Arbeitsblatt ist fertig – ohne KI erstellt.");
      return;
    }
    if (mode === "external") {
      const r = requestFor(draft, settings);
      setResult(null);
      setSource(null);
      setRequest(r);
      setResultSettings(settings);
      setPreview(null);
      setMessage(
        "Dein KI-Auftrag ist vorbereitet. Kopiere ihn oder lade ihn herunter.",
      );
      return;
    }
    if (!session) throw new Error("Für direkte KI-Nutzung bitte anmelden.");
    if (mode === "personal" && !apiKey.trim())
      throw new Error("Trage deinen eigenen API-Key ein.");
    if (mode === "workshop" && !workshopId)
      throw new Error("Tritt zuerst mit deinem Code einem Workshop bei.");
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
      throw new Error("Die Antwort gehört zu einem anderen Entwurfsstand.");
    setResult(data.result);
    setSource(data.source);
    setRequest(data.request);
    setResultSettings(settings);
    setMessage(
      "Dein KI-Arbeitsblatt ist fertig. Bitte prüfe die fachlichen Beispiele.",
    );
  }
  function applySnapshot(x, revision = 0) {
    x = readSnapshot(x);
    setDraft(x.draft);
    setResult(x.result || null);
    setRequest(x.request || null);
    setSource(x.source || null);
    setResultSettings(settingsOf(x.resultSettings));
    setCloudRevision(revision);
    setStep(x.result ? 5 : 1);
    setPage("app");
    setPreview(null);
  }
  function newConfiguration() {
    if (
      !window.confirm(
        "Neuen Entwurf beginnen? Lade deinen aktuellen Stand vorher herunter oder speichere ihn online.",
      )
    )
      return;
    setDraft(newDraft());
    setResult(null);
    setRequest(null);
    setSource(null);
    setCloudRevision(0);
    setApiKey("");
    setStep(1);
    setPage("app");
    setPreview(null);
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
      {!cloud && (
        <div className="notice">
          Lokaler Prototyp: Konfiguration, Arbeitsblatt und KI-Export
          funktionieren. Login, direkte KI und Online-Speichern werden nach
          Einrichtung des Backends verfügbar.
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
    </>
  );
  return (
    <>
      <header className="topbar no-print">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("app");
          }}
        >
          <Gem />
          <span>
            7’rizons<small>Spielkonfigurator</small>
          </span>
        </a>
        <nav aria-label="Werkzeuge">
          <button
            onClick={() => {
              setPage("about");
              window.scrollTo(0, 0);
            }}
          >
            Über das Tool
          </button>
          <button
            className="icon-button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={
              theme === "dark"
                ? "Lightmode einschalten"
                : "Darkmode einschalten"
            }
          >
            {theme === "dark" ? "☀ Hell" : "☾ Dunkel"}
          </button>
          {session && (
            <button onClick={() => act(loadArchive)}>Meine Entwürfe</button>
          )}
          {admin && (
            <button onClick={() => act(loadAdmin)}>Administration</button>
          )}
          <button onClick={() => setPage("account")}>
            {session ? "Mein Zugang" : "Anmelden"}
          </button>
        </nav>
      </header>
      <main>
        <div className="no-print">{notices}</div>
        {page === "app" && (
          <>
            <section className="hero no-print">
              <div className="eyebrow">Von der Spielidee zum Seminar</div>
              <h1>
                Dein Thema.
                <br />
                <span>Deine Spielwelt.</span>
              </h1>
              <p>
                Gestalte 7’rizons für deine Lehre. Wähle, was Lernen in Bewegung
                bringt – und nimm einen spielbaren Plan mit.
              </p>
            </section>
            <nav className="steps no-print" aria-label="Konfigurationsschritte">
              {steps.map((label, i) => (
                <button
                  key={label}
                  disabled={busy}
                  className={step === i + 1 ? "active" : ""}
                  aria-current={step === i + 1 ? "step" : undefined}
                  onClick={() => setStep(i + 1)}
                >
                  <span>{i + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
            <div className="workspace no-print" aria-busy={busy}>
              <fieldset disabled={busy}>
                {step === 1 && (
                  <Card>
                    <div className="section-title">
                      <span className="eyebrow">01 · Kontext</span>
                      <h2>Worum soll es gehen?</h2>
                      <p>
                        Das Thema gibt deinem Hack eine Richtung. Die übrigen
                        Angaben sind optional und bleiben beim KI-Auftrag außen
                        vor; nur Thema und Fach werden dafür verwendet.
                      </p>
                    </div>
                    <div className="field-grid">
                      {[
                        [
                          "thema",
                          "Thema des Seminars",
                          "z. B. Klimagerechtigkeit",
                        ],
                        [
                          "fach",
                          "Fach / Disziplin",
                          "z. B. Politikwissenschaft",
                        ],
                        [
                          "name",
                          "Lehrveranstaltung",
                          "Name deiner Veranstaltung",
                        ],
                        ["dozent", "Dozent:in", "Optional"],
                        ["semester", "Semester", "z. B. WS 2026/27"],
                        ["datum", "Datum", "z. B. 20.11.2026"],
                      ].map(([key, label, placeholder]) => (
                        <label
                          key={key}
                          className={key === "thema" ? "wide" : ""}
                        >
                          {label}
                          <input
                            maxLength={1500}
                            value={draft.context[key] || ""}
                            placeholder={placeholder}
                            onChange={(e) =>
                              change((d) => ({
                                ...d,
                                context: {
                                  ...d.context,
                                  [key]: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </Card>
                )}
                {step === 2 && (
                  <Card>
                    <div className="section-title">
                      <span className="eyebrow">02 · Lerntätigkeiten</span>
                      <h2>Was sollen Spielende tun?</h2>
                      <p>
                        Wähle bis zu {settings.maxInhalt} inhaltliche und{" "}
                        {settings.maxWiss} wissenschaftliche Lerntätigkeiten.
                      </p>
                    </div>
                    {["inhalt", "wiss"].map((group) => (
                      <section
                        className={"learning-group " + group}
                        key={group}
                      >
                        <h3>
                          {group === "inhalt"
                            ? "Inhaltlich eintauchen"
                            : "Wissenschaftlich weiterdenken"}{" "}
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
                              <span className="option-icon">{l.icon}</span>
                              <strong>{l.label}</strong>
                              <span>{l.desc}</span>
                              <small>{l.bloom}</small>
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
                      <span className="eyebrow">03 · Mechaniken</span>
                      <h2>Womit wird dein Thema spielbar?</h2>
                      <p>
                        Wähle zunächst großzügig. Im nächsten Schritt setzt du
                        Prioritäten. P = trägt, S = unterstützt, ~ = erzeugt
                        Reibung.
                      </p>
                    </div>
                    {[...new Set(MK.map((m) => m.kat))].map((cat) => (
                      <details open key={cat}>
                        <summary>{cat}</summary>
                        <div className="mechanism-list">
                          {MK.filter((m) => m.kat === cat).map((m) => (
                            <button
                              className={
                                "mechanism " +
                                (draft.mechanisms.includes(m.id)
                                  ? "selected"
                                  : "")
                              }
                              key={m.id}
                              onClick={() => toggleMechanism(m.id)}
                              aria-pressed={draft.mechanisms.includes(m.id)}
                            >
                              <span className="check">
                                {draft.mechanisms.includes(m.id) ? "✓" : "+"}
                              </span>
                              <span>
                                <strong>{m.label}</strong>
                                <span className="badges">
                                  {m.pflicht && <small>Immer dabei</small>}
                                  {m.kern && <small>Kern</small>}
                                  {m.basis && <small>Basisspiel</small>}
                                  {draft.learning
                                    .filter((id) => m.w[id])
                                    .map((id) => (
                                      <small
                                        className={
                                          m.w[id] === "~"
                                            ? "friction"
                                            : "relevance"
                                        }
                                        key={id}
                                      >
                                        {m.w[id]} ·{" "}
                                        {LE.find((l) => l.id === id).label}
                                      </small>
                                    ))}
                                </span>
                                <span className="description">{m.desc}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </details>
                    ))}
                  </Card>
                )}
                {step === 4 && (
                  <Card>
                    <div className="section-title">
                      <span className="eyebrow">04 · Prioritäten</span>
                      <h2>So viel wie nötig.</h2>
                      <p>
                        Reduziere auf das Wesentliche und ordne deine
                        Mechaniken. Die Reihenfolge bestimmt dein Arbeitsblatt.
                      </p>
                    </div>
                    {conflicts(draft).map((c, i) => (
                      <div className="notice error" key={i}>
                        {c}
                      </div>
                    ))}
                    <ol className="priority-list">
                      {draft.mechanisms.map((id, i) => {
                        const m = MK.find((x) => x.id === id);
                        return (
                          <li key={id}>
                            <span className="number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div>
                              <strong>{m.label}</strong>
                              <small>
                                {m.basis ? "Basisspiel" : "Anpassung"} · {m.kat}
                              </small>
                            </div>
                            <div className="rank-buttons">
                              <button
                                disabled={!i}
                                aria-label={`${m.label} nach oben`}
                                onClick={() => move(id, -1)}
                              >
                                ↑
                              </button>
                              <button
                                disabled={i === draft.mechanisms.length - 1}
                                aria-label={`${m.label} nach unten`}
                                onClick={() => move(id, 1)}
                              >
                                ↓
                              </button>
                              {!m.pflicht && (
                                <button
                                  aria-label={`${m.label} entfernen`}
                                  onClick={() => toggleMechanism(id)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </Card>
                )}
                {step === 5 && (
                  <Card>
                    <div className="section-title">
                      <span className="eyebrow">05 · Arbeitsblatt</span>
                      <h2>Wähle deinen Weg.</h2>
                      <p>
                        Alle Wege führen zum gleichen übersichtlichen
                        Arbeitsblatt. Du entscheidest, ob und wie KI
                        mitarbeitet.
                      </p>
                    </div>
                    <div className="mode-grid">
                      {[
                        [
                          "template",
                          "01",
                          "Ohne KI",
                          "Deine Auswahl, feste Anleitungen und Platz für eigene Karten.",
                        ],
                        [
                          "external",
                          "02",
                          "Mit deiner KI-App",
                          "Auftrag mitnehmen, JSON-Antwort hier wieder einfügen.",
                        ],
                        [
                          "personal",
                          "03",
                          "Mit eigenem API-Zugang",
                          "OpenAI, Claude oder Gemini direkt verwenden.",
                        ],
                        [
                          "workshop",
                          "04",
                          "Mit Workshop-KI",
                          "Der Workshop stellt den Zugang bereit.",
                        ],
                      ].map(([id, n, title, text]) => (
                        <button
                          className={"mode " + (mode === id ? "selected" : "")}
                          key={id}
                          aria-pressed={mode === id}
                          onClick={() => {
                            setMode(id);
                            setApiKey("");
                          }}
                        >
                          <small>{n}</small>
                          <strong>{title}</strong>
                          <span>{text}</span>
                        </button>
                      ))}
                    </div>
                    {(mode === "personal" || mode === "workshop") && (
                      <div className="connection">
                        <label>
                          KI-Anbieter
                          <select
                            value={provider}
                            onChange={(e) => {
                              setProvider(e.target.value);
                              setApiKey("");
                            }}
                          >
                            {Object.entries(PROVIDERS).map(([id, label]) => (
                              <option value={id} key={id}>
                                {label}
                                {settings.models[id]
                                  ? ""
                                  : " · noch nicht eingerichtet"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="muted">
                          {settings.models[provider]
                            ? `Modell: ${settings.models[provider]}`
                            : "Die Administration muss zunächst ein Modell für diesen Anbieter freischalten."}
                        </p>
                        {mode === "personal" ? (
                          <>
                            <label>
                              Dein API-Key
                              <input
                                type="password"
                                autoComplete="off"
                                value={apiKey}
                                maxLength={1000}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="API-Key für diese Sitzung"
                              />
                            </label>
                            <p className="muted">
                              Der Key wird nur im Arbeitsspeicher gehalten und
                              für den Aufruf verschlüsselt an unser Backend
                              übertragen. Er wird nicht in Entwürfen oder
                              Downloads gespeichert. Der Anbieter rechnet die
                              Nutzung mit deinem API-Konto ab.
                            </p>
                          </>
                        ) : (
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
                              Die Workshop-KI verwendet einen zentralen Zugang.
                              Du benötigst keinen eigenen API-Key. Nur für
                              freigeschaltete Workshops und innerhalb ihres
                              Limits verfügbar.
                            </p>
                          </>
                        )}
                        {!session && (
                          <Button secondary onClick={() => setPage("account")}>
                            Für direkte KI anmelden
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="actions">
                      <Button
                        onClick={() => act(generate)}
                        disabled={
                          busy ||
                          (["personal", "workshop"].includes(mode) &&
                            (!cloud || !session || !settings.models[provider]))
                        }
                      >
                        {busy
                          ? "Wird erstellt …"
                          : mode === "external"
                            ? "KI-Auftrag vorbereiten"
                            : isCurrent
                              ? "Arbeitsblatt neu erstellen"
                              : "Arbeitsblatt erstellen"}
                      </Button>
                    </div>
                    {mode === "external" &&
                      request &&
                      request.configurationId === draft.id &&
                      request.configurationRevision === draft.revision && (
                        <div className="external-flow">
                          <h3>Dein Auftrag für eine KI deiner Wahl</h3>
                          <p>
                            Er enthält Thema und Fach, Mechaniken und ein festes
                            JSON-Antwortformat. Füge ihn selbst bei deiner KI
                            ein. Andere Kontextangaben werden nicht mitgegeben.
                          </p>
                          <textarea
                            readOnly
                            rows={6}
                            value={makePrompt(request)}
                            aria-label="KI-Arbeitsauftrag"
                          />
                          <div className="actions">
                            <Button
                              secondary
                              onClick={() =>
                                act(async () => {
                                  await navigator.clipboard.writeText(
                                    makePrompt(request),
                                  );
                                  setMessage("Auftrag kopiert.");
                                })
                              }
                            >
                              Auftrag kopieren
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
                              Auftrag herunterladen
                            </Button>
                          </div>
                          <label>
                            JSON-Antwort deiner KI
                            <textarea
                              rows={6}
                              value={importText}
                              onChange={(e) => setImportText(e.target.value)}
                              placeholder="JSON-Antwort hier einfügen"
                            />
                          </label>
                          <label className="file-button">
                            Oder JSON-Datei wählen
                            <input
                              type="file"
                              accept=".json,application/json,text/plain"
                              onChange={(e) =>
                                act(async () =>
                                  setImportText(
                                    await fileText(e.target.files[0]),
                                  ),
                                )
                              }
                            />
                          </label>
                          <Button
                            secondary
                            onClick={() =>
                              act(async () => {
                                setPreview(parseResult(importText, request));
                                setMessage(
                                  "Antwort geprüft. Kontrolliere die Vorschau und übernimm sie anschließend.",
                                );
                              })
                            }
                          >
                            Antwort prüfen
                          </Button>
                        </div>
                      )}
                  </Card>
                )}
                <div className="step-actions">
                  <Button
                    secondary
                    disabled={step === 1}
                    onClick={() => setStep((s) => s - 1)}
                  >
                    ← Zurück
                  </Button>
                  <span>{step} / 5</span>
                  <Button
                    disabled={
                      step === 5 || (step === 2 && !draft.learning.length)
                    }
                    onClick={() => setStep((s) => s + 1)}
                  >
                    Weiter →
                  </Button>
                </div>
                <div className="save-bar">
                  <span className="muted">
                    Im Browser automatisch gesichert
                  </span>
                  <Button
                    secondary
                    onClick={() =>
                      download(
                        JSON.stringify(payload(), null, 2),
                        "7rizons-konfiguration.json",
                        "application/json",
                      )
                    }
                  >
                    JSON sichern
                  </Button>
                  <label className="file-button">
                    JSON laden
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) =>
                        act(async () => {
                          const x = JSON.parse(
                            await fileText(e.target.files[0]),
                          );
                          x.draft = { ...x.draft, id: crypto.randomUUID() };
                          if (x.request)
                            x.request = {
                              ...x.request,
                              configurationId: x.draft.id,
                            };
                          applySnapshot(x);
                          setMessage("Datei als neuer Entwurf geladen.");
                        })
                      }
                    />
                  </label>
                  {session ? (
                    <Button onClick={() => act(saveOnline)}>
                      Online speichern
                    </Button>
                  ) : (
                    <Button secondary onClick={() => setPage("account")}>
                      Für Online-Speichern anmelden
                    </Button>
                  )}
                  <button className="text-button" onClick={newConfiguration}>
                    Neuer Entwurf
                  </button>
                </div>
              </fieldset>
            </div>
            {step === 5 && preview && (
              <>
                <div className="no-print">
                  <h2>Importvorschau</h2>
                  <div className="actions">
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setResult(preview);
                        setSource({ kind: "import" });
                        setResultSettings({
                          ...settings,
                          cardsPerMechanism: request.cardsPerMechanism,
                        });
                        setPreview(null);
                        setImportText("");
                        setMessage("KI-Antwort übernommen.");
                      }}
                    >
                      Vorschau übernehmen
                    </Button>
                    <Button secondary onClick={() => setPreview(null)}>
                      Verwerfen
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
            {step === 5 && result && !preview && (
              <>
                {!isCurrent && (
                  <div className="notice error no-print">
                    Dieses Arbeitsblatt gehört zu einer älteren Auswahl.
                    Erstelle es neu, bevor du es exportierst oder abgibst.
                  </div>
                )}
                {isCurrent && (
                  <>
                    <div className="actions no-print">
                      <Button
                        secondary
                        onClick={() =>
                          download(
                            markdown(draft, result, resultSettings),
                            "7rizons-arbeitsblatt.md",
                            "text/markdown",
                          )
                        }
                      >
                        Markdown herunterladen
                      </Button>
                      <Button secondary onClick={() => window.print()}>
                        Arbeitsblatt drucken
                      </Button>
                    </div>
                    <Worksheet
                      draft={draft}
                      result={result}
                      settings={resultSettings}
                      source={source}
                    />
                    {session && (
                      <Card className="no-print">
                        <h2>Mit der Workshopmoderation teilen</h2>
                        <p>
                          Dein Entwurf ist privat. Erst mit der Abgabe erhält
                          die Moderation eine Kopie dieses Stands samt
                          Kontextangaben.
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
                          Diesen Stand samt Kontextangaben für die
                          Workshopmoderation freigeben.
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
                                "Dieser Stand wurde an die Workshopmoderation abgegeben.",
                              );
                            })
                          }
                        >
                          Arbeitsblatt abgeben
                        </Button>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        {page === "account" && (
          <Card>
            <span className="eyebrow">Dein Zugang</span>
            <h1>
              {session
                ? "Schön, dass du da bist."
                : "Ideen behalten. Später weitermachen."}
            </h1>
            {session ? (
              <>
                <p>Angemeldet als {session.user.email}</p>
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
                <h2>Meine Abgaben</h2>
                {mySubmissions.length ? (
                  mySubmissions.map((s) => (
                    <div className="archive-row" key={s.id}>
                      <span>
                        {s.title}
                        <small>
                          {new Date(s.created_at).toLocaleString("de-AT")}
                        </small>
                      </span>
                      <Button
                        secondary
                        onClick={() =>
                          act(async () => {
                            if (
                              !confirm(
                                "Abgabe zurückziehen? Bereits heruntergeladene Kopien können nicht zurückgerufen werden.",
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
                            setMessage("Abgabe zurückgezogen.");
                          })
                        }
                      >
                        Zurückziehen
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="muted">Noch keine Abgaben.</p>
                )}
                <Button
                  secondary
                  onClick={() =>
                    act(async () => {
                      unwrap(await cloud.auth.signOut());
                      setCloudRevision(0);
                      setMessage(
                        "Abgemeldet. Dein lokaler Entwurf bleibt in diesem Browser.",
                      );
                    })
                  }
                >
                  Abmelden
                </Button>
              </>
            ) : (
              <>
                <p>
                  {adminLogin
                    ? "Administrationszugang mit E-Mail und Passwort. Die Rolle wird separat im Backend vergeben."
                    : "Du erhältst einen Anmeldelink per E-Mail. Ein Passwort brauchst du nicht."}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      if (!cloud)
                        throw new Error(
                          "Das Backend ist noch nicht eingerichtet.",
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
                          "Anmeldelink angefordert. Prüfe dein E-Mail-Postfach.",
                        );
                      }
                    });
                  }}
                >
                  <label>
                    E-Mail
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
                      Passwort
                      <input
                        required
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                  )}
                  <Button disabled={busy || !cloud}>
                    {adminLogin ? "Anmelden" : "Magic Link senden"}
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
                    ? "Anmeldung für Teilnehmende"
                    : "Administrationszugang"}
                </button>
              </>
            )}
          </Card>
        )}
        {page === "archive" && (
          <Card>
            <h1>Meine Entwürfe</h1>
            <p>
              Privat in deinem Konto gespeichert. Laden ersetzt den aktuellen
              lokalen Stand.
            </p>
            {entries.length ? (
              entries.map((e) => (
                <div className="archive-row" key={e.id}>
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {new Date(e.updated_at).toLocaleString("de-AT")} ·
                      Online-Version {e.revision}
                    </small>
                  </span>
                  <Button
                    secondary
                    onClick={() =>
                      act(async () => {
                        if (
                          !confirm(
                            "Aktuellen lokalen Stand durch diesen Online-Entwurf ersetzen?",
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
                    Öffnen
                  </Button>
                  <Button
                    secondary
                    onClick={() =>
                      act(async () => {
                        if (
                          !confirm(
                            "Diesen privaten Online-Entwurf löschen? Bestehende Workshop-Abgaben bleiben separat erhalten.",
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
                    Löschen
                  </Button>
                </div>
              ))
            ) : (
              <p>Noch keine Online-Entwürfe gespeichert.</p>
            )}
          </Card>
        )}
        {page === "admin" && admin && (
          <div className="admin-grid">
            <Card>
              <span className="eyebrow">Administration</span>
              <h1>Raum fürs Ausprobieren.</h1>
              <p>
                Modelle und Auswahlgrenzen gelten für neue Aufträge. Bereits
                erstellte Arbeitsblätter behalten ihre Einstellungen.
              </p>
              <div className="field-grid">
                {[
                  ["maxInhalt", "Inhaltliche Auswahlgrenze", 4],
                  ["maxWiss", "Wissenschaftliche Auswahlgrenze", 5],
                  ["cardsPerMechanism", "Karten je Mechanik", 5],
                  ["hourlyLimit", "KI-Aufrufe je Person / Stunde", 30],
                ].map(([k, label, max]) => (
                  <label key={k}>
                    {label}
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
                    {label} · Modell-ID
                    <input
                      value={settings.models[id]}
                      maxLength={100}
                      placeholder="Leer = Anbieter deaktiviert"
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
                    setMessage("Einstellungen veröffentlicht.");
                  })
                }
              >
                Einstellungen veröffentlichen
              </Button>
            </Card>
            <Card>
              <h2>Zentrale KI-Zugänge</h2>
              <p>
                API-Keys werden serverseitig verschlüsselt gespeichert und nie
                wieder angezeigt.
              </p>
              <p>
                {credentials.length
                  ? credentials.map((c) => PROVIDERS[c.provider]).join(", ") +
                    " eingerichtet"
                  : "Noch keine zentralen Zugänge eingerichtet."}
              </p>
              <label>
                Anbieter
                <select
                  value={centralProvider}
                  onChange={(e) => {
                    setCentralProvider(e.target.value);
                    setCentralKey("");
                  }}
                >
                  {Object.entries(PROVIDERS).map(([id, l]) => (
                    <option key={id} value={id}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Neuer API-Key
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
                  disabled={busy || !centralKey}
                  onClick={() =>
                    act(async () => {
                      const d = await callFunction("credentials", {
                        action: "set",
                        provider: centralProvider,
                        apiKey: centralKey.trim(),
                      });
                      setCentralKey("");
                      setCredentials(d.credentials);
                      setMessage("Zentraler Zugang gespeichert.");
                    })
                  }
                >
                  Zugang hinterlegen
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      if (
                        !confirm("Zentralen Zugang dieses Anbieters entfernen?")
                      )
                        return;
                      const d = await callFunction("credentials", {
                        action: "delete",
                        provider: centralProvider,
                      });
                      setCredentials(d.credentials);
                      setMessage("Zugang entfernt.");
                    })
                  }
                >
                  Zugang entfernen
                </Button>
              </div>
            </Card>
            <Card>
              <h2>Workshops</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act(async () => {
                    unwrap(
                      await cloud
                        .from("workshops")
                        .insert({
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
                      "Workshop angelegt. Zentrale KI ist zunächst ausgeschaltet.",
                    );
                  });
                }}
              >
                <label>
                  Neuer Workshop
                  <input
                    value={workshopTitle}
                    onChange={(e) => setWorkshopTitle(e.target.value)}
                    required
                    maxLength={200}
                  />
                </label>
                <Button disabled={busy}>Workshop anlegen</Button>
              </form>
              {adminWorkshops.map((w) => (
                <div className="workshop-admin" key={w.id}>
                  <h3>{w.title}</h3>
                  <label>
                    Zugangscode
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
                          setMessage("Du bist dem Workshop beigetreten.");
                        })
                      }
                    >
                      Selbst beitreten
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
                      {w.active ? "Workshop schließen" : "Workshop öffnen"}
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
                        ? "Workshop-KI ausschalten"
                        : "Workshop-KI einschalten"}
                    </Button>
                  </div>
                  <label>
                    Maximale KI-Aufrufe insgesamt
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
                              "Limit muss zwischen 1 und 10000 liegen.",
                            );
                          unwrap(
                            await cloud
                              .from("workshops")
                              .update({ generation_limit: n })
                              .eq("id", w.id),
                          );
                          setMessage("Workshoplimit gespeichert.");
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </Card>
            <Card>
              <h2>Abgaben an die Moderation</h2>
              <p>
                Hier erscheinen nur ausdrücklich eingereichte Stände, keine
                privaten Entwürfe.
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
                      · {new Date(s.created_at).toLocaleString("de-AT")} ·{" "}
                      {s.status}
                    </small>
                  </span>
                  <Button
                    secondary
                    onClick={() =>
                      download(
                        JSON.stringify(s.payload, null, 2),
                        "7rizons-abgabe.json",
                        "application/json",
                      )
                    }
                  >
                    JSON
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
                    Markdown
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
                    Gesichtet
                  </Button>
                </div>
              ))}
              {!submissions.length && <p>Noch keine Abgaben.</p>}
            </Card>
          </div>
        )}
        {page === "about" && (
          <Card>
            <div className="eyebrow">Spielerisch Lehre gestalten</div>
            <h1>Über den Spielkonfigurator</h1>
            <h2>Vom Lernziel zum Spiel</h2>
            <p>
              Der Spielkonfigurator hilft dir, 7’rizons für dein eigenes
              Hochschulseminar anzupassen. Aus deinem Thema, den gewünschten
              Lerntätigkeiten und passenden Spielmechaniken entsteht ein
              Arbeitsblatt mit Anleitungen und Platz für eigene Kartentexte.
              Du kannst mit festen Vorlagen arbeiten oder dir von einer KI
              thematische Vorschläge ausarbeiten lassen.
            </p>
            <h2>7’rizons: Create a playful university!</h2>
            <p>
              7’rizons ist ein fächerübergreifendes Simulations- und
              Rollenspielprojekt an der Universität Bonn. Studierende und
              Lehrende entwerfen gemeinsam eine fiktive Welt und entwickeln
              deren natürliche und gesellschaftliche Grundlagen weiter. Dabei
              bringen sie Wissen aus unterschiedlichen Disziplinen ein,
              übernehmen Rollen und erproben Entscheidungen in imaginativen
              Szenarien. Das Projekt verbindet digitale und analoge Spielformen
              mit forschendem Lernen und stärkt Zusammenarbeit,
              Perspektivwechsel und kreatives Problemlösen. Es ist am IMPULSE
              – House for Intellectual Innovation and Creativity verortet;
              das Bonn Lab for Analog Games and Imaginative Play begleitet
              den gemeinsamen Spielrahmen.
            </p>
            <p>
              <a href="https://www.fiw.uni-bonn.de/gamelab/de/projekte/7rizons">
                Mehr über 7’rizons auf der Projektseite der Universität Bonn →
              </a>
            </p>
            <Button secondary onClick={() => setPage("app")}>
              Zum Spielkonfigurator →
            </Button>
          </Card>
        )}
        {page === "legal" && (
          <Card>
            <h1>Impressum & Hinweise</h1>
            <h2>Menschen hinter dem Werkzeug</h2>
            <p>Created by Harald Eckmüller · Technisch unterstützt von LMB.</p>
            <h2>Impressum</h2>
            <p>
              Verantwortlich: Dr. Ludwig M. Breuer · Bgm.-Rohmüller-Str. 7 ·
              86554 Pöttmes. Kontakt: info@lmbreuer.de.
            </p>
            <h2>Datenschutz</h2>
            <p>
              Diese Website wird über GitHub Pages bereitgestellt. GitHub
              verarbeitet dabei technische Zugriffsdaten, etwa IP-Adressen,
              zur Bereitstellung und Absicherung des Dienstes. Es werden keine
              Trackingdienste oder externen Schriftarten eingebunden.
            </p>
            {!cloud && (
              <p>
                In dieser Vorschau ist noch kein Backend verbunden. Anmeldung,
                direkte KI-Nutzung, Online-Speicherung und Abgabe sind deshalb
                deaktiviert. Deine Konfiguration bleibt in diesem Browser,
                sofern du sie nicht selbst exportierst oder an eine KI weitergibst.
              </p>
            )}
            <p>
              Entwürfe werden automatisch in diesem Browser gespeichert. Nach
              Anmeldung kannst du sie zusätzlich privat online speichern und
              löschen. Erst eine ausdrückliche Abgabe gibt den gewählten Stand
              samt Kontextangaben an die Workshopmoderation weiter. Abgaben
              können zurückgezogen werden; bereits heruntergeladene Kopien
              werden dadurch nicht zurückgerufen.
            </p>
            <p>
              Bei direkter KI-Nutzung werden Thema, Fach und die gewählte
              Spielkonfiguration über das Backend an den angezeigten Anbieter
              gesendet. Eigene API-Keys werden nur für die Sitzung im Speicher
              gehalten; zentrale Workshop-Keys werden serverseitig verschlüsselt
              gespeichert. E-Mail und Login werden über Supabase verarbeitet.
              Private Online-Entwürfe bleiben bis zu deiner Löschung gespeichert;
              Abgaben bis zum Zurückziehen oder einer vereinbarten Bereinigung.
              Beim Aktivieren des Backends werden dessen konkrete Betriebsangaben
              und Aufbewahrungsregeln ergänzt.
            </p>
            <h2>KI-Hinweis</h2>
            <p>
              Der Ausgangsprototyp entstand mit Claude. Die Weiterentwicklung
              wird durch KI unterstützt. „Ohne KI“ verwendet feste Vorlagen und
              erzeugt keine neuen KI-Texte. Beim externen Weg übermittelst du
              den Auftrag selbst an deine KI. Direkte KI-Ausgaben und
              importierte Antworten sind Vorschläge: Prüfe fachliche Richtigkeit
              und Eignung für deine Lehrveranstaltung.
            </p>
            <p>
              Die Herkunft des konkreten Arbeitsblatts wird am Dokument
              ausgewiesen.
            </p>
          </Card>
        )}
      </main>
      <footer className="footer no-print">
        <div>
          <span className="footer-kicker">
            Gute Lehre beginnt mit einer Frage.
            <br />
            <strong>Manchmal auch mit einer Spielkarte.</strong>
          </span>
          <p>
            Eine Idee von <strong>Harald Eckmüller</strong>.<br />
            Mit technischem Rückenwind von <strong>LMB</strong>.
          </p>
          <small>Created by Harald Eckmüller · Unterstützt von LMB</small>
        </div>
        <div className="footer-links">
          <button
            onClick={() => {
              setPage("about");
              window.scrollTo(0, 0);
            }}
          >
            Über das Tool
          </button>
          <button
            onClick={() => {
              setPage("legal");
              window.scrollTo(0, 0);
            }}
          >
            Impressum
          </button>
          <button
            onClick={() => {
              setPage("legal");
              window.scrollTo(0, 0);
            }}
          >
            Datenschutz
          </button>
          <button
            onClick={() => {
              setPage("legal");
              window.scrollTo(0, 0);
            }}
          >
            KI transparent
          </button>
        </div>
      </footer>
    </>
  );
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
          Workshop
          <select
            value={workshopId}
            onChange={(e) => setWorkshopId(e.target.value)}
          >
            <option value="">Workshop auswählen</option>
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
        Workshop-Code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          maxLength={80}
          placeholder="Code von deiner Moderation"
        />
      </label>
      <Button secondary disabled={!session || !code.trim()} onClick={join}>
        Workshop beitreten
      </Button>
    </div>
  );
}
