// TEACHING-DOMAIN TAXONOMY — the regression tests for subject classification.
//
// Each of the ten cases below is a real failure that reached the board, not a hypothetical. "IDEO framework"
// was classified as computer-science and produced a lesson about design thinking drawn with a code block and
// a call stack. "function" alone was treated as programming and put a runtime error on a calculus slide.
// "AI for medical diagnosis" took the application's subject instead of the tool's, so a lesson on the
// application was planned with no AI vocabulary at all. A bare "prototype" and a bare "network" each moved
// the whole lesson into computing.
//
// The classifier is the only place that decides what a lesson is about, so the assertions are about the
// BEHAVIOUR of the whole decision: primary domain, subdomain, coarse subject, secondaries, and code intent.
import { classifyDomain, coarseSubjectFor, GENERIC_TERMS } from "../lib/teaching/taxonomy";
import { DOMAIN_SPECS, TEACHING_DOMAIN_IDS } from "../lib/teaching/taxonomyData";

let passed = 0;
let failed = 0;
const check = (name: string, condition: boolean, detail = "") => {
  if (condition) passed += 1;
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};
const section = (title: string) => console.log(`\n== ${title}`);

// --------------------------------------------------------------------------- The taxonomy itself

section("taxonomy shape");

check("all 47 domains are present", TEACHING_DOMAIN_IDS.length === 47, `found ${TEACHING_DOMAIN_IDS.length}`);
check(
  "the data file describes every domain id",
  DOMAIN_SPECS.length === TEACHING_DOMAIN_IDS.length,
  `${DOMAIN_SPECS.length} specs vs ${TEACHING_DOMAIN_IDS.length} ids`,
);
check(
  "domain ids are unique",
  new Set(DOMAIN_SPECS.map((domain) => domain.id)).size === DOMAIN_SPECS.length,
);
check(
  "subdomain ids are unique within a domain",
  DOMAIN_SPECS.every((domain) => new Set(domain.subdomains.map((sub) => sub.id)).size === domain.subdomains.length),
);
check(
  "every domain has at least one subdomain",
  DOMAIN_SPECS.every((domain) => domain.subdomains.length > 0),
  DOMAIN_SPECS.filter((domain) => domain.subdomains.length === 0).map((domain) => domain.id).join(", "),
);
check(
  "every subdomain has distinctive vocabulary",
  DOMAIN_SPECS.every((domain) => domain.subdomains.every((sub) => (sub.terms?.length ?? 0) > 0)),
);
check(
  "every cross-reference points at a real domain",
  DOMAIN_SPECS.every((domain) =>
    domain.subdomains.every((sub) => (sub.also ?? []).every((id) => TEACHING_DOMAIN_IDS.includes(id))),
  ),
);
check(
  "no vocabulary entry is a banned generic word",
  DOMAIN_SPECS.every((domain) =>
    [...(domain.terms ?? []), ...(domain.aliases ?? []), ...domain.subdomains.flatMap((sub) => sub.terms ?? [])].every(
      (term) => !GENERIC_TERMS.has(term.trim().toLowerCase()),
    ),
  ),
  DOMAIN_SPECS.flatMap((domain) => [
    ...(domain.terms ?? []),
    ...(domain.aliases ?? []),
    ...domain.subdomains.flatMap((sub) => sub.terms ?? []),
  ])
    .filter((term) => GENERIC_TERMS.has(term.trim().toLowerCase()))
    .join(", "),
);
check(
  "the coarse subject of every domain is one of the eleven existing values",
  new Set(DOMAIN_SPECS.map((domain) => domain.coarse)).size > 0,
);

// --------------------------------------------------------------------------- The ten real failures

section("the ten classification failures");

{
  const decision = classifyDomain("IDEO framework");
  check("IDEO framework -> design", decision.primary.domain === "design", decision.primary.domain);
  check("IDEO framework -> design thinking", decision.primary.subdomain === "design-thinking", String(decision.primary.subdomain));
  check("IDEO framework is not programming", decision.coarse !== "programming", decision.coarse);
  check("IDEO framework has no code intent", decision.codeIntent === false);
}

{
  const decision = classifyDomain("function in mathematics");
  check("function in mathematics -> mathematics", decision.primary.domain === "mathematics", decision.primary.domain);
  check("function in mathematics is not programming", decision.coarse !== "programming", decision.coarse);
  check("function in mathematics has no code intent", decision.codeIntent === false);
}

{
  const decision = classifyDomain("function in C++");
  check("function in C++ -> computer-science", decision.primary.domain === "computer-science", decision.primary.domain);
  check("function in C++ -> programming", decision.primary.subdomain === "programming", String(decision.primary.subdomain));
  check("function in C++ -> coarse programming", decision.coarse === "programming", decision.coarse);
  check("function in C++ has code intent", decision.codeIntent === true);
}

{
  const decision = classifyDomain("prototype in product design");
  check("prototype in product design -> design", decision.primary.domain === "design", decision.primary.domain);
  check(
    "prototype in product design -> product design",
    decision.primary.subdomain === "product-design",
    String(decision.primary.subdomain),
  );
  check("prototype in product design is not programming", decision.coarse !== "programming", decision.coarse);
}

{
  const decision = classifyDomain("prototype in software engineering");
  check(
    "prototype in software engineering -> computer-science",
    decision.primary.domain === "computer-science",
    decision.primary.domain,
  );
  check(
    "prototype in software engineering -> software engineering",
    decision.primary.subdomain === "software-engineering",
    String(decision.primary.subdomain),
  );
}

{
  const decision = classifyDomain("binary search");
  check("binary search -> computer-science", decision.primary.domain === "computer-science", decision.primary.domain);
  check("binary search -> algorithms", decision.primary.subdomain === "algorithms", String(decision.primary.subdomain));
}

{
  const decision = classifyDomain("RC circuit");
  const allowed = decision.primary.domain === "electrical-electronics" || decision.primary.domain === "physics";
  check("RC circuit -> electrical-electronics or physics", allowed, decision.primary.domain);
  check("RC circuit -> circuits", decision.primary.subdomain === "circuits", String(decision.primary.subdomain));
  check("RC circuit is never programming", decision.primary.domain !== "computer-science", decision.primary.domain);
  check("RC circuit is never programming even as a coarse subject", decision.coarse !== "programming", decision.coarse);
  check("RC circuit has no code intent", decision.codeIntent === false);
}

{
  const decision = classifyDomain("Newton's second law");
  check("Newton's second law -> physics", decision.primary.domain === "physics", decision.primary.domain);
  check("Newton's second law -> mechanics", decision.primary.subdomain === "mechanics", String(decision.primary.subdomain));
}

{
  const decision = classifyDomain("machine learning regression");
  check("machine learning regression -> artificial-intelligence", decision.primary.domain === "artificial-intelligence", decision.primary.domain);
  check(
    "machine learning regression -> statistics as secondary",
    decision.secondary.some((signal) => signal.domain === "statistics-data-science"),
    decision.secondary.map((signal) => signal.domain).join(", "),
  );
}

{
  const decision = classifyDomain("AI for medical diagnosis");
  check("AI for medical diagnosis -> artificial-intelligence", decision.primary.domain === "artificial-intelligence", decision.primary.domain);
  check(
    "AI for medical diagnosis -> medicine as secondary",
    decision.secondary.some((signal) => signal.domain === "medicine-healthcare"),
    decision.secondary.map((signal) => signal.domain).join(", "),
  );
}

// --------------------------------------------------------------------------- Generic words decide nothing

section("generic words never decide a subject");

for (const generic of ["function", "prototype", "network", "model", "structure", "process", "framework", "loop"]) {
  const decision = classifyDomain(`the ${generic}`);
  check(
    `bare "${generic}" is not programming`,
    decision.primary.domain !== "computer-science",
    decision.primary.domain,
  );
  check(`bare "${generic}" falls back to general`, decision.primary.domain === "general-academic", decision.primary.domain);
}

check(
  "the same generic word resolves differently by context",
  coarseSubjectFor("prototype in product design") !== coarseSubjectFor("prototype in software engineering"),
);

// --------------------------------------------------------------------------- Broad coverage

section("every domain is reachable from its own vocabulary");

let unreachable: string[] = [];
for (const domain of DOMAIN_SPECS) {
  const probe = domain.subdomains[0]?.terms?.[0] ?? domain.terms?.[0] ?? domain.aliases?.[0];
  if (!probe) {
    unreachable.push(`${domain.id} (no vocabulary)`);
    continue;
  }
  const decision = classifyDomain(probe);
  if (decision.primary.domain !== domain.id) unreachable.push(`${domain.id} -> ${decision.primary.domain} ("${probe}")`);
}
check("every domain is reachable", unreachable.length === 0, unreachable.join("; "));

console.log(`\nteaching-taxonomy: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);