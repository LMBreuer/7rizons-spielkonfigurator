import React from "react";

const tags = {
  paragraph: "p",
  bullet_list: "ul",
  ordered_list: "ol",
  list_item: "li",
};

function render(node, key) {
  if (node.type === "text") {
    let text = node.text;
    for (const mark of node.marks || [])
      text = React.createElement(mark.type, null, text);
    return <React.Fragment key={key}>{text}</React.Fragment>;
  }
  const children =
    node.content?.map(render) ?? (node.type === "paragraph" ? <br /> : []);
  if (node.type === "doc") return children;
  return React.createElement(
    tags[node.type],
    {
      key,
      ...(node.type === "ordered_list" ? { start: node.attrs?.order } : {}),
    },
    children,
  );
}

export default function RichCardText({ value }) {
  return typeof value === "string" ? value : render(value);
}
