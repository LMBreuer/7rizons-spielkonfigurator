import React, { useEffect, useState } from "react";
import { cloud, unwrap } from "./cloud.js";
import { t, getLanguage } from "./i18n.js";

function appUrl(query) {
  const url = new URL(window.location.pathname, window.location.origin);
  url.search = new URLSearchParams(query).toString();
  return url.href;
}

function timestamp(date) {
  return new Date(date).toLocaleString(
    getLanguage() === "en" ? "en-GB" : "de-AT",
  );
}

const accessLabels = {
  pending: "Freigabe angefragt",
  approved: "Stand freigegeben",
  declined: "Anfrage abgelehnt",
  revoked: "Freigabe widerrufen",
};

export function AdminProjectList({ act, busy, openProject }) {
  const [projects, setProjects] = useState(null);
  const [mail, setMail] = useState(null);
  const [more, setMore] = useState(false);
  const load = async (offset = 0) => {
    const rows = unwrap(
      await cloud.rpc("superadmin_projects").range(offset, offset + 49),
    );
    setProjects((previous) => (offset ? [...previous, ...rows] : rows));
    setMore(rows.length === 50);
  };
  useEffect(() => {
    act(() => load());
  }, []);
  return (
    <>
      <h2>{t("Online-Projekte")}</h2>
      <p className="muted">
        {t(
          "Die Liste zeigt Titel und Änderungsdatum. Der Projektinhalt wird zugänglich, wenn die Person eine Freigabe bestätigt.",
        )}
      </p>
      {projects?.length === 0 && <p>{t("Noch keine Online-Projekte.")}</p>}
      {projects?.map((project) => (
        <div className="archive-row" key={project.id}>
          <span>
            <strong>{project.title}</strong>
            <small>
              {timestamp(project.updated_at)}
              {project.status && " · " + t(accessLabels[project.status])}
              {project.shared_revision != null &&
                ` (${t("Stand {0}", { 0: project.shared_revision })})`}
              {project.is_owner && " · " + t("Dein Projekt")}
            </small>
          </span>
          {project.status === "approved" ? (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const snapshot = unwrap(
                    await cloud.rpc("read_approved_project", {
                      p_request: project.request_id,
                    }),
                  );
                  openProject(project, snapshot);
                })
              }
            >
              {t("Freigegebenen Stand öffnen")}
            </button>
          ) : (
            !project.is_owner && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const address = unwrap(
                      await cloud.rpc("request_project_access", {
                        p_project: project.id,
                      }),
                    );
                    const subject = t("Projektfreigabe für 7’rizons");
                    const body =
                      t(
                        "Kannst du den gespeicherten Stand von „{0}“ in 7’rizons für mich freigeben?",
                        { 0: project.title },
                      ) +
                      "\n\n" +
                      t(
                        "Öffne in deinem Konto die Freigabeanfragen. Dort kannst du zustimmen oder ablehnen.",
                      ) +
                      "\n" +
                      appUrl({ view: "account" });
                    setMail({
                      id: project.id,
                      href: `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
                    });
                    await load();
                  })
                }
              >
                {t(
                  project.status === "pending"
                    ? "Mail erneut vorbereiten"
                    : "Freigabe anfragen",
                )}
              </button>
            )
          )}
          {mail?.id === project.id && (
            <a className="button secondary" href={mail.href}>
              {t("Mailentwurf öffnen")}
            </a>
          )}
        </div>
      ))}
      {more && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => act(() => load(projects.length))}
        >
          {t("Weitere Projekte laden")}
        </button>
      )}
    </>
  );
}

export function ProjectRequests({ act, busy, message }) {
  const [requests, setRequests] = useState([]);
  const refresh = async () => {
    setRequests(unwrap(await cloud.rpc("my_project_access_requests")));
  };
  useEffect(() => {
    act(refresh);
  }, []);
  if (!requests.length) return null;
  const answer = (request, status) =>
    act(async () => {
      unwrap(
        await cloud.rpc("answer_project_access", {
          p_request: request.id,
          p_decision: status,
          p_revision: request.revision,
        }),
      );
      await refresh();
      message(t(accessLabels[status]));
    });
  return (
    <section className="account-section">
      <h2>{t("Freigabeanfragen")}</h2>
      <p className="muted">
        {t(
          "Wenn du zustimmst, erhält die Superadministration eine Kopie des aktuell online gespeicherten Projektstands samt Arbeitsblättern.",
        )}
      </p>
      {requests.map((request) => (
        <div className="archive-row" key={request.id}>
          <span>
            <strong>{request.title}</strong>
            <small>
              {t("Stand {0}", {
                0: request.shared_revision ?? request.revision,
              })}{" "}
              · {t(accessLabels[request.status])}
            </small>
          </span>
          {request.status === "pending" ? (
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => answer(request, "declined")}
              >
                {t("Ablehnen")}
              </button>
              <button
                className="button"
                disabled={busy}
                onClick={() => answer(request, "approved")}
              >
                {t("Stand freigeben")}
              </button>
            </>
          ) : (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => answer(request, "revoked")}
            >
              {t("Freigabe widerrufen")}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

export function WorkshopInvite({ workshop, act, message }) {
  const [qrUrl, setQrUrl] = useState("");
  const url = appUrl({ workshop: workshop.join_code });
  const toggleQr = () =>
    act(async () => {
      if (qrUrl) {
        setQrUrl("");
        return;
      }
      const { default: qrcode } = await import("qrcode-generator");
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      setQrUrl(qr.createDataURL(5, 20));
    });
  return (
    <div className="workshop-invite">
      <div className="actions">
        <button
          className="button secondary"
          onClick={() =>
            act(async () => {
              await navigator.clipboard.writeText(url);
              message(t("Einladungslink kopiert."));
            })
          }
        >
          {t("Einladungslink kopieren")}
        </button>
        <button
          className="button secondary"
          aria-expanded={Boolean(qrUrl)}
          onClick={toggleQr}
        >
          {t("QR-Code")}
        </button>
      </div>
      {qrUrl && (
        <div className="workshop-qr">
          <img src={qrUrl} alt={t("QR-Code zur Workshop-Einladung")} />
          <a href={qrUrl} download="7rizons-workshop.gif">
            {t("QR-Code herunterladen")}
          </a>
        </div>
      )}
      <details className="workshop-manual-code">
        <summary>{t("Zugangscode")}</summary>
        <label>
          <span className="sr-only">{t("Zugangscode")}</span>
          <input
            readOnly
            value={workshop.join_code}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
        <button
          className="button secondary"
          onClick={() =>
            act(async () => {
              await navigator.clipboard.writeText(workshop.join_code);
              message(t("Workshop-Code kopiert."));
            })
          }
        >
          {t("Workshop-Code kopieren")}
        </button>
      </details>
    </div>
  );
}

export function WorkshopProjectList({ projects }) {
  return projects.length ? (
    <ul className="workshop-projects">
      {projects.map((project) => (
        <li key={project.id}>
          {project.title} · <small>{timestamp(project.updated_at)}</small>
        </li>
      ))}
    </ul>
  ) : (
    <p className="muted">{t("Noch keine Projekte zugeordnet.")}</p>
  );
}

export function WorkshopManagement({ workshop, act, busy }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [moderators, setModerators] = useState([]);
  const [projects, setProjects] = useState([]);
  async function reload() {
    const [people, entries] = await Promise.all([
      cloud.rpc("list_workshop_moderators", { p_workshop: workshop.id }),
      cloud.rpc("list_workshop_projects", { p_workshop: workshop.id }),
    ]);
    setModerators(unwrap(people));
    setProjects(unwrap(entries));
  }
  const setModerator = (address, add) =>
    act(async () => {
      unwrap(
        await cloud.rpc("set_workshop_moderator", {
          p_workshop: workshop.id,
          p_email: address,
          p_add: add,
        }),
      );
      setEmail("");
      await reload();
    });
  return (
    <>
      <details
        onToggle={(e) => {
          if (e.currentTarget.open && !open)
            act(async () => {
              await reload();
              setOpen(true);
            });
        }}
      >
        <summary>{t("Projekte und Moderation")}</summary>
        <WorkshopProjectList projects={projects} />
        <h4>{t("Workshopmoderation")}</h4>
        {moderators.map((person) => (
          <div className="archive-row" key={person.user_id}>
            <span>{person.email}</span>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setModerator(person.email, false)}
            >
              {t("Moderationsrolle entfernen")}
            </button>
          </div>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setModerator(email, true);
          }}
        >
          <label>
            {t("E-Mail eines bestätigten Kontos")}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button className="button secondary" disabled={busy}>
            {t("Moderation hinzufügen")}
          </button>
        </form>
      </details>
    </>
  );
}
