import React, { useEffect, useState } from "react";
import { cloud, unwrap } from "./cloud.js";
import { t } from "./i18n.js";

const roleLabels = {
  member: "Teilnahme",
  moderator: "Moderation",
  admin: "Administration",
  superadmin: "Superadministration",
};

export function WorkshopRoster({ workshop, act, busy, editable = false }) {
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState("");
  async function refresh() {
    const people = [];
    let batch;
    do {
      batch = unwrap(
        await cloud
          .rpc("workshop_roster", { p_workshop: workshop.id })
          .range(people.length, people.length + 99),
      );
      people.push(...batch);
    } while (batch.length === 100);
    setRows(people);
  }
  useEffect(() => {
    act(refresh);
  }, [workshop.id]);
  function change(address, role) {
    act(async () => {
      if (
        role === "remove" &&
        !window.confirm(
          t(
            "„{0}“ aus diesem Workshop entfernen? Die Person kann mit einem gültigen Code erneut beitreten.",
            { 0: address },
          ),
        )
      )
        return;
      unwrap(
        await cloud.rpc("set_roster_role", {
          p_workshop: workshop.id,
          p_email: address,
          p_role: role,
        }),
      );
      setEmail("");
      await refresh();
    });
  }
  return (
    <div className="member-list">
      {editable && (
        <form
          className="workshop-form"
          onSubmit={(e) => {
            e.preventDefault();
            change(email, "add");
          }}
        >
          <label>
            {t("E-Mail eines bestätigten Kontos")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="button secondary" disabled={busy || !email.trim()}>
            {t("Mitglied hinzufügen")}
          </button>
        </form>
      )}
      {rows === null ? (
        <button
          className="text-button"
          disabled={busy}
          onClick={() => act(refresh)}
        >
          {t("Mitglieder laden")}
        </button>
      ) : !rows.length ? (
        <p className="muted">
          {t("Dieser Workshop hat noch keine Mitglieder.")}
        </p>
      ) : (
        <ul>
          {rows.map((person) => (
            <li key={person.email}>
              <div>
                <strong>{person.email}</strong>
                <small>
                  {t(roleLabels[person.moderator ? "moderator" : "member"])}
                </small>
              </div>
              {editable && (
                <div className="actions">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      change(
                        person.email,
                        person.moderator ? "member" : "moderator",
                      )
                    }
                  >
                    {t(
                      person.moderator
                        ? "Moderationsrolle entfernen"
                        : "Moderation übertragen",
                    )}
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => change(person.email, "remove")}
                  >
                    {t("Entfernen")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AccountDirectory({ act, busy }) {
  const [rows, setRows] = useState([]);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [ready, setReady] = useState(false);
  async function load(search, start) {
    const result = unwrap(
      await cloud.rpc("account_directory", {
        p_search: search,
        p_offset: start,
      }),
    );
    setRows(result);
    setOffset(start);
    setQuery(search);
    setReady(true);
  }
  useEffect(() => {
    act(() => load("", 0));
  }, []);
  return (
    <section className="member-list">
      <form
        className="workshop-form"
        onSubmit={(e) => {
          e.preventDefault();
          act(() => load(input, 0));
        }}
      >
        <label>
          {t("Nach E-Mail suchen")}
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button className="button secondary" disabled={busy}>
          {t("Suchen")}
        </button>
      </form>
      {ready && !rows.length && (
        <p>{t("Keine bestätigten Konten gefunden.")}</p>
      )}
      <ul>
        {rows.slice(0, 50).map((person) => (
          <li key={person.user_id}>
            <div>
              <strong>{person.email}</strong>
              <small>{t(roleLabels[person.account_role])}</small>
            </div>
            {person.account_role !== "superadmin" && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const grant = person.account_role !== "admin";
                    if (
                      !window.confirm(
                        t(
                          grant
                            ? "„{0}“ Administrationsrechte für den Konfigurator erteilen?"
                            : "„{0}“ die Administrationsrechte entziehen?",
                          { 0: person.email },
                        ),
                      )
                    )
                      return;
                    unwrap(
                      await cloud.rpc("set_account_admin", {
                        p_user: person.user_id,
                        p_admin: grant,
                      }),
                    );
                    await load(query, offset);
                  })
                }
              >
                {t(
                  person.account_role === "admin"
                    ? "Adminrechte entziehen"
                    : "Adminrechte erteilen",
                )}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="actions">
        {offset > 0 && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => act(() => load(query, offset - 50))}
          >
            {t("Zurück")}
          </button>
        )}
        {rows.length > 50 && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => act(() => load(query, offset + 50))}
          >
            {t("Weiter")}
          </button>
        )}
      </div>
    </section>
  );
}

export default function Members({ workshops, superadmin, act, busy }) {
  const [scope, setScope] = useState(
    superadmin ? "accounts" : workshops[0]?.id || "",
  );
  const workshop = workshops.find((w) => w.id === scope);
  return (
    <section className="panel">
      <h2>{t("Mitglieder")}</h2>
      <label className="member-scope" data-tour="admin-members">
        {t("Mitglieder anzeigen")}
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {superadmin && (
            <option value="accounts">{t("Alle bestätigten Konten")}</option>
          )}
          {workshops.map((w) => (
            <option value={w.id} key={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      </label>
      {scope === "accounts" && superadmin && (
        <AccountDirectory act={act} busy={busy} />
      )}
      {workshop && (
        <WorkshopRoster
          key={scope}
          editable
          workshop={workshop}
          act={act}
          busy={busy}
        />
      )}
      {!scope && <p>{t("Legen Sie zuerst einen Workshop an.")}</p>}
    </section>
  );
}
