const fs = require("fs");
const t = fs.readFileSync("lib/teaching/scenarios.ts", "utf8");
const i = t.indexOf('    id: "atom",');
const j = t.indexOf('    id: "solar-system",');
console.log(t.slice(i, j));
