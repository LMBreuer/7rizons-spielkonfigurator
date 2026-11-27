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
  if (node.type === "horizontal_rule") return <hr key={key} />;
  if (node.type === "hard_break") return <br key={key} />;
  const children =
    node.content?.map(render) ?? (node.type === "paragraph" ? <br /> : []);
  if (node.type === "doc") return children;
  if (node.type === "heading") {
    const large = node.attrs.level <= 2;
    const Tag = large ? "h5" : "h6";
    return (
      <Tag className={large ? "card-heading" : "card-heading-small"} key={key}>
        {children}
      </Tag>
    );
  }
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
