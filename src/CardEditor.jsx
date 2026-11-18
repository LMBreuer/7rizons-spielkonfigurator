import React, { useLayoutEffect, useRef, useState } from "react";
import { Schema } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { validCardText } from "../supabase/functions/_shared/card-text.js";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "text*",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    text: { inline: true },
  },
  marks: {
    strong: {
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
      toDOM: () => ["strong", 0],
    },
    em: { parseDOM: [{ tag: "em" }, { tag: "i" }], toDOM: () => ["em", 0] },
  },
});
export default function CardEditor({ value, onChange, label, t }) {
  const host = useRef(null),
    view = useRef(null),
    callback = useRef(onChange);
  callback.current = onChange;
  const [active, setActive] = useState([]);
  useLayoutEffect(() => {
    const doc =
      typeof value === "string"
        ? schema.node(
            "doc",
            null,
            value
              .split("\n")
              .map((line) =>
                schema.node("paragraph", null, line ? schema.text(line) : null),
              ),
          )
        : schema.nodeFromJSON(value);
    const editor = new EditorView(host.current, {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
      },
      state: EditorState.create({
        doc,
        plugins: [
          history(),
          keymap({
            "Mod-b": toggleMark(schema.marks.strong),
            "Mod-i": toggleMark(schema.marks.em),
            "Mod-z": undo,
            "Mod-Shift-z": redo,
            "Mod-y": redo,
          }),
          keymap(baseKeymap),
          new Plugin({
            filterTransaction: (tr) =>
              !tr.docChanged || validCardText(tr.doc.toJSON()),
          }),
        ],
      }),
      dispatchTransaction(tr) {
        const state = this.state.apply(tr);
        this.updateState(state);
        const sel = state.selection;
        setActive(
          Object.values(schema.marks)
            .filter((mark) =>
              sel.empty
                ? mark.isInSet(state.storedMarks || sel.$from.marks())
                : state.doc.rangeHasMark(sel.from, sel.to, mark),
            )
            .map((mark) => mark.name),
        );
        if (tr.docChanged && state.doc !== tr.before)
          callback.current(state.doc.textContent ? state.doc.toJSON() : "");
      },
    });
    view.current = editor;
    return () => editor.destroy();
  }, []);
  return (
    <section className="card-editor no-print">
      <div role="group" aria-label={t("Textformatierung")}>
        {[
          ["strong", "Fett"],
          ["em", "Kursiv"],
        ].map(([mark, name]) => (
          <button
            key={mark}
            type="button"
            aria-pressed={active.includes(mark)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const editor = view.current;
              toggleMark(schema.marks[mark])(editor.state, editor.dispatch);
              editor.focus();
            }}
          >
            {React.createElement(mark, null, t(name))}
          </button>
        ))}
      </div>
      <section ref={host} />
    </section>
  );
}
