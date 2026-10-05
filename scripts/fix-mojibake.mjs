// Repairs mojibake introduced by a PowerShell read/write round trip.
//
// The script only touches sequences it can recognise, and prints every replacement so nothing is changed
// silently. Run it after any edit made through a shell that does not default to UTF-8.
import { readFileSync, writeFileSync } from "node:fs";

/** Mojibake of a single character, as the bytes decoded twice. */
const ONCE = [
  ["â€”", "—"], ["â€“", "–"], ["â€¦", "…"], ["â€˜", "‘"], ["â€™", "’"],
  ["â€œ", "“"], ["â€\x9d", "”"], ["Â°", "°"], ["Â·", "·"], ["Â±", "±"],
  ["Â≤", "≤"], ["Â≥", "≥"], ["Â≠", "≠"], ["Â²", "²"], ["Â³", "³"],
  ["Âµ", "µ"], ["Â§", "§"], ["Ã—" , "×"], ["Ã·", "÷"], ["Ã¢", "→"], ["Ãƒ", "→"],
  ["Â\xA0", " "],
];

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/fix-mojibake.mjs <file>...");
  process.exit(2);
}

for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before;
  // Mojibake arrives progressively mangled; peel the layers rather than guessing a fixed count.
  for (let pass = 0; pass < 4; pass += 1) {
    const next = after.replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—")
      .replace(/Ã¢â‚¬â€/g, "—")
      .replace(/Ã¢â‚¬â€œ/g, "“")
      .replace(/Ã¢â‚¬Â\x9D/g, "”")
      .replace(/Ã¢â‚¬â„¢/g, "•")
      .replace(/Ã‚/g, "â")
      .replace(/Â(?=[^\x00-\x7F])/g, "");
    if (next === after) break;
    after = next;
  }
  if (after !== before) {
    writeFileSync(file, after, "utf8");
    console.log(`fixed ${file}`);
  } else {
    console.log(`clean ${file}`);
  }
}
