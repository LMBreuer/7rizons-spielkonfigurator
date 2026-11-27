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

function WorkshopAssignment({ project, workshops, act, busy, onChange }) {
  const [selected, setSelected] = useState("");
  const available = workshops.filter(
    (workshop) =>
      workshop.active && !project.workshop_ids.includes(workshop.id),
  );
  const assigned = workshops.filter((workshop) =>
    project.workshop_ids.includes(workshop.id),
  );
  const change = (id, link) =>
    act(async () => {
      unwrap(
        await cloud.rpc("admin_set_workshop_project", {
          p_project: project.id,
          p_workshop: id,
          p_link: link,
        }),
      );
      if (id === selected) setSelected("");
      onChange(
        link
          ? [...project.workshop_ids, id]
          : project.workshop_ids.filter((workshopId) => workshopId !== id),
      );
    });
  return (
    <details className="settings-disclosure project-assignment">
      <summary>
        {t("Workshops zuordnen")} ({assigned.length})
      </summary>
      {assigned.map((workshop) => (
        <div className="archive-row" key={workshop.id}>
          <span>{workshop.title}</span>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            aria-label={t("Zuordnung zu „{0}“ lösen", { 0: workshop.title })}
            onClick={() => change(workshop.id, false)}
          >
            {t("Zuordnung lösen")}
          </button>
        </div>
      ))}
      {available.length > 0 && (
        <form
          className="project-assignment-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected) change(selected, true);
          }}
        >
          <label>
            {t("Workshop")}
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={busy}
            >
              <option value="">{t("Workshop auswählen")}</option>
              {available.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="button secondary"
            disabled={!selected || busy}
          >
            {t("Zuordnen")}
          </button>
        </form>
      )}
      {assigned.length === 0 && available.length === 0 && (
        <p className="muted">{t("Keine aktiven Workshops verfügbar.")}</p>
      )}
    </details>
  );
}

export function AdminProjectList({
  act,
  busy,
  openProject,
  superadmin,
  workshops,
}) {
  const [projects, setProjects] = useState(null);
  const [mail, setMail] = useState(null);
  const [more, setMore] = useState(false);
  const load = async (offset = 0) => {
    const rows = unwrap(
      await cloud.rpc("admin_projects").range(offset, offset + 49),
    );
    setProjects((previous) => (offset ? [...previous, ...rows] : rows));
    setMore(rows.length === 50);
  };
  useEffect(() => {
    act(() => load());
  }, []);
  return (
    <>
      <h2 data-tour="admin-projects">{t("Online-Projekte")}</h2>
      <p className="muted">
        {t(
          "Hier können Sie online freigegebene Projekte öffnen und Workshops zuordnen.",
        )}
      </p>
      {projects?.length === 0 && <p>{t("Noch keine Online-Projekte.")}</p>}
      {projects?.map((project) => (
        <section className="admin-project-row" key={project.id}>
          <div className="archive-row">
            <span>
              <strong>{project.title}</strong>
              <small>
                {timestamp(project.updated_at)}
                {!project.admin_access &&
                  project.status &&
                  " · " + t(accessLabels[project.status])}
                {!project.admin_access &&
                  project.shared_revision != null &&
                  ` (${t("Stand {0}", { 0: project.shared_revision })})`}
                {!project.admin_access &&
                  !project.is_owner &&
                  !project.status &&
                  " · " + t("Bisheriger privater Entwurf")}
                {project.is_owner && " · " + t("Ihr Projekt")}
              </small>
            </span>
            {project.admin_access || project.is_owner ? (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const snapshot = unwrap(
                      await cloud.rpc("read_admin_project", {
                        p_project: project.id,
                      }),
                    );
                    openProject(project, snapshot);
                  })
                }
              >
                {t("Projekt öffnen")}
              </button>
            ) : project.status === "approved" ? (
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
              superadmin && (
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
                          "Können Sie den gespeicherten Stand von „{0}“ in 7’rizons für mich freigeben?",
                          { 0: project.title },
                        ) +
                        "\n\n" +
                        t(
                          "Öffnen Sie in Ihrem Konto die Freigabeanfragen. Dort können Sie zustimmen oder ablehnen.",
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
            {!project.admin_access && mail?.id === project.id && (
              <a className="button secondary" href={mail.href}>
                {t("Mailentwurf öffnen")}
              </a>
            )}
          </div>
          {project.admin_access && (
            <WorkshopAssignment
              project={project}
              workshops={workshops}
              act={act}
              busy={busy}
              onChange={(ids) =>
                setProjects((items) =>
                  items.map((item) =>
                    item.id === project.id
                      ? { ...item, workshop_ids: ids }
                      : item,
                  ),
                )
              }
            />
          )}
        </section>
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
          "Wenn Sie zustimmen, erhält die Superadministration eine Kopie des aktuell online gespeicherten Projektstands samt Arbeitsblättern.",
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
      <details className="settings-disclosure workshop-manual-code">
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

export function WorkshopManagement({ workshop, act }) {
  const [projects, setProjects] = useState(null);
  return (
    <details
      className="settings-disclosure"
      onToggle={(e) => {
        if (e.currentTarget.open)
          act(async () =>
            setProjects(
              unwrap(
                await cloud.rpc("list_workshop_projects", {
                  p_workshop: workshop.id,
                }),
              ),
            ),
          );
      }}
    >
      <summary>{t("Zugeordnete Projekte")}</summary>
      {projects && <WorkshopProjectList projects={projects} />}
    </details>
  );
}
