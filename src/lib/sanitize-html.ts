import DOMPurify from "isomorphic-dompurify";

const CONFIG = {

  ALLOWED_TAGS: [
    "a", "b", "i", "u", "em", "strong", "s", "strike", "sub", "sup",
    "p", "br", "hr", "span", "div",
    "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "pre", "code",
    "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
    "font",
  ],
  ALLOWED_ATTR: [
    "href", "target", "rel", "title",
    "src", "alt", "width", "height", "data-path",
    "style", "align", "color", "face", "size",
    "class",
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image\/):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "textarea"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "formaction"],
};

// Force safe defaults on links
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, CONFIG) as unknown as string;
}

