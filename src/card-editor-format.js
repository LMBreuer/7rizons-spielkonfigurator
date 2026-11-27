import MarkdownIt from "markdown-it";
import { Schema } from "prosemirror-model";
import {
  MarkdownParser,
  MarkdownSerializer,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import { addListNodes } from "prosemirror-schema-list";
import { validCardText } from "../supabase/functions/_shared/card-text.js";

const base = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "inline*",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    heading: {
      group: "block",
      content: "inline*",
      defining: true,
      attrs: { level: { default: 2 } },
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
        tag: "h" + level,
        attrs: { level },
      })),
      toDOM: (node) => [
        "h" + node.attrs.level,
        {
          class: node.attrs.level <= 2 ? "card-heading" : "card-heading-small",
        },
        0,
      ],
    },
    horizontal_rule: {
      group: "block",
      parseDOM: [{ tag: "hr" }],
      toDOM: () => ["hr"],
    },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    },
    text: { group: "inline" },
  },
  marks: {
    strong: {
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
      toDOM: () => ["strong", 0],
    },
    em: {
      parseDOM: [{ tag: "em" }, { tag: "i" }],
      toDOM: () => ["em", 0],
    },
  },
});
export const cardEditorSchema = new Schema({
  nodes: addListNodes(base.spec.nodes, "paragraph block*", "block"),
  marks: base.spec.marks,
});

const tokenizer = new MarkdownIt("commonmark", { html: false }).disable([
  "autolink",
  "backticks",
  "blockquote",
  "code",
  "fence",
  "image",
  "link",
  "reference",
]);
const parser = new MarkdownParser(cardEditorSchema, tokenizer, {
  paragraph: { block: "paragraph" },
  list_item: { block: "list_item" },
  bullet_list: { block: "bullet_list" },
  ordered_list: {
    block: "ordered_list",
    getAttrs: (token) => ({ order: Number(token.attrGet("start")) || 1 }),
  },
  heading: {
    block: "heading",
    getAttrs: (token) => ({ level: Number(token.tag.slice(1)) }),
  },
  hr: { node: "horizontal_rule" },
  hardbreak: { node: "hard_break" },
  em: { mark: "em" },
  strong: { mark: "strong" },
});

export function parseCardMarkdown(text) {
  if (text.length > 40000) return null;
  const doc = parser.parse(text);
  return validCardText(doc.toJSON()) ? doc : null;
}

const serializer = new MarkdownSerializer(
  defaultMarkdownSerializer.nodes,
  defaultMarkdownSerializer.marks,
  { escapeExtraCharacters: /[<>]/g },
);
export function serializeCardMarkdown(doc) {
  return serializer.serialize(doc);
}

export function cardDocument(value) {
  if (typeof value !== "string") return cardEditorSchema.nodeFromJSON(value);
  const paragraphs = value
    .split("\n")
    .map((line) =>
      cardEditorSchema.node(
        "paragraph",
        null,
        line ? cardEditorSchema.text(line) : null,
      ),
    );
  return cardEditorSchema.node("doc", null, paragraphs);
}
