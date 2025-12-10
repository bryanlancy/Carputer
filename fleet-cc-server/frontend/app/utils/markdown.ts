/**
 * Simple markdown parser for basic text decorations
 * Supports: **bold**, *italic*, `code`, and line breaks
 */

export function parseMarkdown(text: string): string {
  if (!text) return ''

  let html = text

  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Process in order: code first (to avoid processing markdown inside code), then bold, then italic

  // Inline code: `code` (process first to avoid processing markdown inside code blocks)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bold: **text** or __text__ (process before italic to avoid conflicts)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Italic: *text* or _text_ (only if not part of bold)
  // Use a simpler approach: match single * or _ that aren't part of ** or __
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
  html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>')

  // Convert line breaks to <br>
  html = html.replace(/\n/g, '<br>')

  return html
}

