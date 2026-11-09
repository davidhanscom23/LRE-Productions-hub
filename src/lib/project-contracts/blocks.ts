/**
 * Turns contract text into display blocks, shared by the signing page and the PDF.
 *
 * Writing a template (plain text, nothing to learn if you skip it):
 *   ## Heading            -> section heading
 *   Label | value         -> a row in a details table (consecutive lines make one table)
 *   - item                -> bullet
 *   (a) text  /  (i) text -> indented clause
 *   blank line            -> new paragraph
 * Older contracts without any of these still show: numbered ALL-CAPS lines are headings.
 */
export type ContractBlock =
  | { kind: "heading"; text: string }
  | { kind: "details"; rows: { label: string; value: string }[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "clause"; text: string }
  | { kind: "paragraph"; text: string };

const KV_RE = /^([^|]{1,32}?)\s+\|\s+(.+)$/;
const CLAUSE_RE = /^\(([a-z]{1,4}|[ivx]{1,5})\)\s/;

function legacyHeading(line: string): boolean {
  return /^[0-9]+\.\s+[A-Z][A-Z &/,'-]+$/.test(line) || (line === line.toUpperCase() && line.length < 60 && /[A-Z]{3}/.test(line));
}

export function parseContractBlocks(body: string): ContractBlock[] {
  const out: ContractBlock[] = [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "paragraph", text: para.join("\n") });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("## ") || legacyHeading(line)) {
      flush();
      out.push({ kind: "heading", text: line.replace(/^##\s+/, "") });
      continue;
    }
    const kv = KV_RE.exec(line);
    if (kv) {
      flush();
      const last = out[out.length - 1];
      const row = { label: kv[1].trim(), value: kv[2].trim() };
      if (last?.kind === "details") last.rows.push(row);
      else out.push({ kind: "details", rows: [row] });
      continue;
    }
    if (line.startsWith("- ")) {
      flush();
      const last = out[out.length - 1];
      const item = line.slice(2).trim();
      if (last?.kind === "bullets") last.items.push(item);
      else out.push({ kind: "bullets", items: [item] });
      continue;
    }
    if (CLAUSE_RE.test(line)) {
      flush();
      out.push({ kind: "clause", text: line });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}
