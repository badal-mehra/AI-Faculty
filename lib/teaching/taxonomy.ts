// THE TEACHING-DOMAIN CLASSIFIER.
//
// WHY THIS FILE EXISTS. The subject classifier used to be a flat list of eleven coarse labels driven by
// substring matching, and it got a real lesson wrong in a way no amount of keyword tuning fixes:
//
//   topic="IDEO framework"  ->  subject="computer-science"
//
// "IDEO" matched nothing, "framework" matched a computing term, and a lesson about how designers
// understand people was planned with a code block and a call stack in its vocabulary. That one wrong
// label then drove the prompt vocabulary, the visual representation policy, the structure policy, asset
// selection, the teaching language and the quality gate — so a single bad classification corrupted every
// downstream decision at once.
//
// THE FIX IS STRUCTURAL, NOT LEXICAL:
//
//   1. HIERARCHY. domain -> subdomain -> topic. "IDEO framework" names a subdomain (design/design-
//      thinking), and the subdomain is what a lesson is actually about.
//   2. CONTEXT. A generic word never decides a domain. "function", "prototype", "model", "network",
//      "process", "framework", "structure", "flow", "state", "method", "object", "class" and "loop" are
//      ordinary English across half the taxonomy; they are listed in GENERIC_TERMS and the index below
//      physically drops any vocabulary entry that appears there. What decides the domain is a DISTINCTIVE
//      term plus the SURROUNDING CONTEXT ("… in C++", "… in mathematics", "… in product design").
//   3. HEAD-NOUN RESOLUTION. English noun phrases put the head first: in "AI for medical diagnosis" the
//      head is "AI", so the primary domain is artificial-intelligence and medicine-healthcare is
//      secondary. This is what stops a tool's application from stealing a tool's lesson.
//   4. ONE PRIMARY, MANY SECONDARY. Overlap is real, so the classifier returns a ranked list and then
//      names exactly ONE primary domain for visual policy. A secondary domain never overrides the primary
//      unless the wording clearly changes subject.
//
// NOTHING HERE DECIDES A VISUAL. This module answers "what subject is this"; `visualPolicy.ts` answers
// "what may this subject be drawn with". Keeping them apart is what lets one be wrong without taking the
// other down, and it is why the coarse `TeachingSubject` (eleven values, keyed by the objective's teaching
// arcs) is preserved and DERIVED FROM this taxonomy rather than replaced by it.
import type { TeachingSubject } from "./intent";
import { DOMAIN_SPECS } from "./taxonomyData";
import type { DomainSpec, SubdomainSpec, TeachingDomainId } from "./taxonomyTypes";

export { TEACHING_DOMAIN_IDS, DOMAIN_SPECS } from "./taxonomyData";
export type { DomainSpec, SubdomainSpec, TeachingDomainId } from "./taxonomyTypes";

/**
 * WORDS THAT MUST NEVER DECIDE A DOMAIN ON THEIR OWN.
 *
 * Every one of these is the central noun of at least two domains. "function" is calculus and it is a C++
 * routine; "prototype" is product design and it is software engineering; "model" is a statistical model
 * and it is a 3D asset; "network" is the internet, a neural network and a fluid network. Exported so the
 * ban is a test rather than a promise.
 */
export const GENERIC_TERMS: ReadonlySet<string> = new Set([
  "function", "functions", "model", "models", "system", "systems", "network", "networks", "node", "nodes",
  "process", "processes", "prototype", "prototypes", "prototyping", "framework", "frameworks", "structure", "structures",
  "flow", "state", "states", "method", "methods", "object", "objects", "class", "classes", "loop", "loops",
  "value", "values", "type", "types", "unit", "units", "input", "output", "result", "results", "step",
  "steps", "stage", "stages", "data", "code", "tool", "tools", "level", "levels", "form", "forms",
  "concept", "concepts", "idea", "ideas", "test", "tests", "problem", "problems", "case", "cases",
]);

/**
 * A programming language, matched before anything else. It is the strongest context anchor there is:
 * "function in C++" and "function in mathematics" are the same noun in two different worlds.
 *
 * Exported so `intent.ts` extracts the language from the SAME pattern the classifier reasons about; two
 * copies of this list is how "in C++" ends up classified one way and displayed another. "c++" is tried
 * before bare "c", and neither is anchored with a trailing \b, because "+" is not a word character and \b
 * after it could never match.
 */
export const LANGUAGE_PATTERN =
  /(c\+\+|c sharp|java|python|javascript|typescript|rust|kotlin|swift|ruby|php|golang|go language|sql|matlab|assembly|pascal|\bc\b)/i;

/** STRONG code evidence: the request is about programs, not prose that happens to say "function". */
export const CODE_EVIDENCE: readonly RegExp[] = [
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
  /\bpointer\b/i,
  /\bpointers\b/i,
  /\bcompiler\b/i,
  /\bcompile\b/i,
  /\bdebug\b/i,
  LANGUAGE_PATTERN,
];

/**
 * SOFT code evidence: programming-ish only when the request is ALREADY about programs.
 *
 * "function", "method", "value", "input", "output", "return", "line", "trace" and "example in" are ordinary
 * English in physics, mathematics and engineering. A real continuity lesson came back with "Runtime Error",
 * "Cost: O(1)" and a call-stack diagram because the only word the old classifier recognised in "where f is
 * a function" was "function".
 */
export const SOFT_CODE_EVIDENCE: readonly RegExp[] = [
  /\breturn(?:s|ed|ing)?\b/i,
  /\bline\b/i,
  /\btrace\b/i,
  /\bexample in\b/i,
  /\bkeyword\b/i,
  /\barray\b/i,
  /\bvariable\b/i,
  /\bmethod\b/i,
  /\bpointer\b/i,
];

// --------------------------------------------------------------------------- Vocabulary index

type TermEntry = { term: string; domain: TeachingDomainId; subdomain: string | null };

const normalise = (value: string): string => value.toLowerCase().trim().replace(/\s+/g, " ");

const VOCABULARY: readonly TermEntry[] = (() => {
  const entries: TermEntry[] = [];
  const push = (values: readonly string[] | undefined, domain: TeachingDomainId, subdomain: string | null) => {
    for (const raw of values ?? []) {
      const term = normalise(raw);
      // The GENERIC_TERMS ban is enforced HERE, not trusted: a future edit cannot smuggle one back in.
      if (!term || GENERIC_TERMS.has(term)) continue;
      entries.push({ term, domain, subdomain });
    }
  };
  for (const domain of DOMAIN_SPECS) {
    push(domain.aliases, domain.id, null);
    push(domain.terms, domain.id, null);
    for (const subdomain of domain.subdomains) {
      push(subdomain.terms, domain.id, subdomain.id);
    }
  }
  return entries;
})();

/** Longest terms first, so "differential equation" is preferred over "equation". */
const VOCABULARY_BY_LENGTH: readonly TermEntry[] = [...VOCABULARY].sort((a, b) => b.term.length - a.term.length);

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word matcher for a multi-word term, built once and cached. */
const TERM_PATTERNS = new Map<string, RegExp>();
const patternFor = (term: string): RegExp => {
  let pattern = TERM_PATTERNS.get(term);
  if (!pattern) {
    pattern = new RegExp(`(?<![a-z0-9])${escapeForRegExp(term)}(?![a-z0-9])`, "i");
    TERM_PATTERNS.set(term, pattern);
  }
  return pattern;
};

// --------------------------------------------------------------------------- Types

export type DomainSignal = {
  domain: TeachingDomainId;
  subdomain: string | null;
  score: number;
  /** The distinctives that fired, for the log line and for the quality gate. */
  matched: string[];
};

export type DomainDecision = {
  /** Exactly one teaching domain. Everything downstream keys on this. */
  primary: DomainSignal;
  /** Ranked secondary domains, strongest first. May be empty. */
  secondary: DomainSignal[];
  /** The coarse subject derived from the primary domain, for the existing eleven-value union. */
  coarse: TeachingSubject;
  /** The topic phrase the classification was made from. */
  topic: string;
  /** True when a programming language or explicit code request made code representation legitimate. */
  codeIntent: boolean;
  /** Every distinct term that fired, in order of strength. */
  evidence: string[];
};

const DEFAULT_DOMAIN: TeachingDomainId = "general-academic";

// --------------------------------------------------------------------------- Helpers

/** Splits a topic into lowercase word tokens, keeping ASCII hyphens and apostrophes inside words. */
const tokensOf = (text: string): string[] => normalise(text).split(/[^a-z0-9'+-]+/).filter(Boolean);

/**
 * Whole-word matching only. Substring matching is what let "model" reach "mode" (a statistics term) and
 * "framework" reach a computing term, so a generic noun could still decide a subject through a shorter
 * neighbour. A distinctive term has to appear as a token, or as a whole phrase, or it does not count.
 */
function findTerm(text: string, entry: TermEntry): boolean {
  if (entry.term.includes(" ")) return patternFor(entry.term).test(text);
  return tokensOf(text).includes(entry.term);
}

/** A term that the topic STARTS WITH is the head noun phrase: "AI for medical diagnosis" heads on AI. */
function startsTopic(topic: string, term: string): boolean {
  if (!topic.startsWith(term)) return false;
  const next = topic.charAt(term.length);
  return next === "" || !/[a-z0-9]/.test(next);
}

/**
 * CONTEXT ANCHORS: "… in C++", "… in mathematics", "… in product design".
 *
 * This is the rule that fixes "function in mathematics" vs "function in C++". When a bare generic noun is
 * the whole topic, the phrase after the preposition decides the domain and the generic noun is ignored.
 */
const CONTEXT_ANCHOR = /\b(?:in|for|within|of|using|with)\s+([a-z0-9'+ -]{2,60})/gi;

function contextAnchors(text: string): string[] {
  const anchors: string[] = [];
  CONTEXT_ANCHOR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CONTEXT_ANCHOR.exec(text)) !== null) {
    anchors.push(normalise(match[1] ?? "").replace(/[.;,]+$/, ""));
  }
  return anchors.filter(Boolean);
}

/**
 * HEAD-NOUN RESOLUTION: in "AI for medical diagnosis" the head is "AI".
 *
 * The first phrase of a topic is what is being taught; everything introduced after "for", "in", "of" is the
 * context it is taught in. So a signal found in the head outranks an equal signal found in the tail.
 */
function headSegment(topic: string): string {
  const tokens = tokensOf(topic);
  const stop = new Set(["for", "in", "of", "within", "using", "with", "and", "the", "a", "an", "on", "to"]);
  const head: string[] = [];
  for (const token of tokens) {
    if (stop.has(token)) break;
    head.push(token);
  }
  return head.join(" ") || normalise(topic);
}

// --------------------------------------------------------------------------- Classification

/**
 * Classifies a teaching topic into one primary domain plus ranked secondaries.
 *
 * Scoring is deliberately simple and inspectable: a whole-word hit outranks a substring hit, a subdomain
 * term outranks a bare domain term, a hit in the head phrase outranks a hit in the tail, and a distinctive
 * term outranks a generic one (generic terms never enter the index at all).
 */
type Accumulator = {
  domain: TeachingDomainId;
  /** Every weight that fired, kept so the best subdomain and the total can be derived at the end. */
  hits: { subdomain: string | null; weight: number; term: string }[];
  /** Character offset of the earliest hit, used to break near-ties in favour of the head noun. */
  firstAt: number;
};

/**
 * MORPHOLOGICAL VARIANTS ARE THE SAME EVIDENCE.
 *
 * "cells" and "cell" are one match, not two. Counting both let biology reach 1.5 + 0.3x1.2 on "an array of
 * four cells holding 10, 20, 30 and 40" and beat computer-science's single "array" hit — which is precisely
 * how a data-structure question was illustrated with biological cells again, one layer deeper than before.
 */
function stemOf(term: string): string {
  if (term.length > 4 && term.endsWith("ies")) return `${term.slice(0, -3)}y`;
  if (term.length > 4 && term.endsWith("es")) return term.slice(0, -2);
  if (term.length > 3 && term.endsWith("s")) return term.slice(0, -1);
  return term;
}

function firstOffsetOf(text: string, term: string): number {
  if (term.includes(" ")) {
    const match = patternFor(term).exec(text);
    return match?.index ?? Number.MAX_SAFE_INTEGER;
  }
  const match = new RegExp(`(?<![a-z0-9])${escapeForRegExp(term)}(?![a-z0-9])`, "i").exec(text);
  return match?.index ?? Number.MAX_SAFE_INTEGER;
}

export function classifyDomain(topic: string, context?: string): DomainDecision {
  const haystack = normalise(`${topic} ${context ?? ""}`.trim());
  const head = headSegment(topic);
  const anchors = contextAnchors(normalise(topic));
  const evidence: string[] = [];
  const scores = new Map<TeachingDomainId, Accumulator>();

  const record = (entry: TermEntry, weight: number) => {
    const accumulator = scores.get(entry.domain) ?? {
      domain: entry.domain,
      hits: [],
      firstAt: Number.MAX_SAFE_INTEGER,
    };
    const stem = stemOf(entry.term);
    if (accumulator.hits.some((hit) => stemOf(hit.term) === stem)) return;
    accumulator.hits.push({ subdomain: entry.subdomain, weight, term: entry.term });
    accumulator.firstAt = Math.min(accumulator.firstAt, firstOffsetOf(haystack, entry.term));
    scores.set(entry.domain, accumulator);
    if (!evidence.includes(entry.term)) evidence.push(entry.term);
  };

  // 1. Terms anywhere in the request. Whole-word only; the head noun phrase of the topic scores highest.
  for (const entry of VOCABULARY_BY_LENGTH) {
    if (!findTerm(haystack, entry)) continue;
    const inHead = entry.term.includes(" ") ? patternFor(entry.term).test(head) : head.includes(entry.term);
    const isPrefix = startsTopic(normalise(topic), entry.term);
    const lengthBoost = Math.min(entry.term.length, 18) / 10;
    record(entry, 2 * lengthBoost * (isPrefix ? 1.8 : inHead ? 1.5 : 1));
  }

  /**
   * 2. Context anchors: the phrase after "in", "for", "of", "within", "using", "with".
   *
   * These are deliberately WEAK. Their job is to rescue a topic whose head is a banned generic noun —
   * "prototype in product design", "function in C++" — where nothing else fires at all. They must not
   * outvote a real distinctive reading of the head, or "AI for medical diagnosis" would be classified by
   * its application (medicine) instead of its subject (AI).
   */
  for (const anchor of anchors) {
    for (const entry of VOCABULARY_BY_LENGTH) {
      if (!findTerm(anchor, entry)) continue;
      const lengthBoost = Math.min(entry.term.length, 18) / 10;
      record(entry, 0.6 * lengthBoost);
    }
  }

  /**
   * DIMINISHING RETURNS, plus ONE subdomain per domain.
   *
   * A domain's score is its single strongest hit plus a third of everything else. Without that, a domain with
   * a long vocabulary would win on quantity alone: "machine learning regression" has to be artificial
   * intelligence primarily and statistics secondarily, not the reverse. Accumulating a 1.5x bonus for every
   * subdomain hit made exactly that mistake, so the strongest subdomain now wins outright and only one is kept.
   */
  const signals: DomainSignal[] = [...scores.values()].map((accumulator) => {
    // Ties prefer the SUBDOMAIN reading: the same word as a domain alias ("machine learning" is both an
    // alias of artificial-intelligence and a term of its ml-fundamentals subdomain) must not throw away
    // the more specific reading just because the alias was indexed first.
    const sorted = [...accumulator.hits].sort((a, b) => (b.weight - a.weight) || (b.subdomain ? 1 : 0) - (a.subdomain ? 1 : 0));
    const best = sorted[0]!;
    const rest = sorted.slice(1).reduce((total, hit) => total + hit.weight, 0);
    return {
      domain: accumulator.domain,
      subdomain: best.subdomain,
      score: Math.round((best.weight + rest * 0.3) * 1000) / 1000,
      matched: [...new Set(sorted.map((hit) => hit.term))],
    };
  });

  /**
   * ORDER BREAKS NEAR-TIES. English puts the head noun of a topic first: in "an array of four cells" the
   * subject is the ARRAY and "cells" is what the array is made of. When two domains score within a fifth of
   * each other, the one whose evidence appears EARLIER in the topic wins, because a topic names what it is
   * about before it names what that thing contains.
   */
  const NEAR_TIE = 0.2;
  const ranked = signals.sort((a, b) => {
    const difference = b.score - a.score;
    const threshold = NEAR_TIE * Math.max(a.score, b.score);
    if (Math.abs(difference) <= threshold) {
      return (scores.get(a.domain)?.firstAt ?? 0) - (scores.get(b.domain)?.firstAt ?? 0);
    }
    return difference;
  });

  // A bare generic noun with no distinctive evidence is not a subject. Fall back rather than guess.
  if (ranked.length === 0) {
    const fallback = DOMAIN_SPECS.find((domain) => domain.id === DEFAULT_DOMAIN)!;
    return {
      primary: { domain: fallback.id, subdomain: null, score: 0, matched: [] },
      secondary: [],
      coarse: fallback.coarse,
      topic: normalise(topic),
      codeIntent: false,
      evidence: [],
    };
  }

  const [primary, ...rest] = ranked;
  const primarySpec = DOMAIN_SPECS.find((domain) => domain.id === primary.domain)!;
  const primarySubdomain = primarySpec.subdomains.find((subdomain) => subdomain.id === primary.subdomain);

  /**
   * CROSS-REFERENCE SECONDARIES. A subdomain's `also` list is how "machine learning regression" gets
   * statistics as a SECONDARY even though its own vocabulary no longer claims the bare word "regression".
   * They are seeded below genuine evidence, so a real hit elsewhere in the topic still wins the ranking.
   */
  const seedScore = Math.min(1.5, primary.score * 0.3);
  const seeded = new Map<TeachingDomainId, DomainSignal>(
    (primarySubdomain?.also ?? []).map((domain) => [
      domain,
      { domain, subdomain: null, score: seedScore, matched: ["cross-reference"] as string[] },
    ]),
  );
  for (const signal of rest) {
    if (signal.domain !== primary.domain) seeded.set(signal.domain, signal);
  }
  // One domain cannot be secondary to itself, and the primary is never repeated in the secondary list.
  const secondary = [...seeded.values()]
    .filter((signal) => signal.domain !== primary.domain)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const coarse = primarySubdomain?.coarse ?? primarySpec.coarse;
  const codeIntent = CODE_EVIDENCE.some((pattern) => pattern.test(haystack));

  return {
    primary,
    secondary,
    coarse,
    topic: normalise(topic),
    codeIntent,
    evidence,
  };
}

/** Convenience: the coarse eleven-value subject the objective and asset layers are keyed on. */
export function coarseSubjectFor(topic: string, context?: string): TeachingSubject {
  return classifyDomain(topic, context).coarse;
}

/** Every domain, in taxonomy order. Exported so the quality gate can iterate the whole taxonomy. */
export const ALL_DOMAINS: readonly DomainSpec[] = DOMAIN_SPECS;