/**
 * DETERMINISTIC SYNTAX HIGHLIGHTING.
 *
 * A regex/keyword table, not a parser: the board has to be able to colour an unfamiliar language
 * gracefully on the first frame, and a student learns far more from seeing `return` and `if` picked
 * out of a listing than from a perfect parse. Every token is assigned a SEMANTIC ROLE (keyword, string,
 * number, comment, function) and the theme decides the colour, so the same code reads the same way on
 * every subject's board.
 *
 * Indentation is preserved exactly. In most languages leading whitespace is the structure, so a
 * "tidy" highlighter that trims a line would quietly destroy the lesson.
 */

export type CodeTokenKind = "plain" | "keyword" | "type" | "string" | "number" | "comment" | "function" | "operator";

export type CodeToken = { text: string; kind: CodeTokenKind };

/** Keywords across the languages a teaching board actually shows. */
const KEYWORDS = new Set([
  // control flow
  "if", "else", "elif", "for", "while", "do", "switch", "case", "break", "continue", "return", "yield", "goto",
  // functions/modules
  "def", "class", "function", "func", "fn", "fun", "lambda", "import", "from", "as", "export", "default", "module", "package",
  // declarations
  "let", "const", "var", "static", "final", "public", "private", "protected", "extends", "implements", "interface", "struct", "enum", "trait",
  // types
  "int", "integer", "long", "short", "float", "double", "decimal", "char", "string", "str", "String", "boolean", "bool", "void", "byte",
  "auto", "new", "this", "self", "super", "null", "nil", "None", "undefined", "true", "false", "True", "False", "TRUE", "FALSE",
  // misc
  "new", "delete", "throw", "throws", "try", "catch", "except", "finally", "async", "await", "yield", "pass", "raise", "assert", "in", "of", "is", "not", "and", "or",
  // memory / systems words worth colouring in a data-structures lesson
  "malloc", "free", "calloc", "realloc", "sizeof", "struct", "typedef", "ptr", "ref", "sizeof", "public", "static", "void",
]);

/** Type-ish words that read as declarations rather than control flow. */
const TYPES = new Set([
  "int", "long", "short", "float", "double", "decimal", "char", "boolean", "bool", "void", "byte", "str", "String",
  "ArrayList", "List", "Map", "Set", "HashMap", "HashSet", "Queue", "Stack", "Deque", "Node", "TreeNode", "ListNode", "vector",
  "std", "System", "Math", "console", "printf", "cout", "println",
]);

/** Line comments, by marker. Ordered longest-first so `//` never eats a `/*`. */
const LINE_COMMENTS = ["//", "#", "--"];
const BLOCK_COMMENT = { open: "/*", close: "*/" };

const isWordStart = (character: string): boolean => /[A-Za-z_$]/.test(character);
const isWordPart = (character: string): boolean => /[A-Za-z0-9_$]/.test(character);

/**
 * Splits one line into coloured tokens.
 *
 * `inBlockComment` carries comment state across lines, so a `/* ... *&#47;` javadoc block colours every
 * line it spans instead of only its first line.
 */
export function highlightCodeLine(line: string, inBlockComment = false): { tokens: CodeToken[]; inBlockComment: boolean } {
  const tokens: CodeToken[] = [];
  let plain = "";
  let index = 0;
  const push = (text: string, kind: CodeTokenKind) => {
    if (text.length === 0) return;
    if (kind === "plain") plain += text;
    else {
      if (plain.length > 0) {
        tokens.push({ text: plain, kind: "plain" });
        plain = "";
      }
      tokens.push({ text, kind });
    }
  };

  while (index < line.length) {
    if (inBlockComment) {
      const end = line.indexOf(BLOCK_COMMENT.close, index);
      if (end === -1) {
        push(line.slice(index), "comment");
        return { tokens, inBlockComment: true };
      }
      push(line.slice(index, end + BLOCK_COMMENT.close.length), "comment");
      index = end + BLOCK_COMMENT.close.length;
      inBlockComment = false;
      continue;
    }

    if (line.startsWith(BLOCK_COMMENT.open, index)) {
      const end = line.indexOf(BLOCK_COMMENT.close, index + BLOCK_COMMENT.open.length);
      if (end === -1) {
        push(line.slice(index), "comment");
        return { tokens, inBlockComment: true };
      }
      push(line.slice(index, end + BLOCK_COMMENT.close.length), "comment");
      index = end + BLOCK_COMMENT.close.length;
      continue;
    }

    const marker = LINE_COMMENTS.find((candidate) => line.startsWith(candidate, index));
    // A `#` inside a string is a character, not a comment; string handling below consumes it first, so
    // only a `#` reached at token start counts.
    if (marker) {
      push(line.slice(index), "comment");
      return { tokens, inBlockComment: false };
    }

    const character = line[index];

    if (character === '"' || character === "'" || character === "`") {
      let end = index + 1;
      while (end < line.length) {
        if (line[end] === "\\") {
          end += 2;
          continue;
        }
        if (line[end] === character) {
          end += 1;
          break;
        }
        end += 1;
      }
      push(line.slice(index, Math.min(end, line.length)), "string");
      index = end;
      continue;
    }

    if (/[0-9]/.test(character) && !isWordPart(line[index - 1] ?? "")) {
      let end = index;
      while (end < line.length && /[0-9._xXbBoOa-fA-F]/.test(line[end])) end += 1;
      push(line.slice(index, end), "number");
      index = end;
      continue;
    }

    if (isWordStart(character)) {
      let end = index;
      while (end < line.length && isWordPart(line[end])) end += 1;
      const word = line.slice(index, end);
      const next = line[end];
      if (TYPES.has(word)) push(word, "type");
      else if (KEYWORDS.has(word)) push(word, "keyword");
      // `name(` is a call; `name:` at the start of a line is a label. Both read as a function to a
      // beginner and the colour is what makes the structure pop out of a wall of identifiers.
      else if (next === "(" || (next === ":" && line.slice(0, index).trim().length === 0)) push(word, "function");
      else if (next === ".") push(word, "type");
      else plain += word;
      index = end;
      continue;
    }

    if ("+-*/%=<>!&|^~?:".includes(character)) {
      push(character, "operator");
      index += 1;
      continue;
    }

    plain += character;
    index += 1;
  }

  // Accumulated plain text is flushed here, NOT through `push`: `push` with kind "plain" appends to the
  // accumulator, so calling it to emit the tail silently DROPPED everything after the last highlighted
  // token. Every line lost the code that followed its first operator.
  if (plain.length > 0) tokens.push({ text: plain, kind: "plain" });
  return { tokens, inBlockComment };
}

/** Highlights a whole listing, carrying block-comment state from line to line. */
export function highlightCode(lines: string[]): CodeToken[][] {
  const highlighted: CodeToken[][] = [];
  let inBlockComment = false;
  for (const line of lines) {
    const result = highlightCodeLine(line, inBlockComment);
    highlighted.push(result.tokens);
    inBlockComment = result.inBlockComment;
  }
  return highlighted;
}

/**
 * Whether a block of text is SOURCE CODE rather than a formula.
 *
 * Used to route the model's code through the code-block action instead of `write_formula`: a real
 * provider teaching a swap routine reaches for the only "verbatim block" action it was given, so
 * `write_formula` arrives containing `class Node { int val; Node left, right; }`. Detecting code is a
 * structural question — braces, semicolons, keywords, indentation — so it is answered here once.
 */
export function looksLikeCode(text: string): boolean {
  const body = String(text ?? "");
  if (!body.trim()) return false;
  const trimmed = body.split("\n").map((line) => line.trim()).filter(Boolean);
  if (trimmed.length === 0) return false;

  let score = 0;
  // Two or more distinct statement keywords, or a declaration keyword, is a strong signal.
  const keywords = body.match(/\b(if|else|for|while|return|def|class|function|var|let|const|int|float|double|void|public|private|static|new|import|struct|printf|console)\b/g) ?? [];
  const distinct = new Set(keywords);
  if (distinct.size >= 2) score += 2;
  if (/\b(def|class|function|struct|public|private|static|int|void|var|const|let)\b/.test(body)) score += 1;
  if (/[{};]\s*(\n|$)/.test(body) || /;\s*(\n|$)/.test(body)) score += 2;
  if (/[{}]/.test(body)) score += 1;
  if (/\)\s*\{/.test(body)) score += 1;
  if (/(^|\n)\s{2,}\S/.test(body)) score += 1;
  if (/(==|!=|<=|>=|=>|&&|\|\|)\s*/.test(body)) score += 1;
  // PSEUDOCODE. "for each element in list:" followed by an indented step has no braces, no semicolons
  // and often no second keyword, so it scores like a sentence of English. A header line ending in a
  // colon with an indented body underneath is the shape of an algorithm, not of prose.
  const lines = body.split("\n");
  if (lines.some((line, index) => /:\s*$/.test(line) && lines.slice(index + 1).some((next) => /^\s{2,}\S/.test(next)))) score += 2;
  if (/\b(push|pop|enqueue|dequeue|insert|delete|append|traverse|swap|advance|pointer|element)\b/i.test(body)) score += 1;
  // A maths expression is a formula even when it contains letters, so anything dominated by maths
  // symbols stays a formula.
  if (/[=+*/^]|\\frac|\\sqrt|\\sum|\\int/.test(body) && distinct.size < 2) score -= 2;
  return score >= 3;
}

/** A short, honest language label for the block header. */
export function codeLanguageLabel(language: string | undefined): string | undefined {
  const cleaned = (language ?? "").trim();
  if (!cleaned) return undefined;
  return cleaned.length <= 24 ? cleaned : cleaned.slice(0, 24);
}