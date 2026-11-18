import React, { useRef, useState, useEffect } from "react";
import { LE, MK, conflicts } from "../supabase/functions/_shared/domain.js";
import {
  priorityOf,
  assignToLearning,
  orderedMechanisms,
} from "../supabase/functions/_shared/priority.js";
import { translate } from "../supabase/functions/_shared/translations.js";
export default function Priority({
  draft,
  onChange,
  onAnnounce,
  language = "de",
}) {
  const t = (s) => translate(s, language);
  const p = priorityOf(draft),
    [drag, setDrag] = useState(null),
    focus = useRef(null),
    container = useRef(null);
  useEffect(() => {
    if (focus.current) {
      (
        container.current?.querySelector(
          `[data-sort-id="${focus.current}"] .drag-handle`,
        ) ||
        container.current?.querySelector(
          `[data-base-id="${focus.current}"] input`,
        )
      )?.focus();
      focus.current = null;
    }
  }, [draft.priority]);
  const update = (next) => onChange((d) => ({ ...d, priority: next }));
  function move(kind, id, target, after = false) {
    const key = kind === "learning" ? "learningOrder" : "mechanismOrder";
    const a = [...p[key]],
      from = a.indexOf(id);
    if (from < 0 || id === target) return;
    a.splice(from, 1);
    let to = a.indexOf(target);
    if (to < 0) return;
    a.splice(to + (after ? 1 : 0), 0, id);
    focus.current = id;
    update({ ...p, [key]: a });
    onAnnounce(
      `${t((LE.find((l) => l.id === id) || MK.find((m) => m.id === id)).label)}: ${t("Position")} ${a.indexOf(id) + 1}.`,
    );
  }
  function arrow(kind, id, delta) {
    const a =
      kind === "learning"
        ? p.learningOrder.filter((l) =>
            p.mechanismOrder.some(
              (m) => assignToLearning(m, draft.learning) === l,
            ),
          )
        : p.mechanismOrder.filter(
            (m) =>
              assignToLearning(m, draft.learning) ===
              assignToLearning(id, draft.learning),
          );
    const target = a[a.indexOf(id) + delta];
    if (target) move(kind, id, target, delta > 0);
  }
  function handle(kind, id, label) {
    return (
      <button
        type="button"
        className="drag-handle"
        draggable
        aria-label={`${t(label)} – ${t("Priorität ändern")}`}
        title={t("Ziehen zum Sortieren; alternativ Pfeiltasten verwenden")}
        onKeyDown={(e) => {
          if (["ArrowUp", "ArrowDown"].includes(e.key)) {
            e.preventDefault();
            arrow(kind, id, e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.setData("text/plain", id);
          e.dataTransfer.effectAllowed = "move";
          setDrag({ kind, id });
        }}
        onDragEnd={() => setDrag(null)}
      >
        ⠿
      </button>
    );
  }
  function drop(kind, id) {
    return {
      onDragOver: (e) => {
        if (drag?.kind === kind) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      onDrop: (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (drag?.kind !== kind) return;
        if (
          kind === "mechanism" &&
          assignToLearning(drag.id, draft.learning) !==
            assignToLearning(id, draft.learning)
        )
          return;
        const r = e.currentTarget.getBoundingClientRect();
        move(kind, drag.id, id, e.clientY > r.top + r.height / 2);
        setDrag(null);
      },
    };
  }
  function toggle(id) {
    focus.current = id;
    const m = MK.find((m) => m.id === id),
      checked = p.finalSelection.includes(id);
    update({
      ...p,
      finalSelection: checked
        ? p.finalSelection.filter((x) => x !== id)
        : [...p.finalSelection, id],
      promoted:
        checked && m.basis ? p.promoted.filter((x) => x !== id) : p.promoted,
    });
  }
  const base = draft.mechanisms
    .map((id) => MK.find((m) => m.id === id))
    .filter((m) => m.basis && !m.pflicht && !p.promoted.includes(m.id));
  return (
    <section className="panel" ref={container}>
      <div className="section-title">
        <span className="eyebrow">04 · {t("Übersicht")}</span>
        <h2>{t("Schritt 4: Übersicht")}</h2>
        <p>
          {t(
            "Sortiere Mechaniken nach Priorität (Ziehen) und hake ab was in den Hack soll.",
          )}
        </p>
      </div>
      {conflicts({
        ...draft,
        mechanisms: orderedMechanisms(draft),
        priority: undefined,
      }).map((c) => (
        <div className="notice error" key={c}>
          {t(c)}
        </div>
      ))}
      <h3 className="section-divider">{t("Im Basisspiel vorhanden")}</h3>
      <p className="muted">
        {t(
          "Diese Mechaniken werden im Standardspiel bereits verwendet und müssen nicht oder nur minimal angepasst werden. Hake ab welche du für dein Seminar bewusst ansprechen oder anpassen willst. Aktivierte Mechaniken wandern in die Hauptanpassungen unten.",
        )}
      </p>
      <div className="base-mechanics">
        <div className="base-safety">
          <span aria-hidden="true">✓</span>
          <strong>{t("Safety-Rahmen")}</strong>
          <span>{t("CATS, X-Karte, Open Door")}</span>
          <span className="tag">{t("IMMER")}</span>
        </div>
        {base.map((m) => (
          <label className="base-mechanic" key={m.id} data-base-id={m.id}>
            <input
              type="checkbox"
              checked={false}
              onChange={() => {
                focus.current = m.id;
                update({
                  ...p,
                  promoted: [...p.promoted, m.id],
                  mechanismOrder: [m.id, ...p.mechanismOrder],
                  finalSelection: [...new Set([...p.finalSelection, m.id])],
                });
              }}
            />
            <strong>{t(m.label)}</strong>
            <span>{t(m.kurz)}</span>
            {m.kern && <span className="tag">{t("KERN")}</span>}
          </label>
        ))}
        {!base.length && (
          <p className="muted">
            {t(
              "Alle ausgewählten Basisspiel-Mechaniken wurden bereits verschoben.",
            )}
          </p>
        )}
      </div>
      <h3 className="section-divider">{t("Hauptanpassungen ↕ sortierbar")}</h3>
      <p className="muted">
        {t(
          "Ziehe Lernerlebnisse und Mechaniken um ihre Priorität zu ändern. Hake ab was in den Hack soll.",
        )}
      </p>
      {!p.mechanismOrder.length && (
        <p className="notice">
          {t(
            "Keine Hauptanpassungen. Aktiviere Basisspiel-Elemente oben oder gehe zurück zu Schritt 3.",
          )}
        </p>
      )}
      <div className="priority-groups">
        {p.learningOrder.map((leId) => {
          const le = LE.find((l) => l.id === leId);
          const ids = p.mechanismOrder.filter(
            (id) => assignToLearning(id, draft.learning) === leId,
          );
          if (!ids.length) return null;
          return (
            <section
              className={`priority-group ${le?.group === "wiss" ? "wiss" : ""}`}
              key={leId}
              data-sort-id={leId}
              {...drop("learning", leId)}
            >
              <div className="priority-group-heading">
                {handle("learning", leId, le?.label || leId)}
                <h4>
                  {le?.icon} {t(le?.label || leId)}
                </h4>
                <small>{t(le?.bloom || "")}</small>
                <div className="rank-buttons">
                  <button
                    aria-label={`${t(le?.label || leId)} ${t("nach oben")}`}
                    onClick={() => arrow("learning", leId, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`${t(le?.label || leId)} ${t("nach unten")}`}
                    onClick={() => arrow("learning", leId, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <ol className="priority-list">
                {ids.map((id, i) => {
                  const m = MK.find((m) => m.id === id);
                  return (
                    <li
                      key={id}
                      data-sort-id={id}
                      className={
                        p.finalSelection.includes(id) ? "included" : ""
                      }
                      {...drop("mechanism", id)}
                    >
                      {handle("mechanism", id, m.label)}
                      <label className="priority-check">
                        <input
                          type="checkbox"
                          checked={p.finalSelection.includes(id)}
                          onChange={() => toggle(id)}
                        />
                        <span>
                          <strong>{t(m.label)}</strong>
                          <small>{t(m.kurz)}</small>
                        </span>
                      </label>
                      {m.kern && <span className="tag">{t("KERN")}</span>}
                      {m.basis && <span className="tag">{t("BASIS")}</span>}
                      <div className="rank-buttons">
                        <button
                          disabled={i === 0}
                          aria-label={`${t(m.label)} ${t("nach oben")}`}
                          onClick={() => arrow("mechanism", id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          disabled={i === ids.length - 1}
                          aria-label={`${t(m.label)} ${t("nach unten")}`}
                          onClick={() => arrow("mechanism", id, 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
      <div className="priority-summary">
        <span>
          {t("Ausgewählt:")}{" "}
          <strong>
            {p.finalSelection.length} {t("Mechaniken")}
          </strong>
        </span>
        <span>
          {t("Hauptanpassungen:")}{" "}
          <strong>
            {
              p.mechanismOrder.filter((id) => p.finalSelection.includes(id))
                .length
            }
          </strong>
        </span>
      </div>
    </section>
  );
}
