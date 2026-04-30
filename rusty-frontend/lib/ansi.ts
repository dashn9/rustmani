export type AnsiSegment = { text: string; className: string };

type Style = {
  fg: number | null;
  bright: boolean;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
};

const FG: Record<number, string> = {
  30: "text-white/55",
  31: "text-[oklch(0.72_0.18_25)]",
  32: "text-[oklch(0.78_0.16_148)]",
  33: "text-[oklch(0.82_0.16_85)]",
  34: "text-[oklch(0.74_0.13_240)]",
  35: "text-[oklch(0.74_0.16_310)]",
  36: "text-[oklch(0.78_0.13_200)]",
  37: "text-white",
};

const FG_BRIGHT: Record<number, string> = {
  30: "text-white/70",
  31: "text-[oklch(0.78_0.20_25)]",
  32: "text-[oklch(0.85_0.18_148)]",
  33: "text-[oklch(0.88_0.18_85)]",
  34: "text-[oklch(0.80_0.15_240)]",
  35: "text-[oklch(0.80_0.18_310)]",
  36: "text-[oklch(0.85_0.15_200)]",
  37: "text-white",
};

const ANSI_RE = /\x1B\[([0-9;]*)m/g;

function freshStyle(): Style {
  return { fg: null, bright: false, bold: false, dim: false, italic: false, underline: false };
}

function applyCodes(style: Style, codes: number[]): Style {
  let s = style;
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    if (c === 0) s = freshStyle();
    else if (c === 1) s = { ...s, bold: true };
    else if (c === 2) s = { ...s, dim: true };
    else if (c === 3) s = { ...s, italic: true };
    else if (c === 4) s = { ...s, underline: true };
    else if (c === 22) s = { ...s, bold: false, dim: false };
    else if (c === 23) s = { ...s, italic: false };
    else if (c === 24) s = { ...s, underline: false };
    else if (c >= 30 && c <= 37) s = { ...s, fg: c, bright: false };
    else if (c >= 90 && c <= 97) s = { ...s, fg: c - 60, bright: true };
    else if (c === 39) s = { ...s, fg: null, bright: false };
  }
  return s;
}

function classFor(s: Style): string {
  const parts: string[] = [];
  if (s.fg != null) parts.push((s.bright ? FG_BRIGHT : FG)[s.fg] ?? "");
  if (s.bold) parts.push("font-bold");
  if (s.dim) parts.push("opacity-60");
  if (s.italic) parts.push("italic");
  if (s.underline) parts.push("underline");
  return parts.filter(Boolean).join(" ");
}

/**
 * Parses an ANSI-coded string into lines of styled segments. Style state is
 * carried across line breaks so a `[2m...[0m` pair that spans `\n` still works.
 */
export function parseAnsiLines(text: string): AnsiSegment[][] {
  const lines: AnsiSegment[][] = [[]];
  let style = freshStyle();
  let last = 0;

  function pushText(chunk: string) {
    if (!chunk) return;
    const cls = classFor(style);
    const parts = chunk.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]);
      const piece = parts[i];
      if (piece) lines[lines.length - 1].push({ text: piece, className: cls });
    }
  }

  ANSI_RE.lastIndex = 0;
  for (let m = ANSI_RE.exec(text); m !== null; m = ANSI_RE.exec(text)) {
    pushText(text.slice(last, m.index));
    const codes = m[1] === "" ? [0] : m[1].split(";").map((n) => parseInt(n, 10));
    style = applyCodes(style, codes);
    last = m.index + m[0].length;
  }
  pushText(text.slice(last));
  return lines;
}
