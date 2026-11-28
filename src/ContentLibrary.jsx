import React, { useEffect, useState } from "react";
import { cloud, unwrap } from "./cloud.js";
import { t } from "./i18n.js";
import ContentEditor from "./ContentEditor.jsx";

export default function ContentLibrary({ act, busy, message, dirtyRef }) {
  const [rows, setRows] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [defaultId, setDefaultId] = useState("");
  const [current, setCurrent] = useState(null);
  const [copy, setCopy] = useState(null);
  const [ready, setReady] = useState(false);
  async function refresh() {
    const [editions, settings, uses] = await Promise.all([
      cloud
        .from("content_editions")
        .select("id,title,revision,is_public")
        .order("title"),
      cloud.from("app_settings").select("default_edition_id").single(),
      cloud.from("workshops").select("id,title,edition_id").order("title"),
    ]);
    const next = [unwrap(editions), unwrap(settings), unwrap(uses)];
    setRows(next[0]);
    setDefaultId(next[1].default_edition_id);
    setWorkshops(next[2]);
    setReady(true);
  }
  useEffect(() => {
    act(refresh);
  }, []);
  async function edit(id) {
    setCurrent(
      unwrap(
        await cloud
          .from("content_editions")
          .select("id,title,revision,content")
          .eq("id", id)
          .single(),
      ),
    );
    setCopy(null);
  }
  function runEditionAction(event, action) {
    const menu = event.currentTarget.closest("details");
    menu.open = false;
    menu.querySelector("summary").focus();
    act(action);
  }
  async function toggleVisibility(row) {
    unwrap(
      await cloud.rpc("set_edition_visibility", {
        p_id: row.id,
        p_public: !row.is_public,
      }),
    );
    await refresh();
  }
  async function setDefault(row) {
    if (
      !window.confirm(
        t(
          "„{0}“ öffentlich verfügbar machen und als Standard für neue Projekte und Workshops ohne eigene Fassung setzen?",
          { 0: row.title },
        ),
      )
    )
      return;
    unwrap(await cloud.rpc("choose_default_edition", { p_id: row.id }));
    await refresh();
  }
  if (current)
    return (
      <ContentEditor
        key={current.id}
        dirtyRef={dirtyRef}
        published={current}
        busy={busy}
        act={act}
        onBack={() => {
          setCurrent(null);
          act(refresh);
        }}
        onPublish={async (content, title) => {
          const revision = unwrap(
            await cloud.rpc("publish_content_edition", {
              p_id: current.id,
              p_revision: current.revision,
              p_title: title,
              p_content: content,
            }),
          );
          setCurrent({ ...current, revision, content, title });
          message(t("Änderungen gespeichert."));
        }}
      />
    );
  return (
    <section className="edition-library">
      <div className="editor-heading">
        <h1>{t("Inhalte")}</h1>
        {ready && (
          <button
            className="button"
            disabled={busy || !!copy}
            onClick={() => setCopy({ source: defaultId, title: "" })}
          >
            {t("Neue Fassung")}
          </button>
        )}
      </div>
      {copy && (
        <form
          className="editor-create panel"
          onSubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const id = unwrap(
                await cloud.rpc("copy_content_edition", {
                  p_source: copy.source,
                  p_revision: rows.find((r) => r.id === copy.source).revision,
                  p_title: copy.title.trim(),
                }),
              );
              setCopy(null);
              await edit(id);
            });
          }}
        >
          <h2>{t("Neue Fassung")}</h2>
          <div className="field-grid">
            <label>
              {t("Name der Fassung")}
              <input
                required
                autoFocus
                maxLength={100}
                value={copy.title}
                onChange={(e) => setCopy({ ...copy, title: e.target.value })}
              />
            </label>
            <label>
              {t("Kopieren von")}
              <select
                value={copy.source}
                onChange={(e) => setCopy({ ...copy, source: e.target.value })}
              >
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="actions">
            <button className="button" disabled={busy || !copy.title.trim()}>
              {t("Fassung anlegen")}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => setCopy(null)}
            >
              {t("Abbrechen")}
            </button>
          </div>
        </form>
      )}
      <section className="panel edition-list" aria-label={t("Inhaltsfassungen")}>
        {!ready && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => act(refresh)}
          >
            {t("Fassungen laden")}
          </button>
        )}
        <ul className="edition-rows">
          {rows.map((row) => {
            const isDefault = row.id === defaultId;
            const uses = workshops.filter(
              (w) => (w.edition_id || defaultId) === row.id,
            );
            const status = isDefault
              ? "Standard"
              : row.is_public
                ? "Öffentlich"
                : "Nicht öffentlich";
            const menuLabel = t("Optionen für „{0}“", { 0: row.title });
            return (
              <li className="edition-row" key={row.id}>
                <div className="edition-name">
                  <h2>{row.title}</h2>
                  <small className="muted">
                    {t(status)}
                    {uses.length > 0 &&
                      " · " +
                        t(uses.length === 1 ? "{0} Workshop" : "{0} Workshops", {
                          0: uses.length,
                        })}
                  </small>
                </div>
                <button
                  type="button"
                  className="button secondary edition-edit-action"
                  disabled={busy}
                  onClick={() => act(() => edit(row.id))}
                >
                  {t("Bearbeiten")}
                </button>
                {(!isDefault || uses.length > 0) && (
                  <details className="switch-menu edition-menu">
                    <summary
                      className="button secondary"
                      aria-label={menuLabel}
                      title={menuLabel}
                    >
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                        <circle cx="4" cy="9" r="1.3" />
                        <circle cx="9" cy="9" r="1.3" />
                        <circle cx="14" cy="9" r="1.3" />
                      </svg>
                    </summary>
                    <div className="menu-body">
                      {!isDefault && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(event) =>
                              runEditionAction(event, () => toggleVisibility(row))
                            }
                          >
                            {t(
                              row.is_public
                                ? "Aus öffentlicher Auswahl nehmen"
                                : "Öffentlich machen",
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(event) =>
                              runEditionAction(event, () => setDefault(row))
                            }
                          >
                            {t("Als Standard setzen")}
                          </button>
                        </>
                      )}
                      {uses.length > 0 && (
                        <div className="edition-menu-workshops">
                          <strong>{t("Workshops")}</strong>
                          <ul>
                            {uses.map((w) => <li key={w.id}>{w.title}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
