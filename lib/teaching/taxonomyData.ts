// DOMAIN VOCABULARY — the 47 teaching domains and what identifies each.
//
// Pure data, kept apart from the classifier so the vocabulary can be read, audited and unit-tested
// without any classification logic in view. Every term is checked against GENERIC_TERMS when the index is
// built, so a generic word cannot be smuggled in here.
//
// VOCABULARY BELONGS TO THE SUBDOMAIN whenever a subdomain exists, because a subdomain is the level a
// lesson is actually about: "IDEO framework" is design/design-thinking, and a term filed only under the
// bare domain would have lost exactly the distinction that was needed.
//
// TERMS ARE DELIBERATELY SPARSE. The test for including one is: could this word appear in an ordinary
// sentence about a DIFFERENT domain? "function", "prototype", "network", "model", "structure", "process"
// and their relatives are excluded everywhere, because each is the central noun of several domains at once.
import type { DomainSpec, TeachingDomainId } from "./taxonomyTypes";

export { TEACHING_DOMAIN_IDS } from "./taxonomyTypes";
export type { DomainSpec, SubdomainSpec, TeachingDomainId } from "./taxonomyTypes";

/**
 * Every cross-reference below is typed as `TeachingDomainId`, so a subdomain pointing at something that is
 * not one of the 47 domains is a COMPILE error rather than a reference that silently never fires.
 */
export const DOMAIN_SPECS: readonly DomainSpec[] = [
  // ----------------------------------------------------------------------- 1. MATHEMATICS
  {
    id: "mathematics",
    label: "Mathematics",
    coarse: "mathematics",
    aliases: ["maths", "math", "pure mathematics"],
    terms: ["mathematics", "algebra", "geometry", "calculus", "polynomial", "equation", "equations"],
    subdomains: [
      { id: "arithmetic", label: "Arithmetic", terms: ["arithmetic", "fraction", "fractions", "percentage", "percentages", "long division", "order of operations", "prime number", "divisibility", "lcm", "gcd"] },
      {
        id: "algebra",
        label: "Algebra",
        terms: ["algebra", "polynomial", "polynomials", "quadratic", "linear equation", "system of equations", "factorise", "factorize", "factoring", "discriminant", "coefficient", "coefficients", "inequality", "inequalities", "logarithm", "logarithms", "exponent", "exponents", "binomial theorem", "arithmetic sequence", "geometric sequence", "root finding", "roots of a polynomial"],
        also: ["statistics-data-science"],
      },
      {
        id: "geometry",
        label: "Geometry",
        terms: ["geometry", "triangle", "triangles", "angle", "angles", "parallel lines", "congruent", "similar triangles", "perimeter", "coordinate geometry", "theorem", "proof", "prove", "circle theorem"],
        also: ["architecture"],
      },
      { id: "trigonometry", label: "Trigonometry", terms: ["trigonometry", "trigonometric", "sine", "cosine", "tangent", "pythagorean", "unit circle", "trig"], also: ["astronomy-space-science", "aerospace"] },
      {
        id: "calculus",
        label: "Calculus",
        terms: ["calculus", "derivative", "derivatives", "differentiate", "differentiation", "integral", "integrals", "integrate", "integration", "antiderivative", "limit", "limits", "continuity", "continuous", "piecewise", "chain rule", "product rule", "quotient rule", "mean value theorem", "taylor series", "riemann", "asymptote", "optimisation", "newton raphson"],
        also: ["physics", "statistics-data-science"],
      },
      { id: "differential-equations", label: "Differential equations", terms: ["differential equation", "differential equations", "laplace transform", "separable equation", "first order"], also: ["physics"] },
      {
        id: "linear-algebra",
        label: "Linear algebra",
        terms: ["linear algebra", "matrix", "matrices", "determinant", "eigenvector", "eigenvectors", "eigenvalue", "eigenvalues", "vector space", "matrix multiplication", "transpose", "rank of a matrix"],
        also: ["artificial-intelligence", "computer-science"],
      },
      { id: "probability", label: "Probability", terms: ["probability", "probabilities", "permutation", "permutations", "combination", "combinations", "expected value", "random variable", "conditional probability", "fair coin"], also: ["statistics-data-science"] },
      { id: "discrete-mathematics", label: "Discrete mathematics", terms: ["discrete mathematics", "graph theory", "set theory", "combinatorics", "boolean algebra", "mathematical induction", "recurrence relation"], also: ["computer-science"] },
      { id: "numerical-methods", label: "Numerical methods", terms: ["numerical method", "numerical methods", "interpolation", "extrapolation", "simpson's rule", "euler method", "error bound"], also: ["computer-science"] },
    ],
  },

  // -------------------------------------------------------------------- 2. COMPUTER SCIENCE
  {
    id: "computer-science",
    label: "Computer science",
    coarse: "computer-science",
    aliases: ["computing", "computation"],
    subdomains: [
      {
        id: "programming",
        label: "Programming",
        coarse: "programming",
        terms: ["programming", "c++", "cpp", "java", "python", "javascript", "typescript", "rust", "kotlin", "swift", "ruby", "php", "syntax", "compiler", "compilation", "object-oriented", "polymorphism", "inheritance", "encapsulation", "exception handling", "debugging", "refactoring", "recursive", "recursion", "pseudocode"],
        also: ["mathematics"],
      },
      {
        id: "data-structures",
        label: "Data structures",
        coarse: "programming",
        terms: ["data structure", "data structures", "array", "arrays", "linked list", "linked lists", "doubly linked", "stack", "stack overflow", "queue", "queues", "hash table", "hash tables", "hash map", "binary search tree", "bst", "tree", "trees", "heap", "priority queue", "trie", "adjacency list", "pointer", "pointers", "memory layout"],
        also: ["mathematics"],
      },
      {
        id: "algorithms",
        label: "Algorithms",
        terms: ["algorithm", "algorithms", "binary search", "linear search", "sorting", "sorting algorithm", "quicksort", "mergesort", "bubble sort", "insertion sort", "big o", "big-o", "time complexity", "space complexity", "divide and conquer", "dynamic programming", "greedy algorithm"],
        also: ["mathematics", "artificial-intelligence"],
      },
      { id: "operating-systems", label: "Operating systems", terms: ["operating system", "operating systems", "process scheduling", "scheduler", "deadlock", "virtual memory", "paging", "kernel", "thread", "threads", "threading", "race condition", "semaphore", "mutex"], also: ["information-technology"] },
      { id: "databases", label: "Databases", terms: ["database", "databases", "sql", "relational database", "normalisation", "normalization", "indexing", "primary key", "foreign key", "nosql"], also: ["information-technology"] },
      {
        id: "computer-networks",
        label: "Computer networks",
        coarse: "networking",
        terms: ["ip address", "subnet", "dns", "dhcp", "ethernet", "lan", "tcp", "udp", "http", "https", "three-way handshake", "3-way handshake", "handshake", "socket", "sockets", "packet", "packets", "router", "routing", "firewall", "bandwidth", "latency", "protocol", "protocols", "port number"],
        also: ["telecommunications", "cybersecurity"],
      },
      {
        id: "software-engineering",
        label: "Software engineering",
        coarse: "programming",
        terms: ["software engineering", "software design", "design pattern", "design patterns", "unit testing", "integration testing", "code review", "version control", "agile", "scrum", "continuous integration", "sprint", "technical debt", "microservices", "api design"],
        also: ["business-management", "information-technology"],
      },
      { id: "computer-architecture", label: "Computer architecture", terms: ["computer architecture", "cpu", "instruction set", "cache", "caching", "ram", "rom", "alu", "assembly language", "hardware architecture", "firmware", "von neumann"], also: ["electrical-electronics"] },
      { id: "web-development", label: "Web development", terms: ["web development", "html", "css", "react", "angular", "vue", "frontend", "front-end", "backend", "back-end", "responsive design", "browser"], also: ["information-technology", "design"] },
    ],
  },

  // --------------------------------------------------------------------------- 3. PHYSICS
  {
    id: "physics",
    label: "Physics",
    coarse: "physics",
    subdomains: [
      { id: "mechanics", label: "Mechanics", terms: ["newton", "newton's law", "newtons law", "newton's second law", "newton's first law", "newton's third law", "force", "forces", "velocity", "acceleration", "momentum", "friction", "gravity", "inertia", "torque", "projectile", "kinematics", "equilibrium"], also: ["mechanical-engineering", "physical-education-sports"] },
      { id: "thermodynamics", label: "Thermodynamics", terms: ["thermodynamics", "heat engine", "entropy", "enthalpy", "carnot", "internal energy", "adiabatic", "isothermal", "gibbs"], also: ["mechanical-engineering", "chemistry"] },
      { id: "electromagnetism", label: "Electromagnetism", terms: ["electromagnetism", "magnetism", "magnetic field", "electric field", "coulomb", "faraday", "maxwell", "capacitance", "inductance"], also: ["electrical-electronics"] },
      { id: "optics", label: "Optics", terms: ["optics", "lens", "lenses", "mirror", "mirrors", "refraction", "reflection", "diffraction", "interference", "polarisation", "polarization", "snell's law", "rayleigh", "sky", "blue sky", "focal length"], also: ["astronomy-space-science"] },
      { id: "waves", label: "Waves", terms: ["wave", "waves", "oscillation", "oscillations", "harmonic", "pendulum", "amplitude", "frequency", "wavelength", "resonance", "damped", "standing wave", "sound wave"], also: ["telecommunications"] },
      { id: "modern-physics", label: "Modern physics", terms: ["quantum", "quantum mechanics", "wave function", "schrodinger", "relativity", "special relativity", "general relativity", "photoelectric", "particle physics"], also: ["materials-science"] },
      { id: "nuclear-physics", label: "Nuclear physics", terms: ["nuclear", "fission", "fusion", "radioactive", "half life", "half-life", "isotope", "mass defect"], also: ["chemistry", "electrical-electronics"] },
    ],
  },

  // ------------------------------------------------------------------------- 4. CHEMISTRY
  {
    id: "chemistry",
    label: "Chemistry",
    coarse: "chemistry",
    terms: ["chemistry", "chemical", "molecule", "molecules", "atom", "atoms", "electron", "electrons", "proton", "protons", "neutron", "neutrons", "orbital", "orbitals", "periodic table", "catalyst", "catalysts", "bond", "bonds", "valence", "stoichiometry", "mole", "moles", "acid", "acids", "base", "bases"],
    subdomains: [
      { id: "organic", label: "Organic chemistry", terms: ["organic chemistry", "organic", "alkane", "alkene", "alkyne", "benzene", "functional group", "hydrocarbon", "carbonyl", "ester", "amine", "ketone"], also: ["pharmacy"] },
      { id: "inorganic", label: "Inorganic chemistry", terms: ["inorganic chemistry", "ionic bonding", "covalent bonding", "metallic bonding", "ionic", "covalent", "oxidation state", "oxidation", "reduction", "redox", "transition metal", "salt"], also: ["materials-science"] },
      { id: "physical-chemistry", label: "Physical chemistry", terms: ["physical chemistry", "chemical equilibrium", "equilibrium constant", "reaction rate", "rate constant", "gibbs free energy", "enthalpy change"], also: ["physics"] },
      { id: "analytical-chemistry", label: "Analytical chemistry", terms: ["analytical chemistry", "titration", "chromatography", "spectroscopy", "nmr", "mass spectrometry", "calibration curve"], also: ["pharmacy"] },
      { id: "biochemistry", label: "Biochemistry", terms: ["biochemistry", "biochemical", "enzyme", "enzymes", "substrate", "protein folding", "metabolism", "atp", "glycolysis"], also: ["biology", "pharmacy"] },
    ],
  },

  // --------------------------------------------------------------------------- 5. BIOLOGY
  {
    id: "biology",
    label: "Biology",
    coarse: "biology",
    aliases: ["life science", "life sciences"],
    terms: ["biology", "biological", "organism", "organisms", "photosynthesis", "chloroplast", "chlorophyll", "mitochondria", "mitochondrion", "organelle", "organelles", "tissue", "tissues", "genetics", "bacteria", "bacterium", "virus", "ecosystem", "evolution"],
    subdomains: [
      { id: "cell-biology", label: "Cell biology", terms: ["cell", "cells", "cell membrane", "nucleus", "cytoplasm", "ribosome", "golgi", "endoplasmic reticulum", "osmosis", "active transport", "cell division"], also: ["chemistry", "medicine-healthcare"] },
      { id: "genetics", label: "Genetics", terms: ["genetics", "gene", "genes", "allele", "alleles", "dna", "rna", "inheritance", "genotype", "phenotype", "mutation", "mutations", "heredity", "chromosome", "chromosomes", "meiosis", "mitosis"], also: ["biotechnology"] },
      { id: "molecular-biology", label: "Molecular biology", terms: ["molecular biology", "transcription", "protein synthesis", "pcr", "plasmid"], also: ["biotechnology"] },
      { id: "microbiology", label: "Microbiology", terms: ["microbiology", "bacterial", "viruses", "fungi", "fungal", "sterilisation", "sterilization", "antibiotic", "pathogen"], also: ["medicine-healthcare", "agriculture"] },
      { id: "anatomy", label: "Anatomy", terms: ["anatomy", "anatomical", "skeleton", "muscle", "muscles", "lung", "lungs", "trachea", "heart", "brain", "stomach", "kidney", "liver", "circulatory system", "respiratory system", "digestive system"], also: ["medicine-healthcare"] },
      { id: "physiology", label: "Physiology", terms: ["physiology", "homeostasis", "heart rate", "blood pressure", "breathing", "alveoli", "neuron", "neurons", "synapse", "digestion", "respiration"], also: ["medicine-healthcare"] },
      { id: "ecology", label: "Ecology", terms: ["ecology", "ecosystem", "ecosystems", "food chain", "food web", "biodiversity", "habitat", "symbiosis", "predator", "biome"], also: ["environmental-science"] },
      { id: "evolution", label: "Evolution", terms: ["evolution", "evolutionary", "darwin", "natural selection", "adaptation", "speciation", "fossil", "common ancestor"] },
      { id: "botany", label: "Botany", terms: ["botany", "plant", "plants", "leaf", "leaves", "stomata", "xylem", "phloem", "pollination", "flower"], also: ["agriculture"] },
      { id: "zoology", label: "Zoology", terms: ["zoology", "animal", "animals", "mammal", "bird", "fish", "insect", "reptile"] },
    ],
  },

  // ------------------------------------------------------- 6. ELECTRICAL & ELECTRONICS ENGINEERING
  {
    id: "electrical-electronics",
    label: "Electrical and electronics engineering",
    coarse: "engineering",
    aliases: ["electrical engineering", "electronic engineering", "electronics", "ee"],
    subdomains: [
      { id: "circuits", label: "Circuit analysis", terms: ["circuit", "circuits", "rc circuit", "resistor", "resistors", "capacitor", "capacitors", "inductor", "voltage", "current", "ohm", "ohm's law", "kirchhoff", "series circuit", "parallel circuit", "equivalent resistance"], also: ["physics"] },
      { id: "digital-logic", label: "Digital logic", terms: ["digital logic", "logic gate", "logic gates", "boolean logic", "flip flop", "truth table", "multiplexer", "adder", "binary", "truth values"], also: ["computer-science"] },
      { id: "microelectronics", label: "Microelectronics", terms: ["semiconductor", "transistor", "transistors", "diode", "integrated circuit", "mosfet", "diode", "ic design", "wafer"], also: ["computer-science", "materials-science"] },
      { id: "signal-processing", label: "Signal processing", terms: ["signal processing", "fourier transform", "convolution", "filter", "filters", "modulation", "spectrum"], also: ["mathematics", "telecommunications"] },
      { id: "power-systems", label: "Power systems", terms: ["power system", "power systems", "transmission line", "generator", "solar panel", "renewable energy", "grid", "power supply", "ac", "dc"], also: ["environmental-science"] },
      { id: "control-systems", label: "Control systems", terms: ["control system", "control systems", "feedback", "pid", "stability", "transfer function", "open loop", "closed loop"], also: ["mechanical-engineering"] },
    ],
  },

  // ------------------------------------------------------------- 7. MECHANICAL ENGINEERING
  {
    id: "mechanical-engineering",
    label: "Mechanical engineering",
    coarse: "engineering",
    aliases: ["mechanical"],
    subdomains: [
      { id: "thermodynamics", label: "Applied thermodynamics", terms: ["thermodynamic cycle", "work done", "efficiency", "power cycle"], also: ["physics"] },
      { id: "fluids", label: "Fluid mechanics", terms: ["fluid mechanics", "fluids", "hydraulics", "pressure drop", "bernoulli", "laminar", "turbulent", "viscosity", "pump", "pipeline"], also: ["civil-engineering"] },
      { id: "dynamics", label: "Mechanics of machines", terms: ["mechanics of machines", "four bar linkage", "kinematics of machines", "gear ratio"], also: ["automotive"] },
      { id: "machine-design", label: "Machine design", terms: ["machine design", "stress analysis", "factor of safety", "bearing", "shaft design", "tolerances", "fatigue"], also: ["materials-science"] },
      { id: "manufacturing", label: "Manufacturing", terms: ["manufacturing", "casting", "forging", "cnc", "machining", "injection moulding", "injection molding", "tolerances", "tolerance"], also: ["design"] },
      { id: "cad", label: "Computer-aided design", terms: ["computer aided design", "computer-aided design", "cad", "solidworks", "autocad", "catia", "parametric"], also: ["design"] },
    ],
  },

  // -------------------------------------------------------------------- 8. CIVIL ENGINEERING
  {
    id: "civil-engineering",
    label: "Civil engineering",
    coarse: "engineering",
    aliases: ["civil"],
    subdomains: [
      { id: "structural", label: "Structural analysis", terms: ["beam", "beams", "truss", "trusses", "bending moment", "shear force", "column", "slab", "load distribution", "statically determinate"], also: ["mechanical-engineering"] },
      { id: "concrete", label: "Concrete technology", terms: ["reinforced concrete", "rcc", "concrete mix", "rebar", "cement", "compressive strength", "formwork"] },
      { id: "geotechnical", label: "Geotechnical engineering", terms: ["soil mechanics", "bearing capacity", "settlement", "liquefaction", "foundation design", "geotechnical"], also: ["geology"] },
      { id: "transport", label: "Transport engineering", terms: ["traffic engineering", "highway design", "road design", "intersection design", "roundabout", "pavement design"] },
      { id: "water-resources", label: "Water resources", terms: ["hydrology", "flood", "flooding", "drainage", "water supply", "dam design", "watershed"], also: ["environmental-science"] },
      { id: "construction", label: "Construction management", terms: ["construction management", "project scheduling", "critical path", "site safety", "bill of quantities"], also: ["business-management"] },
      { id: "surveying", label: "Surveying", terms: ["surveying", "theodolite", "levelling", "levelling", "traverse", "total station", "benchmark"] },
    ],
  },

  // ----------------------------------------------------------------- 9. AEROSPACE ENGINEERING
  {
    id: "aerospace",
    label: "Aerospace engineering",
    coarse: "engineering",
    subdomains: [
      { id: "aerodynamics", label: "Aerodynamics", terms: ["aerodynamics", "lift", "drag", "angle of attack", "boundary layer", "airfoil", "wing loading", "reynolds number"], also: ["mechanical-engineering", "physics"] },
      { id: "propulsion", label: "Propulsion", terms: ["propulsion", "thrust", "jet engine", "turbofan", "rocket nozzle", "combustion chamber", "specific impulse"], also: ["mechanical-engineering"] },
      { id: "orbital-mechanics", label: "Orbital mechanics", terms: ["orbital mechanics", "orbit", "kepler", "escape velocity", "delta-v", "transfer orbit", "mission design"], also: ["astronomy-space-science"] },
      { id: "spacecraft", label: "Spacecraft systems", terms: ["spacecraft", "payload", "attitude control", "solar array", "thermal control", "launch vehicle"], also: ["electrical-electronics"] },
    ],
  },

  // ---------------------------------------------------------------- 10. AUTOMOTIVE ENGINEERING
  {
    id: "automotive",
    label: "Automotive engineering",
    coarse: "engineering",
    subdomains: [
      { id: "automotive-powertrain", label: "Powertrain", terms: ["internal combustion engine", "powertrain", "piston", "crankshaft", "cylinder", "turbocharger", "transmission gearbox", "clutch"], also: ["mechanical-engineering"] },
      { id: "vehicle-dynamics", label: "Vehicle dynamics", terms: ["vehicle dynamics", "suspension", "braking distance", "handling", "tyre", "tire", "aeroelastic"], also: ["mechanical-engineering"] },
      { id: "electric-vehicle", label: "Electric vehicles", terms: ["electric vehicle", "ev battery", "regenerative braking", "traction motor", "charging station"], also: ["electrical-electronics"] },
      { id: "automotive-safety", label: "Automotive safety", terms: ["crash test", "crumple zone", "airbag", "restraint system", "pedestrian impact"], also: ["mechanical-engineering"] },
    ],
  },

  // ------------------------------------------------------------- 11. MATERIALS SCIENCE
  {
    id: "materials-science",
    label: "Materials science",
    coarse: "engineering",
    subdomains: [
      { id: "structure", label: "Structure of materials", terms: ["crystal structure", "lattice", "grain", "grain boundary", "bragg"], also: ["physics"] },
      { id: "mechanical-properties", label: "Mechanical properties", terms: ["stress strain curve", "elastic limit", "yield strength", "ductility", "toughness", "creep", "ductile", "brittle"], also: ["mechanical-engineering"] },
      { id: "thermochemistry", label: "Thermodynamics of materials", terms: ["phase diagram", "phase equilibrium", "heat treatment", "annealing", "quenching", "sintering"], also: ["chemistry"] },
      { id: "ceramics", label: "Ceramics and glasses", terms: ["ceramic", "ceramics", "glass", "porcelain", "toughening"], also: ["architecture"] },
      { id: "composites", label: "Composites", terms: ["fibre reinforced", "carbon fibre", "carbon fiber", "composite material", "laminate"], also: ["aerospace"] },
    ],
  },

  // ---------------------------------------------------------------------------- 12. GEOLOGY
  {
    id: "geology",
    label: "Geology",
    coarse: "engineering",
    aliases: ["earth science", "geoscience"],
    subdomains: [
      { id: "mineralogy", label: "Mineralogy", terms: ["mineral", "minerals", "mineralogy", "crystal habit", "cleavage", "hardness", "streak", "lustre"], also: ["chemistry"] },
      { id: "petrology", label: "Petrology", terms: ["igneous rock", "sedimentary rock", "metamorphic rock", "magma", "lava", "sediment", "metamorphism"] },
      { id: "stratigraphy", label: "Stratigraphy", terms: ["stratigraphy", "strata", "geological map", "unconformity", "geological age"] },
      { id: "structural-geology", label: "Structural geology", terms: ["fault", "folds", "anticline", "syncline", "joint", "fold", "plate tectonics", "earthquake", "volcano"], also: ["geography"] },
      { id: "hydrogeology", label: "Hydrogeology", terms: ["aquifer", "groundwater", "water table", "porosity", "permeability"], also: ["environmental-science"] },
    ],
  },

  // -------------------------------------------------------------- 13. ENVIRONMENTAL SCIENCE
  {
    id: "environmental-science",
    label: "Environmental science",
    coarse: "biology",
    aliases: ["environmental studies", "environment"],
    subdomains: [
      { id: "ecotoxicology", label: "Ecotoxicology", terms: ["ecotoxicology", "bioaccumulation", "pollution", "contaminant", "toxicity", "ecosystem health"], also: ["biology"] },
      { id: "conservation", label: "Conservation", terms: ["conservation", "endangered", "habitat loss", "reforestation", "biodiversity conservation", "protected area"], also: ["biology"] },
      { id: "renewable", label: "Sustainable energy", terms: ["sustainable energy", "carbon footprint", "renewable", "emissions", "net zero", "recycling"], also: ["electrical-electronics"] },
      { id: "waste", label: "Waste management", terms: ["waste management", "landfill", "sewage", "water treatment", "bioremediation"], also: ["civil-engineering"] },
      { id: "climate", label: "Climate science", terms: ["climate change", "global warming", "greenhouse effect", "carbon cycle", "greenhouse gas", "co2 emissions", "co2"], also: ["chemistry", "electrical-electronics"] },
    ],
  },

  // ----------------------------------------------------------------------- 14. AGRICULTURE
  {
    id: "agriculture",
    label: "Agriculture",
    coarse: "biology",
    subdomains: [
      { id: "crop", label: "Crop science", terms: ["crop", "crops", "yield", "cultivation", "irrigation", "fertiliser", "fertilizer", "pest control"], also: ["biology"] },
      { id: "soil", label: "Soil science", terms: ["soil fertility", "loam", "soil ph", "nutrient cycle", "tilth"], also: ["environmental-science"] },
      { id: "animal-husbandry", label: "Animal husbandry", terms: ["animal husbandry", "livestock", "dairy", "poultry", "fodder", "veterinary care"], also: ["biology"] },
      { id: "agri-technology", label: "Agricultural technology", terms: ["precision agriculture", "drip irrigation", "hydroponics", "agricultural mechanisation", "greenhouse cultivation"], also: ["mechanical-engineering"] },
    ],
  },

  // --------------------------------------------------------------------- 15. ARCHITECTURE
  {
    id: "architecture",
    label: "Architecture",
    coarse: "engineering",
    subdomains: [
      { id: "design-principles", label: "Design principles", terms: ["architectural design", "proportion", "rhythm", "symmetry", "massing", "facade"], also: ["design"] },
      { id: "building-science", label: "Building science", terms: ["thermal comfort", "insulation", "ventilation", "daylighting", "passive design", "u value"], also: ["mechanical-engineering"] },
      { id: "urban-planning", label: "Urban planning", terms: ["urban planning", "zoning", "land use", "master plan", "walkability", "urban density"], also: ["geography"] },
      { id: "interior", label: "Interior architecture", terms: ["interior design", "interiors", "space planning", "furniture layout", "material palette"], also: ["design"] },
      { id: "heritage", label: "Architectural heritage", terms: ["heritage building", "conservation of buildings", "listed building", "vernacular architecture", "adaptive reuse"], also: ["history"] },
    ],
  },

  // --------------------------------------------------- 16. STATISTICS & DATA SCIENCE
  {
    id: "statistics-data-science",
    label: "Statistics and data science",
    coarse: "computer-science",
    aliases: ["data science", "statistics", "statistical science"],
    terms: ["data science", "dataset", "datasets", "correlation", "distribution", "anomaly detection"],
    subdomains: [
      { id: "descriptive-statistics", label: "Descriptive statistics", terms: ["mean", "median", "mode", "variance", "quartile", "percentile", "histogram", "box plot", "boxplot"], also: ["mathematics"] },
      { id: "inference", label: "Statistical inference", terms: ["hypothesis testing", "p-value", "t-test", "chi-squared", "regression analysis", "confidence interval", "significance", "bootstrap"], also: ["mathematics", "medicine-healthcare"] },
      { id: "data-analysis", label: "Data analysis", terms: ["data analysis", "exploratory data", "outlier", "data cleaning", "summarising data", "data preparation"] },
      { id: "statistical-learning", label: "Statistical learning", terms: ["classification model", "decision tree", "random forest", "support vector machine", "gradient descent", "overfitting", "training set", "test set"], also: ["artificial-intelligence", "mathematics"] },
    ],
  },

  // ---------------------------------------------------------------- 17. ARTIFICIAL INTELLIGENCE
  {
    id: "artificial-intelligence",
    label: "Artificial intelligence",
    coarse: "computer-science",
    aliases: ["ai", "ml"],
    subdomains: [
      { id: "ml-fundamentals", label: "Machine learning fundamentals", terms: ["machine learning", "deep learning", "neural network", "neural networks", "perceptron", "activation function", "loss function", "cross entropy", "epoch", "epoch", "batch size", "learning rate"], also: ["statistics-data-science", "mathematics"] },
      { id: "ml-models", label: "Supervised and unsupervised learning", terms: ["supervised learning", "unsupervised learning", "reinforcement learning", "classification", "regression model", "clustering", "linear regression", "logistic regression", "feature engineering"], also: ["statistics-data-science"] },
      { id: "deep-learning", label: "Deep learning", terms: ["deep learning", "convolutional", "cnn", "rnn", "lstm", "transformer", "attention mechanism", "embedding", "backpropagation", "transfer learning"], also: ["computer-science"] },
      { id: "computer-vision", label: "Computer vision", terms: ["computer vision", "image classification", "object detection", "image segmentation", "edge detection", "opencv", "convolutional neural network"] },
      { id: "nlp", label: "Natural language processing", terms: ["natural language processing", "nlp", "tokenization", "sentiment analysis", "named entity", "text classification", "language model"], also: ["computer-science", "language-literature"] },
      { id: "ai-applications", label: "AI applications", terms: ["ai for medical diagnosis", "medical imaging", "recommendation system", "expert system", "ai in healthcare", "predictive model"], also: ["medicine-healthcare", "business-management"] },
      { id: "ai-ethics", label: "AI ethics", terms: ["ai ethics", "algorithmic bias", "fairness in ai", "ai safety", "explainability", "model transparency", "ai regulation"], also: ["law", "arts-humanities"] },
      { id: "robotics", label: "Robotics", terms: ["robotics", "robot arm", "autonomous robot", "kinematics of robots", "path planning", "sensor fusion"], also: ["mechanical-engineering", "electrical-electronics"] },
    ],
  },

  // ------------------------------------------------------------ 18. INFORMATION TECHNOLOGY
  {
    id: "information-technology",
    label: "Information technology",
    coarse: "computer-science",
    aliases: ["it", "computing and information technology"],
    subdomains: [
      { id: "it-fundamentals", label: "IT fundamentals", terms: ["information technology", "computer literacy", "hardware and software", "file system", "end-user computing"], also: ["computer-science"] },
      { id: "spreadsheets", label: "Spreadsheet and data tools", terms: ["spreadsheet", "spreadsheets", "pivot table", "formula in a spreadsheet", "excel", "data table", "chart from data"], also: ["statistics-data-science", "accounting"] },
      { id: "networking-it", label: "Networking for IT", terms: ["client server", "network topology", "wireless network", "router configuration"], also: ["computer-science"] },
      { id: "databases-it", label: "Database systems", terms: ["spreadsheet database", "query", "validation"], also: ["computer-science"] },
      { id: "cyber-awareness", label: "Cyber awareness", terms: ["cyber awareness", "password strength", "phishing", "online safety", "data privacy", "digital footprint"], also: ["cybersecurity"] },
      { id: "systems-administration", label: "Systems administration", terms: ["systems administration", "backup", "server maintenance", "active directory", "cloud computing", "virtual machine", "virtualisation"], also: ["cybersecurity"] },
    ],
  },

  // --------------------------------------------------------------------- 19. CYBERSECURITY
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    coarse: "computer-science",
    subdomains: [
      { id: "security-fundamentals", label: "Security fundamentals", terms: ["cybersecurity", "cia triad", "confidentiality", "integrity", "availability", "threat model", "vulnerability", "vulnerabilities"], also: ["information-technology"] },
      { id: "cryptography", label: "Cryptography", terms: ["cryptography", "encryption", "decryption", "cipher", "ciphertext", "hash function", "hashing", "public key", "private key", "digital signature", "aes", "rsa"], also: ["computer-science", "mathematics"] },
      { id: "network-security", label: "Network security", terms: ["network security", "firewall configuration", "intrusion detection", "penetration testing", "vpn", "tls"], also: ["computer-science", "telecommunications"] },
      { id: "ethical-hacking", label: "Ethical hacking", terms: ["ethical hacking", "penetration test", "exploit", "vulnerability assessment", "footprinting", "pen testing"], also: ["computer-science"] },
      { id: "application-security", label: "Application security", terms: ["application security", "sql injection", "cross-site scripting", "xss", "owasp", "input validation", "authentication", "access control"], also: ["computer-science"] },
      { id: "incident-response", label: "Incident response", terms: ["incident response", "digital forensics", "breach", "malware", "ransomware", "antivirus"], also: ["information-technology"] },
    ],
  },

  // ------------------------------------------------------------------ 20. TELECOMMUNICATIONS
  {
    id: "telecommunications",
    label: "Telecommunications",
    coarse: "engineering",
    subdomains: [
      { id: "signalling", label: "Signalling", terms: ["signalling", "telephone exchange", "analog signal", "digital signal", "pulse code modulation", "multiplexing", "cdma", "fdma"], also: ["computer-science", "electrical-electronics"] },
      { id: "antennas", label: "Antennas and propagation", terms: ["antenna", "antennas", "propagation", "path loss", "microwave link", "satellite link", "antenna gain"], also: ["aerospace", "physics"] },
      { id: "optical-networks", label: "Optical networks", terms: ["optical fibre", "optical fiber", "fibre optic", "fiber optic", "wdm", "attenuation", "dispersion"], also: ["information-technology"] },
      { id: "wireless-communication", label: "Wireless communication", terms: ["wireless communication", "cellular", "5g", "4g", "wi-fi", "bluetooth", "lte", "mobile network"], also: ["computer-science", "cybersecurity"] },
    ],
  },

  // ------------------------------------------------------------ 21. ASTRONOMY & SPACE SCIENCE
  {
    id: "astronomy-space-science",
    label: "Astronomy and space science",
    coarse: "astronomy",
    aliases: ["astronomy", "space science"],
    terms: ["astronomy", "astronomer", "telescope", "observatory", "planet", "planets", "star", "stars", "galaxy", "galaxies"],
    subdomains: [
      { id: "solar-system", label: "The solar system", terms: ["solar system", "orbit of the earth", "earth's orbit", "moon phase", "eclipse", "meteor", "comet", "asteroid", "planet", "planets", "satellite"], also: ["physics", "aerospace"] },
      { id: "stars", label: "Stars and stellar evolution", terms: ["star formation", "stellar", "red giant", "supernova", "black hole", "neutron star", "spectral class", "luminosity"], also: ["physics"] },
      { id: "cosmology", label: "Cosmology", terms: ["cosmology", "big bang", "expansion of the universe", "hubble", "dark matter", "dark energy", "cosmic microwave background"], also: ["physics"] },
      { id: "observation", label: "Astronomical observation", terms: ["telescope", "telescopes", "observatory", "spectroscopy of starlight", "light curve", "exoplanet", "sky survey"], also: ["chemistry"] },
      { id: "space-exploration", label: "Space exploration", terms: ["space exploration", "rover", "space mission", "space telescope", "space station", "sample return"], also: ["aerospace"] },
    ],
  },

  // ------------------------------------------------------------ 22. MEDICINE & HEALTHCARE
  {
    id: "medicine-healthcare",
    label: "Medicine and healthcare",
    coarse: "biology",
    aliases: ["medicine", "clinical medicine", "healthcare"],
    terms: ["medicine", "clinical", "diagnosis", "prognosis", "patient", "patients", "therapy", "treatment", "symptom", "symptoms", "clinical trial", "epidemiology"],
    subdomains: [
      { id: "diagnosis", label: "Clinical diagnosis", terms: ["clinical diagnosis", "differential diagnosis", "investigation", "physical examination", "case presentation", "differential"], also: ["biology"] },
      { id: "pharmacology-clinical", label: "Clinical pharmacology", terms: ["clinical pharmacology", "drug interaction", "pharmacokinetics", "adverse effect", "contraindication"], also: ["pharmacy"] },
      { id: "surgery", label: "Surgery", terms: ["surgery", "surgical", "incision", "resection", "anaesthesia", "anesthesia", "operative"], also: ["biology"] },
      { id: "public-health", label: "Public health", terms: ["public health", "health promotion", "disease surveillance", "outbreak", "pandemic", "health inequality", "vaccination"], also: ["biology"] },
      { id: "epidemiology", label: "Epidemiology", terms: ["epidemiology", "incidence", "prevalence", "risk factor", "risk factors", "cohort study", "case control", "mortality rate"], also: ["statistics-data-science"] },
      { id: "healthcare-delivery", label: "Healthcare systems", terms: ["healthcare system", "hospital administration", "clinical governance", "health service", "medical ethics", "patient safety", "triage"], also: ["business-management", "law"] },
      { id: "clinical-ai", label: "Clinical AI and diagnostics", terms: ["computer aided detection", "clinical decision support", "radiology", "diagnostic imaging"], also: ["artificial-intelligence"] },
    ],
  },

  // ------------------------------------------------------------------------ 23. PHARMACY
  {
    id: "pharmacy",
    label: "Pharmacy",
    coarse: "biology",
    subdomains: [
      { id: "pharmaceutical-chemistry", label: "Pharmaceutical chemistry", terms: ["pharmaceutical chemistry", "drug synthesis", "active ingredient", "salt form", "bioavailability"], also: ["chemistry"] },
      { id: "pharmaceutics", label: "Pharmaceutics", terms: ["pharmaceutics", "tablet", "capsule", "formulation", "drug delivery", "controlled release", "excipient"] },
      { id: "pharmacology", label: "Pharmacology", terms: ["pharmacology", "pharmacodynamics", "mechanism of action", "receptor agonist", "antagonist", "therapeutic index", "half life of a drug"] },
      { id: "pharmacovigilance", label: "Pharmacovigilance", terms: ["pharmacovigilance", "adverse drug reaction", "drug recall", "side effects", "post-marketing surveillance"] },
    ],
  },

  // -------------------------------------------------------------------- 24. BIOTECHNOLOGY
  {
    id: "biotechnology",
    label: "Biotechnology",
    coarse: "biology",
    aliases: ["biotech"],
    subdomains: [
      { id: "recombinant-dna", label: "Recombinant DNA", terms: ["recombinant dna", "genetic engineering", "gene cloning", "plasmid vector", "restriction enzyme", "ligase"], also: ["biology"] },
      { id: "bioprocessing", label: "Bioprocessing", terms: ["bioprocessing", "fermentation", "bioreactor", "downstream processing", "biomass"], also: ["chemistry"] },
      { id: "biopharmaceuticals", label: "Biopharmaceuticals", terms: ["biopharmaceutical", "monoclonal antibody", "insulin production", "gene therapy", "cell culture"], also: ["pharmacy", "biology"] },
      { id: "synthetic-biology", label: "Synthetic biology", terms: ["synthetic biology", "biofoundry", "circuit design in cells", "crispr", "genome editing"], also: ["computer-science"] },
      { id: "agritech", label: "Agricultural biotechnology", terms: ["gmo", "bt crop", "golden rice", "biopesticide", "drought resistant crop"], also: ["agriculture", "environmental-science"] },
      { id: "bioinformatics", label: "Bioinformatics", terms: ["bioinformatics", "sequence alignment", "genome assembly", "blast", "phylogenetics"], also: ["computer-science"] },
    ],
  },

  // --------------------------------------------------------------------- 25. DESIGN
  {
    id: "design",
    label: "Design",
    coarse: "humanities",
    aliases: ["design studies", "design thinking"],
    terms: ["design", "designer", "ux", "ui design", "visual design", "design language"],
    subdomains: [
      {
        id: "design-thinking",
        label: "Design thinking",
        terms: ["design thinking", "design process", "ideo", "ideo framework", "empathy map", "double diamond", "ideation", "brainstorm", "persona", "user research", "wireframe", "design brief", "problem framing", "divergent", "convergent", "human centred design", "human-centered design", "design sprint", "value proposition"],
        also: ["business-management"],
      },
      {
        id: "product-design",
        label: "Product design",
        terms: ["product design", "product designer", "minimal viable product", "product roadmap", "user experience", "ux research", "usability testing", "interaction design", "physical product", "product concept", "design for manufacture"],
        also: ["mechanical-engineering"],
      },
      { id: "graphic-design", label: "Graphic design", terms: ["graphic design", "typography", "logo", "branding", "layout design", "colour theory", "color theory", "visual identity", "poster design"], also: ["arts-humanities"] },
      { id: "visual-communication", label: "Visual communication", terms: ["visual communication", "diagram", "infographic", "illustration", "information design", "storyboard"], also: ["arts-humanities"] },
      { id: "design-history", label: "Design history and theory", terms: ["design history", "bauhaus", "art nouveau", "design movement", "aesthetics", "design critique"], also: ["arts-humanities", "history"] },
      { id: "fashion", label: "Fashion and textile design", terms: ["fashion design", "textile design", "pattern making", "couture", "drape"], also: ["arts-humanities"] },
      { id: "design-engineering", label: "Design engineering", terms: ["design engineering", "engineering design", "design for assembly", "design and make", "cad drawing"], also: ["mechanical-engineering"] },
    ],
  },

  // ------------------------------------------------------------ 26. BUSINESS MANAGEMENT
  {
    id: "business-management",
    label: "Business management",
    coarse: "humanities",
    aliases: ["management", "business", "management studies"],
    terms: ["business", "management", "manager", "organisation", "organization", "leadership", "strategy", "organisational behaviour", "organizational behavior"],
    subdomains: [
      { id: "management-theory", label: "Management theory", terms: ["management theory", "scientific management", "division of labour", "hierarchy of needs", "management styles", "management functions"], also: ["sociology"] },
      { id: "business-strategy", label: "Business strategy", terms: ["business strategy", "competitive advantage", "business model", "market analysis", "corporate strategy", "swot", "portfolio analysis", "penetration pricing"], also: ["economics"] },
      { id: "organisational-behaviour", label: "Organisational behaviour", terms: ["organisational behaviour", "organizational behavior", "motivation", "team dynamics", "corporate culture", "organisational structure", "change management"], also: ["psychology-human-behavior"] },
      { id: "human-resources", label: "Human resource management", terms: ["human resource management", "human resources", "hiring", "recruitment", "payroll", "performance appraisal", "industrial relations"] },
      { id: "marketing", label: "Marketing", terms: ["marketing", "marketing mix", "four ps", "segmentation", "branding strategy", "customer journey", "sales funnel", "promotion strategy", "market share"], also: ["commerce"] },
      { id: "operations", label: "Operations management", terms: ["operations management", "quality control", "supply chain", "inventory management", "process improvement", "just in time", "six sigma"], also: ["mechanical-engineering", "statistics-data-science"] },
      { id: "project-management", label: "Project management", terms: ["project management", "gantt chart", "milestone", "stakeholder", "risk register", "critical path method", "scrum board"], also: ["computer-science"] },
      { id: "entrepreneurship", label: "Entrepreneurship", terms: ["entrepreneurship", "entrepreneur", "startup", "start-up", "venture capital", "pitch deck", "business plan"], also: ["finance"] },
      { id: "accounting-management", label: "Accounting for managers", terms: ["break even analysis"], also: ["accounting", "finance"] },
    ],
  },

  // ---------------------------------------------------------------------- 27. ECONOMICS
  {
    id: "economics",
    label: "Economics",
    coarse: "humanities",
    terms: ["economics", "economic", "economy", "economies", "gdp", "inflation", "supply and demand", "opportunity cost", "unemployment rate", "fiscal", "monetary policy"],
    subdomains: [
      { id: "microeconomics", label: "Microeconomics", terms: ["microeconomics", "microeconomic", "marginal cost", "marginal utility", "elasticity", "price ceiling", "price floor", "market equilibrium", "oligopoly", "monopoly", "externalities"], also: ["business-management"] },
      { id: "macroeconomics", label: "Macroeconomics", terms: ["macroeconomics", "macroeconomic", "gdp", "cpi", "gdp per capita", "economic growth", "fiscal deficit", "central bank", "phillips curve"], also: ["political-science"] },
      { id: "development-economics", label: "Development economics", terms: ["development economics", "poverty line", "hdi", "human development index", "economic development", "microfinance"], also: ["sociology", "geography"] },
      { id: "international-economics", label: "International economics", terms: ["international economics", "trade", "free trade", "tariff", "exchange rate", "balance of payments", "comparative advantage", "gatt"], also: ["commerce"] },
      { id: "environmental-economics", label: "Environmental economics", terms: ["environmental economics", "carbon tax", "externality pricing", "market failure", "common pool resource", "sustainable development"], also: ["environmental-science"] },
      { id: "behavioural-economics", label: "Behavioural economics", terms: ["behavioural economics", "behavioral economics", "loss aversion", "prospect theory", "bounded rationality", "incentive design"], also: ["psychology-human-behavior"] },
    ],
  },

  // --------------------------------------------------------------------- 28. ACCOUNTING
  {
    id: "accounting",
    label: "Accounting",
    coarse: "humanities",
    terms: ["accounting", "accountant", "ledger", "debit", "credit", "journal entry", "reconciliation", "accrual"],
    subdomains: [
      { id: "financial-accounting", label: "Financial accounting", terms: ["financial accounting", "balance sheet", "income statement", "cash flow statement", "double entry", "chart of accounts", "trial balance", "depreciation"] },
      { id: "management-accounting", label: "Management accounting", terms: ["management accounting", "cost accounting", "budget", "budgeting", "variance analysis", "contribution margin", "standard costing"], also: ["economics", "business-management"] },
      { id: "taxation", label: "Taxation", terms: ["taxation", "tax", "tax return", "income tax", "corporate tax", "capital gains tax", "withholding tax"], also: ["law", "finance"] },
      { id: "audit", label: "Auditing", terms: ["auditing", "audit", "internal control", "internal audit", "external audit", "material misstatement"], also: ["finance", "law"] },
      { id: "corporate-finance", label: "Corporate finance", terms: ["corporate finance", "capital structure", "npv", "net present value", "wacc", "weighted average cost of capital", "dividend", "share capital", "capital budgeting"], also: ["finance"] },
    ],
  },

  // ------------------------------------------------------------------------ 29. FINANCE
  {
    id: "finance",
    label: "Finance",
    coarse: "humanities",
    terms: ["finance", "financial", "investment", "investing", "portfolio", "risk", "return"],
    subdomains: [
      { id: "financial-markets", label: "Financial markets", terms: ["financial markets", "stock market", "bond market", "share price", "equity", "index fund", "commodity price", "dividend yield"], also: ["economics"] },
      { id: "investment-analysis", label: "Investment analysis", terms: ["investment analysis", "dcf", "discounted cash flow", "arbitrage", "bond pricing", "diversification", "portfolio theory"], also: ["mathematics", "statistics-data-science"] },
      { id: "banking", label: "Banking and monetary finance", terms: ["banking", "monetary finance", "interest rate", "lender of last resort", "fractional reserve", "securitisation", "securitization"], also: ["economics"] },
      { id: "insurance", label: "Insurance and risk", terms: ["insurance", "actuarial", "premium", "claim", "risk management", "reinsurance", "moral hazard", "hedging"], also: ["statistics-data-science"] },
      { id: "personal-finance", label: "Personal finance", terms: ["personal finance", "savings account", "mortgage", "credit score", "retirement planning", "pension"], also: ["accounting"] },
    ],
  },

  // ------------------------------------------------------------------------ 30. COMMERCE
  {
    id: "commerce",
    label: "Commerce",
    coarse: "humanities",
    terms: ["commerce", "merchant", "wholesale", "retail", "ecommerce"],
    subdomains: [
      { id: "international-business", label: "International business", terms: ["international business", "multinational", "global supply chain", "import", "export", "incoterms", "globalisation", "globalization"], also: ["economics"] },
      { id: "retail", label: "Retailing", terms: ["retailing", "retailer", "store layout", "footfall", "supermarket", "shopping centre", "shopping center"], also: ["business-management"] },
      { id: "ecommerce", label: "E-commerce", terms: ["e-commerce", "ecommerce", "online marketplace", "shopping cart", "checkout flow", "digital payment", "seller", "buyer"], also: ["computer-science"] },
      { id: "logistics", label: "Logistics and distribution", terms: ["logistics", "distribution channel", "freight", "warehousing", "last mile delivery", "cross docking"], also: ["business-management"] },
      { id: "advertising", label: "Advertising", terms: ["advertising", "campaign", "copywriting", "billboard", "brand awareness", "media buying", "advertorial"], also: ["business-management", "communication-media"] },
      { id: "consumer-behaviour", label: "Consumer behaviour", terms: ["consumer behaviour", "consumer behavior", "brand loyalty", "purchase decision", "impulse buying", "consumer trust"], also: ["business-management", "economics"] },
    ],
  },

  // ---------------------------------------------------- 31. HOSPITALITY & TOURISM
  {
    id: "hospitality-tourism",
    label: "Hospitality and tourism",
    coarse: "humanities",
    terms: ["hospitality", "tourism", "hotel", "restaurant", "tourist", "hospitality industry"],
    subdomains: [
      { id: "hotel-management", label: "Hotel management", terms: ["hotel management", "front desk", "housekeeping", "room service", "occupancy rate", "check in"], also: ["business-management"] },
      { id: "food-beverage", label: "Food and beverage", terms: ["food and beverage", "menu design", "food safety", "mise en place", "catering", "restaurant management", "hygiene standards"], also: ["biology"] },
      { id: "tourism", label: "Tourism", terms: ["tourism", "destination marketing", "ecotourism", "tour operator", "travel package", "seasonality", "visitor economy"], also: ["geography", "commerce"] },
      { id: "event-management", label: "Event management", terms: ["event management", "conference", "banquet", "event planning", "venue management"], also: ["business-management"] },
      { id: "hospitality-finance", label: "Hospitality finance", terms: ["revenue per available room", "revpar", "cost per occupied room", "hospitality accounting"], also: ["accounting"] },
    ],
  },

  // --------------------------------------------------- 32. VOCATIONAL & TECHNICAL
  {
    id: "vocational-technical",
    label: "Vocational and technical skills",
    coarse: "engineering",
    terms: ["vocational", "apprenticeship", "practical skills", "workshop", "hand tool", "trade skill"],
    subdomains: [
      { id: "automotive-repair", label: "Automotive repair", terms: ["engine repair", "brake service", "vehicle diagnostics", "motorcycle repair", "garage workshop"], also: ["automotive"] },
      { id: "welding", label: "Welding and fabrication", terms: ["welding", "arc welding", "tig welding", "mig welding", "brazing", "soldering", "fabrication"], also: ["mechanical-engineering"] },
      { id: "carpentry", label: "Carpentry and joinery", terms: ["carpentry", "joinery", "timber", "woodworking", "sawing", "chiselling", "furniture making"], also: ["mechanical-engineering"] },
      { id: "electrical-installation", label: "Electrical installation", terms: ["electrical installation", "wiring", "cable", "circuit installation", "testing and certification", "consumer unit"], also: ["electrical-electronics"] },
      { id: "plumbing", label: "Plumbing", terms: ["plumbing", "pipework", "drainage installation", "water heating", "sanitary ware"], also: ["civil-engineering"] },
      { id: "hvac", label: "Heating, ventilation and air conditioning", terms: ["hvac", "air conditioning", "refrigeration", "boiler", "ventilation system"], also: ["mechanical-engineering"] },
      { id: "cookery", label: "Professional cookery", terms: ["cookery", "professional kitchen", "knife skills", "pastry", "food preparation"], also: ["hospitality-tourism"] },
    ],
  },

  // -------------------------------------------------------------------- 33. PSYCHOLOGY
  {
    id: "psychology",
    label: "Psychology",
    coarse: "biology",
    subdomains: [
      { id: "cognitive-psychology", label: "Cognitive psychology", terms: ["cognitive psychology", "memory", "perception", "attention", "recall", "working memory", "elaboration", "cognitive load"], also: ["biology"] },
      { id: "developmental-psychology", label: "Developmental psychology", terms: ["developmental psychology", "piaget", "attachment", "child development", "adolescence", "nature versus nurture"], also: ["education"] },
      { id: "social-psychology", label: "Social psychology", terms: ["social psychology", "conformity", "obedience", "prejudice", "stereotype", "in group", "out group", "attribution"], also: ["psychology-human-behavior"] },
      { id: "clinical-psychology", label: "Clinical psychology", terms: ["clinical psychology", "abnormality", "psychotherapy", "cognitive behavioural therapy", "phobia", "depression", "schizophrenia"], also: ["medicine-healthcare"] },
      { id: "research-methods-psychology", label: "Research methods in psychology", terms: ["research methods in psychology", "participant", "anonymous", "confounding variable", "experimental control"], also: ["statistics-data-science"] },
    ],
  },

  // ------------------------------------------------- 34. PSYCHOLOGY & HUMAN BEHAVIOR
  {
    id: "psychology-human-behavior",
    label: "Psychology and human behaviour",
    coarse: "biology",
    aliases: ["human behaviour", "human behavior", "behavioral science"],
    terms: ["human behaviour", "human behavior", "behavioural science", "motivation theory", "decision making", "habit formation"],
    subdomains: [
      { id: "behavioural-theory", label: "Behavioural theory", terms: ["classical conditioning", "operant conditioning", "reinforcement", "extinction", "shaping", "habit loop", "behavioural theory"], also: ["psychology"] },
      { id: "motivation", label: "Motivation", terms: ["motivation theory", "intrinsic motivation", "extrinsic motivation", "self determination theory", "maslow"], also: ["business-management"] },
      { id: "decision-making", label: "Decision making", terms: ["decision making", "cognitive bias", "heuristic", "framing effect", "choice architecture", "risk attitude", "forecasting bias"], also: ["economics"] },
      { id: "group-dynamics", label: "Group dynamics", terms: ["group dynamics", "groupthink", "cohesion", "roles in a group", "collective behaviour", "collective behavior"], also: ["business-management"] },
      { id: "consumer-psychology", label: "Consumer psychology", terms: ["consumer psychology", "attitude", "persuasion", "nudge", "impulse"], also: ["commerce"] },
    ],
  },

  // --------------------------------------------------------------------- 35. EDUCATION
  {
    id: "education",
    label: "Education",
    coarse: "humanities",
    aliases: ["pedagogy", "teaching studies"],
    terms: ["education", "pedagogy", "teaching", "learning theory", "classroom", "curriculum"],
    subdomains: [
      { id: "learning-theory", label: "Learning theories", terms: ["learning theory", "constructivism", "bloom's taxonomy", "bloom taxonomy", "scaffolding", "spaced repetition", "active recall", "rote learning"], also: ["psychology"] },
      { id: "curriculum-design", label: "Curriculum design", terms: ["curriculum design", "curriculum", "learning objective", "bloom level", "course outline", "rubric design", "syllabus"] },
      { id: "pedagogy", label: "Pedagogy and classroom practice", terms: ["pedagogy", "pedagogical", "formative assessment", "summative assessment", "differentiated instruction", "group work", "blackboard", "lesson plan"], also: ["business-management"] },
      { id: "educational-assessment", label: "Assessment", terms: ["educational assessment", "assessment", "grading", "summative", "formative", "peer assessment", "validity and reliability"], also: ["statistics-data-science"] },
      { id: "educational-technology", label: "Educational technology", terms: ["educational technology", "edtech", "e-learning", "learning management system", "online course", "digital learning"], also: ["computer-science"] },
      { id: "inclusive-education", label: "Inclusive and special education", terms: ["inclusive education", "special educational needs", "sen", "differentiated instruction", "accessibility in learning", "individualised education"] },
    ],
  },

  // ---------------------------------------------------------------------- 36. SOCIOLOGY
  {
    id: "sociology",
    label: "Sociology",
    coarse: "humanities",
    terms: ["sociology", "sociological", "society", "social", "social norms", "social change", "culture", "social class"],
    subdomains: [
      { id: "social-theory", label: "Social theory", terms: ["social theory", "functionalism", "conflict theory", "symbolic interactionism", "feminist theory", "postmodernism"], also: ["philosophy"] },
      { id: "socialisation", label: "Socialisation", terms: ["socialisation", "socialization", "primary socialisation", "secondary socialisation", "agent of socialisation", "normative"], also: ["psychology"] },
      { id: "social-stratification", label: "Stratification and mobility", terms: ["social stratification", "social mobility", "social class", "wealth gap", "social mobility"], also: ["economics"] },
      { id: "research-methods-sociology", label: "Research methods", terms: ["sociological research", "survey", "interview method", "ethnography", "participant observation", "sampling method"], also: ["psychology"] },
      { id: "rural-urban-sociology", label: "Rural and urban sociology", terms: ["rural sociology", "urban sociology", "community structure"], also: ["architecture", "geography"] },
    ],
  },

  // ------------------------------------------------------------ 37. POLITICAL SCIENCE
  {
    id: "political-science",
    label: "Political science",
    coarse: "humanities",
    aliases: ["politics", "political studies", "government"],
    terms: ["politics", "political", "government", "democracy", "policy", "governance"],
    subdomains: [
      { id: "political-theory", label: "Political theory", terms: ["political theory", "social contract", "natural rights", "separation of powers", "sovereignty", "political legitimacy", "justice in politics"], also: ["sociology"] },
      { id: "comparative-politics", label: "Comparative politics", terms: ["comparative politics", "democracy", "authoritarianism", "regime", "electoral system", "federalism"] },
      { id: "international-relations", label: "International relations", terms: ["international relations", "diplomacy", "united nations", "foreign policy", "geopolitics", "treaty", "sanctions", "international organisations"], also: ["economics"] },
      { id: "public-policy", label: "Public policy", terms: ["public policy", "policy analysis", "public spending", "welfare state", "regulation", "evidence based policy"], also: ["economics", "sociology"] },
      { id: "public-administration", label: "Public administration", terms: ["public administration", "civil service", "bureaucracy", "local government", "governance reform", "service delivery"], also: ["business-management"] },
      { id: "civics", label: "Civics and citizenship", terms: ["civics", "citizenship", "rights", "election", "voting", "civic duty", "community participation"], also: ["law"] },
    ],
  },

  // --------------------------------------------------------------------- 38. GEOGRAPHY
  {
    id: "geography",
    label: "Geography",
    coarse: "humanities",
    terms: ["geography", "geographical", "geographic", "map", "maps", "location", "region", "climate", "landform", "population"],
    subdomains: [
      { id: "physical-geography", label: "Physical geography", terms: ["physical geography", "landform", "erosion", "weathering", "river", "plateau", "glacier", "weather and climate"], also: ["geology", "environmental-science"] },
      { id: "human-geography", label: "Human geography", terms: ["human geography", "settlement", "urbanisation", "urbanization", "migration", "population distribution", "rural", "urban"], also: ["sociology"] },
      { id: "environmental-geography", label: "Environment and sustainability", terms: ["environmental geography", "sustainability", "resource management", "climate change adaptation"], also: ["environmental-science"] },
      { id: "geographical-skills", label: "Geographical skills and fieldwork", terms: ["map work", "fieldwork", "surveying in geography", "gis", "geographic information system", "photograph interpretation", "cross section"], also: ["civil-engineering"] },
      { id: "tourism-geography", label: "Tourism geography", terms: ["tourism geography", "tourist region", "destination", "leisure geography", "heritage site"], also: ["hospitality-tourism"] },
    ],
  },

  // ------------------------------------------------------------------------ 39. HISTORY
  {
    id: "history",
    label: "History",
    coarse: "humanities",
    terms: ["history", "historical", "century", "periodisation", "civilisation", "civilization", "empire", "revolution", "primary source", "secondary source"],
    subdomains: [
      { id: "source-criticism", label: "Source criticism", terms: ["primary source", "secondary source", "source criticism", "provenance", "historiography", "bias in sources", "corroboration"], also: ["sociology"] },
      { id: "world-history", label: "World history", terms: ["world history", "ancient egypt", "mesopotamia", "roman empire", "silk road", "age of exploration", "industrial revolution"] },
      { id: "national-history", label: "National and regional history", terms: ["national history", "independence", "colonialism", "industrialisation", "nation state", "post colonial"], also: ["political-science"] },
      { id: "social-history", label: "Social history", terms: ["social history", "living standards", "demographic transition", "everyday life", "work and class in history"], also: ["sociology"] },
      { id: "economic-history", label: "Economic history", terms: ["economic history", "industrial revolution", "trade routes in history", "mercantilism", "great depression"], also: ["economics"] },
      { id: "archaeology", label: "Archaeology", terms: ["archaeology", "artefact", "artifact", "excavation", "dating", "archaeological site"], also: ["geology"] },
      { id: "environmental-history", label: "Environmental history", terms: ["environmental history", "industrial pollution history", "climate change history", "human environment interaction"], also: ["environmental-science"] },
    ],
  },

  // -------------------------------------------------------------------------- 40. LAW
  {
    id: "law",
    label: "Law",
    coarse: "humanities",
    terms: ["law", "legal", "jurisdiction", "legislation", "statute", "contract", "liability", "plaintiff", "defendant", "court"],
    subdomains: [
      { id: "legal-foundations", label: "Legal foundations", terms: ["legal system", "jurisdiction", "statute", "legislation", "precedent", "case law", "legal reasoning"], also: ["political-science"] },
      { id: "contract-law", label: "Contract law", terms: ["contract law", "offer", "acceptance", "consideration", "breach of contract", "remedy", "warranty"] },
      { id: "criminal-law", label: "Criminal law", terms: ["criminal law", "mens rea", "actus reus", "assault", "fraud", "criminal offence", "sentencing", "punishment"] },
      { id: "human-rights", label: "Human rights", terms: ["human rights", "humanitarian law", "geneva convention", "freedom of speech", "freedom of movement", "rights and freedoms"], also: ["political-science"] },
      { id: "constitutional-law", label: "Constitutional law", terms: ["constitutional law", "constitution", "judicial review", "rule of law", "amendment"], also: ["political-science"] },
      { id: "commercial-law", label: "Commercial law", terms: ["commercial law", "partnership", "company law", "corporate governance", "intellectual property", "consumer protection"], also: ["accounting", "commerce"] },
    ],
  },

  // --------------------------------------------------------------------- 41. PHILOSOPHY
  {
    id: "philosophy",
    label: "Philosophy",
    coarse: "humanities",
    terms: ["philosophy", "philosophical", "ethics", "moral", "metaphysics", "epistemology", "argument"],
    subdomains: [
      { id: "ethics", label: "Ethics", terms: ["ethics", "moral", "moral philosophy", "consequentialism", "deontology", "utilitarianism", "virtue ethics", "moral dilemma"], also: ["political-science"] },
      { id: "logic", label: "Logic and reasoning", terms: ["formal logic", "logical fallacy", "syllogism", "validity", "soundness", "propositional logic", "critical thinking"], also: ["mathematics"] },
      { id: "epistemology", label: "Epistemology", terms: ["epistemology", "knowledge", "justified belief", "truth", "scepticism", "skepticism", "perception and knowledge"], also: ["psychology"] },
      { id: "metaphysics", label: "Metaphysics", terms: ["metaphysics", "ontology", "existence", "reality", "causation", "free will", "universal", "substance"], also: ["sociology"] },
      { id: "philosophy-of-science", label: "Philosophy of science", terms: ["philosophy of science", "scientific method", "falsifiability", "theory of science", "induction", "paradigm"], also: ["statistics-data-science", "environmental-science"] },
    ],
  },

  // ---------------------------------------------------------------- 42. LANGUAGE & LITERATURE
  {
    id: "language-literature",
    label: "Language and literature",
    coarse: "humanities",
    aliases: ["english", "literature", "language arts", "linguistics"],
    terms: ["language", "languages", "literature", "grammar", "novel", "poem", "essay", "literary"],
    subdomains: [
      { id: "english-language", label: "English language", terms: ["english language", "grammar", "phonology", "morphology", "tense", "vocabulary", "register", "semicolon", "clause", "part of speech"] },
      { id: "english-literature", label: "English literature", terms: ["english literature", "novel", "drama", "poetry", "prose", "unreliable narrator", "literary device", "protagonist", "allegory", "satire", "metaphor"] },
      { id: "creative-writing", label: "Creative writing", terms: ["creative writing", "short story", "narrative", "plot", "characterisation", "characterization", "dialogue", "show don't tell"] },
      { id: "linguistics", label: "Linguistics", terms: ["linguistics", "phonetics", "morpheme", "dialect", "sociolinguistics", "language acquisition", "bilingualism"], also: ["psychology"] },
      { id: "translation", label: "Translation and interpretation", terms: ["translation", "interpreting", "localisation", "localization", "machine translation", "equivalence in translation"] },
      { id: "comparative-literature", label: "Comparative literature", terms: ["comparative literature", "world literature", "translation studies", "canon"], also: ["history"] },
    ],
  },

  // ---------------------------------------------------------------- 43. COMMUNICATION & MEDIA
  {
    id: "communication-media",
    label: "Communication and media",
    coarse: "humanities",
    aliases: ["media studies", "journalism", "communications"],
    terms: ["communication", "media", "journalism", "mass media", "audience", "broadcast", "advertisement", "editorial"],
    subdomains: [
      { id: "communication-theory", label: "Communication theory", terms: ["communication theory", "mass communication", "encoding", "decoding", "noise in communication", "shannon"], also: ["sociology"] },
      { id: "journalism", label: "Journalism", terms: ["journalism", "news", "newsroom", "reporting", "editorial", "headline", "source in journalism", "press freedom"], also: ["history", "law"] },
      { id: "media-studies", label: "Media studies", terms: ["media studies", "representation", "stereotype in media", "propaganda", "media effect", "audience segmentation"] },
      { id: "digital-media", label: "Digital media", terms: ["digital media", "social media", "viral", "algorithmic feed", "influencer", "engagement rate", "online community"], also: ["commerce", "cybersecurity"] },
      { id: "public-speaking", label: "Public speaking and writing", terms: ["public speaking", "presentation skills", "speech writing", "rhetoric", "audience engagement", "pitch"], also: ["language-literature"] },
    ],
  },

  // ---------------------------------------------------------------- 44. ARTS & HUMANITIES
  {
    id: "arts-humanities",
    label: "Arts and humanities",
    coarse: "humanities",
    aliases: ["arts", "humanities", "fine art"],
    terms: ["art", "arts", "humanities", "artist", "creative", "aesthetic", "canvas", "gallery", "heritage"],
    subdomains: [
      { id: "visual-arts", label: "Visual arts", terms: ["painting", "drawing", "sketch", "sculpture", "landscape painting", "still life", "portraiture", "gallery"], also: ["design"] },
      { id: "performing-arts", label: "Performing arts", terms: ["performing arts", "theatre", "theater", "acting", "dance", "music", "orchestra", "musical theatre", "stagecraft"], also: ["language-literature"] },
      { id: "aesthetic-theory", label: "Aesthetic theory", terms: ["aesthetic theory", "beauty", "kant", "form and content", "art criticism", "art movement", "modernism"], also: ["design"] },
      { id: "music-theory", label: "Music theory", terms: ["music theory", "clef", "key signature", "chord", "chords", "scale", "harmony", "rhythm", "cadence"], also: ["physics"] },
      { id: "film-studies", label: "Film and media arts", terms: ["film studies", "cinematography", "film editing", "close up", "montage", "screenplay", "documentary"], also: ["communication-media"] },
      { id: "heritage-interpretation", label: "Heritage and museums", terms: ["heritage interpretation", "museum", "curation", "archaeological site management", "intangible heritage"], also: ["history"] },
    ],
  },

  // ------------------------------------------------- 45. PHYSICAL EDUCATION & SPORTS
  {
    id: "physical-education-sports",
    label: "Physical education and sports",
    coarse: "general",
    aliases: ["physical education", "pe", "sport", "sports science"],
    terms: ["physical education", "sport", "sports", "athlete", "training", "fitness", "exercise", "coach"],
    subdomains: [
      { id: "anatomy-fitness", label: "Anatomy and fitness", terms: ["muscle group", "fitness training", "flexibility", "aerobic", "anaerobic", "endurance", "warm up", "cardiovascular fitness"], also: ["biology"] },
      { id: "sports-science", label: "Sports science", terms: ["sports science", "biomechanics of sport", "kinematics of sport", "elite performance", "recovery in sport"], also: ["mechanical-engineering"] },
      { id: "team-sports", label: "Team sports", terms: ["team sport", "tactical analysis", "formation", "possession", "match play", "referee", "rules of the game"], also: ["mathematics"] },
      { id: "athletics", label: "Athletics", terms: ["athletics", "sprinting", "marathon", "long jump", "high jump", "relay", "javelin", "discus"], also: ["physics"] },
      { id: "sports-psychology", label: "Sport psychology", terms: ["sport psychology", "performance anxiety", "motivation in sport", "mental skills training", "arousal"], also: ["psychology-human-behavior"] },
      { id: "health-education", label: "Health education", terms: ["health education", "physical activity", "lifestyle disease", "wellbeing", "first aid"], also: ["medicine-healthcare"] },
    ],
  },

  // ------------------------------------------------------ 46. GENERAL INTERDISCIPLINARY
  {
    id: "general-interdisciplinary",
    label: "General interdisciplinary studies",
    coarse: "general",
    aliases: ["interdisciplinary", "general studies", "liberal arts"],
    terms: ["interdisciplinary", "cross disciplinary", "liberal arts", "general studies", "foundations", "first year", "common core"],
    subdomains: [
      { id: "foundations", label: "Foundations and first-year skills", terms: ["first year", "foundation year", "academic writing", "critical reading", "common core curriculum"], also: ["education"] },
      { id: "liberal-arts", label: "Liberal arts", terms: ["liberal arts", "great books", "humanities core", "interdisciplinary humanities", "comparative studies"], also: ["arts-humanities"] },
      { id: "science-technology-society", label: "Science, technology and society", terms: ["science technology and society", "sts", "technology and society", "impact of technology", "responsible innovation"], also: ["philosophy"] },
      { id: "problem-based", label: "Problem-based learning", terms: ["problem based learning", "problem-based learning", "capstone", "group project", "real world problem", "interdisciplinary project"], also: ["business-management"] },
      { id: "skills-for-interdisciplinary", label: "Transferable skills", terms: ["transferable skills", "communication skills", "teamwork", "problem solving", "time management"], also: ["education"] },
    ],
  },

  // ----------------------------------------------------------- 47. GENERAL ACADEMIC
  {
    id: "general-academic",
    label: "General academic study",
    coarse: "general",
    aliases: ["general academic", "general knowledge", "revision", "exam preparation"],
    terms: ["general", "general knowledge", "revision", "exam preparation", "overview", "introduction to", "basics of", "exam", "questions"],
    subdomains: [
      { id: "revision", label: "Revision and exam preparation", terms: ["revision", "revision notes", "exam preparation", "past paper", "practice questions", "mock exam", "revision timetable"], also: ["education"] },
      { id: "study-skills", label: "Study skills", terms: ["study skills", "note taking", "mind map", "flashcards", "revision plan"], also: ["general-interdisciplinary"] },
      { id: "general-knowledge", label: "General knowledge", terms: ["general knowledge", "general awareness", "quiz", "crossword", "trivia"], also: ["general-interdisciplinary"] },
    ],
  },
];
