import React, { useLayoutEffect, useRef, useState } from "react";
import { Schema } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, toggleMark } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import {
  addListNodes,
  wrapInList,
  liftListItem,
  splitListItem,
} from "prosemirror-schema-list";
import { validCardText } from "../supabase/functions/_shared/card-text.js";

const baseSchema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      group: "block",
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
const schema = new Schema({
  nodes: addListNodes(
    baseSchema.spec.nodes.update("doc", { content: "block+" }),
    "paragraph block*",
    "block",
  ),
  marks: baseSchema.spec.marks,
});

function enclosingListName(state) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const name = $from.node(depth).type.name;
    if (name === "bullet_list" || name === "ordered_list")
      return { name, position: $from.before(depth) };
  }
  return null;
}

function toggleList(type) {
  return (state, dispatch) => {
    const list = enclosingListName(state);
    if (!list) return wrapInList(schema.nodes[type])(state, dispatch);
    if (list.name === type)
      return liftListItem(schema.nodes.list_item)(state, dispatch);
    if (dispatch)
      dispatch(state.tr.setNodeMarkup(list.position, schema.nodes[type]));
    return true;
  };
}

const commands = [
  ["strong", "Fett", toggleMark(schema.marks.strong)],
  ["em", "Kursiv", toggleMark(schema.marks.em)],
  ["bullet_list", "Aufzählung", toggleList("bullet_list")],
  ["ordered_list", "Nummerierte Liste", toggleList("ordered_list")],
  ["undo", "Rückgängig", undo],
  ["redo", "Wiederholen", redo],
];
const toolPaths = {
  strong: "M7 12h7a4 4 0 0 1 0 8H7V4h6a4 4 0 0 1 0 8",
  em: "M18 4h-8m4 0-4 16m4 0H6",
  bullet_list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  ordered_list:
    "M10 6h10M10 12h10M10 18h10M4 5l1-1v4m-1 0h2m-2 7a2 2 0 0 1 2 0c1 1.5-2 3-2 4h3",
  undo: "m9 14-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-2",
  redo: "m15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12h2",
};
export default function CardEditor({
  value,
  onChange,
  label,
  t,
  autoFocus = true,
}) {
  const host = useRef(null),
    view = useRef(null),
    callback = useRef(onChange);
  callback.current = onChange;
  const [toolbar, setToolbar] = useState({
    active: [],
    undo: false,
    redo: false,
  });
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
            Enter: splitListItem(schema.nodes.list_item),
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
        const marks = Object.values(schema.marks)
          .filter((mark) =>
            sel.empty
              ? mark.isInSet(state.storedMarks || sel.$from.marks())
              : state.doc.rangeHasMark(sel.from, sel.to, mark),
          )
          .map((mark) => mark.name);
        setToolbar({
          active: [...marks, enclosingListName(state)?.name],
          undo: undo(state),
          redo: redo(state),
        });
        if (tr.docChanged && state.doc !== tr.before)
          callback.current(state.doc.textContent ? state.doc.toJSON() : "");
      },
    });
    view.current = editor;
    if (autoFocus) editor.focus();
    return () => editor.destroy();
  }, []);
  return (
    <section className="card-editor no-print">
      <div
        className="editor-toolbar"
        role="group"
        aria-label={t("Textformatierung")}
      >
        {commands.map(([key, label, command]) => {
          const historyAction = key === "undo" || key === "redo";
          return (
            <button
              key={key}
              type="button"
              aria-label={t(label)}
              title={t(label)}
              aria-pressed={
                historyAction ? undefined : toolbar.active.includes(key)
              }
              disabled={historyAction && !toolbar[key]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const editor = view.current;
                command(editor.state, editor.dispatch);
                editor.focus();
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={toolPaths[key]} />
              </svg>
            </button>
          );
        })}
      </div>
      <section ref={host} />
    </section>
  );
}
