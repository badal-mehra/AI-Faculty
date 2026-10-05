// Reads real formulas off the board and prints what the board will actually show.
//
// The failure this exists to make visible: a continuity lesson put `\lim_{x \to a} f(x) = f(a)` and
// `\text{Bridge Analogy: No gaps allowed at } x = 0` on the screen verbatim. Correct mathematics,
// unreadable to the student it is meant to teach.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { normaliseFormula, hasUnrenderableMarkup } = require("../.test-out/lib/visual/formula.js");

const cases = [
  "\\lim_{x \\to a} f(x) = f(a)",
  "\\text{Bridge Analogy: No gaps allowed at } x = 0",
  "RC \\frac{dv}{dt}+v=V_s",
  "v(t) = V_s (1 - e^(-t/\\tau))",
  "F = ma",
  "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}",
  "\\sum_{n=1}^{\\infty} \\frac{1}{n^2}",
  "\\int_0^\\infty e^{-x} dx = 1",
  "\\left( \\frac{x}{y} \\right)^2",
  "\\nabla \\cdot E = \\frac{\\rho}{\\epsilon_0}",
];

for (const source of cases) {
  console.log(JSON.stringify(source).padEnd(48), "->", JSON.stringify(normaliseFormula(source)),
    hasUnrenderableMarkup(normaliseFormula(source)) ? "  <-- still has markup" : "");
}
