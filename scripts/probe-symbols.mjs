// Prints what the symbol-explainer makes of a formula and a sentence, for one case at a time.
// Used while building the pedagogical layer: "why did this not report an unexplained symbol" is not a
// question a test failure answers on its own.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { symbolsInFormula, speechExplainsSymbol, unexplainedSymbols } = require("../.test-out/lib/teaching/pedagogy.js");

const speech = "Newton's second law is F = ma and it is a very useful relationship in physics for motion problems.";
const declared = [
  { symbol: "F", meaning: "net force" },
  { symbol: "m", meaning: "mass" },
  { symbol: "a", meaning: "acceleration" },
];
console.log("symbols:", symbolsInFormula("F = ma").join(","));
for (const symbol of ["F", "m", "a"]) {
  console.log(`  ${symbol}: in speech=${speech.toLowerCase().includes(symbol.toLowerCase())} explains=${speechExplainsSymbol(speech, symbol)}`);
}
console.log("unexplained:", unexplainedSymbols({ formula: "F = ma", variables: declared }, speech).join(",") || "(none)");

const good = "Newton's second law is F = ma, where F is the net force, m is the mass and a is the acceleration it produces.";
console.log("good speech unexplained:", unexplainedSymbols({ formula: "F = ma", variables: declared }, good).join(",") || "(none)");

console.log("RC:", symbolsInFormula("V(t) = V0(1 - e^(-t/RC))").join(","));
console.log("int by parts:", symbolsInFormula("int u dv = uv - int v du").join(","));
console.log("sin:", symbolsInFormula("v = sin(x) + cos(x)").join(","));
