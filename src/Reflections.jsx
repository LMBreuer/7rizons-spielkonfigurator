import React, { useState } from "react";
import { reflectionFields } from "../supabase/functions/_shared/reflection.js";
import { printWorksheet } from "./WorksheetCards.jsx";

export default function Reflections({ items, title, onChange, t }) {
  const [editing, setEditing] = useState(null);
  if (!onChange && !items.length) return null;
  function add() {
    const id = crypto.randomUUID();
    onChange((current) => [
      ...current,
      { id, title: "", stars: "", wishes: "", learning: "", next: "" },
    ]);
    setEditing(id);
  }
  function field(item, key, value) {
    onChange((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, [key]: value } : row,
      ),
    );
  }
  return (
    <section className="worksheet-reflections">
      <div className="card-title-row no-print">
        <h2>{t("Ergebnisblätter zum Probelauf")}</h2>
        {onChange && (
          <button type="button" className="button secondary" onClick={add}>
            + {t("Ergebnisblatt hinzufügen")}
          </button>
        )}
      </div>
      {items.map((item, index) => {
        const editable = editing === item.id && onChange;
        return (
          <section
            className="reflection-sheet"
            key={item.id}
            id={"reflection-" + item.id}
          >
            <div className="card-title-row">
              <h3>
                {item.title.trim() || t("Probelauf {0}", { 0: index + 1 })}
              </h3>
              <div className="reflection-actions no-print">
                {onChange && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setEditing(editable ? null : item.id)}
                  >
                    {t(editable ? "Fertig" : "Bearbeiten")}
                  </button>
                )}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => printWorksheet("reflection", item.id)}
                >
                  {t("Ergebnisblatt drucken")}
                </button>
              </div>
            </div>
            <p className="reflection-print-title">
              {t("Ergebnisblatt zum Probelauf")} · {title}
            </p>
            {editable && (
              <label className="no-print">
                {t("Gruppe oder Probelauf")}
                <input
                  autoFocus
                  value={item.title}
                  maxLength={120}
                  onChange={(e) => field(item, "title", e.target.value)}
                />
              </label>
            )}
            <dl className="reflection-fields">
              {Object.entries(reflectionFields).map(([key, label]) => {
                const text = t(label);
                return (
                  <div key={key}>
                    <dt className={editable ? "print-card-copy" : ""}>
                      {text}
                    </dt>
                    <dd className={editable ? "print-card-copy" : ""}>
                      {item[key] || "—"}
                    </dd>
                    {editable && (
                      <dd className="no-print">
                        <label>
                          {text}
                          <textarea
                            rows={2}
                            maxLength={4000}
                            value={item[key]}
                            onChange={(e) => field(item, key, e.target.value)}
                          />
                        </label>
                      </dd>
                    )}
                  </div>
                );
              })}
            </dl>
            {editable && (
              <button
                type="button"
                className="text-button no-print"
                onClick={() => {
                  if (!window.confirm(t("Dieses Ergebnisblatt löschen?")))
                    return;
                  onChange((current) =>
                    current.filter((row) => row.id !== item.id),
                  );
                  setEditing(null);
                }}
              >
                {t("Ergebnisblatt löschen")}
              </button>
            )}
          </section>
        );
      })}
    </section>
  );
}
