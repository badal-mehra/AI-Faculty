// DEVELOPMENT + ACCEPTANCE ONLY — deterministic, offline teaching scenarios.
//
// These are RAW teaching responses in exactly the shape a real provider returns, so every one of
// them goes through the SAME `parseTeachingResponse()` validation, the SAME engines and the SAME
// renderers as a live Gemini/Groq lesson. They exist so the 3D pipeline can be verified in a real
// browser without an API key, and so a regression in any domain is reproducible.
//
// They are not a fallback for production: the production routes only serve them in development.

export type ScenarioStep = {
  speech: string;
  board_actions: Array<Record<string, unknown>>;
  visual_actions?: Array<Record<string, unknown>>;
  visual3d_actions?: Array<Record<string, unknown>>;
  lesson_step: number;
  next_step: number;
};

export type TeachingScenario = {
  id: string;
  title: string;
  domain: string;
  /** Lower-case keywords matched against the student question to auto-select this scenario. */
  match: string[];
  steps: ScenarioStep[];
};

export const TEACHING_SCENARIOS: TeachingScenario[] = [
  {
    id: "heart",
    title: "Human heart: chambers, valves and blood flow",
    domain: "Biology",
    match: ["heart", "dil", "blood flow", "pump", "cardiac"],
    steps: [
      {
        speech: "The heart is a muscular pump with four chambers. Let us look at the whole organ first.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "heart", type: "model", asset: "biology/heart", placement: { kind: "anchor", anchor: "center" } },
          { action: "frame_camera" },
          { action: "show_3d_label", id: "lbl-heart", target: "heart", text: "Human heart", subtitle: "four chambers, one pump" },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "Blood enters the right atrium from the vena cava, then passes through the tricuspid valve.",
        board_actions: [],
        visual3d_actions: [
          { action: "create_3d_object", id: "vena", type: "model", asset: "biology/blood-vessel", placement: { kind: "relation", relation: { type: "attached_to", objects: ["heart"], anchorPart: "vena_cava" } } },
          { action: "show_3d_label", id: "lbl-vena", target: "vena", text: "Vena cava", part: "vena_cava", side: "above", leader: true },
          { action: "highlight_3d_object", id: "heart", part: "tricuspid_valve", color: "#ffd166" },
          { action: "show_3d_label", id: "lbl-tricuspid", target: "heart", text: "Tricuspid valve", part: "tricuspid_valve", side: "right", leader: true },
          { action: "animate_flow", id: "flow-vena", from: "vena", to: "heart", color: "#4d7cff", shape: "sphere", particleCount: 26, speed: 0.7, loop: true, durationMs: 3400 },
        ],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "The left ventricle is the thickest chamber: it pumps oxygenated blood out through the aorta to the whole body.",
        board_actions: [],
        visual3d_actions: [
          { action: "highlight_3d_object", id: "heart", part: "left_ventricle", color: "#ef476f" },
          { action: "show_3d_label", id: "lbl-aorta", target: "heart", text: "Aorta", part: "aorta", side: "left", leader: true },
          { action: "show_3d_label", id: "lbl-lv", target: "heart", text: "Left ventricle", part: "left_ventricle", side: "below", leader: true },
          { action: "focus_camera", target: "heart", part: "left_ventricle" },
        ],
        lesson_step: 3,
        next_step: 4,
      },
      {
        // The generic inspection lesson: every action here works on ANY multi-part model, because each
        // one names a real semantic part and resolves through the registry rather than a topic rule.
        speech: "Now let us take the heart apart. Separating the chambers shows how the walls differ in thickness.",
        board_actions: [],
        visual3d_actions: [
          { action: "restore_parts", id: "heart" },
          { action: "explode_group", id: "heart", strength: 0.9 },
          { action: "show_3d_label", id: "lbl-explode", target: "heart", text: "Chambers separated", side: "above" },
        ],
        lesson_step: 4,
        next_step: 5,
      },      {
        speech: "Look at just the left ventricle on its own. Isolation hides the other parts rather than drawing a fake copy.",
        board_actions: [],
        visual3d_actions: [
          { action: "assemble_group", id: "heart" },
          { action: "isolate_part", id: "heart", part: "left_ventricle" },
          { action: "focus_camera", target: "heart", part: "left_ventricle" },
          { action: "pulse_3d_object", id: "heart", durationMs: 1400, color: "#ffd166" },
          { action: "show_3d_label", id: "lbl-iso", target: "heart", part: "left_ventricle", text: "Left ventricle only", side: "right", leader: true },
        ],
        lesson_step: 5,
        next_step: 6,
      },
      {
        speech: "Finally, let us measure the chamber and draw the direction blood leaves it.",
        board_actions: [],
        visual3d_actions: [
          { action: "restore_parts", id: "heart" },
          { action: "return_camera" },
          { action: "frame_camera" },
          { action: "show_measurement", id: "m-lv", from: "heart", to: { x: 0, y: 1.6, z: 0 }, text: "chamber height", color: "#66ccff" },
          { action: "show_vector", id: "v-out", from: "heart", direction: { x: 0, y: 1, z: 0 }, length: 2.4, color: "#ff9f1c", text: "outflow" },
          { action: "follow_object", target: "heart", part: "aorta" },
        ],
        lesson_step: 6,
        next_step: 6,
      },
    ],
  },
  {
    id: "brain",
    title: "Human brain: hemispheres, lobes and the cerebellum",
    domain: "Biology",
    match: ["brain", "cerebrum", "cerebellum", "cortex"],
    steps: [
      {
        speech: "The brain has two hemispheres separated by a deep fissure. Let us look at the whole organ first.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "brain", type: "model", asset: "biology/brain", placement: { kind: "anchor", anchor: "center" } },
          { action: "frame_camera" },
          { action: "show_3d_label", id: "lbl-brain", target: "brain", text: "Human brain", subtitle: "two hemispheres, folded cortex" },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "The left hemisphere handles the right side of the body, and the right hemisphere the left side.",
        board_actions: [],
        visual3d_actions: [
          { action: "highlight_3d_object", id: "brain", part: "left_hemisphere", color: "#7ec8f2" },
          { action: "show_3d_label", id: "lbl-left", target: "brain", text: "Left hemisphere", part: "left_hemisphere", side: "left", leader: true },
          { action: "show_3d_label", id: "lbl-fissure", target: "brain", text: "Longitudinal fissure", part: "longitudinal_fissure", side: "above", leader: true },
          { action: "highlight_3d_object", id: "brain", part: "right_hemisphere", color: "#f28fb0" },
          { action: "show_3d_label", id: "lbl-right", target: "brain", text: "Right hemisphere", part: "right_hemisphere", side: "right", leader: true },
        ],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "Each hemisphere is divided into lobes. The frontal lobe plans movement and the occipital lobe processes vision.",
        board_actions: [],
        visual3d_actions: [
          { action: "highlight_3d_object", id: "brain", part: "frontal_lobe", color: "#ffd166" },
          { action: "show_3d_label", id: "lbl-frontal", target: "brain", text: "Frontal lobe", part: "frontal_lobe", side: "left", leader: true },
          { action: "highlight_3d_object", id: "brain", part: "occipital_lobe", color: "#ef476f" },
          { action: "show_3d_label", id: "lbl-occipital", target: "brain", text: "Occipital lobe", part: "occipital_lobe", side: "right", leader: true },
        ],
        lesson_step: 3,
        next_step: 4,
      },
      {
        speech: "At the back sits the cerebellum, with its fine folia folds, and below it the brain stem carries every signal to the spinal cord.",
        board_actions: [],
        visual3d_actions: [
          { action: "restore_parts", id: "brain" },
          { action: "isolate_part", id: "brain", part: "cerebellum" },
          { action: "focus_camera", target: "brain", part: "cerebellum" },
          { action: "show_3d_label", id: "lbl-cerebellum", target: "brain", text: "Cerebellum", part: "cerebellum", side: "right", leader: true },
          { action: "restore_parts", id: "brain" },
          { action: "show_3d_label", id: "lbl-stem", target: "brain", text: "Brain stem", part: "brain_stem", side: "below", leader: true },
          { action: "frame_camera" },
        ],
        lesson_step: 4,
        next_step: 4,
      },
    ],
  },
  {
    id: "lungs",
    title: "Lungs: trachea, bronchi and gas exchange",
    domain: "Biology",
    match: ["lung", "lungs", "breathing", "trachea", "alveoli", "respiration"],
    steps: [
      {
        speech: "Air enters through the trachea and splits into two bronchi, one for each lung.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "lungs", type: "model", asset: "biology/lungs", placement: { kind: "anchor", anchor: "center" } },
          { action: "frame_camera" },
          { action: "show_3d_label", id: "lbl-lungs", target: "lungs", text: "Human lungs", subtitle: "left and right, with the heart between" },
          { action: "highlight_3d_object", id: "lungs", part: "trachea", color: "#ffd166" },
          { action: "show_3d_label", id: "lbl-trachea", target: "lungs", text: "Trachea", part: "trachea", side: "above", leader: true },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "The bronchi branch again and again into bronchioles, reaching every part of each lung.",
        board_actions: [],
        visual3d_actions: [
          { action: "highlight_3d_object", id: "lungs", part: "left_bronchus", color: "#7ec8f2" },
          { action: "show_3d_label", id: "lbl-lbronchus", target: "lungs", text: "Left bronchus", part: "left_bronchus", side: "left", leader: true },
          { action: "highlight_3d_object", id: "lungs", part: "right_bronchus", color: "#7ec8f2" },
          { action: "show_3d_label", id: "lbl-rbronchus", target: "lungs", text: "Right bronchus", part: "right_bronchus", side: "right", leader: true },
        ],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "At the very ends sit the alveoli. Their thin walls meet a capillary net, which is where oxygen actually enters the blood.",
        board_actions: [],
        visual3d_actions: [
          { action: "focus_camera", target: "lungs", part: "alveolus_1" },
          { action: "show_3d_label", id: "lbl-alveolus", target: "lungs", text: "Alveolus", part: "alveolus_1", side: "left", leader: true },
          { action: "show_3d_label", id: "lbl-capillary", target: "lungs", text: "Pulmonary capillary", part: "pulmonary_capillary", side: "right", leader: true },
          { action: "create_3d_object", id: "capillary_target", type: "sphere", position: { x: 1.5, y: -0.2, z: 0.6 }, scale: 0.25, color: "#5cc8ff" },
          { action: "animate_flow", id: "flow-o2", from: "lungs", to: "capillary_target", color: "#5cc8ff", shape: "sphere", particleCount: 22, speed: 0.8, loop: true, durationMs: 3200 },
        ],
        lesson_step: 3,
        next_step: 4,
      },
      {
        speech: "Below the lungs the diaphragm pulls down to draw air in. Two lobes on the left and three on the right keep the heart in place.",
        board_actions: [],
        visual3d_actions: [
          { action: "frame_camera" },
          { action: "highlight_3d_object", id: "lungs", part: "diaphragm", color: "#ffd166" },
          { action: "show_3d_label", id: "lbl-diaphragm", target: "lungs", text: "Diaphragm", part: "diaphragm", side: "below", leader: true },
          { action: "show_3d_label", id: "lbl-heartpos", target: "lungs", text: "Heart position", part: "heart_position", side: "left", leader: true },
        ],
        lesson_step: 4,
        next_step: 4,
      },
    ],
  },
  {
    id: "cell",
    title: "Animal cell: membrane, nucleus and organelles",
    domain: "Biology",
    match: ["cell", "organelle", "organelles", "mitochondria", "nucleus"],
    steps: [
      {
        speech: "An animal cell is enclosed by a flexible membrane, with the cytoplasm filling the space inside.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "cell", type: "model", asset: "biology/cell", placement: { kind: "anchor", anchor: "center" } },
          { action: "frame_camera" },
          { action: "show_3d_label", id: "lbl-cell", target: "cell", text: "Animal cell", subtitle: "membrane, cytoplasm, organelles" },
          { action: "show_3d_label", id: "lbl-membrane", target: "cell", text: "Cell membrane", part: "cell_membrane", side: "above", leader: true },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "The nucleus holds the DNA. Its envelope is studded with pores, and the nucleolus builds ribosomes.",
        board_actions: [],
        visual3d_actions: [
          { action: "highlight_3d_object", id: "cell", part: "nucleus", color: "#b18cff" },
          { action: "focus_camera", target: "cell", part: "nucleus" },
          { action: "show_3d_label", id: "lbl-nucleus", target: "cell", text: "Nucleus", part: "nucleus", side: "above", leader: true },
          { action: "show_3d_label", id: "lbl-nucleolus", target: "cell", text: "Nucleolus", part: "nucleolus", side: "right", leader: true },
          { action: "show_3d_label", id: "lbl-pore", target: "cell", text: "Nuclear pore", part: "nuclear_pore_1", side: "left", leader: true },
        ],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "Mitochondria release energy from glucose. Their inner membrane is folded into cristae, which increases the surface area.",
        board_actions: [],
        visual3d_actions: [
          { action: "restore_parts", id: "cell" },
          { action: "isolate_part", id: "cell", part: "mitochondrion_1" },
          { action: "focus_camera", target: "cell", part: "mitochondrion_1" },
          { action: "show_3d_label", id: "lbl-mito", target: "cell", text: "Mitochondrion", part: "mitochondrion_1", side: "above", leader: true },
          { action: "show_3d_label", id: "lbl-crista", target: "cell", text: "Cristae", part: "crista_1a", side: "right", leader: true },
          { action: "restore_parts", id: "cell" },
        ],
        lesson_step: 3,
        next_step: 4,
      },
      {
        speech: "Ribosomes on the rough endoplasmic reticulum make proteins, the Golgi packs and ships them, and lysosomes digest waste.",
        board_actions: [],
        visual3d_actions: [
          { action: "focus_camera", target: "cell", part: "rough_endoplasmic_reticulum" },
          { action: "show_3d_label", id: "lbl-er", target: "cell", text: "Rough ER", part: "rough_endoplasmic_reticulum", side: "right", leader: true },
          { action: "show_3d_label", id: "lbl-golgi", target: "cell", text: "Golgi apparatus", part: "golgi_cisterna_1", side: "left", leader: true },
          { action: "show_3d_label", id: "lbl-lysosome", target: "cell", text: "Lysosome", part: "lysosome", side: "below", leader: true },
          { action: "frame_camera" },
        ],
        lesson_step: 4,
        next_step: 4,
      },
    ],
  },
  {
    id: "photosynthesis",
    title: "Photosynthesis inside a leaf",
    domain: "Biology",
    match: ["photosynthesis", "leaf", "chloroplast", "co2", "oxygen"],
    steps: [
      {
        speech: "Photosynthesis happens inside the chloroplasts of a leaf. Here is the leaf itself.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "leaf", type: "model", asset: "biology/leaf", placement: { kind: "anchor", anchor: "center" } },
          { action: "frame_camera" },
          { action: "show_3d_label", id: "lbl-leaf", target: "leaf", text: "Leaf blade", part: "leaf_blade", side: "above", leader: true },
          { action: "show_3d_label", id: "lbl-midrib", target: "leaf", text: "Midrib", part: "midrib", side: "right", leader: true },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "Chloroplasts hold chlorophyll, the green pigment that captures light energy.",
        board_actions: [],
        visual3d_actions: [
          { action: "create_3d_object", id: "chloro", type: "model", asset: "biology/chloroplast", placement: { kind: "relation", relation: { type: "inside", objects: ["leaf"] } } },
          { action: "show_3d_label", id: "lbl-chloro", target: "chloro", text: "Chloroplast", part: "chloroplast_1", side: "left", leader: true },
          { action: "focus_camera", target: "chloro" },
        ],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "Carbon dioxide enters through the stomata, water arrives from the veins, and light energy drives the reaction that releases oxygen.",
        board_actions: [],
        visual3d_actions: [
          { action: "create_3d_object", id: "air", type: "sphere", position: { x: 0, y: 0, z: 0 }, scale: 0.35, color: "#bde0fe" },
          { action: "show_3d_label", id: "lbl-air", target: "air", text: "Outside air (CO2 in, O2 out)", side: "above", leader: true },
          { action: "animate_flow", id: "co2-in", from: "air", to: "chloro", color: "#8ecae6", shape: "drop", particleCount: 18, speed: 0.8, loop: true },
          { action: "animate_flow", id: "o2-out", from: "chloro", to: "air", color: "#95d5b2", shape: "glow", particleCount: 22, speed: 0.9, loop: true, trail: true },
          { action: "frame_camera" },
        ],
        lesson_step: 3,
        next_step: 3,
      },
    ],
  },
  {
    id: "pendulum",
    title: "Simple pendulum and its oscillation",
    domain: "Physics",
    match: ["pendulum", "oscillat", "swing", "period", "simple harmonic"],
    steps: [
      {
        speech: "A simple pendulum is a mass on a massless string. Let us build it.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "pivot", type: "sphere", position: { x: 0, y: 6, z: 0 }, scale: 0.5, color: "#c9d1d9" },
          { action: "create_3d_object", id: "rod", type: "cylinder", position: { x: 0, y: 3, z: 0 }, scale: 0.2, color: "#8b949e" },
          { action: "create_3d_object", id: "bob", type: "sphere", position: { x: 0, y: 0.6, z: 0 }, scale: 1.2, color: "#f5a623" },
          { action: "create_3d_object", id: "weight", type: "cylinder", position: { x: 3.2, y: 0.4, z: 1.2 }, scale: 0.8, color: "#4a90d9" },
          { action: "create_3d_object", id: "weight-label", type: "text", text: "m", position: { x: 3.2, y: 1.6, z: 1.2 }, color: "#4a90d9" },
          { action: "animate_orbit", id: "bob", center: "pivot", radius: 5.4, speedDegPerSec: 26, tiltDeg: 0 },
          { action: "animate_orbit", id: "rod", center: "pivot", radius: 3, speedDegPerSec: 26, tiltDeg: 0 },
          { action: "animate_flow", id: "pull", from: "weight", to: "bob", color: "#ff6b6b", shape: "arrow", particleCount: 3, speed: 0.6, loop: true },
          { action: "show_3d_label", id: "lbl-bob", target: "bob", text: "Bob (m)", side: "right", leader: true },
          { action: "show_3d_label", id: "lbl-pivot", target: "pivot", text: "Pivot", side: "left", leader: true },
          { action: "frame_camera" },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "Pull the bob to one side and release: gravity restores it, and the period grows with the square root of the length.",
        board_actions: [],
        visual3d_actions: [
          { action: "highlight_3d_object", id: "bob", color: "#ffd166" },
          { action: "focus_camera", target: "bob" },
          { action: "show_3d_label", id: "lbl-len", target: "rod", text: "L = 1 m", side: "left", leader: true },
        ],
        lesson_step: 2,
        next_step: 2,
      },
    ],
  },
  {
    id: "tcp",
    title: "TCP three-way handshake between two hosts",
    domain: "Computer networking",
    match: ["tcp", "handshake", "syn", "packet", "network", "socket", "latency"],
    steps: [
      {
        speech: "A TCP connection starts with a three-way handshake. Here are the two machines.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "client", type: "model", asset: "network/laptop", placement: { kind: "relation", relation: { type: "left_of", objects: ["server"] } } },
          { action: "create_3d_object", id: "server", type: "model", asset: "network/server", placement: { kind: "anchor", anchor: "right" } },
          { action: "create_3d_object", id: "router", type: "model", asset: "network/router", placement: { kind: "relation", relation: { type: "between", objects: ["client", "server"] } } },
          { action: "show_3d_label", id: "lbl-client", target: "client", text: "Client", side: "below", leader: true },
          { action: "show_3d_label", id: "lbl-server", target: "server", text: "Server", side: "below", leader: true },
          { action: "show_3d_label", id: "lbl-router", target: "router", text: "Router", side: "above", leader: true },
          { action: "frame_camera" },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "The client sends SYN. Watch the packet travel through the router.",
        board_actions: [],
        visual3d_actions: [
          { action: "animate_flow", id: "syn", from: "client", to: "server", color: "#ffd166", shape: "cube", size: 0.5, particleCount: 3, speed: 1.1, loop: true, trail: true, durationMs: 2600 },
          { action: "highlight_3d_object", id: "router", color: "#ffd166" },
        ],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "The server answers SYN-ACK, and the client finishes with ACK. Now the connection is established.",
        board_actions: [],
        visual3d_actions: [
          { action: "animate_flow", id: "synack", from: "server", to: "client", color: "#4cc9f0", shape: "cube", size: 0.5, particleCount: 3, speed: 1.1, loop: true, trail: true, durationMs: 2600 },
          { action: "highlight_3d_object", id: "server", color: "#4cc9f0" },
        ],
        lesson_step: 3,
        next_step: 4,
      },
      {
        speech: "Only after all three segments is the connection ready for data.",
        board_actions: [],
        visual3d_actions: [
          { action: "animate_flow", id: "ack", from: "client", to: "server", color: "#80ed99", shape: "cube", size: 0.5, particleCount: 3, speed: 1.2, loop: true, trail: true, durationMs: 2400 },
          { action: "highlight_3d_object", id: "client", color: "#80ed99" },
          { action: "frame_camera" },
        ],
        lesson_step: 4,
        next_step: 4,
      },
    ],
  },
  {
    id: "atom",
    title: "Atomic structure with electron shells",
    domain: "Chemistry",
    match: ["atom", "electron", "nucleus", "proton", "neutron", "orbital", "bohr"],
    steps: [
      {
        speech: "An atom is a nucleus of protons and neutrons with electrons in shells around it.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "nucleus", type: "sphere", position: { x: 0, y: 0, z: 0 }, scale: 1.6, color: "#ff6b6b" },
          { action: "create_3d_object", id: "shell1", type: "sphere", position: { x: 0, y: 0, z: 0 }, scale: 2.2, color: "#4cc9f0" },
          { action: "create_3d_object", id: "shell2", type: "sphere", position: { x: 0, y: 0, z: 0 }, scale: 3.4, color: "#90e0ef" },
          { action: "create_3d_object", id: "e1", type: "sphere", position: { x: 2.2, y: 0, z: 0 }, scale: 0.35, color: "#ffd166", orbit: { center: "nucleus", radius: 2.2, speedDegPerSec: 45 } },
          { action: "create_3d_object", id: "e2", type: "sphere", position: { x: -2.2, y: 0, z: 0 }, scale: 0.35, color: "#ffd166", orbit: { center: "nucleus", radius: 2.2, speedDegPerSec: 45, tiltDeg: 30 } },
          { action: "create_3d_object", id: "e3", type: "sphere", position: { x: 0, y: 3.4, z: 0 }, scale: 0.35, color: "#ffd166", orbit: { center: "nucleus", radius: 3.4, speedDegPerSec: 26, tiltDeg: 60 } },
          { action: "show_3d_label", id: "lbl-nucleus", target: "nucleus", text: "Nucleus (protons + neutrons)", side: "below", leader: true },
          { action: "show_3d_label", id: "lbl-e", target: "e1", text: "Electron", side: "above", leader: true },
          { action: "frame_camera" },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "In helium there are two protons, two neutrons and two electrons in the first shell.",
        board_actions: [],
        visual3d_actions: [
          { action: "create_3d_object", id: "p1", type: "sphere", placement: { kind: "relation", relation: { type: "inside", objects: ["nucleus"] } }, scale: 0.3, color: "#ff6b6b" },
          { action: "highlight_3d_object", id: "shell1", color: "#80ed99" },
          { action: "focus_camera", target: "nucleus" },
        ],
        lesson_step: 2,
        next_step: 2,
      },
    ],
  },
  {
    id: "solar-system",
    title: "Solar system with orbiting planets",
    domain: "Astronomy",
    match: ["solar system", "planet", "sun", "orbit", "solar", "mercury", "venus", "mars", "jupiter", "saturn"],
    steps: [
      {
        speech: "The Sun holds most of the mass of the solar system, and the planets orbit it.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "sun", type: "model", asset: "astronomy/sun", placement: { kind: "anchor", anchor: "center" } },
          { action: "create_3d_object", id: "mercury", type: "model", asset: "astronomy/mercury", orbit: { center: "sun", radius: 3.4, speedDegPerSec: 22 } },
          { action: "create_3d_object", id: "venus", type: "model", asset: "astronomy/venus", orbit: { center: "sun", radius: 5, speedDegPerSec: 16 } },
          { action: "create_3d_object", id: "earth3d", type: "model", asset: "earth/globe", orbit: { center: "sun", radius: 7, speedDegPerSec: 12 } },
          { action: "create_3d_object", id: "mars", type: "model", asset: "astronomy/mars", orbit: { center: "sun", radius: 9.2, speedDegPerSec: 9 } },
          { action: "create_3d_object", id: "jupiter", type: "model", asset: "astronomy/jupiter", orbit: { center: "sun", radius: 12, speedDegPerSec: 6 } },
          { action: "show_3d_label", id: "lbl-sun", target: "sun", text: "Sun", side: "above", leader: true },
          { action: "show_3d_label", id: "lbl-earth", target: "earth3d", text: "Earth", side: "right", leader: true },
          { action: "frame_camera" },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "The inner planets are small and rocky; the outer giants are far larger and made of gas.",
        board_actions: [],
        visual3d_actions: [
          { action: "highlight_3d_object", id: "jupiter", color: "#ffd166" },
          { action: "show_3d_label", id: "lbl-jupiter", target: "jupiter", text: "Jupiter (gas giant)", side: "below", leader: true },
          { action: "focus_camera", target: "jupiter" },
        ],
        lesson_step: 2,
        next_step: 2,
      },
    ],
  },
  {
    id: "cylinder-volume",
    title: "Volume of a cylinder by filling",
    domain: "Mathematics",
    match: ["cylinder", "volume", "formula", "geometry", "radius", "height", "pi"],
    steps: [
      {
        speech: "A cylinder of radius r and height h. Here is the solid itself.",
        board_actions: [],
        visual3d_actions: [
          { action: "clear_3d_scene" },
          { action: "create_3d_object", id: "cyl", type: "model", asset: "mathematics/cylinder", placement: { kind: "anchor", anchor: "center" } },
          { action: "show_3d_label", id: "lbl-r", target: "cyl", text: "radius r", side: "right", leader: true },
          { action: "show_3d_label", id: "lbl-h", target: "cyl", text: "height h", side: "left", leader: true },
          { action: "frame_camera" },
        ],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "Slice the cylinder into two parts and slide them apart: a cylinder is a rectangle rolled up.",
        board_actions: [],
        visual3d_actions: [
          { action: "move_3d_object", id: "cyl", position: { x: -2, y: 0, z: 0 }, animate: { kind: "move", durationMs: 900 } },
          { action: "show_3d_label", id: "lbl-net", target: "cyl", text: "Net: w = 2*pi*r, h = h", side: "below", leader: true },
        ],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "Area times height gives the volume: V = pi * r^2 * h.",
        board_actions: [],
        visual3d_actions: [
          { action: "move_3d_object", id: "cyl", position: { x: 0, y: 0, z: 0 }, animate: { kind: "move", durationMs: 900 } },
          { action: "create_3d_object", id: "base", type: "cylinder", position: { x: 3.2, y: -1.6, z: 0 }, scale: 1.1, color: "#4cc9f0" },
          { action: "show_3d_label", id: "lbl-base", target: "base", text: "base area = pi*r^2", side: "below", leader: true },
          { action: "show_3d_label", id: "lbl-v", target: "cyl", text: "V = pi*r^2*h", side: "above", leader: true },
          { action: "frame_camera" },
        ],
        lesson_step: 3,
        next_step: 3,
      },
    ],
  },
  {
    id: "bst",
    title: "Binary search tree insertion",
    domain: "Computer science",
    match: ["binary search tree", "bst", "tree", "insert", "search tree", "node"],
    steps: [
      {
        speech: "A binary search tree keeps smaller keys on the left and larger keys on the right. Start with 50.",
        board_actions: [
          { action: "clear" },
          { action: "draw_node", id: "node-50", value: "50" },
        ],
        visual3d_actions: [],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "30 is smaller than 50, so it becomes the left child.",
        board_actions: [
          { action: "draw_node", id: "node-30", value: "30", parentId: "node-50", side: "left" },
          { action: "connect", from: "node-50", to: "node-30" },
          { action: "highlight", target: "node-30" },
        ],
        visual3d_actions: [],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "70 is larger than 50, so it becomes the right child.",
        board_actions: [
          { action: "draw_node", id: "node-70", value: "70", parentId: "node-50", side: "right" },
          { action: "connect", from: "node-50", to: "node-70" },
          { action: "highlight", target: "node-70" },
        ],
        visual3d_actions: [],
        lesson_step: 3,
        next_step: 3,
      },
    ],
  },
  {
    id: "code-trace",
    title: "Tracing a swap inside bubble sort",
    domain: "Computer science",
    match: ["bubble sort", "code trace", "swap", "code step", "trace the code"],
    steps: [
      {
        speech: "Bubble sort compares neighbours and swaps them when they are out of order. Here is the swap itself.",
        visual_actions: [
          { action: "clear" },
          {
            action: "create_code_block",
            id: "swap-code",
            language: "c",
            title: "swap(a, i, j)",
            code: "void swap(int a[], int i, int j) {\n  int t = a[i];\n  a[i] = a[j];\n  a[j] = t;\n}",
            highlightLines: [2],
          },
          { action: "create_array", id: "row", values: ["5", "2", "4", "1"], indices: true, title: "the array we are sorting" },
        ],
        board_actions: [],
        visual3d_actions: [],
        lesson_step: 1,
        next_step: 2,
      },
      {
        speech: "Line two reads the value at position i into a temporary, so it is not lost when we overwrite a[i].",
        visual_actions: [
          { action: "set_code_pointer", id: "swap-code", lines: [2] },
        ],
        board_actions: [],
        visual3d_actions: [],
        lesson_step: 2,
        next_step: 3,
      },
      {
        speech: "Now we compare 5 and 2. Five is greater than two, so the two positions are swapped: 5 moves right and 2 moves left.",
        visual_actions: [
          { action: "set_code_pointer", id: "swap-code", lines: [3] },
          { action: "update_array", id: "row", values: ["2", "5", "4", "1"] },
          { action: "create_label", id: "cmp", target: "row-c0", text: "5 > 2 -> swap", side: "above" },
        ],
        board_actions: [],
        visual3d_actions: [],
        lesson_step: 3,
        next_step: 4,
      },
      {
        speech: "The row becomes 2, 5, 4, 1. The pass is not finished: we keep comparing the next pair, 5 and 4.",
        visual_actions: [
          { action: "set_code_pointer", id: "swap-code", lines: [3] },
          { action: "update_array", id: "row", values: ["2", "4", "5", "1"] },
          { action: "remove", id: "cmp" },
          { action: "create_label", id: "cmp2", target: "row-c1", text: "5 > 4 -> swap", side: "above" },
        ],
        board_actions: [],
        visual3d_actions: [],
        lesson_step: 4,
        next_step: 5,
      },
      {
        speech: "Then 5 moves right again past 1, and the row reads 2, 4, 1, 5. The largest value has bubbled all the way to the end, which is exactly what bubble sort is named for.",
        visual_actions: [
          { action: "set_code_pointer", id: "swap-code", lines: [4] },
          { action: "update_array", id: "row", values: ["2", "4", "1", "5"] },
          { action: "remove", id: "cmp2" },
          { action: "create_label", id: "done", target: "row-c3", text: "5 is in its final place", side: "above" },
          { action: "set_theme", theme: "computer-science" },
        ],
        board_actions: [],
        visual3d_actions: [],
        lesson_step: 5,
        next_step: 6,
      },
    ],
  },
];

export function findScenario(id: string): TeachingScenario | undefined {
  return TEACHING_SCENARIOS.find((scenario) => scenario.id === id);
}

/** Picks the scenario whose keywords best match the student's question. */
export function matchScenario(question: string): TeachingScenario | undefined {
  const text = question.toLowerCase();
  let best: TeachingScenario | undefined;
  let bestScore = 0;
  for (const scenario of TEACHING_SCENARIOS) {
    const score = scenario.match.reduce((total, keyword) => (text.includes(keyword) ? total + keyword.length : total), 0);
    if (score > bestScore) {
      best = scenario;
      bestScore = score;
    }
  }
  return best;
}
