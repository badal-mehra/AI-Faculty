// REQUEST INTENT.
//
// The product is a TEACHER, so the first question a request has to answer is not "what should the
// model draw?" but "how much teaching does this student actually want?". That decision has to be made
// BEFORE any prompt is built, because it decides how many teaching stages the lesson is planned
// around, whether code belongs in the lesson at all, and whether one short answer is enough.
//
// Two rules drive everything here:
//   * DEEP IS THE DEFAULT. "Explain linked list." is a request for a lesson, not for a definition.
//     The student never has to add "in detail" to get a real lesson.
//   * AN EXPLICIT SHORT REQUEST IS ANSWERED BRIEFLY. "Define recursion in one sentence." is a
//     complete, explicit request for one sentence, and honouring it is not rudeness.
//
// Everything is derived from the request text with no model call, so the same question always plans
// the same lesson and the behaviour is testable.
//
// THE SUBJECT comes from the hierarchical taxonomy in `taxonomy.ts`, not from the keyword table further
// down: a topic is resolved to domain -> subdomain and then DERIVED onto the eleven coarse subjects the
// objective, asset and structure layers are keyed on. The keyword table survives only as a fallback for
// topics the taxonomy cannot place.
import { classifyDomain, type DomainDecision, type TeachingDomainId } from "./taxonomy";

/** The domain the classifier returns when nothing distinctive matched: a topic with no subject yet. */
const UNPLACED_DOMAIN: TeachingDomainId = "general-academic";

export type TeachingDepth = "deep" | "brief";

export type TeachingSubject =
  | "programming"
  | "networking"
  | "biology"
  | "physics"
  | "chemistry"
  | "mathematics"
  | "astronomy"
  | "engineering"
  | "computer-science"
  | "humanities"
  | "general";

// Ordered by how specific the subject is; the highest total keyword weight wins, so "binary search
// in C++" resolves to programming while "binary search" alone resolves to computer science.
//
// ENGINEERING is its own subject rather than a corner of physics, because it teaches in a different
// order: a physical situation, then the components and variables, then the governing law, then why that
// law applies, then a model and a calculation. An RC circuit resolved to `physics` got a lesson about
// forces; a resistor divider is not a free-body diagram.
// The mathematical vocabulary is the SUBJECT BOUNDARY, not decoration.
//
// Continuity, limits, the chain rule and the rest are what "this is mathematics" means, and without them
// a continuity problem classified as `general` â€” which is how one reached the renderer with runtime
// errors and an O(1) cost estimate, because "function" was the only word the classifier recognised.
//
// Only strongly mathematical terms are listed. The ambiguous ones â€” "graph", "range", "domain", "vector",
// "series", "minimum", "maximum", "set" â€” are deliberately absent: they are everyday words in physics,
// biology and engineering, and one of them deciding the subject is the exact contamination being fixed.
const MATHEMATICS_KEYWORDS = [
  "algebra", "geometry", "theorem", "proof", "lemma", "corollary", "calculus",
  "derivative", "differentiate", "differential", "integral", "integrate", "integration", "antiderivative",
  "limit", "limits", "continuity", "continuous", "asymptote", "asymptotic", "implicit", "parametric",
  "riemann", "mean value", "intermediate value", "chain rule", "product rule", "quotient rule",
  "fundamental theorem", "partial derivative", "taylor", "series expansion", "convergence",
  "matrix", "matrices", "determinant", "eigenvalue", "eigenvector", "diagonalis", "diagonaliz",
  "vector space", "dot product", "cross product", "basis", "span", "linear transformation",
  "probability", "permutation", "factorial", "combination", "binomial", "expected value", "variance",
  "polynomial", "inequality", "inequalities", "radical", "exponent", "modulo", "gcd", "lcm",
  "trigonometry", "trigonometric", "sine", "cosine", "tangent", "pythagorean", "logarithm",
  "arithmetic sequence", "geometric sequence", "closed form", "recurrence", "summation", "sum from",
] as const;

const SUBJECT_KEYWORDS: Array<{ subject: TeachingSubject; keywords: readonly string[] }> = [
  { subject: "programming", keywords: ["c++", "cpp", "java", "python", "javascript", "typescript", "rust", "kotlin", "swift", "linked list", "doubly linked", "binary search tree", "recursion", "recursive", "data structure", "stack", "queue", "pointer", "pointers", "array", "arrays", "hash table", "sorting algorithm", "big o", "time complexity", "oop", "polymorphism", "inheritance", "algorithm", "algorithms", "syntax", "compile", "compiler", "struct"] },
  { subject: "networking", keywords: ["tcp", "udp", "handshake", "three-way", "3-way", "syn-ack", "packet", "packets", "ip address", "dns", "http", "https", "network", "socket", "router", "latency", "bandwidth", "port number", "firewall", "ethernet", "lan", "server", "client"] },
  { subject: "biology", keywords: ["photosynthesis", "chloroplast", "chlorophyll", "leaf", "leaves", "plant", "plants", "heart", "blood", "lungs", "brain", "cell", "cells", "organelle", "mitochondria", "mitochondrion", "nucleus", "dna", "enzyme", "protein", "organ", "organs", "stomach", "kidney", "neuron", "alveoli", "respiration", "stomata", "glucose", "bacteria", "tissue", "tissues"] },
  { subject: "engineering", keywords: ["circuit", "circuits", "resistor", "capacitor", "inductor", "impedance", "ohm's law", "kirchhoff", "transient", "voltage divider", "current divider", "transistor", "diode", "op amp", "op-amp", "mosfet", "amplifier", "feedback", "control system", "thermodynamic cycle", "heat engine", "refrigeration", "control theory", "signal processing", "modulation", "power supply", "pcb", "semiconductor", "microcontroller"] },
  { subject: "physics", keywords: ["pendulum", "oscillation", "newton", "force", "velocity", "acceleration", "momentum", "gravity", "energy", "friction", "magnet", "wave", "wavelength", "frequency", "thermodynamics", "kinematics", "harmonic", "projectile"] },
  { subject: "chemistry", keywords: ["atom", "atoms", "electron", "electrons", "proton", "neutron", "orbital", "molecule", "molecules", "reaction", "acid", "base", "ph", "bond", "periodic table", "isotope", "catalyst", "oxidation"] },
  { subject: "mathematics", keywords: [...MATHEMATICS_KEYWORDS, "equation", "formula for", "area of", "volume of", "perimeter", "triangle", "circle", "cylinder", "∫"] },
  { subject: "astronomy", keywords: ["solar system", "planet", "planets", "sun", "moon", "orbit", "orbiting", "galaxy", "star", "stars", "solar", "mercury", "venus", "mars", "jupiter", "saturn", "nebula", "telescope", "universe"] },
  { subject: "computer-science", keywords: ["computer science", "algorithm", "data structure", "ram", "rom", "memory", "cpu", "operating system", "database", "sql", "compilation", "encryption", "hashing", "binary search", "sorting", "complexity", "big-o"] },
  { subject: "humanities", keywords: ["history", "historical", "war", "empire", "revolution", "civilization", "philosophy", "philosophical", "literature", "novel", "poem", "geography", "economy", "economics", "democracy", "constitution"] },
];

// An explicit, unambiguous request for a SHORT answer. A bare "what is RAM?" is deliberately NOT in
// this list: section 1 of the product requirement says teaching deeply is the default, and only an
// EXPLICIT short request is answered briefly.
const EXPLICIT_SHORT_PATTERNS: RegExp[] = [
  /\b(?:in|within) (?:one|a single|1) (?:sentence|line|word|phrase|paragraph)s?\b/i,
  /\bone[- ]?liners?\b/i,
  /\b(?:one|two|1|2) (?:lines?|words?)\b/i,
  /\bbriefly\b/i,
  /\bin short\b/i,
  /\bshort (?:answer|version|form|summar[yz]y)\b/i,
  /\btl;?dr\b/i,
  /\b(?:just|only) (?:the )?(?:formula|definition|answer|meaning)\b/i,
  /\b(?:give|state|tell) (?:me )?the formula\b/i,
  /\bformula for\b/i,
  /\bdefinition of\b/i,
  /\bwhat does\b[\s\S]{0,60}\bmean\b/i,
  /\bmeaning of\b/i,
  /\bin (?:just )?(?:2|3|4|5|one|two|three|four|five) (?:bullets?|points?|lines?)\b/i,
];

// An explicit request for a DEEP lesson always wins over a short-answer pattern, because "define
// recursion in detail" is contradictory and the student's explicit depth request is the real one.
const DEEP_PATTERNS: RegExp[] = [
  /\bin (?:full |complete )?detail\b/i,
  /\bdeeply\b/i,
  /\bfrom scratch\b/i,
  /\bstep[- ]by[- ]step\b/i,
  /\bvery (?:detailed|thorough|deep)\b/i,
  /\bthoroughly\b/i,
];

// Instructions that wrap the actual topic: the topic is what is left once these are removed.
const LEAD_INSTRUCTIONS: RegExp[] = [
  /^(?:please\s+)?(?:can you|could you|would you)\s+/i,
  /^(?:please\s+)?(?:i want you to|i'd like you to|help me)\s+/i,
  /^teach me (?:about )?/i,
  /^teach\s+/i,
  /^walk me through\s+/i,
  /^break (?:it )?down\s+/i,
  /^explain (?:to me )?/i,
  // The SOLVE family. "Solve âˆ« xÂ² sin(x) dx" is a lesson request, and without these the topic became
  // the whole sentence â€” which is what made the lesson title, the asset search and the prerequisite all
  // look at "Solve âˆ« xÂ² sin(x) dx and explain whyâ€¦" instead of at integration by parts.
  /^solve (?:for )?(?:me )?(?:this|these|the)?\s*/i,
  /^(?:work out|evaluate|calculate|compute|determine|find)\s+/i,
  /^(?:analyse|analyze|derive|show|prove|demonstrate)\s+/i,
  /^explain (?:to me )?/i,
  /^describe\s+/i,
  /^discuss\s+/i,
  /^tell me about\s+/i,
  /^what is the meaning of\s+/i,
  /^what does\s+/i,
  /^what's\s+/i,
  /^what are\s+/i,
  /^what is\s+/i,
  /^how does\s+/i,
  /^how do(?:es)?\s+/i,
  /^how to\s+/i,
  /^why (?:is|are|do|does)\s+/i,
  /^define\s+/i,
  /^intro(?:duce)?\s+/i,
  /^overview of\s+/i,
];

// Modifiers that describe HOW MUCH teaching is wanted, never WHAT the topic is.
const DEPTH_MODIFIERS: RegExp[] = [
  /\bfrom scratch\b/gi,
  /\bstep[- ]by[- ]step\b/gi,
  /\bin detail\b/gi,
  /\bin full detail\b/gi,
  /\bdeeply\b/gi,
  /\bdetailed\b/gi,
  /\bthorough(?:ly)?\b/gi,
  /\bfor beginners?\b/gi,
  /\bbeginner[- ]friendly\b/gi,
  /\bcomplete(?:ly)?\b/gi,
  /\beverything about\b/gi,
  /\bin full\b/gi,
  /\bwith examples?\b/gi,
  /\bwith (?:a )?visuals?\b/gi,
  /\bwith diagrams?\b/gi,
  /\bwith pictures?\b/gi,
  /\band examples?\b/gi,
  /\bfrom the basics\b/gi,
  /\bas a beginner\b/gi,
  /\bfor a beginner\b/gi,
  /\bnotes?\b/gi,
];

// "c++" is matched before the bare "c" alternative, and neither is anchored with a trailing \b:
// "+" is not a word character, so "\b" after "c++" would never match.
const LANGUAGE_PATTERN = /(c\+\+|c sharp|java|python|javascript|typescript|rust|kotlin|swift|ruby|php|golang|go language|sql|matlab|assembly|pascal|\bc\b)/i;

/**
 * Words that suggest programming on their own â€” and must not.
 *
 * Every one of these is ordinary English in another subject. "function" is the central object of
 * calculus; "line" is geometry and an equation; "value", "result", "input", "output" and "return" appear
 * in half of physics. A real run showed exactly what that costs: a continuity problem came back with
 * "Runtime Error", "Cost: O(1)" and a call-stack diagram, because the question mentioned a function.
 *
 * These are therefore SOFT: they count only when the request is already about programs. A maths "function"
 * is not a programming function, a maths "limit" is not a runtime boundary, and a maths "variable" is not
 * a stack slot. The hard list below is what actually establishes the subject.
 */
const CODE_SOFT_HINTS: RegExp[] = [
  /\bfunction\b/i,
  /\bmethod\b/i,
  /\bvalue\b/i,
  /\binput\b/i,
  /\boutput\b/i,
  /\breturn\b/i,
  /\bline\b/i,
  /\bsolve\b/i,
  /\btrace\b/i,
  /\bwalk(?:ing)? (?:it |this |the \w+ )?through\b/i,
  /\bwrite (?:a|an|the)\b/i,
  /\bexample in\b/i,
];

const CODE_HINTS: RegExp[] = [
  /\bcode\b/i,
  /\bcoding\b/i,
  /\bprogram(?:me|ming)?\b/i,
  /\bimplement(?:ation|ing|s)?\b/i,
  /\bsyntax\b/i,
  /\bstruct\b/i,
  /\bclass\b/i,
  /\bsnippet\b/i,
  /\bpseudocode\b/i,
  /\bapi\b/i,
  /\bscript\b/i,
  LANGUAGE_PATTERN,
];

const stripAll = (text: string, patterns: RegExp[]): string =>
  patterns.reduce((acc, pattern) => acc.replace(pattern, " "), text);

/** Strips wrapping instructions until the text stops changing, so "Explain what is X" also works. */
function stripLeadInstructions(text: string): string {
  let current = text.trim();
  for (let pass = 0; pass < 4; pass += 1) {
    const before = current;
    for (const pattern of LEAD_INSTRUCTIONS) current = current.replace(pattern, "").trim();
    if (current === before) break;
  }
  return current;
}

export type TeachingIntent = {
  /** The normalised topic: "linked list" for "Explain linked list in C++ from scratch.". */
  topic: string;
  /** The original request, unmodified. */
  question: string;
  subject: TeachingSubject;
  depth: TeachingDepth;
  /** True only when the student EXPLICITLY asked for a short answer. */
  explicitShort: boolean;
  /** True when code belongs in this lesson. */
  codeRelevant: boolean;
  /** The programming language named in the request, when one was ("C++"). */
  codeLanguage?: string;
  /** The teaching domain the hierarchy resolved, e.g. "design" or "electrical-electronics". */
  domain: TeachingDomainId;
  /** The subdomain within that domain, e.g. "design-thinking" or "circuits". */
  subdomain?: string;
  /** Other domains the same lesson legitimately touches, strongest first. */
  secondaryDomains: TeachingDomainId[];
};

/**
 * The legacy flat keyword scorer, kept ONLY as a fallback for topics the taxonomy cannot place.
 *
 * The taxonomy decides first because it reasons hierarchically and refuses to let a generic word decide:
 * this scorer still scores on raw substring length, which is exactly how "IDEO framework" became
 * computer-science. When the hierarchy has nothing distinctive to say, this scorer's answer is a better
 * guess than "general", so it is consulted — but never the other way round.
 */
function legacyDetectSubject(text: string): TeachingSubject {
  let best: TeachingSubject = "general";
  let bestScore = 0;
  for (const { subject, keywords } of SUBJECT_KEYWORDS) {
    // Substring matching is what makes "cells" find "cell", but it also double-counts: an earlier run
    // gave biology 4 + 5 for one word and beat programming's 5 for "array", so "an array of four cells"
    // was classified as a biology lesson and illustrated with a heart. A keyword that is contained in
    // another matched keyword for the SAME subject adds nothing — it is the same match, counted twice.
    const matched = keywords.filter((keyword) => text.includes(keyword));
    const distinct = matched.filter((keyword) => !matched.some((other) => other !== keyword && other.includes(keyword)));
    const score = distinct.reduce((total, keyword) => total + keyword.length, 0);
    if (score > bestScore) { best = subject; bestScore = score; }
  }
  return bestScore === 0 ? "general" : best;
}

function detectSubject(text: string, topic: string): { subject: TeachingSubject; decision: DomainDecision } {
  const decision = classifyDomain(topic, text);
  const subject = decision.primary.domain === UNPLACED_DOMAIN
    ? legacyDetectSubject(text)
    : decision.coarse;
  return { subject, decision };
}

/** "what is 2+2?" / "2 + 2 =" â€” pure arithmetic is never a lesson. */
function isArithmeticOnly(text: string): boolean {
  const candidate = text.toLowerCase()
    .replace(/^(?:what(?:'s| is|are)|calculate|compute|solve)\s+/i, "")
    .replace(/[?=]\s*$/, "");
  if (candidate.length === 0 || !/\d/.test(candidate)) return false;
  return /^[\d\s+\-*/%^().,]+$/.test(candidate) && /[+\-*/%^]/.test(candidate);
}

export function detectDepth(question: string): { depth: TeachingDepth; explicitShort: boolean } {
  if (DEEP_PATTERNS.some((pattern) => pattern.test(question))) return { depth: "deep", explicitShort: false };
  const askedShortly = EXPLICIT_SHORT_PATTERNS.some((pattern) => pattern.test(question))
    || /^\s*(?:define|definition of)\b/i.test(question)
    || isArithmeticOnly(question);
  return { depth: askedShortly ? "brief" : "deep", explicitShort: askedShortly };
}

export function extractTopic(question: string): { topic: string; codeLanguage?: string } {
  let text = question.trim().replace(/[.?!]+$/, "");
  const languageMatch = LANGUAGE_PATTERN.exec(text);
  const codeLanguage = languageMatch ? (languageMatch[1] === "c" ? "C" : languageMatch[1]) : undefined;
  text = stripAll(text, DEPTH_MODIFIERS);
  if (codeLanguage) text = text.replace(LANGUAGE_PATTERN, " ");
  text = stripLeadInstructions(text);
  // Removing the language leaves a dangling connector ("linked list in"), which is not part of the topic.
  text = text.replace(/(?:\s|\b)(?:in|with|using|and|for|of|to)\s*$/i, "");
  text = text.replace(/^(?:about|on|regarding)\s+/i, "").replace(/[,:]\s*$/, "").trim();
  text = text.replace(/\s{2,}/g, " ").trim();
  if (text.length < 2) text = question.trim().replace(/[.?!]+$/, "");
  return { topic: text, ...(codeLanguage ? { codeLanguage } : {}) };
}

/**
 * Classifies one student request into the teaching decision the whole pipeline depends on:
 * what the topic is, how deep the lesson goes, and whether code belongs in it.
 */
export function classifyTeachingIntent(question: string): TeachingIntent {
  const text = question.trim();
  const lowered = text.toLowerCase();
  const { topic, codeLanguage } = extractTopic(text);
  const { subject, decision } = detectSubject(lowered, topic);
  const { depth, explicitShort } = detectDepth(text);
  // CODE BELONGS IN A LESSON ABOUT PROGRAMS.
  //
  // The subject is a strong semantic constraint, not a hint. A request that has already been classified
  // as mathematics, physics, chemistry, engineering or biology is asking about that subject, and adding a
  // code block, a runtime error and an O(1) cost to a continuity problem does not enrich it — it hides
  // the algebra behind a call stack. Soft hints are only consulted when the subject is genuinely open.
  const subjectAdmitsCode = subject === "programming" || subject === "computer-science" || subject === "general";
  const codeRelevant = subjectAdmitsCode
    && (subject === "programming" || CODE_HINTS.some((pattern) => pattern.test(text))
      || (subject === "computer-science" && CODE_SOFT_HINTS.some((pattern) => pattern.test(text))));
  return {
    topic,
    question: text,
    subject,
    depth,
    explicitShort,
    codeRelevant,
    domain: decision.primary.domain,
    ...(decision.primary.subdomain ? { subdomain: decision.primary.subdomain } : {}),
    secondaryDomains: decision.secondary.map((signal) => signal.domain),
    ...(codeLanguage ? { codeLanguage } : {}),
  };
}