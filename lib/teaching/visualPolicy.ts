// WHAT EACH DOMAIN MAY BE DRAWN WITH.
//
// WHY THIS IS SEPARATE FROM THE TAXONOMY. `taxonomy.ts` answers "what subject is this lesson?". This file
// answers "what is that subject allowed to look like on the board?". Keeping them apart means a
// misclassification and a mis-specified representation are two different, separately testable faults: a
// lesson about design thinking can be classified correctly and STILL be drawn as a code block, and the fix
// for that is here, not in the vocabulary.
//
// THE FAILURE THIS EXISTS FOR. A lesson about the IDEO design framework was planned with a code block and a
// call stack on the board, and every gate agreed it was fine: the action contract offers every structure to
// every subject, the asset gate only rejected assets from an unrelated *category*, and the structure gate was
// keyed on eleven coarse subjects that never mentioned design at all. Nothing in the pipeline could say "a
// design lesson does not get a call stack", so the foreign representation reached the student.
//
// THE POLICY. Each domain gets an explicit set of representations. `code` is the sharpest one because it is
// the only representation that is not just off-subject but actively misleading: a code listing on a
// non-programming lesson teaches a language the student did not ask for, in the place of the thing they did.
// Every rejection carries a diagnostic naming the domain, so a log line says WHY something was removed
// instead of silently dropping it.
import type { TeachingSubject } from "./intent";
import type { TeachingDomainId } from "./taxonomy";

/**
 * The representation families the board knows how to build. These are what a domain's policy is written in
 * terms of; the concrete actions each family compiles to are listed in `FAMILY_ACTIONS`.
 */
export type RepresentationKind =
  | "code"
  | "data-structure"
  | "equation"
  | "circuit"
  | "free-body"
  | "plot"
  | "graph"
  | "sequence"
  | "pipeline"
  | "timeline"
  | "compare"
  | "diagram"
  | "model";

/** The actions each family compiles to. One family per structure action, so a policy is a set of families. */
export const FAMILY_ACTIONS: Readonly<Record<RepresentationKind, readonly string[]>> = {
  code: ["create_code_block"],
  "data-structure": ["create_array", "update_array", "create_linked_list", "create_stack", "create_queue", "create_tree"],
  equation: ["create_equation_block", "write_formula"],
  circuit: ["create_circuit"],
  "free-body": ["create_free_body_diagram"],
  plot: ["create_graph_plot"],
  graph: ["create_graph"],
  sequence: ["create_sequence"],
  pipeline: ["create_pipeline"],
  timeline: ["create_timeline"],
  compare: ["create_compare"],
  // Primitives, not structures: a rectangle, a label and an arrow are how any of the above is drawn.
  diagram: ["create_shape", "create_text", "create_label", "create_icon", "create_arrow", "create_connector", "create_container"],
  model: [],
};

/** Every structure action, mapped back to the family that owns it. Used by the alignment gate. */
export const ACTION_FAMILY: Readonly<Record<string, RepresentationKind>> = Object.fromEntries(
  Object.entries(FAMILY_ACTIONS).flatMap(([family, actions]) => actions.map((action) => [action, family as RepresentationKind])),
);

/**
 * Every structure action there is, across all families.
 *
 * The composition stage needs this to tell a FORBIDDEN STRUCTURE from an ordinary drawing primitive. Counting
 * "anything the policy does not permit" as foreign flagged `move` and `create_text` in real provider runs —
 * a rectangle and a nudge are not a design lesson's foreign representation, and a diagnostic that cries wolf
 * about them is one nobody reads.
 */
export const ALL_STRUCTURE_ACTIONS: ReadonlySet<string> = new Set(Object.values(FAMILY_ACTIONS).flat());

/** A structure action that mutates an existing object rather than creating one, so it follows its target. */
export const NEUTRAL_STRUCTURE_ACTIONS: ReadonlySet<string> = new Set(["update_array", "set_code_pointer"]);

/**
 * COARSE-SUBJECT BASELINE.
 *
 * These are the eleven existing subjects, unchanged, so every behaviour that already worked keeps working.
 * The domain policy is then a NARROWING of this, never a widening: a domain may remove families its coarse
 * subject has, but it may not add families the coarse subject forbids.
 */
const COARSE_FAMILIES: Readonly<Record<TeachingSubject, readonly RepresentationKind[]>> = {
  mathematics: ["equation", "plot", "data-structure", "compare", "pipeline", "timeline", "sequence", "diagram"],
  physics: ["equation", "free-body", "plot", "data-structure", "compare", "pipeline", "graph", "diagram"],
  engineering: ["circuit", "equation", "plot", "free-body", "data-structure", "compare", "pipeline", "graph", "diagram"],
  programming: ["code", "data-structure", "graph", "sequence", "pipeline", "compare", "diagram"],
  "computer-science": ["code", "data-structure", "graph", "sequence", "pipeline", "compare", "diagram"],
  networking: ["sequence", "pipeline", "graph", "timeline", "compare", "data-structure", "diagram"],
  chemistry: ["equation", "pipeline", "plot", "compare", "data-structure", "sequence", "timeline", "diagram"],
  biology: ["pipeline", "sequence", "timeline", "graph", "compare", "data-structure", "diagram"],
  astronomy: ["plot", "pipeline", "compare", "data-structure", "sequence", "diagram"],
  humanities: ["timeline", "compare", "pipeline", "graph", "diagram"],
  general: ["equation", "plot", "circuit", "free-body", "data-structure", "compare", "pipeline", "timeline", "sequence", "graph", "code", "diagram"],
};

/**
 * DOMAIN NARROWINGS.
 *
 * A narrowing INTERSECTS with the coarse subject's families, it never replaces them: "∫ x² sin(x) dx"
 * resolves to the general-academic domain when nothing distinctive matched, and a narrowing that replaced
 * the mathematics families would then delete the equation block from a calculus lesson. Only `design` needs
 * a narrowing, and only to be explicit about what it will never be shown.
 */
const DOMAIN_FAMILIES: Partial<Record<TeachingDomainId, readonly RepresentationKind[]>> = {
  design: ["timeline", "compare", "pipeline", "graph", "diagram"],
};

/** Domains whose lessons may legitimately contain a code listing, because the lesson IS about programs. */
const CODE_DOMAINS: ReadonlySet<TeachingDomainId> = new Set([
  "computer-science",
  "information-technology",
  "cybersecurity",
  "artificial-intelligence",
  "statistics-data-science",
  "biotechnology",
  "vocational-technical",
]);

/**
 * Asset categories a domain may illustrate with.
 *
 * These are consulted ONLY for domains whose coarse subject has no category of its own (the engineering and
 * earth families), because the existing coarse gate already covers biology, chemistry, physics, mathematics,
 * astronomy, networking and computer-science. `undefined` means "no restriction": a guess would delete the
 * only visual a lesson has, and a design lesson is better served by a labelled diagram than by a laptop.
 */
const DOMAIN_CATEGORIES: Partial<Record<TeachingDomainId, readonly string[]>> = {
  "electrical-electronics": ["network", "computer-science", "physics"],
  telecommunications: ["network", "computer-science"],
  "mechanical-engineering": ["physics", "network"],
  "civil-engineering": ["physics", "earth"],
  architecture: ["earth", "physics"],
  aerospace: ["physics", "earth"],
  automotive: ["physics", "network"],
  "materials-science": ["physics", "chemistry", "earth"],
  geology: ["earth"],
  geography: ["earth", "biology"],
  "environmental-science": ["earth", "biology"],
  agriculture: ["biology", "earth"],
  "vocational-technical": ["network", "physics"],
};

/** One-line guidance appended to the provider prompt, so the model is told rather than caught. Kept short on
 * purpose: the prompt competes for a real token budget with the stage plan and the action vocabulary, and a
 * policy line that pushes a request out of `compact` is a policy that never reaches the model. */
const DOMAIN_GUIDANCE: Partial<Record<TeachingDomainId, string>> = {
  design: "diagrams of the process, personas, journey maps and comparisons. Never show code.",
  "artificial-intelligence": "labelled block diagrams, data-flow arrows and worked examples; pseudocode only when the lesson is about an algorithm.",
  mathematics: "the mathematics itself: equations, graphs and worked steps. No code listing.",
  "general-academic": "simple labelled lists, comparisons and short diagrams. No code listing.",
  "general-interdisciplinary": "simple labelled diagrams and comparisons. No code listing.",
};

export type VisualPolicy = {
  domain: TeachingDomainId;
  coarse: TeachingSubject;
  /** The representation families this domain may be drawn with. */
  families: readonly RepresentationKind[];
  /** The concrete structure actions this domain may issue, for the alignment gate. */
  structures: ReadonlySet<string>;
  /** True when a code listing is legitimate for this lesson. */
  allowCode: boolean;
  /** Asset categories this domain may illustrate with, or undefined for "no restriction". */
  categories?: readonly string[];
  /** The sentence appended to the provider prompt for this domain. */
  guidance: string;
};

const FALLBACK: VisualPolicy["families"] = COARSE_FAMILIES.general;

/** Builds the policy for a domain, narrowing its coarse subject's families. */
export function visualPolicyFor(domain: TeachingDomainId, coarse: TeachingSubject): VisualPolicy {
  const coarseFamilies = COARSE_FAMILIES[coarse] ?? FALLBACK;
  const narrowed = DOMAIN_FAMILIES[domain];
  const base = narrowed ? coarseFamilies.filter((family) => narrowed.includes(family)) : coarseFamilies;
  // `general` is deliberately generous, so code survives it by default. That generosity is exactly how an
  // unrecognised non-programming topic ends up with a call stack on it, so a domain that is not about
  // programs loses code even when the coarse subject is open.
  const allowCode = CODE_DOMAINS.has(domain)
    && (coarse === "programming" || coarse === "computer-science" || coarse === "general");
  const families = base.filter((family) => family !== "code" || allowCode);
  const structures = new Set(families.flatMap((family) => FAMILY_ACTIONS[family] ?? []));
  return {
    domain,
    coarse,
    families,
    structures,
    allowCode,
    ...(DOMAIN_CATEGORIES[domain] ? { categories: DOMAIN_CATEGORIES[domain] } : {}),
    guidance: DOMAIN_GUIDANCE[domain] ?? (allowCode
      ? "code is allowed: this lesson is about programs."
      : "represent the idea with a labelled diagram. No code listing."),
  };
}

/** The policy for the coarse subject alone, for callers that have no domain yet. */
export function visualPolicyForSubject(coarse: TeachingSubject): VisualPolicy {
  return visualPolicyFor("general-academic", coarse);
}

export type RepresentationVerdict = { allowed: true } | { allowed: false; family: RepresentationKind; diagnostic: string };

/**
 * THE GATE. Decides whether one representation is legitimate for this lesson.
 *
 * The diagnostic text is part of the contract, not decoration: `Rejected code representation: subject=design,
 * no programming intent.` is the line that makes this failure legible in a log instead of invisible.
 */
export function checkRepresentation(
  policy: VisualPolicy,
  action: string,
  options: { codeIntent?: boolean } = {},
): RepresentationVerdict {
  const family = ACTION_FAMILY[action];
  if (!family) return { allowed: true };
  if (NEUTRAL_STRUCTURE_ACTIONS.has(action)) return { allowed: true };
  if (policy.structures.has(action)) return { allowed: true };
  if (family === "code" && options.codeIntent) return { allowed: true };
  return {
    allowed: false,
    family,
    diagnostic: family === "code"
      ? `Rejected code representation: subject=${policy.domain}, no programming intent.`
      : `Rejected ${family} representation: subject=${policy.domain}, not a ${policy.domain} representation.`,
  };
}

/** Counts the foreign representations in a step's actions, and returns each diagnostic with it. */
export function foreignRepresentations(
  policy: VisualPolicy,
  actions: readonly { action: string }[],
  options: { codeIntent?: boolean } = {},
): { count: number; diagnostics: string[] } {
  const diagnostics: string[] = [];
  for (const action of actions) {
    const verdict = checkRepresentation(policy, action.action, options);
    if (!verdict.allowed && !diagnostics.includes(verdict.diagnostic)) diagnostics.push(verdict.diagnostic);
  }
  return { count: diagnostics.length, diagnostics };
}