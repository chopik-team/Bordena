import { useMemo } from "react"
import {
  parseMarkdown,
  renderMarkdown,
  useMarkdownRenderers,
} from "@bordena/markdown"
import { createWebAdapter } from "./adapter"
import { MarkdownRoot } from "./markdown-root"

interface IProps {
  children: string
  className?: string
  onToggleTask?: (index: number) => void
}

export function Markdown({ children, className, onToggleTask }: IProps) {
  // Attachment images and wikilinks need app data to resolve; see `renderers`.
  const renderers = useMarkdownRenderers()

  const tree = useMemo(() => parseMarkdown(children), [children])

  const content = useMemo(
    () => renderMarkdown(tree, createWebAdapter(renderers), { onToggleTask }),
    [tree, renderers, onToggleTask]
  )

  return <MarkdownRoot className={className}>{content}</MarkdownRoot>
}
