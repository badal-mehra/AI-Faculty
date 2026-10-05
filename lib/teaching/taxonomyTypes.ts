// Shared TYPES for the teaching-domain taxonomy.
//
// Split out from both the classifier and its vocabulary so the data file and the classifier can be read
// without either importing the other. Nothing here has behaviour: it is the shape of a domain.
import type { TeachingSubject } from "./intent";

/**
 * The 47 teaching domains. Kept as a literal tuple rather than derived from the data so that a domain id
 * used anywhere in the codebase — including in a `also` cross-reference — is checked by the compiler.
 */
export const TEACHING_DOMAIN_IDS = [
  "mathematics",
  "computer-science",
  "physics",
  "chemistry",
  "biology",
  "electrical-electronics",
  "mechanical-engineering",
  "civil-engineering",
  "design",
  "business-management",
  "economics",
  "accounting",
  "psychology",
  "education",
  "geography",
  "history",
  "political-science",
  "language-literature",
  "general-interdisciplinary",
  "medicine-healthcare",
  "pharmacy",
  "biotechnology",
  "environmental-science",
  "agriculture",
  "architecture",
  "statistics-data-science",
  "artificial-intelligence",
  "information-technology",
  "cybersecurity",
  "telecommunications",
  "aerospace",
  "automotive",
  "materials-science",
  "geology",
  "astronomy-space-science",
  "sociology",
  "philosophy",
  "law",
  "communication-media",
  "hospitality-tourism",
  "commerce",
  "finance",
  "psychology-human-behavior",
  "arts-humanities",
  "physical-education-sports",
  "vocational-technical",
  "general-academic",
] as const;

export type TeachingDomainId = (typeof TEACHING_DOMAIN_IDS)[number];

export type SubdomainSpec = {
  /** Stable slug, e.g. "design-thinking". */
  id: string;
  /** Student-facing name, e.g. "Design thinking". */
  label: string;
  /** Distinctive vocabulary that establishes THIS subdomain. Never a generic word. */
  terms?: readonly string[];
  /** Domains this subdomain is normally taught alongside. Seeds the secondary list. */
  also?: readonly TeachingDomainId[];
  /** Overrides the domain's coarse subject when this subdomain is the primary one. */
  coarse?: TeachingSubject;
};

export type DomainSpec = {
  id: TeachingDomainId;
  label: string;
  /** The coarse subject the objective's teaching arcs and asset categories are keyed on. */
  coarse: TeachingSubject;
  /** Distinctive vocabulary for the whole domain, used when no subdomain claims it. */
  terms?: readonly string[];
  /** Other names students and teachers use for this domain ("maths", "EE", "AI", ...). */
  aliases?: readonly string[];
  subdomains: readonly SubdomainSpec[];
};
