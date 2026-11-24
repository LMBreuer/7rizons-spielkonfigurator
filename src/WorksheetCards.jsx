import React, { useRef, useState } from "react";
import {
  DEFAULT_CARD_COLOR,
  worksheetCards,
} from "../supabase/functions/_shared/card-text.js";

const CardEditor = React.lazy(() => import("./CardEditor.jsx"));

function CardAnswer({ value }) {
  if (typeof value === "string") return value;
  return value.content.map((p, i) => (
    <p key={i}>
      {(p.content || []).map((r, j) => {
        let text = r.text;
        for (const m of r.marks || [])
          text = React.createElement(m.type, null, text);
        return <React.Fragment key={j}>{text}</React.Fragment>;
      })}
      {!p.content && <br />}
    </p>
  ));
}

export function printWorksheet(cardsOnly = false) {
  const root = document.documentElement;
  if (cardsOnly) {
    root.dataset.print = "cards";
    window.addEventListener(
      "afterprint",
      () => {
        delete root.dataset.print;
      },
      { once: true },
    );
  } else delete root.dataset.print;
  window.print();
}

function longCard(card) {
  const text =
    typeof card.text === "string"
      ? card.text
      : card.text.content
          .map((p) => (p.content || []).map((run) => run.text).join(""))
          .join("\n");
  const estimatedLines = text
    .split("\n")
    .reduce(
      (lines, line) => lines + Math.max(1, Math.ceil(line.length / 31)),
      0,
    );
  return estimatedLines > 12 || card.title.length > 75;
}
export function PrintableCards({ result, mechanicName, t }) {
  const cards = worksheetCards(result);
  if (!cards.length) return null;
  return (
    <div className="card-print">
      {cards.map((card) => (
        <section
          key={card.id}
          className={
            longCard(card) ? "cutout-card extended-card" : "cutout-card"
          }
          style={{ "--card-color": card.color }}
        >
          {card.mechanismId && (
            <p className="cutout-mechanic">{mechanicName(card.mechanismId)}</p>
          )}
          <h2>{card.title.trim() || t("Spielkarte")}</h2>
          <div className="card-answer">
            <CardAnswer value={card.text} />
          </div>
        </section>
      ))}
    </div>
  );
}

function CardNotes({ notes, t }) {
  const visibleNotes = notes.filter((note) => note.trim());
  if (!visibleNotes.length) return null;
  return (
    <div className="saved-card-notes">
      <strong>{t("Notizen")}</strong>
      <ul>
        {visibleNotes.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

export default function WorksheetCards({ cards, mechanicId, onCards, t }) {
  const [openId, setOpenId] = useState(null);
  const addButton = useRef(null);
  const noteEditor = useRef(null);
  const editButtons = useRef(new Map());

  function addCard() {
    const id = crypto.randomUUID();
    onCards((current) => [
      ...current,
      {
        id,
        mechanismId: mechanicId,
        title: "",
        text: "",
        color: DEFAULT_CARD_COLOR,
        notes: [],
      },
    ]);
    setOpenId(id);
  }
  function update(id, updateCard) {
    onCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, ...updateCard(card) } : card,
      ),
    );
  }
  function closeCard(id) {
    setOpenId(null);
    requestAnimationFrame(() =>
      (editButtons.current.get(id) || addButton.current)?.focus(),
    );
  }
  if (!onCards && !cards.length) return null;

  return (
    <div className="worksheet-cards">
      {cards.map((card) => {
        const editing = Boolean(onCards) && openId === card.id;
        const title = card.title.trim() || t("Spielkarte");
        const label = t("Karte bearbeiten") + " · " + title;
        return (
          <section
            className={editing ? "writing-card editing-card" : "writing-card"}
            key={card.id}
            style={{ "--card-color": card.color }}
          >
            {editing ? (
              <>
                <div className="card-edit-form no-print">
                  <div className="card-edit-top">
                    <label>
                      {t("Kartentitel")}
                      <input
                        value={card.title}
                        maxLength={120}
                        autoFocus
                        onChange={(e) => {
                          const title = e.target.value;
                          update(card.id, () => ({ title }));
                        }}
                      />
                    </label>
                    <label className="card-color">
                      {t("Randfarbe")}
                      <input
                        type="color"
                        value={card.color}
                        onChange={(e) => {
                          const color = e.target.value;
                          update(card.id, () => ({ color }));
                        }}
                      />
                    </label>
                  </div>
                  <div>
                    <span className="card-field-label">{t("Kartentext")}</span>
                    <React.Suspense fallback={null}>
                      <CardEditor
                        t={t}
                        label={t("Kartentext")}
                        autoFocus={false}
                        value={card.text}
                        onChange={(text) => update(card.id, () => ({ text }))}
                      />
                    </React.Suspense>
                  </div>
                  <div className="card-notes-editor" ref={noteEditor}>
                    {card.notes.map((note, index) => (
                      <div key={index} className="card-note">
                        <label>
                          {t("Notiz {0}", { 0: index + 1 })}
                          <textarea
                            rows={2}
                            maxLength={4000}
                            value={note}
                            onChange={(e) => {
                              const value = e.target.value;
                              update(card.id, (previous) => ({
                                notes: previous.notes.map((text, i) =>
                                  i === index ? value : text,
                                ),
                              }));
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            update(card.id, (previous) => ({
                              notes: previous.notes.filter(
                                (_, i) => i !== index,
                              ),
                            }));
                            requestAnimationFrame(() => {
                              const form = noteEditor.current;
                              (
                                form?.querySelectorAll("textarea")[index] ||
                                form?.querySelector(":scope > button")
                              )?.focus();
                            });
                          }}
                        >
                          {t("Notiz {0} entfernen", { 0: index + 1 })}
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        update(card.id, (previous) => ({
                          notes: [...previous.notes, ""],
                        }));
                        requestAnimationFrame(() =>
                          Array.from(
                            noteEditor.current?.querySelectorAll("textarea") ||
                              [],
                          )
                            .at(-1)
                            ?.focus(),
                        );
                      }}
                    >
                      + {t("Notiz hinzufügen")}
                    </button>
                  </div>
                  <div className="card-edit-actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            t("Diese Spielkarte mit ihren Notizen löschen?"),
                          )
                        )
                          return;
                        onCards((current) =>
                          current.filter((item) => item.id !== card.id),
                        );
                        closeCard(card.id);
                      }}
                    >
                      {t("Karte löschen")}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => closeCard(card.id)}
                    >
                      {t("Fertig")}
                    </button>
                  </div>
                </div>
                <div className="print-card-copy">
                  <h4>{title}</h4>
                  <div className="card-answer">
                    <CardAnswer value={card.text} />
                  </div>
                  <CardNotes notes={card.notes} t={t} />
                </div>
              </>
            ) : (
              <>
                <div className="card-title-row">
                  <h4>{title}</h4>
                  {onCards && (
                    <button
                      type="button"
                      className="text-button no-print"
                      aria-label={label}
                      ref={(node) => {
                        if (node) editButtons.current.set(card.id, node);
                        else editButtons.current.delete(card.id);
                      }}
                      onClick={() => setOpenId(card.id)}
                    >
                      {t("Bearbeiten")}
                    </button>
                  )}
                </div>
                <div className="card-answer">
                  <CardAnswer value={card.text} />
                </div>
                <CardNotes notes={card.notes} t={t} />
              </>
            )}
          </section>
        );
      })}
      {onCards && (
        <button
          type="button"
          ref={addButton}
          className="button secondary add-card no-print"
          onClick={addCard}
        >
          + {t("Karte hinzufügen")}
        </button>
      )}
    </div>
  );
}
