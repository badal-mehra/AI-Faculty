// FORMULA PRESENTATION.
//
// A real continuity lesson put this on the board:
//
//     \lim_{x \to a} f(x) = f(a)
//     \text{Bridge Analogy: No gaps allowed at } x = 0
//
// and a real RC lesson put this on the board:
//
//     RC \frac{dv}{dt} + v = V_s
//
// Both are correct mathematics and both are unreadable to the student they are meant to teach. A board is
// not a LaTeX renderer and adding one would be a second typesetting engine; what the board needs is a
// formula written the way a teacher writes one when there is no maths font:
//
//     lim(x→a) f(x) = f(a)
//     Bridge Analogy: No gaps allowed at x = 0
//     RC·(dv/dt) + v = Vₛ
//
// So this is a NORMALISER, not a renderer: it converts the notation the teacher writes into the notation a
// board can set in an ordinary font, and `lib/visual/layout.ts` still decides every position and size.
//
// It is a SCANNER rather than a chain of regular expressions, and that is not a style preference. Formula
// notation nests — `\frac{-b \pm \sqrt{b^2-4ac}}{2a}` puts a root inside a fraction inside a script — and
// every regex version of this mis-read the nesting, producing `(/ x{y}) ^ ²` for an ordinary power. A
// left-to-right reader that consumes one group at a time gets it right the first time.

/** LaTeX commands whose replacement is a symbol rather than a word. */
const SYMBOLS: Record<string, string> = {
  to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", leftrightarrow: "⇐",
  cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", ast: "∗", star: "∗",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", propto: "∝", sim: "∼",
  infty: "∞", partial: "∂", nabla: "∇", sum: "Σ", prod: "Π", int: "∫", oint: "∮", iint: "∬",
  forall: "∀", exists: "∃", in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩",
  emptyset: "∅", varnothing: "∅", aleph: "ℵ", hbar: "ℏ", ell: "ℓ", prime: "′",
  ldots: "…", dots: "…", cdots: "⋯", therefore: "∴", because: "∵", circ: "∘", deg: "°", bullet: "•",
  land: "∧", lor: "∨", neg: "¬", lnot: "¬", angle: "∠", perp: "⊥", parallel: "∥",
  pi: "π", theta: "θ", alpha: "α", beta: "β", gamma: "γ", delta: "δ", lambda: "λ", mu: "μ",
  sigma: "σ", phi: "φ", omega: "ω", epsilon: "ε", varepsilon: "ε", rho: "ρ", tau: "τ", eta: "η",
  zeta: "ζ", kappa: "κ", nu: "ν", psi: "ψ", varphi: "ϕ",
  Delta: "Δ", Sigma: "Σ", Omega: "Ω", Phi: "Φ", Lambda: "Λ", Gamma: "Γ", Pi: "Π", Theta: "Θ",
};

/** Commands that are words the teacher wants to read, or that mean nothing on a board. */
const WORDS: Record<string, string> = {
  text: "", mathrm: "", mathbf: "", mathit: "", mathsf: "", mathbb: "", mathcal: "", mathfrak: "",
  operatorname: "", lbrace: "{", rbrace: "}", lbrack: "[", rbrack: "]",
  lim: "lim", limsup: "lim sup", liminf: "lim inf", max: "max", min: "min", sup: "sup", inf: "inf",
  exp: "exp", ln: "ln", log: "log", sin: "sin", cos: "cos", tan: "tan", sec: "sec", csc: "csc",
  cot: "cot", sinh: "sinh", cosh: "cosh", tanh: "tanh", arcsin: "arcsin", arccos: "arccos",
  arctan: "arctan", arccot: "arccot", det: "det", dim: "dim", ker: "ker", gcd: "gcd", mod: "mod",
  lcm: "lcm", left: "", right: "", bigl: "", bigr: "", Bigl: "", Bigr: "", big: "", Big: "",
  bigm: "", Bigm: "", tfrac: "", dfrac: "", quad: " ", qquad: "  ",
};

/** Superscript characters, used only when every character of the run has one. */
const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};

/** Subscript characters, used only when every character of the run has one. */
const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ",
  s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

type Reader = { text: string; index: number };

function skipSpace(reader: Reader): void {
  while (reader.index < reader.text.length && /\s/.test(reader.text[reader.index] as string)) reader.index += 1;
}

/**
 * Reads one argument: a braced group (scanned recursively) or a single character.
 *
 * Reading a group this way is what keeps `\frac{\sqrt{x^2}}{2a}` honest — the numerator's root is consumed
 * inside the numerator, and the reader comes back outside it.
 */
function readArgument(reader: Reader): string {
  skipSpace(reader);
  // A parenthesised argument is as common as a braced one — `e^(-t/\tau)` is written more often than
  // `e^{-t/\tau}` — and reading only its opening bracket would leave the rest of the exponent as stray
  // literal text, which is how `e^(-t/τ)` became `e⁽ - t / τ))`.
  if (reader.text[reader.index] === "(") {
    const open = reader.index;
    let depth = 0;
    for (let index = open; index < reader.text.length; index += 1) {
      if (reader.text[index] === "(") depth += 1;
      else if (reader.text[index] === ")") {
        depth -= 1;
        if (depth === 0) {
          const body = reader.text.slice(open + 1, index);
          reader.index = index + 1;
          return scan(body);
        }
      }
    }
    const body = reader.text.slice(open + 1);
    reader.index = reader.text.length;
    return scan(body);
  }
  if (reader.text[reader.index] !== "{") {
    // `^\infty` and `_\text{src}` are commands in their own right: reading one character would consume
    // the backslash and leave "infty" as literal text on the board.
    if (reader.text[reader.index] === "\\") {
      const command = /^\\([a-zA-Z]+)/.exec(reader.text.slice(reader.index));
      if (command) {
        reader.index += command[0].length;
        const name = command[1] as string;
        return SYMBOLS[name] ?? WORDS[name] ?? name;
      }
    }
    const character = reader.text[reader.index];
    if (character === undefined) return "";
    reader.index += 1;
    return scan(character);
  }
  const open = reader.index;
  let depth = 0;
  for (let index = open; index < reader.text.length; index += 1) {
    if (reader.text[index] === "{") depth += 1;
    else if (reader.text[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = reader.text.slice(open + 1, index);
        reader.index = index + 1;
        return scan(body);
      }
    }
  }
  const body = reader.text.slice(open + 1);
  reader.index = reader.text.length;
  return scan(body);
}

/** A run becomes Unicode only when every character has a form; otherwise it stays parenthesised. */
function asScript(body: string, table: Record<string, string>): string {
  const characters = Array.from(body);
  if (characters.length === 0) return "";
  return characters.every((character) => table[character] !== undefined)
    ? characters.map((character) => table[character] as string).join("")
    : `(${body})`;
}

const needsBrackets = (value: string): boolean => value.length > 0 && /[\s+\-]/.test(value);

/** One left-to-right pass over a formula. */
function scan(input: string): string {
  const reader: Reader = { text: input, index: 0 };
  let out = "";
  while (reader.index < reader.text.length) {
    const character = reader.text[reader.index] as string;

    if (character === "\\") {
      const rest = reader.text.slice(reader.index + 1);
      const nameMatch = /^([a-zA-Z]+)/.exec(rest);
      if (!nameMatch) {
        // `\\` is a line break and `\{` an escaped brace; in both cases the backslash itself is noise.
        reader.index += 1 + (/^\\/.test(rest) ? 1 : 0);
        out += " ";
        continue;
      }
      const command = nameMatch[1] as string;
      reader.index += 1 + command.length;
      if (command === "frac" || command === "dfrac" || command === "tfrac") {
        const numerator = readArgument(reader);
        const denominator = readArgument(reader);
        const top = needsBrackets(numerator) ? `(${numerator})` : numerator;
        const bottom = needsBrackets(denominator) ? `(${denominator})` : denominator;
        out += `${top}/${bottom}`;
        continue;
      }
      if (command === "sqrt") {
        skipSpace(reader);
        let degree = "";
        if (reader.text[reader.index] === "[") {
          const close = reader.text.indexOf("]", reader.index);
          if (close > reader.index) {
            degree = scan(reader.text.slice(reader.index + 1, close));
            reader.index = close + 1;
          }
        }
        const radicand = readArgument(reader);
        const inside = needsBrackets(radicand) ? `(${radicand})` : radicand;
        out += degree === "" ? `√${inside}` : `√[${degree}]${inside}`;
        continue;
      }
      if (command === "begin" || command === "end") {
        skipSpace(reader);
        readArgument(reader);
        out += " ";
        continue;
      }
      if (SYMBOLS[command] !== undefined) { out += SYMBOLS[command] as string; continue; }
      if (WORDS[command] !== undefined) { out += WORDS[command] as string; continue; }
      // Unrecognised: keep the name. A stray word beats a silent gap in a formula.
      out += command;
      continue;
    }

    if (character === "^" || character === "_") {
      reader.index += 1;
      const body = readArgument(reader);
      out += character === "^" ? asScript(body, SUPERSCRIPT) : asScript(body, SUBSCRIPT);
      continue;
    }

    if (character === "{" || character === "}") { reader.index += 1; continue; }

    reader.index += 1;
    out += character;
  }
  return out;
}

/**
 * Converts one formula into board notation.
 *
 * `mathrm{d}` is the differential, not a letter `d` to be italicised, and `\,`/`\;`/`\quad` are spacing the
 * board produces itself.
 */
export function normaliseFormula(input: string): string {
  if (!input) return "";
  const prepared = String(input).replace(/\r/g, "").replace(/\\[a-zA-Z]+\s*&/g, " ").replace(/\\(?:,|;|:|!|quad|qquad)/g, " ");
  return tidy(scan(prepared));
}

/** Normalises a multi-line derivation, which arrives as one string with `\\` between lines. */
export function normaliseFormulaLines(input: string): string[] {
  return String(input)
    .split(/\\\\|\n/)
    .map((line) => normaliseFormula(line))
    .filter((line) => line.length > 0);
}

/**
 * Spacing a reader expects: no space inside brackets, one space either side of an operator.
 *
 * Only spacing is touched. By this point the notation has decided what it means, and a second pass that
 * "tidied" structure would be a second parser.
 */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*\[\s*/g, "[")
    .replace(/\s*\]\s*/g, "]")
    .replace(/\s*([=+\-<>±×·÷])\s*/g, " $1 ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
}

/** True when the text still contains markup an ordinary board font cannot set. */
export function hasUnrenderableMarkup(input: string): boolean {
  return /\\[a-zA-Z]+|[{}]/.test(input);
}