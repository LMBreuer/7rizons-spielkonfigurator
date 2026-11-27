import React, { useLayoutEffect, useRef, useState } from "react";
import { EditorState, Plugin, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, setBlockType, toggleMark } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import {
  wrapInList,
  liftListItem,
  splitListItem,
} from "prosemirror-schema-list";
import { validCardText } from "../supabase/functions/_shared/card-text.js";

import {
  cardEditorSchema as schema,
  cardDocument,
  parseCardMarkdown,
  serializeCardMarkdown,
} from "./card-editor-format.js";

const emptyDoc = schema.topNodeType.createAndFill();
const blockFormats = {
  paragraph: setBlockType(schema.nodes.paragraph),
  heading: setBlockType(schema.nodes.heading, { level: 2 }),
  small: setBlockType(schema.nodes.heading, { level: 3 }),
};

function insertDivider(state, dispatch) {
  if (!dispatch) return true;
  const tr = state.tr.replaceSelectionWith(
    schema.nodes.horizontal_rule.create(),
  );
  if (!tr.docChanged) return false;
  if (!tr.selection.$from.parent.isTextblock) {
    const after = tr.selection.to;
    tr.insert(after, schema.nodes.paragraph.create());
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
  }
  dispatch(tr.scrollIntoView());
  return true;
}

function insertHardBreak(state, dispatch) {
  if (dispatch)
    dispatch(
      state.tr
        .replaceSelectionWith(schema.nodes.hard_break.create())
        .scrollIntoView(),
    );
  return true;
}
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
  ["horizontal_rule", "Trennlinie einfügen", insertDivider],
  ["undo", "Rückgängig", undo],
  ["redo", "Wiederholen", redo],
];
const toolPaths = {
  strong: "M7 12h7a4 4 0 0 1 0 8H7V4h6a4 4 0 0 1 0 8",
  em: "M18 4h-8m4 0-4 16m4 0H6",
  bullet_list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  ordered_list:
    "M10 6h10M10 12h10M10 18h10M4 5l1-1v4m-1 0h2m-2 7a2 2 0 0 1 2 0c1 1.5-2 3-2 4h3",
  horizontal_rule: "M4 12h16",
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
    markdownField = useRef(null),
    callback = useRef(onChange);
  callback.current = onChange;
  const [markdown, setMarkdown] = useState(null);
  const [markdownError, setMarkdownError] = useState(false);
  const markdownMode = markdown !== null;
  const [toolbar, setToolbar] = useState({
    active: [],
    block: "paragraph",
    undo: false,
    redo: false,
  });
  useLayoutEffect(() => {
    const doc = cardDocument(value);
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
            "Shift-Enter": insertHardBreak,
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
        const parent = sel.$from.parent;
        setToolbar({
          active: [...marks, enclosingListName(state)?.name],
          block:
            parent.type === schema.nodes.heading
              ? parent.attrs.level <= 2
                ? "heading"
                : "small"
              : "paragraph",
          undo: undo(state),
          redo: redo(state),
        });
        if (tr.docChanged && state.doc !== tr.before)
          callback.current(state.doc.eq(emptyDoc) ? "" : state.doc.toJSON());
      },
    });
    view.current = editor;
    const parent = editor.state.selection.$from.parent;
    if (parent.type === schema.nodes.heading)
      setToolbar((current) => ({
        ...current,
        block: parent.attrs.level <= 2 ? "heading" : "small",
      }));
    if (autoFocus) editor.focus();
    return () => editor.destroy();
  }, []);
  function switchMode() {
    const editor = view.current;
    if (markdownMode) {
      setMarkdown(null);
      setMarkdownError(false);
      window.requestAnimationFrame(() => view.current?.focus());
    } else {
      setMarkdown(serializeCardMarkdown(editor.state.doc));
      window.requestAnimationFrame(() => markdownField.current?.focus());
    }
  }
  function updateMarkdown(raw) {
    const doc = parseCardMarkdown(raw);
    setMarkdownError(!doc);
    if (!doc) return;
    setMarkdown(raw);
    const editor = view.current;
    if (!editor.state.doc.eq(doc))
      editor.dispatch(
        editor.state.tr.replaceWith(
          0,
          editor.state.doc.content.size,
          doc.content,
        ),
      );
  }

  return (
    <section className="card-editor no-print">
      <div
        className="editor-toolbar"
        role="group"
        aria-label={t("Textformatierung")}
      >
        <div className="editor-modes">
          {!markdownMode && (
            <select
              className="editor-block-format"
              aria-label={t("Absatzformat")}
              value={toolbar.block}
              onChange={(event) => {
                const editor = view.current;
                blockFormats[event.target.value](editor.state, editor.dispatch);
                editor.focus();
              }}
            >
              <option value="paragraph">{t("Normaler Absatz")}</option>
              <option value="heading">{t("Überschrift")}</option>
              <option value="small">{t("Kleine Überschrift")}</option>
            </select>
          )}
          <button
            type="button"
            className="markdown-toggle"
            aria-pressed={markdownMode}
            onClick={switchMode}
          >
            {t("Markdown")}
          </button>
        </div>
        {!markdownMode && (
          <div className="editor-commands">
            {commands.map(([key, label, command]) => {
              const historyAction = key === "undo" || key === "redo";
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={t(label)}
                  title={t(label)}
                  aria-pressed={
                    historyAction || key === "horizontal_rule"
                      ? undefined
                      : toolbar.active.includes(key)
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
        )}
      </div>
      <section ref={host} hidden={markdownMode} />
      {markdownMode && (
        <>
          <textarea
            className="card-markdown"
            ref={markdownField}
            aria-label={t("{0} in Markdown", { 0: label })}
            value={markdown}
            rows={6}
            onChange={(event) => updateMarkdown(event.target.value)}
          />
          <p className="card-markdown-hint">
            {t(
              "Markdown für Überschriften, Fett, Kursiv, Listen und Trennlinien.",
            )}
          </p>
          {markdownError && (
            <p className="card-markdown-error" role="alert">
              {t(
                "Die Änderung überschreitet die erlaubte Textlänge oder Verschachtelung.",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
