import React, { useRef, useState } from "react";
import {
  DEFAULT_CARD_COLOR,
  CARD_TYPE_LIMIT,
  worksheetCards,
} from "../supabase/functions/_shared/card-text.js";

import CardAnswer from "./RichCardText.jsx";
import CardGroupField from "./CardGroupField.jsx";

const cardPalette = [
  ["#2a6fb4", "Blau"],
  ["#1cb291", "Türkis"],
  ["#7f598b", "Violett"],
  ["#c84b50", "Rot"],
  ["#8c8c8c", "Grau"],
  ["#61bde4", "Hellblau"],
  ["#b08f23", "Gold"],
  ["#231f20", "Anthrazit"],
];

const CardEditor = React.lazy(() => import("./CardEditor.jsx"));

export function printWorksheet(mode, reflectionId) {
  const root = document.documentElement;
  const reflection =
    reflectionId && document.getElementById("reflection-" + reflectionId);
  if (mode) {
    root.dataset.print = mode;
    if (reflection) reflection.dataset.printSelected = "true";
    window.addEventListener(
      "afterprint",
      () => {
        delete root.dataset.print;
        if (reflection) delete reflection.dataset.printSelected;
      },
      { once: true },
    );
  } else delete root.dataset.print;
  window.print();
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

export default function WorksheetCards({
  cards,
  notes,
  mechanicId,
  defaultType,
  customType,
  onCardType,
  onCards,
  onNotes,
  t,
}) {
  const [openId, setOpenId] = useState(null);
  const [openNoteId, setOpenNoteId] = useState(null);
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
        color:
          current.findLast((card) => card.mechanismId === mechanicId)?.color ??
          DEFAULT_CARD_COLOR,
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
  function addNote(after) {
    const id = crypto.randomUUID();
    onNotes((current) => [
      ...current,
      { id, mechanismId: mechanicId, text: "", ...(after ? { after } : {}) },
    ]);
    setOpenNoteId(id);
  }
  function renderNotes(after) {
    return notes
      .filter((note) => note.after === after)
      .map((note) => (
        <div key={note.id} className="worksheet-free-note">
          <div className="card-title-row">
            <h4>{t("Notiz")}</h4>
            {onNotes && openNoteId !== note.id && (
              <button
                className="text-button no-print"
                type="button"
                onClick={() => setOpenNoteId(note.id)}
              >
                {t("Notiz bearbeiten")}
              </button>
            )}
          </div>
          {onNotes && openNoteId === note.id ? (
            <>
              <React.Suspense fallback={null}>
                <CardEditor
                  t={t}
                  label={t("Notiz")}
                  value={note.text}
                  onChange={(text) =>
                    onNotes((current) =>
                      current.map((item) =>
                        item.id === note.id ? { ...item, text } : item,
                      ),
                    )
                  }
                />
              </React.Suspense>
              <div className="card-answer print-card-copy">
                <CardAnswer value={note.text} />
              </div>
              <div className="card-edit-actions no-print">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    if (!window.confirm(t("Diese Notiz löschen?"))) return;
                    onNotes((current) =>
                      current.filter((item) => item.id !== note.id),
                    );
                    setOpenNoteId(null);
                  }}
                >
                  {t("Notiz löschen")}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setOpenNoteId(null)}
                >
                  {t("Fertig")}
                </button>
              </div>
            </>
          ) : (
            <div className="card-answer">
              <CardAnswer value={note.text} />
            </div>
          )}
        </div>
      ));
  }
  if (!onCards && !onNotes && !cards.length && !notes.length) return null;
  return (
    <div className="worksheet-cards">
      {onCardType && (
        <label className="worksheet-card-type no-print">
          {t("Kartentyp")}
          <input
            type="text"
            value={customType}
            placeholder={defaultType}
            maxLength={CARD_TYPE_LIMIT}
            onChange={(event) => onCardType(event.target.value)}
          />
        </label>
      )}
      {(customType || cards.length > 0) && (
        <p
          className={
            onCardType
              ? "worksheet-card-type-label print-notes"
              : "worksheet-card-type-label"
          }
        >
          <strong>{t("Kartentyp")}</strong> {customType || defaultType}
        </p>
      )}
      {renderNotes(undefined)}
      {cards.map((card) => {
        const editing = Boolean(onCards) && openId === card.id;
        const title = card.title.trim() || t("Spielkarte");
        const label = t("Karte bearbeiten") + " · " + title;
        return (
          <React.Fragment key={card.id}>
            <section
              className={editing ? "writing-card editing-card" : "writing-card"}
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
                      <fieldset className="card-color">
                        <legend>{t("Randfarbe")}</legend>
                        <div className="card-color-controls">
                          <input
                            type="color"
                            aria-label={t("Eigene Farbe wählen")}
                            value={card.color}
                            onChange={(e) => {
                              const color = e.target.value;
                              update(card.id, () => ({ color }));
                            }}
                          />
                          <div
                            className="card-color-palette"
                            role="group"
                            aria-label={t("7’rizons-Farben")}
                          >
                            {cardPalette.map(([color, name]) => (
                              <button
                                type="button"
                                key={color}
                                aria-label={t(name)}
                                title={t(name)}
                                aria-pressed={
                                  card.color.toLowerCase() === color
                                }
                                style={{ "--swatch": color }}
                                onClick={() =>
                                  update(card.id, () => ({ color }))
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </fieldset>
                    </div>
                    <CardGroupField
                      card={card}
                      onChange={(group) => update(card.id, () => ({ group }))}
                      t={t}
                    />
                    <div>
                      <span className="card-field-label">
                        {t("Kartentext")}
                      </span>
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
                              noteEditor.current?.querySelectorAll(
                                "textarea",
                              ) || [],
                            )
                              .at(-1)
                              ?.focus(),
                          );
                        }}
                      >
                        + {t("Notiz zur Karte")}
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
              {onNotes && !editing && (
                <button
                  type="button"
                  className="text-button no-print"
                  aria-label={t("Notiz zur Karte hinzufügen")}
                  onClick={() => addNote(card.id)}
                >
                  {t("Notiz zur Karte")}
                </button>
              )}
            </section>
            {renderNotes(card.id)}
          </React.Fragment>
        );
      })}
      <div className="actions no-print">
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
        {onNotes && (
          <button
            className="button secondary"
            type="button"
            onClick={() => addNote(cards.at(-1)?.id)}
          >
            + {t("Notiz hinzufügen")}
          </button>
        )}
      </div>
    </div>
  );
}
