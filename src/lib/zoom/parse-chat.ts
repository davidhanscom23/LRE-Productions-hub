export type ParsedChatLine = {
  ts_seconds: number;
  speaker: string;
  message: string;
};

function toSeconds(hms: string): number {
  const [h, m, s] = hms.split(":").map((n) => Number(n) || 0);
  return h * 3600 + m * 60 + s;
}

const URL_RE = /https?:\/\/[^\s<>()"']+/gi;

/**
 * Parse a Zoom saved-chat .txt into timestamped lines. Handles the common
 * formats:
 *   "00:05:12 From John Doe to Everyone:\n\tmessage"
 *   "00:05:12\tJohn Doe:\tmessage"
 *   "00:05:12 From John Doe : message"
 * Continuation lines (indented, no timestamp) append to the previous message.
 */
export function parseZoomChat(text: string): ParsedChatLine[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ParsedChatLine[] = [];
  const tsHead = /^(\d{1,2}:\d{2}:\d{2})[\s\t]+(.*)$/;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, " ").trimEnd();
    const head = line.match(tsHead);
    if (head) {
      const ts = toSeconds(head[1]);
      let rest = head[2].trim();
      // Strip a leading "From " and " to <target>" audience marker.
      rest = rest.replace(/^From\s+/i, "");
      let speaker = "";
      let message = "";

      const toIdx = rest.search(/\s+to\s+.+?\s*:/i);
      if (toIdx >= 0) {
        // "Name to Everyone: message"
        speaker = rest.slice(0, toIdx).trim();
        const afterColon = rest.slice(toIdx).replace(/^\s+to\s+.+?:\s*/i, "");
        message = afterColon.trim();
      } else {
        const colon = rest.indexOf(":");
        if (colon >= 0) {
          speaker = rest.slice(0, colon).trim();
          message = rest.slice(colon + 1).trim();
        } else {
          message = rest.trim();
        }
      }
      out.push({ ts_seconds: ts, speaker, message });
    } else if (out.length && line.trim()) {
      // Continuation of the previous message.
      out[out.length - 1].message =
        `${out[out.length - 1].message}\n${line.trim()}`.trim();
    }
  }

  return out.filter((l) => l.message);
}

/** Unique URLs found across all chat messages, in order of first appearance. */
export function extractChatUrls(lines: ParsedChatLine[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const l of lines) {
    const matches = l.message.match(URL_RE);
    if (!matches) continue;
    for (const m of matches) {
      const clean = m.replace(/[.,)]+$/, "");
      if (!seen.has(clean)) {
        seen.add(clean);
        urls.push(clean);
      }
    }
  }
  return urls;
}
