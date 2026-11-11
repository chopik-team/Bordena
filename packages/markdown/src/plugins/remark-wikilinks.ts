import { WIKILINK_RE } from "../wikilink"

interface MdastNode {
  type: string
  value?: string
  children?: MdastNode[]
  data?: { hName?: string; hProperties?: Record<string, unknown> }
}

function link(target: string, alias?: string): MdastNode {
  return {
    type: "emphasis",
    data: {
      hName: "span",
      hProperties: {
        className: ["wikilink"],
        dataWikilink: target,
        ...(alias ? { dataWikilinkAlias: alias } : {}),
      },
    },
    // Only a fallback: a platform that draws its own chip ignores the child.
    children: [{ type: "text", value: alias ?? target }],
  }
}

// Splits a text value on `[[...]]` links, returning text nodes interleaved
// with link nodes.
function splitText(value: string): MdastNode[] {
  const nodes: MdastNode[] = []
  let last = 0
  for (const match of value.matchAll(WIKILINK_RE)) {
    const start = match.index ?? 0
    if (start > last)
      nodes.push({ type: "text", value: value.slice(last, start) })
    nodes.push(link(match[1].trim(), match[2]?.trim() || undefined))
    last = start + match[0].length
  }
  if (last < value.length)
    nodes.push({ type: "text", value: value.slice(last) })
  return nodes
}

function transform(node: MdastNode) {
  if (!node.children) return
  const out: MdastNode[] = []
  for (const child of node.children) {
    if (child.type === "text" && child.value && WIKILINK_RE.test(child.value)) {
      // `test` on a /g regex advances lastIndex; reset so the split sees the
      // whole value.
      WIKILINK_RE.lastIndex = 0
      out.push(...splitText(child.value))
    } else {
      transform(child)
      out.push(child)
    }
  }
  node.children = out
}

/**
 * Renders `[[target]]` as a wikilink
 */
export function remarkWikilinks() {
  return (tree: MdastNode) => transform(tree)
}
