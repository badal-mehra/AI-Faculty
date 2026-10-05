// Which keyword made the classifier choose programming? Prints the matches per question so a
// misclassification can be read rather than guessed at.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { classifyTeachingIntent } = require("../.test-out/lib/teaching/intent.js");

const src = readFileSync("./.test-out/lib/teaching/intent.js", "utf8");
const groups = [...src.matchAll(/subject: "(\w[\w-]*)", keywords: \[([^\]]*)\]/g)].map((match) => ({
  subject: match[1],
  keywords: match[2].split(",").map((entry) => entry.trim().replace(/^["']|["']$/g, "")).filter(Boolean),
}));

const questions = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ["What is a function?", "Find the limit of f(x) as x approaches 0, where f is a function."];
for (const question of questions) {
  const text = question.toLowerCase();
  const matches = groups
    .map((group) => ({ subject: group.subject, hits: group.keywords.filter((keyword) => text.includes(keyword)) }))
    .filter((group) => group.hits.length > 0);
  console.log(JSON.stringify(question.slice(0, 46)), "->", classifyTeachingIntent(question).subject);
  for (const match of matches) console.log("   ", match.subject, match.hits.join(","));
}
