// GENERATED FILE — do not edit by hand.
// Produced by `npm run assets:build` (scripts/build-assets.mjs), which writes the matching .glb
// files into public/models/. Every number below is MEASURED from the generated geometry.
//
// This is the machine layer of the trusted asset registry: identity, local model path, normalized
// bounding radius, camera framing hint, triangle budget and the named semantic anchors that let the
// AI refer to a specific part of a model ("left_ventricle", "electron_shell_2", "nucleus").

export type GeneratedAssetPart = { center: [number, number, number]; radius: number };

/** Measured, normalized bounds of the whole shipped mesh (the model is normalized to radius 1). */
export type GeneratedAssetBounds = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  radius: number;
};

export type GeneratedAsset = {
  id: string;
  category: string;
  name: string;
  path: string;
  fallbackType: string;
  defaultColor: string;
  aliases: string[];
  boundingRadius: number;
  recommendedCameraDistance: number;
  partCount: number;
  meshCount: number;
  materialCount: number;
  bounds: GeneratedAssetBounds;
  triangles: number;
  bytes: number;
  semanticAnchors: string[];
  anchors: Record<string, GeneratedAssetPart>;
};

export const GENERATED_ASSETS: GeneratedAsset[] = [
  {
    "id": "biology/heart",
    "category": "biology",
    "name": "Human Heart",
    "path": "/models/biology/heart.glb",
    "fallbackType": "sphere",
    "defaultColor": "#d64545",
    "aliases": [
      "heart",
      "human heart"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 11,
    "meshCount": 11,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.55129,
        -0.7748,
        -0.30946
      ],
      "max": [
        0.55129,
        0.7748,
        0.30946
      ],
      "size": [
        1.10258,
        1.5496,
        0.61892
      ],
      "radius": 1
    },
    "triangles": 12188,
    "bytes": 245568,
    "semanticAnchors": [
      "left_ventricle",
      "right_ventricle",
      "left_atrium",
      "right_atrium",
      "septum",
      "aorta",
      "pulmonary_artery",
      "vena_cava",
      "pulmonary_vein",
      "mitral_valve",
      "tricuspid_valve"
    ],
    "anchors": {
      "left_ventricle": {
        "center": [
          -0.232,
          -0.36566,
          0
        ],
        "radius": 0.60424
      },
      "right_ventricle": {
        "center": [
          0.16944,
          -0.38843,
          -0.00096
        ],
        "radius": 0.55231
      },
      "left_atrium": {
        "center": [
          -0.29076,
          0.0063,
          -0.04919
        ],
        "radius": 0.30022
      },
      "right_atrium": {
        "center": [
          0.19463,
          -0.00348,
          -0.04833
        ],
        "radius": 0.28362
      },
      "septum": {
        "center": [
          -0.03381,
          -0.36298,
          -0.01755
        ],
        "radius": 0.33892
      },
      "aorta": {
        "center": [
          -0.03053,
          0.41141,
          0.02178
        ],
        "radius": 0.47135
      },
      "pulmonary_artery": {
        "center": [
          0.30954,
          0.1428,
          0.02345
        ],
        "radius": 0.31935
      },
      "vena_cava": {
        "center": [
          0.26743,
          0.00254,
          -0.10335
        ],
        "radius": 0.22822
      },
      "pulmonary_vein": {
        "center": [
          -0.35822,
          0.00474,
          -0.10345
        ],
        "radius": 0.16747
      },
      "mitral_valve": {
        "center": [
          -0.24995,
          -0.13243,
          -0.01755
        ],
        "radius": 0.14463
      },
      "tricuspid_valve": {
        "center": [
          0.17272,
          -0.14684,
          -0.01755
        ],
        "radius": 0.13794
      }
    }
  },
  {
    "id": "biology/lungs",
    "category": "biology",
    "name": "Human Lungs",
    "path": "/models/biology/lungs.glb",
    "fallbackType": "sphere",
    "defaultColor": "#d98c8c",
    "aliases": [
      "lung",
      "lungs"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 34,
    "meshCount": 34,
    "materialCount": 10,
    "bounds": {
      "min": [
        -0.56791,
        -0.77527,
        -0.27648
      ],
      "max": [
        0.56791,
        0.77527,
        0.27648
      ],
      "size": [
        1.13582,
        1.55054,
        0.55296
      ],
      "radius": 1
    },
    "triangles": 18634,
    "bytes": 399628,
    "semanticAnchors": [
      "left_lung",
      "right_lung",
      "left_upper_lobe",
      "right_upper_lobe",
      "heart_position",
      "trachea",
      "tracheal_ring_1",
      "tracheal_ring_2",
      "tracheal_ring_3",
      "tracheal_ring_4",
      "tracheal_ring_5",
      "tracheal_ring_6",
      "tracheal_ring_7",
      "left_bronchus",
      "right_bronchus",
      "bronchiole_l_1",
      "bronchiole_l_2",
      "bronchiole_l_3",
      "bronchiole_r_1",
      "bronchiole_r_2",
      "bronchiole_r_3",
      "alveolus_1",
      "alveolus_2",
      "alveolus_3",
      "alveolus_4",
      "alveolus_5",
      "alveolus_6",
      "alveolus_7",
      "alveolus_8",
      "alveolar_sac",
      "pulmonary_capillary",
      "diaphragm",
      "pleural_membrane",
      "pleural_membrane_right"
    ],
    "anchors": {
      "left_lung": {
        "center": [
          -0.28782,
          -0.02852,
          -0.00265
        ],
        "radius": 0.53906
      },
      "right_lung": {
        "center": [
          0.2869,
          -0.03193,
          0.00209
        ],
        "radius": 0.53701
      },
      "left_upper_lobe": {
        "center": [
          -0.29408,
          0.15833,
          -0.00149
        ],
        "radius": 0.3536
      },
      "right_upper_lobe": {
        "center": [
          0.29309,
          0.14803,
          0.00284
        ],
        "radius": 0.34978
      },
      "heart_position": {
        "center": [
          -0.26901,
          -0.08406,
          0.15692
        ],
        "radius": 0.19414
      },
      "trachea": {
        "center": [
          0,
          0.49505,
          0
        ],
        "radius": 0.2927
      },
      "tracheal_ring_1": {
        "center": [
          0,
          0.2522,
          0
        ],
        "radius": 0.10151
      },
      "tracheal_ring_2": {
        "center": [
          0,
          0.33066,
          0
        ],
        "radius": 0.10151
      },
      "tracheal_ring_3": {
        "center": [
          0,
          0.40912,
          0
        ],
        "radius": 0.10151
      },
      "tracheal_ring_4": {
        "center": [
          0,
          0.48758,
          0
        ],
        "radius": 0.10151
      },
      "tracheal_ring_5": {
        "center": [
          0,
          0.56604,
          0
        ],
        "radius": 0.10152
      },
      "tracheal_ring_6": {
        "center": [
          0,
          0.6445,
          0
        ],
        "radius": 0.10152
      },
      "tracheal_ring_7": {
        "center": [
          0,
          0.72296,
          0
        ],
        "radius": 0.10152
      },
      "left_bronchus": {
        "center": [
          -0.11894,
          0.1562,
          0.00943
        ],
        "radius": 0.19971
      },
      "right_bronchus": {
        "center": [
          0.11894,
          0.1562,
          0.00943
        ],
        "radius": 0.19971
      },
      "bronchiole_l_1": {
        "center": [
          -0.19064,
          -0.03736,
          0.01872
        ],
        "radius": 0.1108
      },
      "bronchiole_l_2": {
        "center": [
          -0.17769,
          -0.07862,
          0.0187
        ],
        "radius": 0.149
      },
      "bronchiole_l_3": {
        "center": [
          -0.17491,
          -0.11658,
          0.01869
        ],
        "radius": 0.19387
      },
      "bronchiole_r_1": {
        "center": [
          0.19065,
          -0.03736,
          0.01872
        ],
        "radius": 0.1108
      },
      "bronchiole_r_2": {
        "center": [
          0.1777,
          -0.07862,
          0.0187
        ],
        "radius": 0.149
      },
      "bronchiole_r_3": {
        "center": [
          0.17491,
          -0.11658,
          0.01869
        ],
        "radius": 0.19387
      },
      "alveolus_1": {
        "center": [
          -0.2989,
          -0.14011,
          0.15692
        ],
        "radius": 0.06471
      },
      "alveolus_2": {
        "center": [
          -0.23912,
          -0.14011,
          0.15692
        ],
        "radius": 0.06471
      },
      "alveolus_3": {
        "center": [
          -0.17934,
          -0.14011,
          0.15692
        ],
        "radius": 0.06471
      },
      "alveolus_4": {
        "center": [
          -0.11956,
          -0.14011,
          0.15692
        ],
        "radius": 0.06471
      },
      "alveolus_5": {
        "center": [
          -0.2989,
          -0.2223,
          0.15692
        ],
        "radius": 0.06471
      },
      "alveolus_6": {
        "center": [
          -0.23912,
          -0.2223,
          0.15692
        ],
        "radius": 0.06471
      },
      "alveolus_7": {
        "center": [
          -0.17934,
          -0.2223,
          0.15692
        ],
        "radius": 0.06471
      },
      "alveolus_8": {
        "center": [
          -0.11956,
          -0.2223,
          0.15692
        ],
        "radius": 0.06471
      },
      "alveolar_sac": {
        "center": [
          0.2989,
          -0.16626,
          0.15692
        ],
        "radius": 0.12943
      },
      "pulmonary_capillary": {
        "center": [
          0.29461,
          -0.11355,
          0.1727
        ],
        "radius": 0.11247
      },
      "diaphragm": {
        "center": [
          0,
          -0.49505,
          0
        ],
        "radius": 0.51297
      },
      "pleural_membrane": {
        "center": [
          -0.29142,
          -0.02802,
          0
        ],
        "radius": 0.47888
      },
      "pleural_membrane_right": {
        "center": [
          0.29143,
          -0.02802,
          0
        ],
        "radius": 0.47888
      }
    }
  },
  {
    "id": "biology/brain",
    "category": "biology",
    "name": "Human Brain",
    "path": "/models/biology/brain.glb",
    "fallbackType": "sphere",
    "defaultColor": "#e0a3b4",
    "aliases": [
      "brain"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 28,
    "meshCount": 28,
    "materialCount": 9,
    "bounds": {
      "min": [
        -0.57441,
        -0.5991,
        -0.55779
      ],
      "max": [
        0.57441,
        0.5991,
        0.55779
      ],
      "size": [
        1.14882,
        1.1982,
        1.11558
      ],
      "radius": 1
    },
    "triangles": 14788,
    "bytes": 321204,
    "semanticAnchors": [
      "left_hemisphere",
      "right_hemisphere",
      "gyrus_l_1",
      "gyrus_l_2",
      "gyrus_l_3",
      "gyrus_l_4",
      "gyrus_l_5",
      "gyrus_r_1",
      "gyrus_r_2",
      "gyrus_r_3",
      "gyrus_r_4",
      "gyrus_r_5",
      "longitudinal_fissure",
      "corpus_callosum",
      "cerebellum",
      "cerebellar_folium_1",
      "cerebellar_folium_2",
      "cerebellar_folium_3",
      "cerebellar_folium_4",
      "cerebellar_folium_5",
      "cerebellar_folium_6",
      "brain_stem",
      "spinal_cord",
      "frontal_lobe",
      "parietal_lobe",
      "temporal_lobe",
      "temporal_lobe_left",
      "occipital_lobe"
    ],
    "anchors": {
      "left_hemisphere": {
        "center": [
          -0.18411,
          0.22671,
          0.0316
        ],
        "radius": 0.69761
      },
      "right_hemisphere": {
        "center": [
          0.18472,
          0.22379,
          0.0339
        ],
        "radius": 0.70463
      },
      "gyrus_l_1": {
        "center": [
          -0.19747,
          0.37798,
          -0.07927
        ],
        "radius": 0.18202
      },
      "gyrus_l_2": {
        "center": [
          -0.19747,
          0.29011,
          -0.01337
        ],
        "radius": 0.16705
      },
      "gyrus_l_3": {
        "center": [
          -0.19747,
          0.20224,
          0.05254
        ],
        "radius": 0.15209
      },
      "gyrus_l_4": {
        "center": [
          -0.19747,
          0.11437,
          0.11844
        ],
        "radius": 0.13712
      },
      "gyrus_l_5": {
        "center": [
          -0.19747,
          0.0265,
          0.18434
        ],
        "radius": 0.12216
      },
      "gyrus_r_1": {
        "center": [
          0.19795,
          0.37798,
          -0.07927
        ],
        "radius": 0.18202
      },
      "gyrus_r_2": {
        "center": [
          0.19795,
          0.29011,
          -0.01337
        ],
        "radius": 0.16706
      },
      "gyrus_r_3": {
        "center": [
          0.19795,
          0.20224,
          0.05254
        ],
        "radius": 0.15209
      },
      "gyrus_r_4": {
        "center": [
          0.19795,
          0.11437,
          0.11844
        ],
        "radius": 0.13712
      },
      "gyrus_r_5": {
        "center": [
          0.19795,
          0.0265,
          0.18434
        ],
        "radius": 0.12216
      },
      "longitudinal_fissure": {
        "center": [
          0.00024,
          0.38897,
          0.00311
        ],
        "radius": 0.28044
      },
      "corpus_callosum": {
        "center": [
          0.00024,
          0.25716,
          0.03057
        ],
        "radius": 0.23333
      },
      "cerebellum": {
        "center": [
          0.0004,
          -0.08358,
          -0.3168
        ],
        "radius": 0.4205
      },
      "cerebellar_folium_1": {
        "center": [
          0.00023,
          -0.00645,
          -0.30993
        ],
        "radius": 0.34265
      },
      "cerebellar_folium_2": {
        "center": [
          0.00024,
          -0.0394,
          -0.30993
        ],
        "radius": 0.32711
      },
      "cerebellar_folium_3": {
        "center": [
          0.00023,
          -0.07235,
          -0.30993
        ],
        "radius": 0.31159
      },
      "cerebellar_folium_4": {
        "center": [
          0.00024,
          -0.10531,
          -0.30993
        ],
        "radius": 0.29606
      },
      "cerebellar_folium_5": {
        "center": [
          0.00024,
          -0.13826,
          -0.30993
        ],
        "radius": 0.28054
      },
      "cerebellar_folium_6": {
        "center": [
          0.00023,
          -0.1712,
          -0.30993
        ],
        "radius": 0.26501
      },
      "brain_stem": {
        "center": [
          0.00024,
          -0.15808,
          -0.13073
        ],
        "radius": 0.33483
      },
      "spinal_cord": {
        "center": [
          0.00024,
          -0.4162,
          -0.06483
        ],
        "radius": 0.24639
      },
      "frontal_lobe": {
        "center": [
          0.00024,
          0.29011,
          0.38205
        ],
        "radius": 0.30439
      },
      "parietal_lobe": {
        "center": [
          0.00023,
          0.42192,
          0.04155
        ],
        "radius": 0.26634
      },
      "temporal_lobe": {
        "center": [
          0.27484,
          0.09241,
          0.14041
        ],
        "radius": 0.22829
      },
      "temporal_lobe_left": {
        "center": [
          -0.27435,
          0.09241,
          0.14041
        ],
        "radius": 0.22829
      },
      "occipital_lobe": {
        "center": [
          0.00023,
          0.26815,
          -0.37583
        ],
        "radius": 0.28536
      }
    }
  },
  {
    "id": "biology/cell",
    "category": "biology",
    "name": "Animal Cell",
    "path": "/models/biology/cell.glb",
    "fallbackType": "sphere",
    "defaultColor": "#7fd4a8",
    "aliases": [
      "cell",
      "animal cell"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 58,
    "meshCount": 58,
    "materialCount": 19,
    "bounds": {
      "min": [
        -0.64889,
        -0.39735,
        -0.64889
      ],
      "max": [
        0.64889,
        0.39735,
        0.64889
      ],
      "size": [
        1.29778,
        0.7947,
        1.29778
      ],
      "radius": 1
    },
    "triangles": 23884,
    "bytes": 526600,
    "semanticAnchors": [
      "cell_membrane",
      "cytoplasm",
      "nucleus",
      "nucleoplasm",
      "chromatin_1",
      "chromatin_2",
      "chromatin_3",
      "chromatin_4",
      "chromatin_5",
      "nucleolus",
      "nuclear_pore_1",
      "nuclear_pore_2",
      "nuclear_pore_3",
      "nuclear_pore_4",
      "nuclear_pore_5",
      "nuclear_pore_6",
      "mitochondrion_1",
      "crista_1a",
      "crista_1b",
      "mitochondrion_2",
      "crista_2a",
      "crista_2b",
      "mitochondrion_3",
      "crista_3a",
      "crista_3b",
      "rough_endoplasmic_reticulum",
      "rough_endoplasmic_reticulum_2",
      "smooth_endoplasmic_reticulum",
      "golgi_cisterna_1",
      "golgi_cisterna_2",
      "golgi_cisterna_3",
      "golgi_cisterna_4",
      "golgi_vesicle_1",
      "golgi_vesicle_2",
      "lysosome",
      "peroxisome",
      "vesicle",
      "centriole_1",
      "centriole_2",
      "cytoskeleton_filament_1",
      "cytoskeleton_filament_2",
      "cytoskeleton_filament_3",
      "cytoskeleton_filament_4",
      "cytoskeleton_filament_5",
      "ribosome_1",
      "ribosome_2",
      "ribosome_3",
      "ribosome_4",
      "ribosome_5",
      "ribosome_6",
      "ribosome_7",
      "ribosome_8",
      "ribosome_9",
      "ribosome_10",
      "ribosome_11",
      "ribosome_12",
      "ribosome_13",
      "ribosome_14"
    ],
    "anchors": {
      "cell_membrane": {
        "center": [
          0,
          -0.0047,
          0
        ],
        "radius": 0.91778
      },
      "cytoplasm": {
        "center": [
          0,
          -0.00471,
          0
        ],
        "radius": 0.84755
      },
      "nucleus": {
        "center": [
          0,
          0.02009,
          0
        ],
        "radius": 0.37225
      },
      "nucleoplasm": {
        "center": [
          0,
          0.02009,
          0
        ],
        "radius": 0.3293
      },
      "chromatin_1": {
        "center": [
          0.00827,
          0.02009,
          0
        ],
        "radius": 0.13177
      },
      "chromatin_2": {
        "center": [
          0.00827,
          0.02009,
          0
        ],
        "radius": 0.11769
      },
      "chromatin_3": {
        "center": [
          0.00827,
          0.02009,
          0
        ],
        "radius": 0.10081
      },
      "chromatin_4": {
        "center": [
          0.00826,
          0.0201,
          0
        ],
        "radius": 0.08504
      },
      "chromatin_5": {
        "center": [
          0.00827,
          0.02009,
          0
        ],
        "radius": 0.06754
      },
      "nucleolus": {
        "center": [
          0.03306,
          0.02836,
          0.0248
        ],
        "radius": 0.14317
      },
      "nuclear_pore_1": {
        "center": [
          0.20665,
          0.02009,
          0
        ],
        "radius": 0.0358
      },
      "nuclear_pore_2": {
        "center": [
          0.10283,
          0.14404,
          0.17926
        ],
        "radius": 0.03579
      },
      "nuclear_pore_3": {
        "center": [
          -0.10432,
          0.01286,
          0.17839
        ],
        "radius": 0.03579
      },
      "nuclear_pore_4": {
        "center": [
          -0.20665,
          -0.10342,
          -0.00174
        ],
        "radius": 0.03579
      },
      "nuclear_pore_5": {
        "center": [
          -0.10131,
          0.03455,
          -0.18011
        ],
        "radius": 0.03579
      },
      "nuclear_pore_6": {
        "center": [
          0.10583,
          0.14277,
          -0.17751
        ],
        "radius": 0.03579
      },
      "mitochondrion_1": {
        "center": [
          -0.25561,
          0.11999,
          0.17228
        ],
        "radius": 0.16708
      },
      "crista_1a": {
        "center": [
          -0.25625,
          0.11929,
          0.17359
        ],
        "radius": 0.08455
      },
      "crista_1b": {
        "center": [
          -0.20665,
          0.11929,
          0.17359
        ],
        "radius": 0.07159
      },
      "mitochondrion_2": {
        "center": [
          0.27303,
          -0.13706,
          0.12438
        ],
        "radius": 0.1662
      },
      "crista_2a": {
        "center": [
          0.27278,
          -0.13696,
          0.12399
        ],
        "radius": 0.08246
      },
      "crista_2b": {
        "center": [
          0.32237,
          -0.13696,
          0.12399
        ],
        "radius": 0.06985
      },
      "mitochondrion_3": {
        "center": [
          -0.04163,
          -0.29471,
          0.17328
        ],
        "radius": 0.16682
      },
      "crista_3a": {
        "center": [
          -0.04133,
          -0.29402,
          0.17359
        ],
        "radius": 0.08441
      },
      "crista_3b": {
        "center": [
          0.00827,
          -0.29402,
          0.17359
        ],
        "radius": 0.0715
      },
      "rough_endoplasmic_reticulum": {
        "center": [
          0.20666,
          0.06142,
          -0.04959
        ],
        "radius": 0.27446
      },
      "rough_endoplasmic_reticulum_2": {
        "center": [
          0.20665,
          0.0201,
          -0.04959
        ],
        "radius": 0.31734
      },
      "smooth_endoplasmic_reticulum": {
        "center": [
          0.3155,
          -0.118,
          -0.02928
        ],
        "radius": 0.19436
      },
      "golgi_cisterna_1": {
        "center": [
          -0.22732,
          -0.17829,
          -0.12399
        ],
        "radius": 0.21047
      },
      "golgi_cisterna_2": {
        "center": [
          -0.22732,
          -0.15349,
          -0.12399
        ],
        "radius": 0.19321
      },
      "golgi_cisterna_3": {
        "center": [
          -0.22731,
          -0.12869,
          -0.12399
        ],
        "radius": 0.17597
      },
      "golgi_cisterna_4": {
        "center": [
          -0.22732,
          -0.10389,
          -0.12399
        ],
        "radius": 0.15874
      },
      "golgi_vesicle_1": {
        "center": [
          -0.33064,
          -0.1287,
          -0.04133
        ],
        "radius": 0.05011
      },
      "golgi_vesicle_2": {
        "center": [
          -0.35544,
          -0.21136,
          -0.08266
        ],
        "radius": 0.04295
      },
      "lysosome": {
        "center": [
          0.08266,
          -0.31468,
          -0.12399
        ],
        "radius": 0.14317
      },
      "peroxisome": {
        "center": [
          -0.37197,
          0.22262,
          0.04133
        ],
        "radius": 0.10738
      },
      "vesicle": {
        "center": [
          0.39264,
          0.16062,
          0.14466
        ],
        "radius": 0.07874
      },
      "centriole_1": {
        "center": [
          -0.12399,
          0.29288,
          -0.16532
        ],
        "radius": 0.0957
      },
      "centriole_2": {
        "center": [
          -0.12399,
          0.29288,
          -0.062
        ],
        "radius": 0.0957
      },
      "cytoskeleton_filament_1": {
        "center": [
          0.02901,
          0.16207,
          0.00048
        ],
        "radius": 0.27874
      },
      "cytoskeleton_filament_2": {
        "center": [
          -0.13018,
          -0.02329,
          0.00008
        ],
        "radius": 0.30229
      },
      "cytoskeleton_filament_3": {
        "center": [
          0.08693,
          0.08801,
          0.00025
        ],
        "radius": 0.26985
      },
      "cytoskeleton_filament_4": {
        "center": [
          -0.07247,
          0.14358,
          0.00027
        ],
        "radius": 0.29265
      },
      "cytoskeleton_filament_5": {
        "center": [
          0.13036,
          -0.11604,
          0.00019
        ],
        "radius": 0.33501
      },
      "ribosome_1": {
        "center": [
          0.4753,
          0.03663,
          0
        ],
        "radius": 0.03221
      },
      "ribosome_2": {
        "center": [
          0.2156,
          0.31181,
          0.40986
        ],
        "radius": 0.03221
      },
      "ribosome_3": {
        "center": [
          -0.27972,
          0.37875,
          -0.10562
        ],
        "radius": 0.03221
      },
      "ribosome_4": {
        "center": [
          -0.46935,
          0.18677,
          -0.38264
        ],
        "radius": 0.03221
      },
      "ribosome_5": {
        "center": [
          -0.14608,
          -0.11884,
          0.20422
        ],
        "radius": 0.03221
      },
      "ribosome_6": {
        "center": [
          0.33683,
          -0.30679,
          0.33002
        ],
        "radius": 0.03222
      },
      "ribosome_7": {
        "center": [
          0.45165,
          -0.23485,
          -0.28926
        ],
        "radius": 0.03221
      },
      "ribosome_8": {
        "center": [
          0.0729,
          0.04253,
          -0.25548
        ],
        "radius": 0.03222
      },
      "ribosome_9": {
        "center": [
          -0.38551,
          0.31545,
          0.3551
        ],
        "radius": 0.03222
      },
      "ribosome_10": {
        "center": [
          -0.42263,
          0.37736,
          0.16398
        ],
        "radius": 0.03221
      },
      "ribosome_11": {
        "center": [
          0.0021,
          0.18141,
          -0.39735
        ],
        "radius": 0.03222
      },
      "ribosome_12": {
        "center": [
          0.42454,
          -0.12411,
          -0.06158
        ],
        "radius": 0.03222
      },
      "ribosome_13": {
        "center": [
          0.38304,
          -0.30799,
          0.41322
        ],
        "radius": 0.03222
      },
      "ribosome_14": {
        "center": [
          -0.07705,
          -0.23107,
          -0.0449
        ],
        "radius": 0.03222
      }
    }
  },
  {
    "id": "biology/dna",
    "category": "biology",
    "name": "DNA Double Helix",
    "path": "/models/biology/dna.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#6aa9e9",
    "aliases": [
      "dna",
      "double helix"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 42,
    "meshCount": 42,
    "materialCount": 6,
    "bounds": {
      "min": [
        -0.33414,
        -0.87928,
        -0.33943
      ],
      "max": [
        0.33414,
        0.87928,
        0.33943
      ],
      "size": [
        0.66828,
        1.75856,
        0.67886
      ],
      "radius": 1
    },
    "triangles": 10688,
    "bytes": 252988,
    "semanticAnchors": [
      "backbone_1",
      "backbone_2",
      "purine_1",
      "pyrimidine_1",
      "purine_2",
      "pyrimidine_2",
      "purine_3",
      "pyrimidine_3",
      "purine_4",
      "pyrimidine_4",
      "purine_5",
      "pyrimidine_5",
      "purine_6",
      "pyrimidine_6",
      "purine_7",
      "pyrimidine_7",
      "purine_8",
      "pyrimidine_8",
      "purine_9",
      "pyrimidine_9",
      "purine_10",
      "pyrimidine_10",
      "purine_11",
      "pyrimidine_11",
      "purine_12",
      "pyrimidine_12",
      "phosphate_1",
      "deoxyribose_1",
      "phosphate_2",
      "deoxyribose_2",
      "phosphate_3",
      "deoxyribose_3",
      "phosphate_4",
      "deoxyribose_4",
      "phosphate_5",
      "deoxyribose_5",
      "phosphate_6",
      "deoxyribose_6",
      "phosphate_7",
      "deoxyribose_7",
      "phosphate_8",
      "deoxyribose_8"
    ],
    "anchors": {
      "backbone_1": {
        "center": [
          -0.00004,
          0,
          -0.00003
        ],
        "radius": 0.99815
      },
      "backbone_2": {
        "center": [
          0.00004,
          0,
          0.00003
        ],
        "radius": 0.99815
      },
      "purine_1": {
        "center": [
          0.12146,
          -0.77689,
          0.08825
        ],
        "radius": 0.18144
      },
      "pyrimidine_1": {
        "center": [
          -0.12146,
          -0.77689,
          -0.08825
        ],
        "radius": 0.17501
      },
      "purine_2": {
        "center": [
          -0.04639,
          -0.63563,
          0.14279
        ],
        "radius": 0.17218
      },
      "pyrimidine_2": {
        "center": [
          0.0464,
          -0.63563,
          -0.14279
        ],
        "radius": 0.16729
      },
      "purine_3": {
        "center": [
          -0.15013,
          -0.49438,
          0
        ],
        "radius": 0.15603
      },
      "pyrimidine_3": {
        "center": [
          0.15013,
          -0.49437,
          0
        ],
        "radius": 0.15399
      },
      "purine_4": {
        "center": [
          -0.04639,
          -0.35312,
          -0.14279
        ],
        "radius": 0.17218
      },
      "pyrimidine_4": {
        "center": [
          0.0464,
          -0.35312,
          0.14279
        ],
        "radius": 0.16729
      },
      "purine_5": {
        "center": [
          0.12146,
          -0.21186,
          -0.08825
        ],
        "radius": 0.18144
      },
      "pyrimidine_5": {
        "center": [
          -0.12146,
          -0.21187,
          0.08825
        ],
        "radius": 0.17501
      },
      "purine_6": {
        "center": [
          0.12146,
          -0.0706,
          0.08825
        ],
        "radius": 0.18144
      },
      "pyrimidine_6": {
        "center": [
          -0.12146,
          -0.0706,
          -0.08825
        ],
        "radius": 0.17501
      },
      "purine_7": {
        "center": [
          -0.04639,
          0.07066,
          0.14279
        ],
        "radius": 0.17218
      },
      "pyrimidine_7": {
        "center": [
          0.0464,
          0.07066,
          -0.14279
        ],
        "radius": 0.16729
      },
      "purine_8": {
        "center": [
          -0.15013,
          0.21191,
          0
        ],
        "radius": 0.15603
      },
      "pyrimidine_8": {
        "center": [
          0.15013,
          0.21192,
          0
        ],
        "radius": 0.15399
      },
      "purine_9": {
        "center": [
          -0.04639,
          0.35317,
          -0.14279
        ],
        "radius": 0.17218
      },
      "pyrimidine_9": {
        "center": [
          0.0464,
          0.35317,
          0.14279
        ],
        "radius": 0.16729
      },
      "purine_10": {
        "center": [
          0.12146,
          0.49443,
          -0.08825
        ],
        "radius": 0.18144
      },
      "pyrimidine_10": {
        "center": [
          -0.12146,
          0.49443,
          0.08825
        ],
        "radius": 0.17501
      },
      "purine_11": {
        "center": [
          0.12146,
          0.63569,
          0.08825
        ],
        "radius": 0.18144
      },
      "pyrimidine_11": {
        "center": [
          -0.12146,
          0.63569,
          -0.08825
        ],
        "radius": 0.17501
      },
      "purine_12": {
        "center": [
          -0.04639,
          0.77695,
          0.14279
        ],
        "radius": 0.17218
      },
      "pyrimidine_12": {
        "center": [
          0.0464,
          0.77695,
          -0.14279
        ],
        "radius": 0.16729
      },
      "phosphate_1": {
        "center": [
          0.1765,
          -0.74158,
          0.24293
        ],
        "radius": 0.0619
      },
      "deoxyribose_1": {
        "center": [
          -0.17649,
          -0.74158,
          -0.24293
        ],
        "radius": 0.07016
      },
      "phosphate_2": {
        "center": [
          -0.28558,
          -0.52969,
          0.09279
        ],
        "radius": 0.06191
      },
      "deoxyribose_2": {
        "center": [
          0.28557,
          -0.52969,
          -0.09279
        ],
        "radius": 0.07016
      },
      "phosphate_3": {
        "center": [
          0,
          -0.3178,
          -0.30027
        ],
        "radius": 0.0619
      },
      "deoxyribose_3": {
        "center": [
          0,
          -0.3178,
          0.30028
        ],
        "radius": 0.07016
      },
      "phosphate_4": {
        "center": [
          0.28558,
          -0.10592,
          0.09279
        ],
        "radius": 0.06191
      },
      "deoxyribose_4": {
        "center": [
          -0.28557,
          -0.10592,
          -0.09279
        ],
        "radius": 0.07016
      },
      "phosphate_5": {
        "center": [
          -0.17649,
          0.10597,
          0.24293
        ],
        "radius": 0.06191
      },
      "deoxyribose_5": {
        "center": [
          0.1765,
          0.10597,
          -0.24293
        ],
        "radius": 0.07016
      },
      "phosphate_6": {
        "center": [
          -0.17649,
          0.31786,
          -0.24292
        ],
        "radius": 0.06191
      },
      "deoxyribose_6": {
        "center": [
          0.1765,
          0.31786,
          0.24293
        ],
        "radius": 0.07016
      },
      "phosphate_7": {
        "center": [
          0.28558,
          0.52975,
          -0.09279
        ],
        "radius": 0.06191
      },
      "deoxyribose_7": {
        "center": [
          -0.28557,
          0.52974,
          0.09279
        ],
        "radius": 0.07016
      },
      "phosphate_8": {
        "center": [
          0,
          0.74163,
          0.30028
        ],
        "radius": 0.0619
      },
      "deoxyribose_8": {
        "center": [
          0,
          0.74163,
          -0.30027
        ],
        "radius": 0.07016
      }
    }
  },
  {
    "id": "biology/skeleton",
    "category": "biology",
    "name": "Human Skeleton",
    "path": "/models/biology/skeleton.glb",
    "fallbackType": "box",
    "defaultColor": "#ece5d4",
    "aliases": [
      "skeleton",
      "bones"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 50,
    "meshCount": 50,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.44502,
        -0.87631,
        -0.18449
      ],
      "max": [
        0.44502,
        0.87631,
        0.18449
      ],
      "size": [
        0.89004,
        1.75262,
        0.36898
      ],
      "radius": 1
    },
    "triangles": 25532,
    "bytes": 568180,
    "semanticAnchors": [
      "skull",
      "jaw",
      "vertebra_1",
      "vertebra_2",
      "vertebra_3",
      "vertebra_4",
      "vertebra_5",
      "vertebra_6",
      "vertebra_7",
      "vertebra_8",
      "vertebra_9",
      "vertebra_10",
      "vertebra_11",
      "vertebra_12",
      "rib_l_1",
      "rib_r_1",
      "rib_l_2",
      "rib_r_2",
      "rib_l_3",
      "rib_r_3",
      "rib_l_4",
      "rib_r_4",
      "rib_l_5",
      "rib_r_5",
      "rib_l_6",
      "rib_r_6",
      "rib_l_7",
      "rib_r_7",
      "rib_l_8",
      "rib_r_8",
      "sternum",
      "pelvis",
      "left_shoulder",
      "left_humerus",
      "left_elbow",
      "left_radius",
      "left_hip",
      "left_femur",
      "left_knee",
      "left_tibia",
      "left_foot",
      "right_shoulder",
      "right_humerus",
      "right_elbow",
      "right_radius",
      "right_hip",
      "right_femur",
      "right_knee",
      "right_tibia",
      "right_foot"
    ],
    "anchors": {
      "skull": {
        "center": [
          0,
          0.69183,
          0
        ],
        "radius": 0.31954
      },
      "jaw": {
        "center": [
          0,
          0.5864,
          0.02636
        ],
        "radius": 0.1056
      },
      "vertebra_1": {
        "center": [
          0,
          0.4722,
          -0.02196
        ],
        "radius": 0.07178
      },
      "vertebra_2": {
        "center": [
          0,
          0.40192,
          -0.02723
        ],
        "radius": 0.07059
      },
      "vertebra_3": {
        "center": [
          0,
          0.33164,
          -0.0325
        ],
        "radius": 0.06942
      },
      "vertebra_4": {
        "center": [
          0,
          0.26136,
          -0.03778
        ],
        "radius": 0.06824
      },
      "vertebra_5": {
        "center": [
          0,
          0.19108,
          -0.04304
        ],
        "radius": 0.06706
      },
      "vertebra_6": {
        "center": [
          0,
          0.1208,
          -0.04831
        ],
        "radius": 0.06589
      },
      "vertebra_7": {
        "center": [
          0,
          0.05052,
          -0.05359
        ],
        "radius": 0.06472
      },
      "vertebra_8": {
        "center": [
          0,
          -0.01977,
          -0.05886
        ],
        "radius": 0.06355
      },
      "vertebra_9": {
        "center": [
          0,
          -0.09004,
          -0.06413
        ],
        "radius": 0.06239
      },
      "vertebra_10": {
        "center": [
          0,
          -0.16032,
          -0.0694
        ],
        "radius": 0.06122
      },
      "vertebra_11": {
        "center": [
          0,
          -0.23061,
          -0.07468
        ],
        "radius": 0.06007
      },
      "vertebra_12": {
        "center": [
          0,
          -0.30089,
          -0.07994
        ],
        "radius": 0.05891
      },
      "rib_l_1": {
        "center": [
          -0.1354,
          0.25452,
          0.01323
        ],
        "radius": 0.20044
      },
      "rib_r_1": {
        "center": [
          0.13541,
          0.25452,
          0.01323
        ],
        "radius": 0.20044
      },
      "rib_l_2": {
        "center": [
          -0.14953,
          0.20598,
          0.01025
        ],
        "radius": 0.21595
      },
      "rib_r_2": {
        "center": [
          0.14953,
          0.20598,
          0.01025
        ],
        "radius": 0.21595
      },
      "rib_l_3": {
        "center": [
          -0.16362,
          0.15751,
          0.00716
        ],
        "radius": 0.23159
      },
      "rib_r_3": {
        "center": [
          0.16363,
          0.15751,
          0.00716
        ],
        "radius": 0.23159
      },
      "rib_l_4": {
        "center": [
          -0.17772,
          0.10909,
          0.004
        ],
        "radius": 0.24733
      },
      "rib_r_4": {
        "center": [
          0.17772,
          0.10909,
          0.004
        ],
        "radius": 0.24733
      },
      "rib_l_5": {
        "center": [
          -0.19182,
          0.06071,
          0.00078
        ],
        "radius": 0.2632
      },
      "rib_r_5": {
        "center": [
          0.19182,
          0.06071,
          0.00078
        ],
        "radius": 0.2632
      },
      "rib_l_6": {
        "center": [
          -0.2059,
          0.01235,
          -0.00247
        ],
        "radius": 0.27916
      },
      "rib_r_6": {
        "center": [
          0.20591,
          0.01235,
          -0.00247
        ],
        "radius": 0.27916
      },
      "rib_l_7": {
        "center": [
          -0.21998,
          -0.03599,
          -0.00574
        ],
        "radius": 0.29522
      },
      "rib_r_7": {
        "center": [
          0.21999,
          -0.03599,
          -0.00574
        ],
        "radius": 0.29522
      },
      "rib_l_8": {
        "center": [
          -0.23405,
          -0.08431,
          -0.00904
        ],
        "radius": 0.31137
      },
      "rib_r_8": {
        "center": [
          0.23406,
          -0.08431,
          -0.00904
        ],
        "radius": 0.31137
      },
      "sternum": {
        "center": [
          0,
          0.17351,
          0.12299
        ],
        "radius": 0.16086
      },
      "pelvis": {
        "center": [
          0,
          -0.09004,
          0
        ],
        "radius": 0.22307
      },
      "left_shoulder": {
        "center": [
          -0.21963,
          0.4107,
          0
        ],
        "radius": 0.12173
      },
      "left_humerus": {
        "center": [
          -0.27233,
          0.22622,
          0.00879
        ],
        "radius": 0.1753
      },
      "left_elbow": {
        "center": [
          -0.29869,
          0.0593,
          0.00878
        ],
        "radius": 0.08369
      },
      "left_radius": {
        "center": [
          -0.31626,
          -0.09004,
          0.01757
        ],
        "radius": 0.15667
      },
      "left_hip": {
        "center": [
          -0.12299,
          -0.10761,
          0
        ],
        "radius": 0.12934
      },
      "left_femur": {
        "center": [
          -0.1142,
          -0.30089,
          0
        ],
        "radius": 0.20086
      },
      "left_knee": {
        "center": [
          -0.10981,
          -0.48537,
          0.00439
        ],
        "radius": 0.0913
      },
      "left_tibia": {
        "center": [
          -0.10981,
          -0.66986,
          0.00879
        ],
        "radius": 0.18857
      },
      "left_foot": {
        "center": [
          -0.10981,
          -0.85874,
          0.03514
        ],
        "radius": 0.0748
      },
      "right_shoulder": {
        "center": [
          0.21963,
          0.4107,
          0
        ],
        "radius": 0.12173
      },
      "right_humerus": {
        "center": [
          0.27234,
          0.22622,
          0.00879
        ],
        "radius": 0.1753
      },
      "right_elbow": {
        "center": [
          0.29869,
          0.0593,
          0.00878
        ],
        "radius": 0.08369
      },
      "right_radius": {
        "center": [
          0.31626,
          -0.09004,
          0.01757
        ],
        "radius": 0.15667
      },
      "right_hip": {
        "center": [
          0.12299,
          -0.10761,
          0
        ],
        "radius": 0.12934
      },
      "right_femur": {
        "center": [
          0.11421,
          -0.30089,
          0
        ],
        "radius": 0.20086
      },
      "right_knee": {
        "center": [
          0.10981,
          -0.48537,
          0.00439
        ],
        "radius": 0.0913
      },
      "right_tibia": {
        "center": [
          0.10982,
          -0.66986,
          0.00879
        ],
        "radius": 0.18857
      },
      "right_foot": {
        "center": [
          0.10982,
          -0.85874,
          0.03514
        ],
        "radius": 0.0748
      }
    }
  },
  {
    "id": "biology/blood-cell",
    "category": "biology",
    "name": "Red Blood Cell",
    "path": "/models/biology/blood-cell.glb",
    "fallbackType": "sphere",
    "defaultColor": "#d64545",
    "aliases": [
      "red blood cell",
      "rbc",
      "erythrocyte"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 6,
    "meshCount": 6,
    "materialCount": 6,
    "bounds": {
      "min": [
        -0.94809,
        -0.17639,
        -0.26458
      ],
      "max": [
        0.94809,
        0.17639,
        0.26458
      ],
      "size": [
        1.89618,
        0.35278,
        0.52916
      ],
      "radius": 1
    },
    "triangles": 20152,
    "bytes": 379824,
    "semanticAnchors": [
      "red_blood_cell",
      "haemoglobin_region",
      "central_pallor",
      "rouleau_disc_1",
      "rouleau_disc_2",
      "rouleau_disc_3"
    ],
    "anchors": {
      "red_blood_cell": {
        "center": [
          -0.68351,
          0,
          0
        ],
        "radius": 0.41366
      },
      "haemoglobin_region": {
        "center": [
          -0.68351,
          0.02406,
          0
        ],
        "radius": 0.25669
      },
      "central_pallor": {
        "center": [
          -0.68351,
          0.08018,
          0
        ],
        "radius": 0.11804
      },
      "rouleau_disc_1": {
        "center": [
          -0.06214,
          0,
          0
        ],
        "radius": 0.32824
      },
      "rouleau_disc_2": {
        "center": [
          0.33875,
          0,
          0
        ],
        "radius": 0.32824
      },
      "rouleau_disc_3": {
        "center": [
          0.73963,
          0,
          0
        ],
        "radius": 0.32824
      }
    }
  },
  {
    "id": "biology/white-blood-cell",
    "category": "biology",
    "name": "White Blood Cell",
    "path": "/models/biology/white-blood-cell.glb",
    "fallbackType": "sphere",
    "defaultColor": "#f2e2c8",
    "aliases": [
      "white blood cell",
      "wbc",
      "leukocyte"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 14,
    "meshCount": 14,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.60111,
        -0.53627,
        -0.59253
      ],
      "max": [
        0.60111,
        0.53627,
        0.59253
      ],
      "size": [
        1.20222,
        1.07254,
        1.18506
      ],
      "radius": 1.00001
    },
    "triangles": 7848,
    "bytes": 167648,
    "semanticAnchors": [
      "cell_membrane",
      "nucleus",
      "granule_1",
      "granule_2",
      "granule_3",
      "granule_4",
      "granule_5",
      "granule_6",
      "granule_7",
      "lobed_nucleus_lobe_1",
      "lobed_nucleus_lobe_2",
      "pseudopod_1",
      "pseudopod_2",
      "pseudopod_3"
    ],
    "anchors": {
      "cell_membrane": {
        "center": [
          0.02032,
          -0.02017,
          0.07642
        ],
        "radius": 0.89392
      },
      "nucleus": {
        "center": [
          0.02032,
          -0.02016,
          0.07643
        ],
        "radius": 0.53505
      },
      "granule_1": {
        "center": [
          0.41256,
          -0.02016,
          0.07643
        ],
        "radius": 0.08796
      },
      "granule_2": {
        "center": [
          0.26414,
          0.26845,
          0.27592
        ],
        "radius": 0.08796
      },
      "granule_3": {
        "center": [
          -0.0688,
          0.189,
          0.38159
        ],
        "radius": 0.08796
      },
      "granule_4": {
        "center": [
          -0.33429,
          -0.15719,
          0.34373
        ],
        "radius": 0.08796
      },
      "granule_5": {
        "center": [
          -0.33142,
          -0.32864,
          0.18016
        ],
        "radius": 0.08796
      },
      "granule_6": {
        "center": [
          -0.06236,
          -0.10669,
          -0.03219
        ],
        "radius": 0.08796
      },
      "granule_7": {
        "center": [
          0.26927,
          0.22561,
          -0.19346
        ],
        "radius": 0.08796
      },
      "lobed_nucleus_lobe_1": {
        "center": [
          0.24741,
          -0.14403,
          0.17965
        ],
        "radius": 0.49856
      },
      "lobed_nucleus_lobe_2": {
        "center": [
          -0.18612,
          0.12435,
          -0.04744
        ],
        "radius": 0.45022
      },
      "pseudopod_1": {
        "center": [
          0.44628,
          0.08306,
          0.36784
        ],
        "radius": 0.26817
      },
      "pseudopod_2": {
        "center": [
          -0.44628,
          0.38144,
          0.297
        ],
        "radius": 0.26818
      },
      "pseudopod_3": {
        "center": [
          0.06548,
          0.24269,
          -0.4377
        ],
        "radius": 0.26817
      }
    }
  },
  {
    "id": "biology/blood-vessel",
    "category": "biology",
    "name": "Blood Vessel",
    "path": "/models/biology/blood-vessel.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#c05a5a",
    "aliases": [
      "blood vessel",
      "vein",
      "artery"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 12,
    "meshCount": 12,
    "materialCount": 9,
    "bounds": {
      "min": [
        -0.8155,
        -0.4276,
        -0.39002
      ],
      "max": [
        0.8155,
        0.4276,
        0.39002
      ],
      "size": [
        1.631,
        0.8552,
        0.78004
      ],
      "radius": 1
    },
    "triangles": 6808,
    "bytes": 151924,
    "semanticAnchors": [
      "adventitia",
      "smooth_muscle_layer",
      "elastic_layer",
      "endothelium",
      "lumen",
      "erythrocyte_1",
      "erythrocyte_2",
      "erythrocyte_3",
      "erythrocyte_4",
      "branch_vessel",
      "plaque",
      "vasa_vasorum"
    ],
    "anchors": {
      "adventitia": {
        "center": [
          -0.01182,
          -0.03924,
          0
        ],
        "radius": 0.96921
      },
      "smooth_muscle_layer": {
        "center": [
          -0.01182,
          -0.03924,
          0
        ],
        "radius": 0.91657
      },
      "elastic_layer": {
        "center": [
          -0.01182,
          -0.03924,
          0
        ],
        "radius": 0.87802
      },
      "endothelium": {
        "center": [
          -0.01182,
          -0.03924,
          0
        ],
        "radius": 0.85866
      },
      "lumen": {
        "center": [
          -0.01182,
          -0.03924,
          0
        ],
        "radius": 0.84936
      },
      "erythrocyte_1": {
        "center": [
          -0.54367,
          -0.03924,
          0
        ],
        "radius": 0.12283
      },
      "erythrocyte_2": {
        "center": [
          -0.1891,
          -0.03924,
          0
        ],
        "radius": 0.12282
      },
      "erythrocyte_3": {
        "center": [
          0.16547,
          -0.03924,
          0
        ],
        "radius": 0.12283
      },
      "erythrocyte_4": {
        "center": [
          0.52003,
          -0.03924,
          0
        ],
        "radius": 0.12282
      },
      "branch_vessel": {
        "center": [
          0.57913,
          0.28578,
          0
        ],
        "radius": 0.35655
      },
      "plaque": {
        "center": [
          -0.33684,
          0.13804,
          0
        ],
        "radius": 0.16377
      },
      "vasa_vasorum": {
        "center": [
          0.34275,
          -0.36426,
          0
        ],
        "radius": 0.47451
      }
    }
  },
  {
    "id": "biology/digestive-system",
    "category": "biology",
    "name": "Digestive System",
    "path": "/models/biology/digestive-system.glb",
    "fallbackType": "sphere",
    "defaultColor": "#e0a878",
    "aliases": [
      "digestive system",
      "digestion",
      "stomach"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 8,
    "meshCount": 8,
    "materialCount": 6,
    "bounds": {
      "min": [
        -0.40298,
        -0.87032,
        -0.28312
      ],
      "max": [
        0.40298,
        0.87032,
        0.28312
      ],
      "size": [
        0.80596,
        1.74064,
        0.56624
      ],
      "radius": 1
    },
    "triangles": 14092,
    "bytes": 278256,
    "semanticAnchors": [
      "esophagus",
      "stomach",
      "duodenum",
      "small_intestine",
      "large_intestine",
      "sigmoid_colon",
      "liver",
      "pancreas"
    ],
    "anchors": {
      "esophagus": {
        "center": [
          -0.06707,
          0.63663,
          0.02092
        ],
        "radius": 0.25056
      },
      "stomach": {
        "center": [
          -0.05419,
          0.28375,
          0.01061
        ],
        "radius": 0.42376
      },
      "duodenum": {
        "center": [
          0.17461,
          0.06524,
          0.04696
        ],
        "radius": 0.23816
      },
      "small_intestine": {
        "center": [
          0.08757,
          -0.31173,
          0.01206
        ],
        "radius": 0.3422
      },
      "large_intestine": {
        "center": [
          -0.0941,
          -0.17659,
          0.17932
        ],
        "radius": 0.59588
      },
      "sigmoid_colon": {
        "center": [
          0.06336,
          -0.66616,
          0.15135
        ],
        "radius": 0.2973
      },
      "liver": {
        "center": [
          0.08509,
          0.64915,
          0.03199
        ],
        "radius": 0.42398
      },
      "pancreas": {
        "center": [
          -0.05428,
          0.17462,
          -0.18105
        ],
        "radius": 0.2426
      }
    }
  },
  {
    "id": "biology/leaf",
    "category": "biology",
    "name": "Leaf",
    "path": "/models/biology/leaf.glb",
    "fallbackType": "plane",
    "defaultColor": "#4f9e4a",
    "aliases": [
      "leaf",
      "leaves"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 14,
    "meshCount": 14,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.52274,
        -0.84965,
        -0.06952
      ],
      "max": [
        0.52274,
        0.84965,
        0.06952
      ],
      "size": [
        1.04548,
        1.6993,
        0.13904
      ],
      "radius": 1
    },
    "triangles": 8160,
    "bytes": 176408,
    "semanticAnchors": [
      "leaf_blade",
      "petiole",
      "midrib",
      "vein_l_1",
      "vein_l_2",
      "vein_l_3",
      "vein_l_4",
      "vein_r_1",
      "vein_r_2",
      "vein_r_3",
      "vein_r_4",
      "chloroplast_1",
      "chloroplast_2",
      "chloroplast_3"
    ],
    "anchors": {
      "leaf_blade": {
        "center": [
          0,
          0.27035,
          0.00719
        ],
        "radius": 0.78088
      },
      "petiole": {
        "center": [
          0,
          -0.5793,
          -0.02317
        ],
        "radius": 0.27818
      },
      "midrib": {
        "center": [
          0,
          -0.06985,
          -0.01157
        ],
        "radius": 0.24257
      },
      "vein_l_1": {
        "center": [
          -0.12313,
          -0.30874,
          -0.0193
        ],
        "radius": 0.14616
      },
      "vein_l_2": {
        "center": [
          -0.12313,
          -0.13108,
          -0.0193
        ],
        "radius": 0.14616
      },
      "vein_l_3": {
        "center": [
          -0.12313,
          0.04657,
          -0.0193
        ],
        "radius": 0.14616
      },
      "vein_l_4": {
        "center": [
          -0.12313,
          0.20106,
          -0.0193
        ],
        "radius": 0.14616
      },
      "vein_r_1": {
        "center": [
          0.12313,
          -0.30874,
          -0.0193
        ],
        "radius": 0.14616
      },
      "vein_r_2": {
        "center": [
          0.12313,
          -0.13108,
          -0.0193
        ],
        "radius": 0.14616
      },
      "vein_r_3": {
        "center": [
          0.12313,
          0.04657,
          -0.0193
        ],
        "radius": 0.14616
      },
      "vein_r_4": {
        "center": [
          0.12313,
          0.20106,
          -0.0193
        ],
        "radius": 0.14616
      },
      "chloroplast_1": {
        "center": [
          -0.13903,
          -0.11586,
          0.01545
        ],
        "radius": 0.09365
      },
      "chloroplast_2": {
        "center": [
          0.15448,
          -0.23172,
          0.00772
        ],
        "radius": 0.09365
      },
      "chloroplast_3": {
        "center": [
          0.01545,
          0.04635,
          0.01545
        ],
        "radius": 0.09365
      }
    }
  },
  {
    "id": "biology/plant-cell",
    "category": "biology",
    "name": "Plant Cell",
    "path": "/models/biology/plant-cell.glb",
    "fallbackType": "box",
    "defaultColor": "#8fbf6a",
    "aliases": [
      "plant cell"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 13,
    "meshCount": 13,
    "materialCount": 6,
    "bounds": {
      "min": [
        -0.57735,
        -0.57735,
        -0.57735
      ],
      "max": [
        0.57735,
        0.57735,
        0.57735
      ],
      "size": [
        1.1547,
        1.1547,
        1.1547
      ],
      "radius": 1
    },
    "triangles": 6776,
    "bytes": 151480,
    "semanticAnchors": [
      "cell_wall",
      "cell_membrane",
      "nucleus",
      "chloroplast_1",
      "grana_1a",
      "grana_1b",
      "chloroplast_2",
      "grana_2a",
      "grana_2b",
      "chloroplast_3",
      "grana_3a",
      "grana_3b",
      "vacuole"
    ],
    "anchors": {
      "cell_wall": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 1
      },
      "cell_membrane": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.93479
      },
      "nucleus": {
        "center": [
          -0.17571,
          0.0753,
          0.05021
        ],
        "radius": 0.34782
      },
      "chloroplast_1": {
        "center": [
          0.27613,
          0.17572,
          0.15062
        ],
        "radius": 0.26087
      },
      "grana_1a": {
        "center": [
          0.27613,
          0.22592,
          0.15062
        ],
        "radius": 0.11459
      },
      "grana_1b": {
        "center": [
          0.27613,
          0.12551,
          0.15062
        ],
        "radius": 0.11459
      },
      "chloroplast_2": {
        "center": [
          0.30123,
          -0.22592,
          -0.17571
        ],
        "radius": 0.26087
      },
      "grana_2a": {
        "center": [
          0.30123,
          -0.17571,
          -0.17571
        ],
        "radius": 0.11459
      },
      "grana_2b": {
        "center": [
          0.30123,
          -0.27612,
          -0.17571
        ],
        "radius": 0.11459
      },
      "chloroplast_3": {
        "center": [
          -0.0502,
          0.37654,
          -0.25102
        ],
        "radius": 0.26087
      },
      "grana_3a": {
        "center": [
          -0.0502,
          0.42674,
          -0.25102
        ],
        "radius": 0.11459
      },
      "grana_3b": {
        "center": [
          -0.0502,
          0.32633,
          -0.25102
        ],
        "radius": 0.11459
      },
      "vacuole": {
        "center": [
          0.12551,
          -0.17571,
          0.22592
        ],
        "radius": 0.47826
      }
    }
  },
  {
    "id": "biology/neuron",
    "category": "biology",
    "name": "Neuron",
    "path": "/models/biology/neuron.glb",
    "fallbackType": "sphere",
    "defaultColor": "#f0c98a",
    "aliases": [
      "neuron",
      "nerve cell"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 11,
    "meshCount": 11,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.4398,
        -0.22974,
        -0.86821
      ],
      "max": [
        0.4398,
        0.22974,
        0.86821
      ],
      "size": [
        0.8796,
        0.45948,
        1.73642
      ],
      "radius": 1
    },
    "triangles": 10960,
    "bytes": 224920,
    "semanticAnchors": [
      "cell_body",
      "nucleus",
      "axon",
      "myelin_sheath_1",
      "myelin_sheath_2",
      "myelin_sheath_3",
      "myelin_sheath_4",
      "dendrite_a",
      "dendrite_b",
      "axon_terminal",
      "synapse"
    ],
    "anchors": {
      "cell_body": {
        "center": [
          0,
          -0.00792,
          -0.637
        ],
        "radius": 0.3842
      },
      "nucleus": {
        "center": [
          0,
          -0.00792,
          -0.637
        ],
        "radius": 0.18296
      },
      "axon": {
        "center": [
          0.01221,
          0.0449,
          -0.05585
        ],
        "radius": 0.59339
      },
      "myelin_sheath_1": {
        "center": [
          0,
          0.03037,
          -0.37293
        ],
        "radius": 0.14636
      },
      "myelin_sheath_2": {
        "center": [
          0,
          0.04226,
          -0.10885
        ],
        "radius": 0.14636
      },
      "myelin_sheath_3": {
        "center": [
          0,
          0.05414,
          0.15522
        ],
        "radius": 0.14636
      },
      "myelin_sheath_4": {
        "center": [
          0,
          0.06601,
          0.41929
        ],
        "radius": 0.14636
      },
      "dendrite_a": {
        "center": [
          -0.25318,
          0.02461,
          -0.7404
        ],
        "radius": 0.23339
      },
      "dendrite_b": {
        "center": [
          0.25319,
          0.02461,
          -0.7404
        ],
        "radius": 0.23339
      },
      "axon_terminal": {
        "center": [
          0.03331,
          0.13682,
          0.6608
        ],
        "radius": 0.19109
      },
      "synapse": {
        "center": [
          -0.05281,
          0.17693,
          0.8154
        ],
        "radius": 0.09148
      }
    }
  },
  {
    "id": "biology/muscle",
    "category": "biology",
    "name": "Skeletal Muscle",
    "path": "/models/biology/muscle.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#c25b6e",
    "aliases": [
      "muscle",
      "muscle fibre"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 9,
    "meshCount": 9,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.91403,
        -0.26883,
        -0.30378
      ],
      "max": [
        0.91403,
        0.26883,
        0.30378
      ],
      "size": [
        1.82806,
        0.53766,
        0.60756
      ],
      "radius": 1
    },
    "triangles": 8496,
    "bytes": 171756,
    "semanticAnchors": [
      "muscle_belly",
      "fascicle_1",
      "fascicle_2",
      "fascicle_3",
      "fascicle_4",
      "fascicle_5",
      "fascicle_6",
      "tendon_start",
      "tendon_end"
    ],
    "anchors": {
      "muscle_belly": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.6585
      },
      "fascicle_1": {
        "center": [
          -0.43013,
          0,
          0
        ],
        "radius": 0.43028
      },
      "fascicle_2": {
        "center": [
          -0.25808,
          0,
          0
        ],
        "radius": 0.38474
      },
      "fascicle_3": {
        "center": [
          -0.08603,
          0,
          0
        ],
        "radius": 0.33922
      },
      "fascicle_4": {
        "center": [
          0.08603,
          0,
          0
        ],
        "radius": 0.29373
      },
      "fascicle_5": {
        "center": [
          0.25808,
          0,
          0
        ],
        "radius": 0.24829
      },
      "fascicle_6": {
        "center": [
          0.43013,
          0,
          0
        ],
        "radius": 0.20293
      },
      "tendon_start": {
        "center": [
          -0.72585,
          0,
          0
        ],
        "radius": 0.20914
      },
      "tendon_end": {
        "center": [
          0.72585,
          0,
          0
        ],
        "radius": 0.20914
      }
    }
  },
  {
    "id": "biology/kidney",
    "category": "biology",
    "name": "Kidney",
    "path": "/models/biology/kidney.glb",
    "fallbackType": "sphere",
    "defaultColor": "#b5563f",
    "aliases": [
      "kidney",
      "nephron"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 8,
    "meshCount": 8,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.37706,
        -0.77367,
        -0.50917
      ],
      "max": [
        0.37706,
        0.77367,
        0.50917
      ],
      "size": [
        0.75412,
        1.54734,
        1.01834
      ],
      "radius": 1
    },
    "triangles": 2356,
    "bytes": 60388,
    "semanticAnchors": [
      "kidney",
      "renal_pelvis",
      "ureter",
      "renal_artery_1",
      "renal_artery_2",
      "renal_artery_3",
      "renal_artery_4",
      "renal_vein"
    ],
    "anchors": {
      "kidney": {
        "center": [
          0,
          0.24591,
          0.10254
        ],
        "radius": 0.73092
      },
      "renal_pelvis": {
        "center": [
          -0.02532,
          0.33196,
          0.39279
        ],
        "radius": 0.30928
      },
      "ureter": {
        "center": [
          -0.05441,
          -0.33724,
          0.34624
        ],
        "radius": 0.44267
      },
      "renal_artery_1": {
        "center": [
          0.09107,
          0.39015,
          -0.3055
        ],
        "radius": 0.20957
      },
      "renal_artery_2": {
        "center": [
          -0.02532,
          0.4047,
          -0.3055
        ],
        "radius": 0.20957
      },
      "renal_artery_3": {
        "center": [
          0.07652,
          0.18648,
          -0.3055
        ],
        "radius": 0.20957
      },
      "renal_artery_4": {
        "center": [
          -0.08351,
          0.21558,
          -0.3055
        ],
        "radius": 0.20957
      },
      "renal_vein": {
        "center": [
          0.06197,
          0.30286,
          -0.3055
        ],
        "radius": 0.21166
      }
    }
  },
  {
    "id": "biology/skin",
    "category": "biology",
    "name": "Skin Cross Section",
    "path": "/models/biology/skin.glb",
    "fallbackType": "box",
    "defaultColor": "#f2d9c0",
    "aliases": [
      "skin",
      "epidermis"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 9,
    "meshCount": 9,
    "materialCount": 8,
    "bounds": {
      "min": [
        -0.661,
        -0.5633,
        -0.49575
      ],
      "max": [
        0.661,
        0.5633,
        0.49575
      ],
      "size": [
        1.322,
        1.1266,
        0.9915
      ],
      "radius": 1
    },
    "triangles": 6372,
    "bytes": 134292,
    "semanticAnchors": [
      "epidermis",
      "dermis",
      "hypodermis",
      "hair_shaft",
      "sebaceous_gland",
      "sweat_gland",
      "sweat_duct",
      "receptor_1",
      "receptor_2"
    ],
    "anchors": {
      "epidermis": {
        "center": [
          0,
          -0.01246,
          0
        ],
        "radius": 0.82742
      },
      "dermis": {
        "center": [
          0,
          -0.20526,
          0
        ],
        "radius": 0.83765
      },
      "hypodermis": {
        "center": [
          0,
          -0.39805,
          0
        ],
        "radius": 0.84261
      },
      "hair_shaft": {
        "center": [
          -0.32781,
          0.26238,
          0.11016
        ],
        "radius": 0.31355
      },
      "sebaceous_gland": {
        "center": [
          -0.30296,
          0.05363,
          0.11017
        ],
        "radius": 0.12403
      },
      "sweat_gland": {
        "center": [
          0.22034,
          -0.01246,
          -0.16525
        ],
        "radius": 0.09541
      },
      "sweat_duct": {
        "center": [
          0.22033,
          0.12524,
          -0.16525
        ],
        "radius": 0.07527
      },
      "receptor_1": {
        "center": [
          -0.05508,
          -0.12263,
          0.27542
        ],
        "radius": 0.08587
      },
      "receptor_2": {
        "center": [
          0.11017,
          -0.12263,
          0.30295
        ],
        "radius": 0.08587
      }
    }
  },
  {
    "id": "biology/flower",
    "category": "biology",
    "name": "Flower",
    "path": "/models/biology/flower.glb",
    "fallbackType": "sphere",
    "defaultColor": "#f28fb0",
    "aliases": [
      "flower"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 23,
    "meshCount": 23,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.49572,
        -0.693,
        -0.52347
      ],
      "max": [
        0.49572,
        0.693,
        0.52347
      ],
      "size": [
        0.99144,
        1.386,
        1.04694
      ],
      "radius": 1
    },
    "triangles": 16480,
    "bytes": 344832,
    "semanticAnchors": [
      "stem",
      "receptacle",
      "petal_1",
      "petal_2",
      "petal_3",
      "petal_4",
      "petal_5",
      "petal_6",
      "petal_7",
      "petal_8",
      "stamen_1",
      "stamen_2",
      "stamen_3",
      "stamen_4",
      "stamen_5",
      "stamen_6",
      "stamen_7",
      "stamen_8",
      "stamen_9",
      "stamen_10",
      "stamen_11",
      "stamen_12",
      "pistil"
    ],
    "anchors": {
      "stem": {
        "center": [
          0,
          -0.1446,
          0
        ],
        "radius": 0.55206
      },
      "receptacle": {
        "center": [
          0,
          0.45365,
          0
        ],
        "radius": 0.2111
      },
      "petal_1": {
        "center": [
          0.24927,
          0.5581,
          -0.06979
        ],
        "radius": 0.2895
      },
      "petal_2": {
        "center": [
          0.17627,
          0.56955,
          0.17626
        ],
        "radius": 0.2834
      },
      "petal_3": {
        "center": [
          0.03213,
          0.60612,
          0.24927
        ],
        "radius": 0.29636
      },
      "petal_4": {
        "center": [
          -0.17626,
          0.56955,
          0.17626
        ],
        "radius": 0.2834
      },
      "petal_5": {
        "center": [
          -0.24927,
          0.5581,
          0.0698
        ],
        "radius": 0.2895
      },
      "petal_6": {
        "center": [
          -0.17626,
          0.56955,
          -0.17626
        ],
        "radius": 0.2834
      },
      "petal_7": {
        "center": [
          -0.06273,
          0.57552,
          -0.24927
        ],
        "radius": 0.29636
      },
      "petal_8": {
        "center": [
          0.17627,
          0.56955,
          -0.17626
        ],
        "radius": 0.2834
      },
      "stamen_1": {
        "center": [
          0.09971,
          0.60322,
          0
        ],
        "radius": 0.05181
      },
      "stamen_2": {
        "center": [
          0.08635,
          0.60322,
          0.04986
        ],
        "radius": 0.05181
      },
      "stamen_3": {
        "center": [
          0.04986,
          0.60322,
          0.08635
        ],
        "radius": 0.05181
      },
      "stamen_4": {
        "center": [
          0,
          0.60322,
          0.09971
        ],
        "radius": 0.05181
      },
      "stamen_5": {
        "center": [
          -0.04985,
          0.60322,
          0.08635
        ],
        "radius": 0.05181
      },
      "stamen_6": {
        "center": [
          -0.08635,
          0.60322,
          0.04986
        ],
        "radius": 0.05181
      },
      "stamen_7": {
        "center": [
          -0.09971,
          0.60322,
          0
        ],
        "radius": 0.05181
      },
      "stamen_8": {
        "center": [
          -0.08635,
          0.60322,
          -0.04985
        ],
        "radius": 0.05181
      },
      "stamen_9": {
        "center": [
          -0.04985,
          0.60322,
          -0.08635
        ],
        "radius": 0.05181
      },
      "stamen_10": {
        "center": [
          0,
          0.60322,
          -0.09971
        ],
        "radius": 0.05181
      },
      "stamen_11": {
        "center": [
          0.04986,
          0.60322,
          -0.08635
        ],
        "radius": 0.05181
      },
      "stamen_12": {
        "center": [
          0.08635,
          0.60322,
          -0.04985
        ],
        "radius": 0.05181
      },
      "pistil": {
        "center": [
          0,
          0.61319,
          0
        ],
        "radius": 0.08635
      }
    }
  },
  {
    "id": "biology/chloroplast",
    "category": "biology",
    "name": "Chloroplast",
    "path": "/models/biology/chloroplast.glb",
    "fallbackType": "sphere",
    "defaultColor": "#6fbf52",
    "aliases": [
      "chloroplast"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 6,
    "meshCount": 6,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.57735,
        -0.57735,
        -0.57735
      ],
      "max": [
        0.57735,
        0.57735,
        0.57735
      ],
      "size": [
        1.1547,
        1.1547,
        1.1547
      ],
      "radius": 1
    },
    "triangles": 3024,
    "bytes": 68288,
    "semanticAnchors": [
      "chloroplast",
      "granum_1a",
      "granum_1b",
      "granum_2a",
      "granum_2b",
      "thylakoid"
    ],
    "anchors": {
      "chloroplast": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 1
      },
      "granum_1a": {
        "center": [
          0,
          0.13857,
          0
        ],
        "radius": 0.49207
      },
      "granum_1b": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.49207
      },
      "granum_2a": {
        "center": [
          0.05774,
          -0.16166,
          0.04619
        ],
        "radius": 0.45794
      },
      "granum_2b": {
        "center": [
          0.05773,
          -0.30022,
          0.04618
        ],
        "radius": 0.39283
      },
      "thylakoid": {
        "center": [
          0,
          -0.05773,
          0
        ],
        "radius": 0.75258
      }
    }
  },
  {
    "id": "biology/enzyme",
    "category": "biology",
    "name": "Enzyme",
    "path": "/models/biology/enzyme.glb",
    "fallbackType": "sphere",
    "defaultColor": "#6ab7e0",
    "aliases": [
      "enzyme",
      "protein"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 5,
    "meshCount": 5,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.65227,
        -0.58964,
        -0.47631
      ],
      "max": [
        0.65227,
        0.58964,
        0.47631
      ],
      "size": [
        1.30454,
        1.17928,
        0.95262
      ],
      "radius": 1
    },
    "triangles": 6716,
    "bytes": 135860,
    "semanticAnchors": [
      "protein_backbone",
      "active_site_lobe",
      "substrate_binding",
      "substrate",
      "active_site"
    ],
    "anchors": {
      "protein_backbone": {
        "center": [
          0,
          0.01992,
          0
        ],
        "radius": 0.98839
      },
      "active_site_lobe": {
        "center": [
          -0.32131,
          -0.31835,
          0.17208
        ],
        "radius": 0.48845
      },
      "substrate_binding": {
        "center": [
          0.34508,
          -0.31985,
          -0.16723
        ],
        "radius": 0.44941
      },
      "substrate": {
        "center": [
          0.01391,
          -0.38575,
          -0.0007
        ],
        "radius": 0.3182
      },
      "active_site": {
        "center": [
          0.01391,
          -0.38575,
          -0.0007
        ],
        "radius": 0.20249
      }
    }
  },
  {
    "id": "physics/pulley",
    "category": "physics",
    "name": "Pulley System",
    "path": "/models/physics/pulley.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#8fa0ad",
    "aliases": [
      "pulley"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 10,
    "meshCount": 10,
    "materialCount": 6,
    "bounds": {
      "min": [
        -0.58966,
        -0.73707,
        -0.33021
      ],
      "max": [
        0.58966,
        0.73707,
        0.33021
      ],
      "size": [
        1.17932,
        1.47414,
        0.66042
      ],
      "radius": 1
    },
    "triangles": 1846,
    "bytes": 50080,
    "semanticAnchors": [
      "support_frame",
      "support_crossbar",
      "pulley_wheel",
      "pulley_axle",
      "pulley_mount",
      "rope",
      "rope_2",
      "load",
      "effort_applied",
      "load_force"
    ],
    "anchors": {
      "support_frame": {
        "center": [
          -0.53069,
          -0.02948,
          0
        ],
        "radius": 0.70935
      },
      "support_crossbar": {
        "center": [
          0,
          0.61914,
          0
        ],
        "radius": 0.59178
      },
      "pulley_wheel": {
        "center": [
          0,
          0.47172,
          0
        ],
        "radius": 0.47143
      },
      "pulley_axle": {
        "center": [
          0,
          0.47173,
          0
        ],
        "radius": 0.15855
      },
      "pulley_mount": {
        "center": [
          0,
          0.68989,
          0
        ],
        "radius": 0.13369
      },
      "rope": {
        "center": [
          -0.26534,
          0.14741,
          0
        ],
        "radius": 0.31094
      },
      "rope_2": {
        "center": [
          0.26535,
          0.1769,
          0
        ],
        "radius": 0.29627
      },
      "load": {
        "center": [
          -0.26534,
          -0.29482,
          0
        ],
        "radius": 0.25533
      },
      "effort_applied": {
        "center": [
          0.26535,
          -0.23586,
          0
        ],
        "radius": 0.17362
      },
      "load_force": {
        "center": [
          -0.26534,
          -0.46656,
          0
        ],
        "radius": 0.16056
      }
    }
  },
  {
    "id": "physics/pendulum",
    "category": "physics",
    "name": "Pendulum",
    "path": "/models/physics/pendulum.glb",
    "fallbackType": "sphere",
    "defaultColor": "#d4a03c",
    "aliases": [
      "pendulum"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 9,
    "meshCount": 9,
    "materialCount": 8,
    "bounds": {
      "min": [
        -0.805,
        -0.58286,
        -0.11067
      ],
      "max": [
        0.805,
        0.58286,
        0.11067
      ],
      "size": [
        1.61,
        1.16572,
        0.22134
      ],
      "radius": 1
    },
    "triangles": 5420,
    "bytes": 119952,
    "semanticAnchors": [
      "pendulum_stand_base",
      "pendulum_pole",
      "pendulum_pivot",
      "pendulum_string",
      "pendulum_bob",
      "pivot_point",
      "tension_force",
      "gravity_force",
      "swing_arc"
    ],
    "anchors": {
      "pendulum_stand_base": {
        "center": [
          0,
          -0.55703,
          0
        ],
        "radius": 0.23255
      },
      "pendulum_pole": {
        "center": [
          0,
          -0.00368,
          0
        ],
        "radius": 0.55455
      },
      "pendulum_pivot": {
        "center": [
          0,
          0.54966,
          0
        ],
        "radius": 0.06902
      },
      "pendulum_string": {
        "center": [
          0,
          0.10698,
          0
        ],
        "radius": 0.44274
      },
      "pendulum_bob": {
        "center": [
          0,
          -0.35414,
          0
        ],
        "radius": 0.19169
      },
      "pivot_point": {
        "center": [
          0,
          0.54966,
          0
        ],
        "radius": 0.05111
      },
      "tension_force": {
        "center": [
          0,
          -0.24163,
          0
        ],
        "radius": 0.10725
      },
      "gravity_force": {
        "center": [
          0,
          -0.42608,
          0
        ],
        "radius": 0.10725
      },
      "swing_arc": {
        "center": [
          0,
          -0.14379,
          0
        ],
        "radius": 0.83895
      }
    }
  },
  {
    "id": "physics/inclined-plane",
    "category": "physics",
    "name": "Inclined Plane",
    "path": "/models/physics/inclined-plane.glb",
    "fallbackType": "box",
    "defaultColor": "#c9b28a",
    "aliases": [
      "inclined plane",
      "incline",
      "ramp"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 7,
    "meshCount": 7,
    "materialCount": 6,
    "bounds": {
      "min": [
        -0.66619,
        -0.56349,
        -0.48854
      ],
      "max": [
        0.66619,
        0.56349,
        0.48854
      ],
      "size": [
        1.33238,
        1.12698,
        0.97708
      ],
      "radius": 1
    },
    "triangles": 2862,
    "bytes": 66888,
    "semanticAnchors": [
      "inclined_plane",
      "plane_base",
      "block",
      "gravity_force",
      "normal_force",
      "friction_force",
      "plane_surface"
    ],
    "anchors": {
      "inclined_plane": {
        "center": [
          0,
          0.07495,
          -0.04441
        ],
        "radius": 0.78561
      },
      "plane_base": {
        "center": [
          0,
          -0.53573,
          -0.04441
        ],
        "radius": 0.80114
      },
      "block": {
        "center": [
          -0.30534,
          -0.11935,
          -0.04441
        ],
        "radius": 0.29689
      },
      "gravity_force": {
        "center": [
          -0.1943,
          0.37474,
          0.37196
        ],
        "radius": 0.20406
      },
      "normal_force": {
        "center": [
          -0.1943,
          0.13047,
          0.34698
        ],
        "radius": 0.16141
      },
      "friction_force": {
        "center": [
          -0.33032,
          0.01943,
          0.39972
        ],
        "radius": 0.16141
      },
      "plane_surface": {
        "center": [
          0,
          0.08049,
          -0.04441
        ],
        "radius": 0.69635
      }
    }
  },
  {
    "id": "physics/spring",
    "category": "physics",
    "name": "Spring",
    "path": "/models/physics/spring.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#c0cad2",
    "aliases": [
      "spring",
      "helical spring"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.41685,
        -0.86754,
        -0.2713
      ],
      "max": [
        0.41685,
        0.86754,
        0.2713
      ],
      "size": [
        0.8337,
        1.73508,
        0.5426
      ],
      "radius": 1
    },
    "triangles": 3314,
    "bytes": 69624,
    "semanticAnchors": [
      "spring_coil",
      "spring_top_plate",
      "spring_bottom_plate",
      "spring_force"
    ],
    "anchors": {
      "spring_coil": {
        "center": [
          -0.1457,
          -0.00024,
          0
        ],
        "radius": 0.91757
      },
      "spring_top_plate": {
        "center": [
          -0.14606,
          0.82781,
          -0.00006
        ],
        "radius": 0.3302
      },
      "spring_bottom_plate": {
        "center": [
          -0.14606,
          -0.8278,
          -0.00006
        ],
        "radius": 0.3302
      },
      "spring_force": {
        "center": [
          0.21983,
          -0.19867,
          -0.00007
        ],
        "radius": 0.21765
      }
    }
  },
  {
    "id": "physics/lens",
    "category": "physics",
    "name": "Convex Lens",
    "path": "/models/physics/lens.glb",
    "fallbackType": "sphere",
    "defaultColor": "#a8d8f0",
    "aliases": [
      "lens",
      "convex lens"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 8,
    "meshCount": 8,
    "materialCount": 7,
    "bounds": {
      "min": [
        -0.93797,
        -0.2916,
        -0.18759
      ],
      "max": [
        0.93797,
        0.2916,
        0.18759
      ],
      "size": [
        1.87594,
        0.5832,
        0.37518
      ],
      "radius": 1
    },
    "triangles": 2564,
    "bytes": 60320,
    "semanticAnchors": [
      "lens_glass",
      "lens_rim",
      "lens_stand",
      "lens_post",
      "optical_axis",
      "focal_point",
      "incident_ray",
      "refracted_ray"
    ],
    "anchors": {
      "lens_glass": {
        "center": [
          0,
          0.05711,
          0
        ],
        "radius": 0.34033
      },
      "lens_rim": {
        "center": [
          0,
          0.03579,
          -0.00853
        ],
        "radius": 0.33126
      },
      "lens_stand": {
        "center": [
          0,
          -0.25413,
          0
        ],
        "radius": 0.22097
      },
      "lens_post": {
        "center": [
          0,
          -0.17738,
          0
        ],
        "radius": 0.07071
      },
      "optical_axis": {
        "center": [
          0,
          0.03578,
          0
        ],
        "radius": 0.93801
      },
      "focal_point": {
        "center": [
          0.63953,
          0.03579,
          0
        ],
        "radius": 0.05169
      },
      "incident_ray": {
        "center": [
          -0.53293,
          -0.12409,
          0.14923
        ],
        "radius": 0.36444
      },
      "refracted_ray": {
        "center": [
          0.21318,
          0.03579,
          0.14923
        ],
        "radius": 0.42649
      }
    }
  },
  {
    "id": "physics/circuit-board",
    "category": "physics",
    "name": "Circuit Board",
    "path": "/models/physics/circuit-board.glb",
    "fallbackType": "box",
    "defaultColor": "#1f6f4a",
    "aliases": [
      "circuit",
      "electric circuit",
      "circuit board"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 15,
    "meshCount": 15,
    "materialCount": 8,
    "bounds": {
      "min": [
        -0.81399,
        -0.14088,
        -0.56353
      ],
      "max": [
        0.81399,
        0.14088,
        0.56353
      ],
      "size": [
        1.62798,
        0.28176,
        1.12706
      ],
      "radius": 1
    },
    "triangles": 5220,
    "bytes": 122752,
    "semanticAnchors": [
      "pcb_board",
      "battery",
      "battery_positive",
      "battery_negative",
      "resistor",
      "led",
      "switch_contact",
      "switch_pivot",
      "wire_1",
      "wire_2",
      "wire_3",
      "wire_4",
      "wire_5",
      "wire_6",
      "current_node"
    ],
    "anchors": {
      "pcb_board": {
        "center": [
          0,
          -0.11583,
          0
        ],
        "radius": 0.99034
      },
      "battery": {
        "center": [
          -0.56353,
          0.03444,
          0.25046
        ],
        "radius": 0.19939
      },
      "battery_positive": {
        "center": [
          -0.42578,
          0.08453,
          0.25046
        ],
        "radius": 0.05807
      },
      "battery_negative": {
        "center": [
          -0.70128,
          0.08453,
          0.25046
        ],
        "radius": 0.05807
      },
      "resistor": {
        "center": [
          -0.06261,
          0.00939,
          0.25046
        ],
        "radius": 0.17182
      },
      "led": {
        "center": [
          0.37569,
          0.03444,
          0.25046
        ],
        "radius": 0.15183
      },
      "switch_contact": {
        "center": [
          0.37569,
          -0.00313,
          -0.21915
        ],
        "radius": 0.13149
      },
      "switch_pivot": {
        "center": [
          0.26298,
          0.00939,
          -0.21915
        ],
        "radius": 0.06686
      },
      "wire_1": {
        "center": [
          -0.24419,
          -0.02817,
          0.25046
        ],
        "radius": 0.18352
      },
      "wire_2": {
        "center": [
          0.55727,
          -0.02817,
          0.25046
        ],
        "radius": 0.13415
      },
      "wire_3": {
        "center": [
          0.68877,
          -0.05322,
          0.01566
        ],
        "radius": 0.2363
      },
      "wire_4": {
        "center": [
          0.53223,
          -0.05322,
          -0.21915
        ],
        "radius": 0.15877
      },
      "wire_5": {
        "center": [
          0.09393,
          -0.05322,
          -0.21915
        ],
        "radius": 0.28301
      },
      "wire_6": {
        "center": [
          -0.18784,
          -0.05322,
          0.01566
        ],
        "radius": 0.2363
      },
      "current_node": {
        "center": [
          0.68876,
          -0.05322,
          0.25046
        ],
        "radius": 0.06507
      }
    }
  },
  {
    "id": "physics/projectile-launcher",
    "category": "physics",
    "name": "Projectile Launcher",
    "path": "/models/physics/projectile-launcher.glb",
    "fallbackType": "box",
    "defaultColor": "#7f8fa0",
    "aliases": [
      "projectile",
      "launcher",
      "cannon"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 6,
    "meshCount": 6,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.64913,
        -0.71947,
        -0.24695
      ],
      "max": [
        0.64913,
        0.71947,
        0.24695
      ],
      "size": [
        1.29826,
        1.43894,
        0.4939
      ],
      "radius": 1
    },
    "triangles": 1532,
    "bytes": 39656,
    "semanticAnchors": [
      "launcher_barrel",
      "launcher_base",
      "launcher_support",
      "projectile",
      "launch_velocity",
      "gravity_force"
    ],
    "anchors": {
      "launcher_barrel": {
        "center": [
          0.01138,
          0.38957,
          0
        ],
        "radius": 0.73176
      },
      "launcher_base": {
        "center": [
          0.00415,
          -0.28201,
          0
        ],
        "radius": 0.40618
      },
      "launcher_support": {
        "center": [
          0.28638,
          0.07078,
          0
        ],
        "radius": 0.38954
      },
      "projectile": {
        "center": [
          -0.52504,
          -0.11267,
          0
        ],
        "radius": 0.19553
      },
      "launch_velocity": {
        "center": [
          -0.41948,
          0.27458,
          0
        ],
        "radius": 0.25909
      },
      "gravity_force": {
        "center": [
          -0.52504,
          -0.53955,
          0
        ],
        "radius": 0.20514
      }
    }
  },
  {
    "id": "physics/wave-tank",
    "category": "physics",
    "name": "Wave Tank",
    "path": "/models/physics/wave-tank.glb",
    "fallbackType": "plane",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "wave",
      "ripple tank",
      "waves"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 10,
    "meshCount": 10,
    "materialCount": 7,
    "bounds": {
      "min": [
        -0.83973,
        -0.27151,
        -0.47025
      ],
      "max": [
        0.83973,
        0.27151,
        0.47025
      ],
      "size": [
        1.67946,
        0.54302,
        0.9405
      ],
      "radius": 1
    },
    "triangles": 4514,
    "bytes": 98588,
    "semanticAnchors": [
      "tank_frame",
      "tank_base",
      "tank_wall_l",
      "tank_wall_r",
      "tank_end_l",
      "tank_end_r",
      "water_surface",
      "wave_crest_marker",
      "wave_trough_marker",
      "wavelength_span"
    ],
    "anchors": {
      "tank_frame": {
        "center": [
          0,
          -0.23232,
          0
        ],
        "radius": 0.9525
      },
      "tank_base": {
        "center": [
          0,
          -0.18754,
          0
        ],
        "radius": 0.95211
      },
      "tank_wall_l": {
        "center": [
          0,
          0.01959,
          -0.44785
        ],
        "radius": 0.87699
      },
      "tank_wall_r": {
        "center": [
          0,
          0.01959,
          0.44786
        ],
        "radius": 0.87699
      },
      "tank_end_l": {
        "center": [
          -0.81733,
          0.01959,
          0
        ],
        "radius": 0.51434
      },
      "tank_end_r": {
        "center": [
          0.81733,
          0.01959,
          0
        ],
        "radius": 0.51434
      },
      "water_surface": {
        "center": [
          0,
          0.10356,
          0
        ],
        "radius": 0.85188
      },
      "wave_crest_marker": {
        "center": [
          0.3359,
          0.11477,
          0
        ],
        "radius": 0.07757
      },
      "wave_trough_marker": {
        "center": [
          -0.33589,
          0.0252,
          0
        ],
        "radius": 0.07757
      },
      "wavelength_span": {
        "center": [
          0.03918,
          0.19314,
          0.33589
        ],
        "radius": 0.36125
      }
    }
  },
  {
    "id": "physics/gear",
    "category": "physics",
    "name": "Gear",
    "path": "/models/physics/gear.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#9aa8b4",
    "aliases": [
      "gear",
      "gears"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 10,
    "meshCount": 10,
    "materialCount": 9,
    "bounds": {
      "min": [
        -0.74503,
        -0.6526,
        -0.13799
      ],
      "max": [
        0.74503,
        0.6526,
        0.13799
      ],
      "size": [
        1.49006,
        1.3052,
        0.27598
      ],
      "radius": 1
    },
    "triangles": 2450,
    "bytes": 95280,
    "semanticAnchors": [
      "gear_rim",
      "gear_body",
      "gear_spokes",
      "gear_hub",
      "keyway",
      "gear_teeth",
      "pitch_circle",
      "driven_gear",
      "driven_gear_shaft",
      "rotation_direction"
    ],
    "anchors": {
      "gear_rim": {
        "center": [
          0.24368,
          -0.15032,
          -0.02759
        ],
        "radius": 0.53337
      },
      "gear_body": {
        "center": [
          0.24368,
          -0.15033,
          -0.02759
        ],
        "radius": 0.45516
      },
      "gear_spokes": {
        "center": [
          0.24368,
          -0.13022,
          -0.02759
        ],
        "radius": 0.38951
      },
      "gear_hub": {
        "center": [
          0.24368,
          -0.15033,
          -0.02759
        ],
        "radius": 0.1599
      },
      "keyway": {
        "center": [
          0.24368,
          -0.05649,
          -0.02759
        ],
        "radius": 0.08883
      },
      "gear_teeth": {
        "center": [
          0.24367,
          -0.15032,
          -0.02759
        ],
        "radius": 0.71141
      },
      "pitch_circle": {
        "center": [
          0.24368,
          -0.15033,
          -0.02759
        ],
        "radius": 0.55581
      },
      "driven_gear": {
        "center": [
          -0.38555,
          0.19379,
          -0.01655
        ],
        "radius": 0.50845
      },
      "driven_gear_shaft": {
        "center": [
          -0.38555,
          0.19189,
          -0.0276
        ],
        "radius": 0.14477
      },
      "rotation_direction": {
        "center": [
          -0.36551,
          0.58709,
          0.0828
        ],
        "radius": 0.16036
      }
    }
  },
  {
    "id": "physics/magnet",
    "category": "physics",
    "name": "Bar Magnet",
    "path": "/models/physics/magnet.glb",
    "fallbackType": "box",
    "defaultColor": "#d64545",
    "aliases": [
      "magnet",
      "magnetic field"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 9,
    "meshCount": 9,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.30102,
        -0.15302,
        -0.94126
      ],
      "max": [
        0.30102,
        0.15302,
        0.94126
      ],
      "size": [
        0.60204,
        0.30604,
        1.88252
      ],
      "radius": 1
    },
    "triangles": 2304,
    "bytes": 57116,
    "semanticAnchors": [
      "magnet_north",
      "magnet_south",
      "field_line_1",
      "field_line_2",
      "field_line_3",
      "field_line_4",
      "field_line_5",
      "field_direction_north",
      "field_direction_south"
    ],
    "anchors": {
      "magnet_north": {
        "center": [
          -0.21563,
          -0.06763,
          0.34355
        ],
        "radius": 0.26405
      },
      "magnet_south": {
        "center": [
          -0.21563,
          -0.06763,
          0.59971
        ],
        "radius": 0.26405
      },
      "field_line_1": {
        "center": [
          0.04295,
          0.03933,
          -0.1465
        ],
        "radius": 0.34324
      },
      "field_line_2": {
        "center": [
          0.05539,
          0.03923,
          -0.21056
        ],
        "radius": 0.40269
      },
      "field_line_3": {
        "center": [
          0.06786,
          0.03916,
          -0.27465
        ],
        "radius": 0.46363
      },
      "field_line_4": {
        "center": [
          0.08045,
          0.03911,
          -0.33874
        ],
        "radius": 0.52559
      },
      "field_line_5": {
        "center": [
          0.09318,
          0.03907,
          -0.40283
        ],
        "radius": 0.58829
      },
      "field_direction_north": {
        "center": [
          -0.11456,
          -0.0202,
          0.04469
        ],
        "radius": 0.14019
      },
      "field_direction_south": {
        "center": [
          -0.11456,
          -0.02967,
          0.89857
        ],
        "radius": 0.1402
      }
    }
  },
  {
    "id": "physics/lever",
    "category": "physics",
    "name": "Lever",
    "path": "/models/physics/lever.glb",
    "fallbackType": "box",
    "defaultColor": "#c9a86a",
    "aliases": [
      "lever"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 6,
    "meshCount": 6,
    "materialCount": 6,
    "bounds": {
      "min": [
        -0.86616,
        -0.45806,
        -0.19988
      ],
      "max": [
        0.86616,
        0.45806,
        0.19988
      ],
      "size": [
        1.73232,
        0.91612,
        0.39976
      ],
      "radius": 1
    },
    "triangles": 1354,
    "bytes": 34536,
    "semanticAnchors": [
      "lever_bar",
      "lever_pivot",
      "fulcrum",
      "load_block",
      "effort_point",
      "load_torque"
    ],
    "anchors": {
      "lever_bar": {
        "center": [
          0,
          -0.10493,
          0
        ],
        "radius": 0.86844
      },
      "lever_pivot": {
        "center": [
          0,
          -0.26484,
          0
        ],
        "radius": 0.1731
      },
      "fulcrum": {
        "center": [
          0,
          -0.41142,
          0
        ],
        "radius": 0.36334
      },
      "load_block": {
        "center": [
          0.66628,
          0.08162,
          0
        ],
        "radius": 0.2308
      },
      "effort_point": {
        "center": [
          -0.66627,
          0.00166,
          0
        ],
        "radius": 0.13848
      },
      "load_torque": {
        "center": [
          0.66628,
          0.25985,
          0
        ],
        "radius": 0.21897
      }
    }
  },
  {
    "id": "physics/piston-engine",
    "category": "physics",
    "name": "Piston Engine",
    "path": "/models/physics/piston-engine.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#9aa8b4",
    "aliases": [
      "engine",
      "piston"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 8,
    "meshCount": 8,
    "materialCount": 8,
    "bounds": {
      "min": [
        -0.30151,
        -0.90453,
        -0.30151
      ],
      "max": [
        0.30151,
        0.90453,
        0.30151
      ],
      "size": [
        0.60302,
        1.80906,
        0.60302
      ],
      "radius": 1
    },
    "triangles": 796,
    "bytes": 31924,
    "semanticAnchors": [
      "cylinder_block",
      "piston",
      "piston_rod",
      "crank_weight",
      "crankshaft",
      "combustion_chamber",
      "intake_valve",
      "exhaust_valve"
    ],
    "anchors": {
      "cylinder_block": {
        "center": [
          0,
          -0.48241,
          0
        ],
        "radius": 0.6
      },
      "piston": {
        "center": [
          0,
          -0.1809,
          0
        ],
        "radius": 0.37794
      },
      "piston_rod": {
        "center": [
          0,
          0.30151,
          0
        ],
        "radius": 0.36986
      },
      "crank_weight": {
        "center": [
          0,
          0.75378,
          0
        ],
        "radius": 0.19771
      },
      "crankshaft": {
        "center": [
          0,
          0.78393,
          0
        ],
        "radius": 0.31334
      },
      "combustion_chamber": {
        "center": [
          0,
          0.03015,
          0
        ],
        "radius": 0.27136
      },
      "intake_valve": {
        "center": [
          -0.21106,
          -0.1206,
          0
        ],
        "radius": 0.13457
      },
      "exhaust_valve": {
        "center": [
          0.21106,
          -0.1206,
          0
        ],
        "radius": 0.13457
      }
    }
  },
  {
    "id": "chemistry/atom",
    "category": "chemistry",
    "name": "Atom",
    "path": "/models/chemistry/atom.glb",
    "fallbackType": "sphere",
    "defaultColor": "#e05f5f",
    "aliases": [
      "atom",
      "atomic structure"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 24,
    "meshCount": 24,
    "materialCount": 7,
    "bounds": {
      "min": [
        -0.65355,
        -0.35162,
        -0.67025
      ],
      "max": [
        0.65355,
        0.35162,
        0.67025
      ],
      "size": [
        1.3071,
        0.70324,
        1.3405
      ],
      "radius": 1
    },
    "triangles": 29616,
    "bytes": 596832,
    "semanticAnchors": [
      "proton_1",
      "proton_2",
      "proton_3",
      "neutron_1",
      "neutron_2",
      "neutron_3",
      "neutron_4",
      "nucleus",
      "electron_shell_1",
      "electron_1_1",
      "electron_1_2",
      "electron_shell_2",
      "electron_2_1",
      "electron_2_2",
      "electron_2_3",
      "electron_2_4",
      "electron_2_5",
      "electron_2_6",
      "electron_2_7",
      "electron_2_8",
      "electron_shell_3",
      "electron_3_1",
      "electron_3_2",
      "electron_3_3"
    ],
    "anchors": {
      "proton_1": {
        "center": [
          -0.0062,
          0,
          -0.02924
        ],
        "radius": 0.12029
      },
      "proton_2": {
        "center": [
          -0.07747,
          0.04115,
          0.02924
        ],
        "radius": 0.12029
      },
      "proton_3": {
        "center": [
          -0.07747,
          -0.04115,
          -0.02924
        ],
        "radius": 0.12029
      },
      "neutron_1": {
        "center": [
          -0.0056,
          0.02629,
          -0.04751
        ],
        "radius": 0.12029
      },
      "neutron_2": {
        "center": [
          -0.08,
          0.04812,
          0
        ],
        "radius": 0.12029
      },
      "neutron_3": {
        "center": [
          -0.10183,
          -0.02628,
          0.04751
        ],
        "radius": 0.12029
      },
      "neutron_4": {
        "center": [
          -0.02743,
          -0.04811,
          -0.04751
        ],
        "radius": 0.12029
      },
      "nucleus": {
        "center": [
          -0.05371,
          0,
          0
        ],
        "radius": 0.2659
      },
      "electron_shell_1": {
        "center": [
          -0.05371,
          0,
          0
        ],
        "radius": 0.49729
      },
      "electron_1_1": {
        "center": [
          0.29352,
          0,
          0
        ],
        "radius": 0.05381
      },
      "electron_1_2": {
        "center": [
          -0.40095,
          0,
          0
        ],
        "radius": 0.05381
      },
      "electron_shell_2": {
        "center": [
          -0.05372,
          0,
          0
        ],
        "radius": 0.72823
      },
      "electron_2_1": {
        "center": [
          0.458,
          0,
          0
        ],
        "radius": 0.05381
      },
      "electron_2_2": {
        "center": [
          0.30813,
          0.16987,
          0.31949
        ],
        "radius": 0.05381
      },
      "electron_2_3": {
        "center": [
          -0.05371,
          0.24024,
          0.45182
        ],
        "radius": 0.05381
      },
      "electron_2_4": {
        "center": [
          -0.41555,
          0.16987,
          0.31949
        ],
        "radius": 0.05381
      },
      "electron_2_5": {
        "center": [
          -0.56543,
          0,
          0
        ],
        "radius": 0.05381
      },
      "electron_2_6": {
        "center": [
          -0.41555,
          -0.16987,
          -0.31949
        ],
        "radius": 0.05381
      },
      "electron_2_7": {
        "center": [
          -0.05371,
          -0.24024,
          -0.45182
        ],
        "radius": 0.05381
      },
      "electron_2_8": {
        "center": [
          0.30813,
          -0.16987,
          -0.31949
        ],
        "radius": 0.05381
      },
      "electron_shell_3": {
        "center": [
          -0.05371,
          0,
          0
        ],
        "radius": 0.95531
      },
      "electron_3_1": {
        "center": [
          0.62248,
          0,
          0
        ],
        "radius": 0.05381
      },
      "electron_3_2": {
        "center": [
          -0.39181,
          0.27492,
          -0.51706
        ],
        "radius": 0.05381
      },
      "electron_3_3": {
        "center": [
          -0.39181,
          -0.27492,
          0.51706
        ],
        "radius": 0.05381
      }
    }
  },
  {
    "id": "chemistry/water-molecule",
    "category": "chemistry",
    "name": "Water Molecule",
    "path": "/models/chemistry/water-molecule.glb",
    "fallbackType": "sphere",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "water molecule",
      "h2o"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 7,
    "meshCount": 7,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.73965,
        -0.61741,
        -0.2678
      ],
      "max": [
        0.73965,
        0.61741,
        0.2678
      ],
      "size": [
        1.4793,
        1.23482,
        0.5356
      ],
      "radius": 1
    },
    "triangles": 5322,
    "bytes": 113168,
    "semanticAnchors": [
      "oxygen_atom",
      "hydrogen_1",
      "hydrogen_2",
      "bond_1",
      "bond_2",
      "dipole_moment",
      "partial_charge_ring"
    ],
    "anchors": {
      "oxygen_atom": {
        "center": [
          0,
          -0.01271,
          0
        ],
        "radius": 0.46384
      },
      "hydrogen_1": {
        "center": [
          -0.59788,
          -0.47563,
          0
        ],
        "radius": 0.24556
      },
      "hydrogen_2": {
        "center": [
          0.59788,
          -0.47563,
          0
        ],
        "radius": 0.24556
      },
      "bond_1": {
        "center": [
          -0.29894,
          -0.24417,
          0
        ],
        "radius": 0.343
      },
      "bond_2": {
        "center": [
          0.29894,
          -0.24417,
          0
        ],
        "radius": 0.343
      },
      "dipole_moment": {
        "center": [
          0,
          0.31614,
          0.15754
        ],
        "radius": 0.32073
      },
      "partial_charge_ring": {
        "center": [
          0,
          -0.01271,
          0
        ],
        "radius": 0.4681
      }
    }
  },
  {
    "id": "chemistry/co2-molecule",
    "category": "chemistry",
    "name": "Carbon Dioxide Molecule",
    "path": "/models/chemistry/co2-molecule.glb",
    "fallbackType": "sphere",
    "defaultColor": "#e05f5f",
    "aliases": [
      "co2",
      "carbon dioxide"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 7,
    "meshCount": 7,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.97024,
        -0.17122,
        -0.17122
      ],
      "max": [
        0.97024,
        0.17122,
        0.17122
      ],
      "size": [
        1.94048,
        0.34244,
        0.34244
      ],
      "radius": 1
    },
    "triangles": 4096,
    "bytes": 91068,
    "semanticAnchors": [
      "carbon_atom",
      "oxygen_atom_left",
      "oxygen_atom_right",
      "double_bond_left",
      "double_bond_left_2",
      "double_bond_right",
      "double_bond_right_2"
    ],
    "anchors": {
      "carbon_atom": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.29656
      },
      "oxygen_atom_left": {
        "center": [
          -0.82756,
          0,
          0
        ],
        "radius": 0.24713
      },
      "oxygen_atom_right": {
        "center": [
          0.82756,
          0,
          0
        ],
        "radius": 0.24713
      },
      "double_bond_left": {
        "center": [
          -0.3567,
          0.06421,
          0
        ],
        "radius": 0.32423
      },
      "double_bond_left_2": {
        "center": [
          -0.3567,
          -0.0642,
          0
        ],
        "radius": 0.32423
      },
      "double_bond_right": {
        "center": [
          0.35671,
          0.06421,
          0
        ],
        "radius": 0.32423
      },
      "double_bond_right_2": {
        "center": [
          0.35671,
          -0.0642,
          0
        ],
        "radius": 0.32423
      }
    }
  },
  {
    "id": "chemistry/methane-molecule",
    "category": "chemistry",
    "name": "Methane Molecule",
    "path": "/models/chemistry/methane-molecule.glb",
    "fallbackType": "sphere",
    "defaultColor": "#5a5a5a",
    "aliases": [
      "methane",
      "ch4"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 9,
    "meshCount": 9,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.57735,
        -0.57735,
        -0.57735
      ],
      "max": [
        0.57735,
        0.57735,
        0.57735
      ],
      "size": [
        1.1547,
        1.1547,
        1.1547
      ],
      "radius": 1
    },
    "triangles": 6528,
    "bytes": 140040,
    "semanticAnchors": [
      "carbon_atom",
      "hydrogen_1",
      "bond_1",
      "hydrogen_2",
      "bond_2",
      "hydrogen_3",
      "bond_3",
      "hydrogen_4",
      "bond_4"
    ],
    "anchors": {
      "carbon_atom": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.45085
      },
      "hydrogen_1": {
        "center": [
          0.42354,
          0.42354,
          0.42354
        ],
        "radius": 0.26642
      },
      "bond_1": {
        "center": [
          0.21177,
          0.21177,
          0.21177
        ],
        "radius": 0.42575
      },
      "hydrogen_2": {
        "center": [
          -0.42353,
          -0.42353,
          0.42354
        ],
        "radius": 0.26642
      },
      "bond_2": {
        "center": [
          -0.21176,
          -0.21176,
          0.21177
        ],
        "radius": 0.42575
      },
      "hydrogen_3": {
        "center": [
          -0.42353,
          0.42354,
          -0.42353
        ],
        "radius": 0.26642
      },
      "bond_3": {
        "center": [
          -0.21176,
          0.21177,
          -0.21177
        ],
        "radius": 0.42575
      },
      "hydrogen_4": {
        "center": [
          0.42354,
          -0.42353,
          -0.42353
        ],
        "radius": 0.26642
      },
      "bond_4": {
        "center": [
          0.21177,
          -0.21176,
          -0.21177
        ],
        "radius": 0.42575
      }
    }
  },
  {
    "id": "chemistry/benzene-ring",
    "category": "chemistry",
    "name": "Benzene Ring",
    "path": "/models/chemistry/benzene-ring.glb",
    "fallbackType": "sphere",
    "defaultColor": "#4a9ee8",
    "aliases": [
      "benzene",
      "aromatic ring"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 11,
    "meshCount": 11,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.63831,
        -0.49029,
        -0.59345
      ],
      "max": [
        0.63831,
        0.49029,
        0.59345
      ],
      "size": [
        1.27662,
        0.98058,
        1.1869
      ],
      "radius": 1
    },
    "triangles": 10208,
    "bytes": 211904,
    "semanticAnchors": [
      "benzene_ring",
      "carbon_1",
      "double_bond_1",
      "hydrogen_attached",
      "carbon_2",
      "carbon_3",
      "double_bond_2",
      "carbon_4",
      "carbon_5",
      "double_bond_3",
      "carbon_6"
    ],
    "anchors": {
      "benzene_ring": {
        "center": [
          -0.08325,
          0,
          0.10037
        ],
        "radius": 0.69393
      },
      "carbon_1": {
        "center": [
          0.37929,
          0,
          0.10037
        ],
        "radius": 0.16023
      },
      "double_bond_1": {
        "center": [
          0.31732,
          0.04626,
          0.33164
        ],
        "radius": 0.2321
      },
      "hydrogen_attached": {
        "center": [
          0.58743,
          0,
          0.10037
        ],
        "radius": 0.08812
      },
      "carbon_2": {
        "center": [
          0.14801,
          0,
          0.50094
        ],
        "radius": 0.16023
      },
      "carbon_3": {
        "center": [
          -0.31453,
          0,
          0.50094
        ],
        "radius": 0.16023
      },
      "double_bond_2": {
        "center": [
          -0.48383,
          0.04626,
          0.33164
        ],
        "radius": 0.2321
      },
      "carbon_4": {
        "center": [
          -0.5458,
          0,
          0.10037
        ],
        "radius": 0.16023
      },
      "carbon_5": {
        "center": [
          -0.31453,
          0,
          -0.3002
        ],
        "radius": 0.16023
      },
      "double_bond_3": {
        "center": [
          -0.08325,
          0.04626,
          -0.36217
        ],
        "radius": 0.23211
      },
      "carbon_6": {
        "center": [
          0.14801,
          0,
          -0.3002
        ],
        "radius": 0.16023
      }
    }
  },
  {
    "id": "chemistry/crystal-lattice",
    "category": "chemistry",
    "name": "Crystal Lattice",
    "path": "/models/chemistry/crystal-lattice.glb",
    "fallbackType": "box",
    "defaultColor": "#4a9ee8",
    "aliases": [
      "crystal",
      "lattice",
      "ionic lattice"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 40,
    "meshCount": 40,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.57735,
        -0.57735,
        -0.57735
      ],
      "max": [
        0.57735,
        0.57735,
        0.57735
      ],
      "size": [
        1.1547,
        1.1547,
        1.1547
      ],
      "radius": 1
    },
    "triangles": 37360,
    "bytes": 764128,
    "semanticAnchors": [
      "ion_1",
      "ion_2",
      "ion_3",
      "ion_4",
      "ion_5",
      "ion_6",
      "ion_7",
      "ion_8",
      "ion_9",
      "ion_10",
      "ion_11",
      "ion_12",
      "ion_13",
      "ion_14",
      "ion_15",
      "ion_16",
      "ion_17",
      "ion_18",
      "ion_19",
      "ion_20",
      "ion_21",
      "ion_22",
      "ion_23",
      "ion_24",
      "ion_25",
      "ion_26",
      "ion_27",
      "unit_cell_edge_1",
      "unit_cell_edge_2",
      "unit_cell_edge_3",
      "unit_cell_edge_4",
      "unit_cell_edge_5",
      "unit_cell_edge_6",
      "unit_cell_edge_7",
      "unit_cell_edge_8",
      "unit_cell_edge_9",
      "unit_cell_edge_10",
      "unit_cell_edge_11",
      "unit_cell_edge_12",
      "cation"
    ],
    "anchors": {
      "ion_1": {
        "center": [
          -0.41623,
          -0.41623,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_2": {
        "center": [
          -0.41623,
          -0.41623,
          0
        ],
        "radius": 0.27907
      },
      "ion_3": {
        "center": [
          -0.41623,
          -0.41623,
          0.41623
        ],
        "radius": 0.27907
      },
      "ion_4": {
        "center": [
          -0.41623,
          0,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_5": {
        "center": [
          -0.41623,
          0,
          0
        ],
        "radius": 0.27907
      },
      "ion_6": {
        "center": [
          -0.41623,
          0,
          0.41623
        ],
        "radius": 0.27907
      },
      "ion_7": {
        "center": [
          -0.41623,
          0.41623,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_8": {
        "center": [
          -0.41623,
          0.41623,
          0
        ],
        "radius": 0.27907
      },
      "ion_9": {
        "center": [
          -0.41623,
          0.41623,
          0.41623
        ],
        "radius": 0.27907
      },
      "ion_10": {
        "center": [
          0,
          -0.41623,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_11": {
        "center": [
          0,
          -0.41623,
          0
        ],
        "radius": 0.27907
      },
      "ion_12": {
        "center": [
          0,
          -0.41623,
          0.41623
        ],
        "radius": 0.27907
      },
      "ion_13": {
        "center": [
          0,
          0,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_14": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.27907
      },
      "ion_15": {
        "center": [
          0,
          0,
          0.41623
        ],
        "radius": 0.27907
      },
      "ion_16": {
        "center": [
          0,
          0.41623,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_17": {
        "center": [
          0,
          0.41623,
          0
        ],
        "radius": 0.27907
      },
      "ion_18": {
        "center": [
          0,
          0.41623,
          0.41623
        ],
        "radius": 0.27907
      },
      "ion_19": {
        "center": [
          0.41623,
          -0.41623,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_20": {
        "center": [
          0.41623,
          -0.41623,
          0
        ],
        "radius": 0.27907
      },
      "ion_21": {
        "center": [
          0.41623,
          -0.41623,
          0.41623
        ],
        "radius": 0.27907
      },
      "ion_22": {
        "center": [
          0.41623,
          0,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_23": {
        "center": [
          0.41623,
          0,
          0
        ],
        "radius": 0.27907
      },
      "ion_24": {
        "center": [
          0.41623,
          0,
          0.41623
        ],
        "radius": 0.27907
      },
      "ion_25": {
        "center": [
          0.41623,
          0.41623,
          -0.41623
        ],
        "radius": 0.27907
      },
      "ion_26": {
        "center": [
          0.41623,
          0.41623,
          0
        ],
        "radius": 0.27907
      },
      "ion_27": {
        "center": [
          0.41623,
          0.41623,
          0.41623
        ],
        "radius": 0.27907
      },
      "unit_cell_edge_1": {
        "center": [
          -0.41622,
          -0.41623,
          0
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_2": {
        "center": [
          -0.41623,
          0,
          -0.41622
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_3": {
        "center": [
          0,
          -0.41623,
          -0.41622
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_4": {
        "center": [
          -0.41623,
          0,
          0.41622
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_5": {
        "center": [
          0,
          -0.41623,
          0.41622
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_6": {
        "center": [
          -0.41622,
          0.41623,
          0
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_7": {
        "center": [
          0,
          0.41623,
          -0.41622
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_8": {
        "center": [
          0,
          0.41623,
          0.41622
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_9": {
        "center": [
          0.41622,
          -0.41623,
          0
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_10": {
        "center": [
          0.41623,
          0,
          -0.41622
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_11": {
        "center": [
          0.41623,
          0,
          0.41622
        ],
        "radius": 0.41682
      },
      "unit_cell_edge_12": {
        "center": [
          0.41622,
          0.41623,
          0
        ],
        "radius": 0.41682
      },
      "cation": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.27907
      }
    }
  },
  {
    "id": "chemistry/titration-setup",
    "category": "chemistry",
    "name": "Titration Setup",
    "path": "/models/chemistry/titration-setup.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#d8e8f0",
    "aliases": [
      "titration",
      "burette"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 8,
    "meshCount": 8,
    "materialCount": 7,
    "bounds": {
      "min": [
        -0.25482,
        -0.93281,
        -0.25482
      ],
      "max": [
        0.25482,
        0.93281,
        0.25482
      ],
      "size": [
        0.50964,
        1.86562,
        0.50964
      ],
      "radius": 1
    },
    "triangles": 2172,
    "bytes": 56612,
    "semanticAnchors": [
      "burette_tube",
      "burette_tip",
      "burette_stand",
      "burette_clamp",
      "titrant",
      "erlenmeyer_flask",
      "analyte_solution",
      "drop_1"
    ],
    "anchors": {
      "burette_tube": {
        "center": [
          0,
          0.47778,
          0
        ],
        "radius": 0.45666
      },
      "burette_tip": {
        "center": [
          0,
          -0.02275,
          0
        ],
        "radius": 0.07295
      },
      "burette_stand": {
        "center": [
          0,
          -0.34127,
          0
        ],
        "radius": 0.23534
      },
      "burette_clamp": {
        "center": [
          0.04551,
          0.47778,
          0
        ],
        "radius": 0.09652
      },
      "titrant": {
        "center": [
          0,
          0.6143,
          0
        ],
        "radius": 0.22935
      },
      "erlenmeyer_flask": {
        "center": [
          0,
          -0.71667,
          0
        ],
        "radius": 0.42022
      },
      "analyte_solution": {
        "center": [
          0,
          -0.59154,
          0
        ],
        "radius": 0.2506
      },
      "drop_1": {
        "center": [
          0,
          -0.10466,
          0
        ],
        "radius": 0.0394
      }
    }
  },
  {
    "id": "chemistry/periodic-tile",
    "category": "chemistry",
    "name": "Periodic Table Tile",
    "path": "/models/chemistry/periodic-tile.glb",
    "fallbackType": "box",
    "defaultColor": "#2f4f7f",
    "aliases": [
      "periodic table tile",
      "element tile"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 3,
    "meshCount": 3,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.70554,
        -0.70554,
        -0.06656
      ],
      "max": [
        0.70554,
        0.70554,
        0.06656
      ],
      "size": [
        1.41108,
        1.41108,
        0.13312
      ],
      "radius": 1
    },
    "triangles": 36,
    "bytes": 4376,
    "semanticAnchors": [
      "tile",
      "tile_border",
      "tile_border_bottom"
    ],
    "anchors": {
      "tile": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.94281
      },
      "tile_border": {
        "center": [
          0,
          0.66561,
          0
        ],
        "radius": 0.7098
      },
      "tile_border_bottom": {
        "center": [
          0,
          -0.6656,
          0
        ],
        "radius": 0.7098
      }
    }
  },
  {
    "id": "earth/globe",
    "category": "earth",
    "name": "Earth Globe",
    "path": "/models/earth/globe.glb",
    "fallbackType": "sphere",
    "defaultColor": "#2f6fbf",
    "aliases": [
      "earth",
      "globe",
      "world"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 11,
    "meshCount": 11,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.55035,
        -0.65056,
        -0.52335
      ],
      "max": [
        0.55035,
        0.65056,
        0.52335
      ],
      "size": [
        1.1007,
        1.30112,
        1.0467
      ],
      "radius": 1
    },
    "triangles": 13896,
    "bytes": 279716,
    "semanticAnchors": [
      "ocean",
      "continent_1",
      "continent_2",
      "continent_3",
      "continent_4",
      "continent_5",
      "continent_6",
      "north_pole_ice",
      "south_pole_ice",
      "rotation_axis",
      "equator"
    ],
    "anchors": {
      "ocean": {
        "center": [
          0.0134,
          0.01219,
          -0.00854
        ],
        "radius": 0.89168
      },
      "continent_1": {
        "center": [
          0.26173,
          0.16248,
          0.37274
        ],
        "radius": 0.35887
      },
      "continent_2": {
        "center": [
          -0.18431,
          0.32534,
          -0.3201
        ],
        "radius": 0.35984
      },
      "continent_3": {
        "center": [
          0.45221,
          -0.16856,
          -0.10387
        ],
        "radius": 0.35962
      },
      "continent_4": {
        "center": [
          -0.36186,
          -0.23017,
          0.17402
        ],
        "radius": 0.35645
      },
      "continent_5": {
        "center": [
          0.09537,
          -0.41493,
          0.20506
        ],
        "radius": 0.36234
      },
      "continent_6": {
        "center": [
          -0.4343,
          0.03793,
          0.17276
        ],
        "radius": 0.3568
      },
      "north_pole_ice": {
        "center": [
          0.0134,
          0.50641,
          -0.00854
        ],
        "radius": 0.24968
      },
      "south_pole_ice": {
        "center": [
          0.01339,
          -0.48203,
          -0.00854
        ],
        "radius": 0.214
      },
      "rotation_axis": {
        "center": [
          0.0134,
          0.01219,
          -0.00854
        ],
        "radius": 0.67687
      },
      "equator": {
        "center": [
          0.0134,
          0.01219,
          -0.00854
        ],
        "radius": 0.75138
      }
    }
  },
  {
    "id": "earth/earth-layers",
    "category": "earth",
    "name": "Earth Internal Layers",
    "path": "/models/earth/earth-layers.glb",
    "fallbackType": "sphere",
    "defaultColor": "#e05f5f",
    "aliases": [
      "earth layers",
      "crust",
      "mantle",
      "core"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 5,
    "meshCount": 5,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.70696,
        -0.0206,
        -0.70696
      ],
      "max": [
        0.70696,
        0.0206,
        0.70696
      ],
      "size": [
        1.41392,
        0.0412,
        1.41392
      ],
      "radius": 1
    },
    "triangles": 1600,
    "bytes": 38584,
    "semanticAnchors": [
      "inner_core",
      "outer_core",
      "lower_mantle",
      "upper_mantle",
      "crust"
    ],
    "anchors": {
      "inner_core": {
        "center": [
          0.00018,
          0,
          -0.00018
        ],
        "radius": 0.34036
      },
      "outer_core": {
        "center": [
          0.00012,
          0,
          -0.00012
        ],
        "radius": 0.56336
      },
      "lower_mantle": {
        "center": [
          0.00006,
          0,
          -0.00006
        ],
        "radius": 0.78651
      },
      "upper_mantle": {
        "center": [
          0.00002,
          0,
          -0.00002
        ],
        "radius": 0.92237
      },
      "crust": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 1
      }
    }
  },
  {
    "id": "earth/atmosphere",
    "category": "earth",
    "name": "Atmosphere",
    "path": "/models/earth/atmosphere.glb",
    "fallbackType": "sphere",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "atmosphere",
      "air layer",
      "troposphere"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 5,
    "meshCount": 5,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.62612,
        -0.4647,
        -0.62612
      ],
      "max": [
        0.62612,
        0.4647,
        0.62612
      ],
      "size": [
        1.25224,
        0.9294,
        1.25224
      ],
      "radius": 1
    },
    "triangles": 4352,
    "bytes": 90724,
    "semanticAnchors": [
      "atmosphere",
      "troposphere",
      "cloud_layer_1",
      "cloud_layer_2",
      "cloud_layer_3"
    ],
    "anchors": {
      "atmosphere": {
        "center": [
          0,
          0.02446,
          0
        ],
        "radius": 0.88633
      },
      "troposphere": {
        "center": [
          0,
          0.02446,
          0
        ],
        "radius": 0.79591
      },
      "cloud_layer_1": {
        "center": [
          0.19566,
          0.2935,
          0.2935
        ],
        "radius": 0.29654
      },
      "cloud_layer_2": {
        "center": [
          -0.29349,
          -0.07337,
          0.24458
        ],
        "radius": 0.23723
      },
      "cloud_layer_3": {
        "center": [
          0.04892,
          -0.31795,
          -0.19566
        ],
        "radius": 0.25417
      }
    }
  },
  {
    "id": "earth/tectonic-plates",
    "category": "earth",
    "name": "Tectonic Plates",
    "path": "/models/earth/tectonic-plates.glb",
    "fallbackType": "box",
    "defaultColor": "#c96a5a",
    "aliases": [
      "tectonic plate",
      "tectonic plates",
      "plates"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 14,
    "meshCount": 14,
    "materialCount": 9,
    "bounds": {
      "min": [
        -0.56626,
        -0.59309,
        -0.57236
      ],
      "max": [
        0.56626,
        0.59309,
        0.57236
      ],
      "size": [
        1.13252,
        1.18618,
        1.14472
      ],
      "radius": 1
    },
    "triangles": 9560,
    "bytes": 196888,
    "semanticAnchors": [
      "plate_1",
      "plate_boundary_1",
      "plate_2",
      "plate_boundary_2",
      "plate_3",
      "plate_boundary_3",
      "plate_4",
      "plate_boundary_4",
      "plate_5",
      "plate_boundary_5",
      "plate_6",
      "plate_boundary_6",
      "mantle_convection",
      "boundary_ridge"
    ],
    "anchors": {
      "plate_1": {
        "center": [
          0.34274,
          -0.05662,
          0
        ],
        "radius": 0.27797
      },
      "plate_boundary_1": {
        "center": [
          0,
          -0.03279,
          0
        ],
        "radius": 0.79244
      },
      "plate_2": {
        "center": [
          0.17137,
          0.00894,
          0.29682
        ],
        "radius": 0.37514
      },
      "plate_boundary_2": {
        "center": [
          0,
          0.03279,
          0
        ],
        "radius": 0.79244
      },
      "plate_3": {
        "center": [
          -0.17137,
          -0.05662,
          0.29682
        ],
        "radius": 0.37514
      },
      "plate_boundary_3": {
        "center": [
          0,
          -0.03279,
          0
        ],
        "radius": 0.79244
      },
      "plate_4": {
        "center": [
          -0.34273,
          0.00894,
          0
        ],
        "radius": 0.27797
      },
      "plate_boundary_4": {
        "center": [
          0,
          0.03279,
          0
        ],
        "radius": 0.79244
      },
      "plate_5": {
        "center": [
          -0.17137,
          -0.05662,
          -0.29682
        ],
        "radius": 0.37514
      },
      "plate_boundary_5": {
        "center": [
          0,
          -0.03279,
          0
        ],
        "radius": 0.79244
      },
      "plate_6": {
        "center": [
          0.17137,
          0.00894,
          -0.29682
        ],
        "radius": 0.37514
      },
      "plate_boundary_6": {
        "center": [
          0,
          0.03279,
          0
        ],
        "radius": 0.79244
      },
      "mantle_convection": {
        "center": [
          0,
          -0.20564,
          0
        ],
        "radius": 0.25811
      },
      "boundary_ridge": {
        "center": [
          0,
          0.00298,
          0
        ],
        "radius": 0.21127
      }
    }
  },
  {
    "id": "earth/volcano",
    "category": "earth",
    "name": "Volcano",
    "path": "/models/earth/volcano.glb",
    "fallbackType": "cone",
    "defaultColor": "#6a5a4a",
    "aliases": [
      "volcano",
      "volcanic cone"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 11,
    "meshCount": 11,
    "materialCount": 11,
    "bounds": {
      "min": [
        -0.55776,
        -0.61465,
        -0.55776
      ],
      "max": [
        0.55776,
        0.61465,
        0.55776
      ],
      "size": [
        1.11552,
        1.2293,
        1.11552
      ],
      "radius": 0.99999
    },
    "triangles": 9134,
    "bytes": 191268,
    "semanticAnchors": [
      "volcano_cone",
      "crater_rim",
      "crater_throat",
      "magma_chamber",
      "lava_flow",
      "ash_plume_1",
      "ash_plume_2",
      "ash_plume_3",
      "ash_plume_4",
      "ash_plume_5",
      "ground"
    ],
    "anchors": {
      "volcano_cone": {
        "center": [
          0,
          -0.3804,
          0
        ],
        "radius": 0.41859
      },
      "crater_rim": {
        "center": [
          0,
          -0.20191,
          0
        ],
        "radius": 0.14757
      },
      "crater_throat": {
        "center": [
          0,
          -0.29115,
          0
        ],
        "radius": 0.18262
      },
      "magma_chamber": {
        "center": [
          0,
          -0.55887,
          0
        ],
        "radius": 0.19735
      },
      "lava_flow": {
        "center": [
          0.15618,
          -0.44732,
          0.04463
        ],
        "radius": 0.20719
      },
      "ash_plume_1": {
        "center": [
          0.02231,
          0.06582,
          0
        ],
        "radius": 0.08501
      },
      "ash_plume_2": {
        "center": [
          -0.04462,
          0.17737,
          0.02231
        ],
        "radius": 0.1082
      },
      "ash_plume_3": {
        "center": [
          0.05578,
          0.28893,
          -0.03346
        ],
        "radius": 0.13138
      },
      "ash_plume_4": {
        "center": [
          0,
          0.40048,
          0.02231
        ],
        "radius": 0.15457
      },
      "ash_plume_5": {
        "center": [
          -0.02231,
          0.51202,
          0
        ],
        "radius": 0.17776
      },
      "ground": {
        "center": [
          0,
          -0.56334,
          0
        ],
        "radius": 0.78879
      }
    }
  },
  {
    "id": "earth/mountain",
    "category": "earth",
    "name": "Mountain",
    "path": "/models/earth/mountain.glb",
    "fallbackType": "cone",
    "defaultColor": "#8a8a8a",
    "aliases": [
      "mountain",
      "peak"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 7,
    "meshCount": 7,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.65761,
        -0.53924,
        -0.52609
      ],
      "max": [
        0.65761,
        0.53924,
        0.52609
      ],
      "size": [
        1.31522,
        1.07848,
        1.05218
      ],
      "radius": 1
    },
    "triangles": 5046,
    "bytes": 106632,
    "semanticAnchors": [
      "mountain_peak",
      "snow_cap",
      "valley_ground",
      "cloud_1",
      "cloud_2",
      "cloud_3",
      "cloud_4"
    ],
    "anchors": {
      "mountain_peak": {
        "center": [
          0,
          -0.24989,
          0
        ],
        "radius": 0.56356
      },
      "snow_cap": {
        "center": [
          0,
          0.17098,
          0
        ],
        "radius": 0.2137
      },
      "valley_ground": {
        "center": [
          0,
          -0.52609,
          0
        ],
        "radius": 0.84215
      },
      "cloud_1": {
        "center": [
          0.28935,
          0.35511,
          0
        ],
        "radius": 0.13668
      },
      "cloud_2": {
        "center": [
          -0.00845,
          0.46033,
          0.21035
        ],
        "radius": 0.13668
      },
      "cloud_3": {
        "center": [
          -0.28885,
          0.35511,
          -0.01229
        ],
        "radius": 0.13668
      },
      "cloud_4": {
        "center": [
          0.02532,
          0.46033,
          -0.20962
        ],
        "radius": 0.13668
      }
    }
  },
  {
    "id": "earth/cloud",
    "category": "earth",
    "name": "Cloud",
    "path": "/models/earth/cloud.glb",
    "fallbackType": "sphere",
    "defaultColor": "#ffffff",
    "aliases": [
      "cloud",
      "clouds"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 5,
    "meshCount": 5,
    "materialCount": 1,
    "bounds": {
      "min": [
        -0.73722,
        -0.49041,
        -0.46477
      ],
      "max": [
        0.73722,
        0.49041,
        0.46477
      ],
      "size": [
        1.47444,
        0.98082,
        0.92954
      ],
      "radius": 1
    },
    "triangles": 6080,
    "bytes": 123168,
    "semanticAnchors": [
      "cloud_puff_1",
      "cloud_puff_2",
      "cloud_puff_3",
      "cloud_puff_4",
      "cloud_puff_5"
    ],
    "anchors": {
      "cloud_puff_1": {
        "center": [
          -0.38463,
          -0.07372,
          -0.04808
        ],
        "radius": 0.61069
      },
      "cloud_puff_2": {
        "center": [
          0.03205,
          0.04167,
          0.01603
        ],
        "radius": 0.77724
      },
      "cloud_puff_3": {
        "center": [
          0.41669,
          -0.0609,
          -0.08013
        ],
        "radius": 0.55517
      },
      "cloud_puff_4": {
        "center": [
          0,
          -0.20193,
          0.08014
        ],
        "radius": 0.49966
      },
      "cloud_puff_5": {
        "center": [
          -0.28848,
          0.00321,
          -0.20834
        ],
        "radius": 0.44414
      }
    }
  },
  {
    "id": "earth/water-droplet",
    "category": "earth",
    "name": "Water Droplet",
    "path": "/models/earth/water-droplet.glb",
    "fallbackType": "sphere",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "water droplet",
      "droplet",
      "raindrop"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 3,
    "meshCount": 3,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.49957,
        -0.70772,
        -0.49957
      ],
      "max": [
        0.49957,
        0.70772,
        0.49957
      ],
      "size": [
        0.99914,
        1.41544,
        0.99914
      ],
      "radius": 1
    },
    "triangles": 2516,
    "bytes": 53132,
    "semanticAnchors": [
      "droplet",
      "droplet_tip",
      "highlight"
    ],
    "anchors": {
      "droplet": {
        "center": [
          0,
          -0.20815,
          0
        ],
        "radius": 0.86528
      },
      "droplet_tip": {
        "center": [
          0,
          0.29141,
          0
        ],
        "radius": 0.82003
      },
      "highlight": {
        "center": [
          -0.16652,
          -0.00832,
          0.33305
        ],
        "radius": 0.23074
      }
    }
  },
  {
    "id": "astronomy/sun",
    "category": "astronomy",
    "name": "Sun",
    "path": "/models/astronomy/sun.glb",
    "fallbackType": "sphere",
    "defaultColor": "#ffcc33",
    "aliases": [
      "sun",
      "star"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 11,
    "meshCount": 11,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.57735,
        -0.57735,
        -0.57735
      ],
      "max": [
        0.57735,
        0.57735,
        0.57735
      ],
      "size": [
        1.1547,
        1.1547,
        1.1547
      ],
      "radius": 1
    },
    "triangles": 4840,
    "bytes": 111836,
    "semanticAnchors": [
      "photosphere",
      "chromosphere",
      "corona",
      "solar_prominence_1",
      "solar_prominence_2",
      "solar_prominence_3",
      "solar_prominence_4",
      "solar_prominence_5",
      "solar_prominence_6",
      "solar_prominence_7",
      "solar_prominence_8"
    ],
    "anchors": {
      "photosphere": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.66667
      },
      "chromosphere": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.6426
      },
      "corona": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 1
      },
      "solar_prominence_1": {
        "center": [
          0.44264,
          0.02021,
          0
        ],
        "radius": 0.1265
      },
      "solar_prominence_2": {
        "center": [
          0.29934,
          0.16819,
          0.31299
        ],
        "radius": 0.12656
      },
      "solar_prominence_3": {
        "center": [
          -0.01504,
          0.22791,
          0.44264
        ],
        "radius": 0.12599
      },
      "solar_prominence_4": {
        "center": [
          -0.31775,
          0.14377,
          0.31299
        ],
        "radius": 0.12659
      },
      "solar_prominence_5": {
        "center": [
          -0.43048,
          -0.00669,
          0
        ],
        "radius": 0.12696
      },
      "solar_prominence_6": {
        "center": [
          -0.29667,
          -0.15953,
          -0.31299
        ],
        "radius": 0.1263
      },
      "solar_prominence_7": {
        "center": [
          0.00828,
          -0.21223,
          -0.44264
        ],
        "radius": 0.12614
      },
      "solar_prominence_8": {
        "center": [
          0.30243,
          -0.15485,
          -0.31299
        ],
        "radius": 0.12717
      }
    }
  },
  {
    "id": "astronomy/mercury",
    "category": "astronomy",
    "name": "Mercury",
    "path": "/models/astronomy/mercury.glb",
    "fallbackType": "sphere",
    "defaultColor": "#9a8f86",
    "aliases": [
      "mercury"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 1,
    "meshCount": 1,
    "materialCount": 1,
    "bounds": {
      "min": [
        -0.57735,
        -0.57735,
        -0.57735
      ],
      "max": [
        0.57735,
        0.57735,
        0.57735
      ],
      "size": [
        1.1547,
        1.1547,
        1.1547
      ],
      "radius": 1
    },
    "triangles": 2000,
    "bytes": 39604,
    "semanticAnchors": [
      "mercury"
    ],
    "anchors": {
      "mercury": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 1
      }
    }
  },
  {
    "id": "astronomy/venus",
    "category": "astronomy",
    "name": "Venus",
    "path": "/models/astronomy/venus.glb",
    "fallbackType": "sphere",
    "defaultColor": "#e0c070",
    "aliases": [
      "venus"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.50263,
        -0.70337,
        -0.50263
      ],
      "max": [
        0.50263,
        0.70337,
        0.50263
      ],
      "size": [
        1.00526,
        1.40674,
        1.00526
      ],
      "radius": 1
    },
    "triangles": 2112,
    "bytes": 43908,
    "semanticAnchors": [
      "venus",
      "venus_axis"
    ],
    "anchors": {
      "venus": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.87058
      },
      "venus_axis": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.70521
      }
    }
  },
  {
    "id": "astronomy/moon",
    "category": "astronomy",
    "name": "Moon",
    "path": "/models/astronomy/moon.glb",
    "fallbackType": "sphere",
    "defaultColor": "#c9c9c9",
    "aliases": [
      "moon",
      "luna"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 5,
    "meshCount": 5,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.57622,
        -0.57622,
        -0.5796
      ],
      "max": [
        0.57622,
        0.57622,
        0.5796
      ],
      "size": [
        1.15244,
        1.15244,
        1.1592
      ],
      "radius": 1
    },
    "triangles": 6004,
    "bytes": 121860,
    "semanticAnchors": [
      "moon",
      "crater_1",
      "crater_2",
      "crater_3",
      "crater_4"
    ],
    "anchors": {
      "moon": {
        "center": [
          0,
          0,
          -0.00653
        ],
        "radius": 0.99623
      },
      "crater_1": {
        "center": [
          0.26709,
          0.26709,
          0.39411
        ],
        "radius": 0.19961
      },
      "crater_2": {
        "center": [
          -0.4104,
          0.16417,
          -0.33485
        ],
        "radius": 0.19961
      },
      "crater_3": {
        "center": [
          0.14986,
          -0.37464,
          -0.38117
        ],
        "radius": 0.19961
      },
      "crater_4": {
        "center": [
          -0.2018,
          -0.2018,
          0.46435
        ],
        "radius": 0.19961
      }
    }
  },
  {
    "id": "astronomy/mars",
    "category": "astronomy",
    "name": "Mars",
    "path": "/models/astronomy/mars.glb",
    "fallbackType": "sphere",
    "defaultColor": "#c1553a",
    "aliases": [
      "mars"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 3,
    "meshCount": 3,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.51359,
        -0.65658,
        -0.55238
      ],
      "max": [
        0.51359,
        0.65658,
        0.55238
      ],
      "size": [
        1.02718,
        1.31316,
        1.10476
      ],
      "radius": 1
    },
    "triangles": 3540,
    "bytes": 72604,
    "semanticAnchors": [
      "mars",
      "mars_axis",
      "mars_feature_1"
    ],
    "anchors": {
      "mars": {
        "center": [
          0,
          0,
          -0.03878
        ],
        "radius": 0.88957
      },
      "mars_axis": {
        "center": [
          0,
          0,
          -0.03879
        ],
        "radius": 0.72807
      },
      "mars_feature_1": {
        "center": [
          0.10812,
          0.05439,
          0.45072
        ],
        "radius": 0.30197
      }
    }
  },
  {
    "id": "astronomy/jupiter",
    "category": "astronomy",
    "name": "Jupiter",
    "path": "/models/astronomy/jupiter.glb",
    "fallbackType": "sphere",
    "defaultColor": "#d9a878",
    "aliases": [
      "jupiter"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.50263,
        -0.703,
        -0.50314
      ],
      "max": [
        0.50263,
        0.703,
        0.50314
      ],
      "size": [
        1.00526,
        1.406,
        1.00628
      ],
      "radius": 1
    },
    "triangles": 4968,
    "bytes": 101336,
    "semanticAnchors": [
      "jupiter",
      "jupiter_axis",
      "jupiter_feature_1",
      "jupiter_feature_2"
    ],
    "anchors": {
      "jupiter": {
        "center": [
          0,
          0,
          -0.00052
        ],
        "radius": 0.87058
      },
      "jupiter_axis": {
        "center": [
          0,
          0,
          -0.00051
        ],
        "radius": 0.70429
      },
      "jupiter_feature_1": {
        "center": [
          0.14806,
          -0.14846,
          0.44562
        ],
        "radius": 0.26425
      },
      "jupiter_feature_2": {
        "center": [
          -0.20723,
          0.10274,
          0.43538
        ],
        "radius": 0.16132
      }
    }
  },
  {
    "id": "astronomy/saturn",
    "category": "astronomy",
    "name": "Saturn",
    "path": "/models/astronomy/saturn.glb",
    "fallbackType": "sphere",
    "defaultColor": "#e0d0a0",
    "aliases": [
      "saturn"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.70144,
        -0.62843,
        -0.33626
      ],
      "max": [
        0.70144,
        0.62843,
        0.33626
      ],
      "size": [
        1.40288,
        1.25686,
        0.67252
      ],
      "radius": 1.00001
    },
    "triangles": 4832,
    "bytes": 97204,
    "semanticAnchors": [
      "saturn",
      "saturn_axis",
      "saturn_rings_inner",
      "saturn_rings_outer"
    ],
    "anchors": {
      "saturn": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.56508
      },
      "saturn_axis": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.46011
      },
      "saturn_rings_inner": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.77895
      },
      "saturn_rings_outer": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 1.00001
      }
    }
  },
  {
    "id": "astronomy/neptune",
    "category": "astronomy",
    "name": "Neptune",
    "path": "/models/astronomy/neptune.glb",
    "fallbackType": "sphere",
    "defaultColor": "#4a6ad9",
    "aliases": [
      "neptune"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.53123,
        -0.65999,
        -0.53123
      ],
      "max": [
        0.53123,
        0.65999,
        0.53123
      ],
      "size": [
        1.06246,
        1.31998,
        1.06246
      ],
      "radius": 1
    },
    "triangles": 2112,
    "bytes": 43916,
    "semanticAnchors": [
      "neptune",
      "neptune_axis"
    ],
    "anchors": {
      "neptune": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.92012
      },
      "neptune_axis": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.74964
      }
    }
  },
  {
    "id": "astronomy/uranus",
    "category": "astronomy",
    "name": "Uranus",
    "path": "/models/astronomy/uranus.glb",
    "fallbackType": "sphere",
    "defaultColor": "#8fd9e0",
    "aliases": [
      "uranus"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.67454,
        -0.31374,
        -0.66825
      ],
      "max": [
        0.67454,
        0.31374,
        0.66825
      ],
      "size": [
        1.34908,
        0.62748,
        1.3365
      ],
      "radius": 1
    },
    "triangles": 4832,
    "bytes": 97204,
    "semanticAnchors": [
      "uranus",
      "uranus_axis",
      "uranus_rings_inner",
      "uranus_rings_outer"
    ],
    "anchors": {
      "uranus": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.54341
      },
      "uranus_axis": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.44074
      },
      "uranus_rings_inner": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.74233
      },
      "uranus_rings_outer": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.95717
      }
    }
  },
  {
    "id": "astronomy/comet",
    "category": "astronomy",
    "name": "Comet",
    "path": "/models/astronomy/comet.glb",
    "fallbackType": "sphere",
    "defaultColor": "#a8e0ff",
    "aliases": [
      "comet"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.90667,
        -0.34478,
        -0.24307
      ],
      "max": [
        0.90667,
        0.34478,
        0.24307
      ],
      "size": [
        1.81334,
        0.68956,
        0.48614
      ],
      "radius": 1
    },
    "triangles": 1474,
    "bytes": 35680,
    "semanticAnchors": [
      "comet_nucleus",
      "comet_tail",
      "comet_ion_tail",
      "solar_wind_pressure"
    ],
    "anchors": {
      "comet_nucleus": {
        "center": [
          -0.49433,
          -0.10171,
          0
        ],
        "radius": 0.1684
      },
      "comet_tail": {
        "center": [
          0.036,
          -0.10171,
          0
        ],
        "radius": 0.59539
      },
      "comet_ion_tail": {
        "center": [
          0.24161,
          -0.00073,
          0
        ],
        "radius": 0.71365
      },
      "solar_wind_pressure": {
        "center": [
          -0.73822,
          0.24306,
          0
        ],
        "radius": 0.20167
      }
    }
  },
  {
    "id": "astronomy/galaxy",
    "category": "astronomy",
    "name": "Galaxy",
    "path": "/models/astronomy/galaxy.glb",
    "fallbackType": "sphere",
    "defaultColor": "#9fc8ff",
    "aliases": [
      "galaxy",
      "spiral galaxy",
      "milky way"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 5,
    "meshCount": 5,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.66348,
        -0.17665,
        -0.72704
      ],
      "max": [
        0.66348,
        0.17665,
        0.72704
      ],
      "size": [
        1.32696,
        0.3533,
        1.45408
      ],
      "radius": 1
    },
    "triangles": 9024,
    "bytes": 179372,
    "semanticAnchors": [
      "galactic_core",
      "galactic_disk",
      "galactic_disk_outer",
      "spiral_arm_1",
      "spiral_arm_2"
    ],
    "anchors": {
      "galactic_core": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.16576
      },
      "galactic_disk": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.61437
      },
      "galactic_disk_outer": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.94929
      },
      "spiral_arm_1": {
        "center": [
          -0.15922,
          0.01627,
          -0.18259
        ],
        "radius": 0.66851
      },
      "spiral_arm_2": {
        "center": [
          0.15923,
          0.01627,
          0.18259
        ],
        "radius": 0.66851
      }
    }
  },
  {
    "id": "network/router",
    "category": "network",
    "name": "Router",
    "path": "/models/network/router.glb",
    "fallbackType": "box",
    "defaultColor": "#2f3a45",
    "aliases": [
      "router",
      "wi-fi router"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 14,
    "meshCount": 14,
    "materialCount": 6,
    "bounds": {
      "min": [
        -0.71847,
        -0.4861,
        -0.49751
      ],
      "max": [
        0.71847,
        0.4861,
        0.49751
      ],
      "size": [
        1.43694,
        0.9722,
        0.99502
      ],
      "radius": 1
    },
    "triangles": 4180,
    "bytes": 100528,
    "semanticAnchors": [
      "router_body",
      "router_top",
      "antenna_1",
      "antenna_2",
      "antenna_3",
      "antenna_4",
      "ethernet_port_1",
      "ethernet_port_2",
      "ethernet_port_3",
      "ethernet_port_4",
      "status_led_1",
      "status_led_2",
      "status_led_3",
      "router_label_plate"
    ],
    "anchors": {
      "router_body": {
        "center": [
          0,
          -0.33395,
          -0.0012
        ],
        "radius": 0.86918
      },
      "router_top": {
        "center": [
          0,
          -0.148,
          -0.00119
        ],
        "radius": 0.79854
      },
      "antenna_1": {
        "center": [
          -0.50715,
          0.17321,
          -0.3393
        ],
        "radius": 0.35504
      },
      "antenna_2": {
        "center": [
          -0.16905,
          0.17321,
          -0.3393
        ],
        "radius": 0.35269
      },
      "antenna_3": {
        "center": [
          0.16905,
          0.17321,
          -0.3393
        ],
        "radius": 0.35269
      },
      "antenna_4": {
        "center": [
          0.50716,
          0.17321,
          -0.3393
        ],
        "radius": 0.35504
      },
      "ethernet_port_1": {
        "center": [
          -0.50715,
          -0.35085,
          0.47215
        ],
        "radius": 0.08368
      },
      "ethernet_port_2": {
        "center": [
          -0.16905,
          -0.35085,
          0.47215
        ],
        "radius": 0.08368
      },
      "ethernet_port_3": {
        "center": [
          0.16905,
          -0.35085,
          0.47215
        ],
        "radius": 0.08368
      },
      "ethernet_port_4": {
        "center": [
          0.50716,
          -0.35085,
          0.47215
        ],
        "radius": 0.08368
      },
      "status_led_1": {
        "center": [
          0.42263,
          -0.24942,
          0.43834
        ],
        "radius": 0.04392
      },
      "status_led_2": {
        "center": [
          0.52406,
          -0.24942,
          0.43834
        ],
        "radius": 0.04392
      },
      "status_led_3": {
        "center": [
          0.62549,
          -0.24942,
          0.43834
        ],
        "radius": 0.04392
      },
      "router_label_plate": {
        "center": [
          -0.42263,
          -0.09727,
          0.08333
        ],
        "radius": 0.32198
      }
    }
  },
  {
    "id": "network/switch",
    "category": "network",
    "name": "Network Switch",
    "path": "/models/network/switch.glb",
    "fallbackType": "box",
    "defaultColor": "#1f2a33",
    "aliases": [
      "switch",
      "network switch"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 18,
    "meshCount": 18,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.89764,
        -0.13465,
        -0.41965
      ],
      "max": [
        0.89764,
        0.13465,
        0.41965
      ],
      "size": [
        1.79528,
        0.2693,
        0.8393
      ],
      "radius": 1
    },
    "triangles": 9848,
    "bytes": 210508,
    "semanticAnchors": [
      "switch_body",
      "switch_port_1",
      "switch_port_2",
      "switch_port_3",
      "switch_port_4",
      "switch_port_5",
      "switch_port_6",
      "switch_port_7",
      "switch_port_8",
      "switch_led_1",
      "switch_led_2",
      "switch_led_3",
      "switch_led_4",
      "switch_led_5",
      "switch_led_6",
      "switch_led_7",
      "switch_led_8",
      "switch_vent"
    ],
    "anchors": {
      "switch_body": {
        "center": [
          0,
          -0.00898,
          -0.01571
        ],
        "radius": 0.99233
      },
      "switch_port_1": {
        "center": [
          -0.62835,
          -0.00897,
          0.39721
        ],
        "radius": 0.08041
      },
      "switch_port_2": {
        "center": [
          -0.44882,
          -0.00897,
          0.39721
        ],
        "radius": 0.08041
      },
      "switch_port_3": {
        "center": [
          -0.26929,
          -0.00897,
          0.39721
        ],
        "radius": 0.08041
      },
      "switch_port_4": {
        "center": [
          -0.08977,
          -0.00897,
          0.39721
        ],
        "radius": 0.08041
      },
      "switch_port_5": {
        "center": [
          0.08977,
          -0.00897,
          0.39721
        ],
        "radius": 0.08041
      },
      "switch_port_6": {
        "center": [
          0.2693,
          -0.00897,
          0.39721
        ],
        "radius": 0.08041
      },
      "switch_port_7": {
        "center": [
          0.44883,
          -0.00897,
          0.39721
        ],
        "radius": 0.08041
      },
      "switch_port_8": {
        "center": [
          0.62836,
          -0.00897,
          0.39721
        ],
        "radius": 0.08041
      },
      "switch_led_1": {
        "center": [
          -0.62835,
          0.08079,
          0.39721
        ],
        "radius": 0.03887
      },
      "switch_led_2": {
        "center": [
          -0.44882,
          0.08079,
          0.39721
        ],
        "radius": 0.03887
      },
      "switch_led_3": {
        "center": [
          -0.26929,
          0.08079,
          0.39721
        ],
        "radius": 0.03887
      },
      "switch_led_4": {
        "center": [
          -0.08977,
          0.08079,
          0.39721
        ],
        "radius": 0.03887
      },
      "switch_led_5": {
        "center": [
          0.08977,
          0.08079,
          0.39721
        ],
        "radius": 0.03887
      },
      "switch_led_6": {
        "center": [
          0.26929,
          0.08079,
          0.39721
        ],
        "radius": 0.03887
      },
      "switch_led_7": {
        "center": [
          0.44882,
          0.08079,
          0.39721
        ],
        "radius": 0.03887
      },
      "switch_led_8": {
        "center": [
          0.62835,
          0.08079,
          0.39721
        ],
        "radius": 0.03887
      },
      "switch_vent": {
        "center": [
          0,
          0.12567,
          -0.19524
        ],
        "radius": 0.74028
      }
    }
  },
  {
    "id": "network/server",
    "category": "network",
    "name": "Server Rack",
    "path": "/models/network/server.glb",
    "fallbackType": "box",
    "defaultColor": "#2f3a45",
    "aliases": [
      "server",
      "web server",
      "server rack"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 17,
    "meshCount": 17,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.42569,
        -0.85138,
        -0.3065
      ],
      "max": [
        0.42569,
        0.85138,
        0.3065
      ],
      "size": [
        0.85138,
        1.70276,
        0.613
      ],
      "radius": 1
    },
    "triangles": 6324,
    "bytes": 142160,
    "semanticAnchors": [
      "rack_frame",
      "server_unit_1",
      "server_unit_2",
      "server_unit_3",
      "server_unit_4",
      "server_unit_5",
      "server_led_1",
      "server_led_2",
      "server_led_3",
      "server_led_4",
      "server_led_5",
      "server_vent_1",
      "server_vent_2",
      "server_vent_3",
      "server_vent_4",
      "server_vent_5",
      "rack_power"
    ],
    "anchors": {
      "rack_frame": {
        "center": [
          0.05109,
          -0.03405,
          0
        ],
        "radius": 0.94989
      },
      "server_unit_1": {
        "center": [
          0.05108,
          0.54488,
          0
        ],
        "radius": 0.43432
      },
      "server_unit_2": {
        "center": [
          0.05108,
          0.25882,
          0
        ],
        "radius": 0.43432
      },
      "server_unit_3": {
        "center": [
          0.05108,
          -0.02724,
          0
        ],
        "radius": 0.43432
      },
      "server_unit_4": {
        "center": [
          0.05108,
          -0.31331,
          0
        ],
        "radius": 0.43432
      },
      "server_unit_5": {
        "center": [
          0.05108,
          -0.59937,
          0
        ],
        "radius": 0.43432
      },
      "server_led_1": {
        "center": [
          0.28947,
          0.54489,
          0.27244
        ],
        "radius": 0.02949
      },
      "server_led_2": {
        "center": [
          0.28947,
          0.25882,
          0.27244
        ],
        "radius": 0.0295
      },
      "server_led_3": {
        "center": [
          0.28947,
          -0.02724,
          0.27244
        ],
        "radius": 0.02949
      },
      "server_led_4": {
        "center": [
          0.28947,
          -0.31331,
          0.27244
        ],
        "radius": 0.0295
      },
      "server_led_5": {
        "center": [
          0.28947,
          -0.59937,
          0.27244
        ],
        "radius": 0.0295
      },
      "server_vent_1": {
        "center": [
          0.05109,
          0.54488,
          0.27244
        ],
        "radius": 0.24463
      },
      "server_vent_2": {
        "center": [
          0.05109,
          0.25882,
          0.27244
        ],
        "radius": 0.24463
      },
      "server_vent_3": {
        "center": [
          0.05109,
          -0.02724,
          0.27244
        ],
        "radius": 0.24463
      },
      "server_vent_4": {
        "center": [
          0.05109,
          -0.31331,
          0.27244
        ],
        "radius": 0.24463
      },
      "server_vent_5": {
        "center": [
          0.05109,
          -0.59937,
          0.27244
        ],
        "radius": 0.24463
      },
      "rack_power": {
        "center": [
          -0.22136,
          0.78327,
          0.20433
        ],
        "radius": 0.2259
      }
    }
  },
  {
    "id": "network/laptop",
    "category": "network",
    "name": "Laptop Computer",
    "path": "/models/network/laptop.glb",
    "fallbackType": "box",
    "defaultColor": "#8a929a",
    "aliases": [
      "laptop",
      "client",
      "pc",
      "computer"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 23,
    "meshCount": 23,
    "materialCount": 14,
    "bounds": {
      "min": [
        -0.70662,
        -0.46893,
        -0.5299
      ],
      "max": [
        0.70662,
        0.46893,
        0.5299
      ],
      "size": [
        1.41324,
        0.93786,
        1.0598
      ],
      "radius": 1
    },
    "triangles": 3888,
    "bytes": 122152,
    "semanticAnchors": [
      "laptop_base",
      "chassis_lower",
      "palm_rest",
      "keyboard_deck",
      "keyboard_keys",
      "trackpad",
      "fingerprint_reader",
      "power_button",
      "hinge",
      "hinge_right",
      "cooling_vents",
      "screen_bezel",
      "screen_display",
      "screen_window_1",
      "screen_window_2",
      "screen_window_3",
      "webcam",
      "screen_chin",
      "usb_port",
      "hdmi_port",
      "ethernet_port",
      "audio_jack",
      "wifi_led"
    ],
    "anchors": {
      "laptop_base": {
        "center": [
          0.00418,
          -0.41039,
          0.06161
        ],
        "radius": 0.82399
      },
      "chassis_lower": {
        "center": [
          0.00418,
          -0.4522,
          0.0616
        ],
        "radius": 0.75396
      },
      "palm_rest": {
        "center": [
          0.00418,
          -0.36858,
          0.36265
        ],
        "radius": 0.60689
      },
      "keyboard_deck": {
        "center": [
          0.00418,
          -0.3853,
          -0.02202
        ],
        "radius": 0.58251
      },
      "keyboard_keys": {
        "center": [
          0.00418,
          -0.36858,
          -0.06383
        ],
        "radius": 0.45007
      },
      "trackpad": {
        "center": [
          0.00418,
          -0.36022,
          0.31247
        ],
        "radius": 0.22757
      },
      "fingerprint_reader": {
        "center": [
          0.50592,
          -0.36022,
          -0.30634
        ],
        "radius": 0.0416
      },
      "power_button": {
        "center": [
          -0.58119,
          -0.36022,
          -0.32307
        ],
        "radius": 0.03572
      },
      "hinge": {
        "center": [
          -0.59791,
          -0.36021,
          -0.40669
        ],
        "radius": 0.1181
      },
      "hinge_right": {
        "center": [
          0.60628,
          -0.36021,
          -0.40669
        ],
        "radius": 0.1181
      },
      "cooling_vents": {
        "center": [
          -0.13798,
          -0.36858,
          -0.37325
        ],
        "radius": 0.30143
      },
      "screen_bezel": {
        "center": [
          0.00418,
          0.03282,
          -0.39833
        ],
        "radius": 0.80935
      },
      "screen_display": {
        "center": [
          0.00418,
          0.04118,
          -0.37324
        ],
        "radius": 0.70509
      },
      "screen_window_1": {
        "center": [
          -0.14634,
          0.1917,
          -0.35652
        ],
        "radius": 0.36399
      },
      "screen_window_2": {
        "center": [
          -0.10453,
          0.03281,
          -0.34649
        ],
        "radius": 0.28987
      },
      "screen_window_3": {
        "center": [
          -0.06272,
          -0.12607,
          -0.33645
        ],
        "radius": 0.21654
      },
      "webcam": {
        "center": [
          0.00418,
          0.42585,
          -0.38161
        ],
        "radius": 0.0507
      },
      "screen_chin": {
        "center": [
          0.00418,
          -0.34349,
          -0.3816
        ],
        "radius": 0.62932
      },
      "usb_port": {
        "center": [
          0.65645,
          -0.41039,
          0.29575
        ],
        "radius": 0.04912
      },
      "hdmi_port": {
        "center": [
          0.65645,
          -0.41039,
          0.11177
        ],
        "radius": 0.06382
      },
      "ethernet_port": {
        "center": [
          -0.64808,
          -0.41039,
          0.16195
        ],
        "radius": 0.07549
      },
      "audio_jack": {
        "center": [
          -0.64808,
          -0.41039,
          0.31248
        ],
        "radius": 0.03877
      },
      "wifi_led": {
        "center": [
          0.52265,
          -0.36021,
          -0.35652
        ],
        "radius": 0.03621
      }
    }
  },
  {
    "id": "network/packet",
    "category": "network",
    "name": "Network Packet",
    "path": "/models/network/packet.glb",
    "fallbackType": "box",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "packet",
      "data packet",
      "datagram"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 3,
    "meshCount": 3,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.83648,
        -0.53534,
        -0.11711
      ],
      "max": [
        0.83648,
        0.53534,
        0.11711
      ],
      "size": [
        1.67296,
        1.07068,
        0.23422
      ],
      "radius": 1
    },
    "triangles": 36,
    "bytes": 4664,
    "semanticAnchors": [
      "packet_envelope",
      "packet_header_strip",
      "packet_payload"
    ],
    "anchors": {
      "packet_envelope": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.99818
      },
      "packet_header_strip": {
        "center": [
          0,
          0.43497,
          0
        ],
        "radius": 0.85058
      },
      "packet_payload": {
        "center": [
          0,
          -0.16729,
          0
        ],
        "radius": 0.62618
      }
    }
  },
  {
    "id": "network/firewall",
    "category": "network",
    "name": "Firewall",
    "path": "/models/network/firewall.glb",
    "fallbackType": "box",
    "defaultColor": "#c0392b",
    "aliases": [
      "firewall"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 18,
    "meshCount": 18,
    "materialCount": 13,
    "bounds": {
      "min": [
        -0.4002,
        -0.84904,
        -0.34492
      ],
      "max": [
        0.4002,
        0.84904,
        0.34492
      ],
      "size": [
        0.8004,
        1.69808,
        0.68984
      ],
      "radius": 1
    },
    "triangles": 7914,
    "bytes": 186484,
    "semanticAnchors": [
      "firewall_wall",
      "gateway",
      "gate_bar_1",
      "gate_bar_2",
      "gate_bar_3",
      "gate_bar_4",
      "gate_lintel",
      "gate_threshold",
      "inspection_engine",
      "rule_led_1",
      "rule_led_2",
      "rule_led_3",
      "uplink_cable",
      "blocked_packet_1",
      "blocked_packet_2",
      "blocked_marker",
      "allowed_packet",
      "traffic_direction"
    ],
    "anchors": {
      "firewall_wall": {
        "center": [
          0.01548,
          -0.37145,
          -0.22995
        ],
        "radius": 0.57498
      },
      "gateway": {
        "center": [
          -0.01105,
          -0.38914,
          -0.22995
        ],
        "radius": 0.43584
      },
      "gate_bar_1": {
        "center": [
          -0.0995,
          -0.38914,
          -0.18572
        ],
        "radius": 0.39833
      },
      "gate_bar_2": {
        "center": [
          -0.04201,
          -0.38914,
          -0.18572
        ],
        "radius": 0.39833
      },
      "gate_bar_3": {
        "center": [
          0.01548,
          -0.38914,
          -0.18572
        ],
        "radius": 0.39833
      },
      "gate_bar_4": {
        "center": [
          0.07296,
          -0.38914,
          -0.18572
        ],
        "radius": 0.39833
      },
      "gate_lintel": {
        "center": [
          -0.01106,
          0.06633,
          -0.2211
        ],
        "radius": 0.16078
      },
      "gate_threshold": {
        "center": [
          -0.01106,
          -0.81808,
          -0.2211
        ],
        "radius": 0.16151
      },
      "inspection_engine": {
        "center": [
          -0.01105,
          0.26091,
          -0.22995
        ],
        "radius": 0.19707
      },
      "rule_led_1": {
        "center": [
          -0.08181,
          0.30512,
          -0.13709
        ],
        "radius": 0.03063
      },
      "rule_led_2": {
        "center": [
          -0.01105,
          0.30512,
          -0.13709
        ],
        "radius": 0.03063
      },
      "rule_led_3": {
        "center": [
          0.0597,
          0.30512,
          -0.13709
        ],
        "radius": 0.03063
      },
      "uplink_cable": {
        "center": [
          -0.01105,
          0.5395,
          -0.31839
        ],
        "radius": 0.31181
      },
      "blocked_packet_1": {
        "center": [
          -0.25427,
          -0.27859,
          -0.07518
        ],
        "radius": 0.09957
      },
      "blocked_packet_2": {
        "center": [
          -0.34271,
          -0.5218,
          -0.07518
        ],
        "radius": 0.09957
      },
      "blocked_marker": {
        "center": [
          -0.29849,
          -0.68542,
          -0.07518
        ],
        "radius": 0.11326
      },
      "allowed_packet": {
        "center": [
          -0.01105,
          -0.41126,
          0.01327
        ],
        "radius": 0.09191
      },
      "traffic_direction": {
        "center": [
          -0.01106,
          -0.41125,
          0.21337
        ],
        "radius": 0.14533
      }
    }
  },
  {
    "id": "computer-science/cpu",
    "category": "computer-science",
    "name": "CPU Chip",
    "path": "/models/computer-science/cpu.glb",
    "fallbackType": "box",
    "defaultColor": "#4a4a52",
    "aliases": [
      "cpu",
      "processor",
      "chip"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 62,
    "meshCount": 62,
    "materialCount": 15,
    "bounds": {
      "min": [
        -0.55717,
        -0.69474,
        -0.45485
      ],
      "max": [
        0.55717,
        0.69474,
        0.45485
      ],
      "size": [
        1.11434,
        1.38948,
        0.9097
      ],
      "radius": 1
    },
    "triangles": 840,
    "bytes": 87744,
    "semanticAnchors": [
      "cpu_package",
      "package_substrate",
      "silicon_die",
      "cpu_core_1",
      "cpu_core_2",
      "cpu_core_3",
      "cpu_core_4",
      "cpu_fabric",
      "cpu_fabric_cross",
      "l2_cache",
      "l3_cache",
      "memory_controller",
      "io_controller",
      "heat_spreader",
      "thermal_interface",
      "heatsink_fins",
      "heatsink_base",
      "alignment_marker",
      "mounting_notch_1",
      "mounting_notch_2",
      "lga_contact_1",
      "lga_contact_2",
      "lga_contact_3",
      "lga_contact_4",
      "lga_contact_5",
      "lga_contact_6",
      "lga_contact_7",
      "lga_contact_8",
      "lga_contact_9",
      "lga_contact_10",
      "lga_contact_11",
      "lga_contact_12",
      "lga_contact_13",
      "lga_contact_14",
      "lga_contact_15",
      "lga_contact_16",
      "lga_contact_17",
      "lga_contact_18",
      "lga_contact_19",
      "lga_contact_20",
      "lga_contact_21",
      "lga_contact_22",
      "lga_contact_23",
      "lga_contact_24",
      "lga_contact_25",
      "lga_contact_26",
      "lga_contact_27",
      "lga_contact_28",
      "lga_contact_29",
      "lga_contact_30",
      "lga_contact_31",
      "lga_contact_32",
      "lga_contact_33",
      "lga_contact_34",
      "lga_contact_35",
      "lga_contact_36",
      "bus_trace_1",
      "bus_trace_2",
      "bus_trace_3",
      "bus_trace_4",
      "bus_trace_5",
      "bus_trace_6"
    ],
    "anchors": {
      "cpu_package": {
        "center": [
          0,
          -0.0963,
          0.04386
        ],
        "radius": 0.73025
      },
      "package_substrate": {
        "center": [
          0,
          -0.0963,
          0.00946
        ],
        "radius": 0.78808
      },
      "silicon_die": {
        "center": [
          0,
          -0.0963,
          0.09888
        ],
        "radius": 0.4391
      },
      "cpu_core_1": {
        "center": [
          -0.15133,
          0.05503,
          0.14015
        ],
        "radius": 0.15599
      },
      "cpu_core_2": {
        "center": [
          0.15133,
          0.05503,
          0.14015
        ],
        "radius": 0.15599
      },
      "cpu_core_3": {
        "center": [
          -0.15133,
          -0.24763,
          0.14015
        ],
        "radius": 0.15599
      },
      "cpu_core_4": {
        "center": [
          0.15133,
          -0.24763,
          0.14015
        ],
        "radius": 0.15599
      },
      "cpu_fabric": {
        "center": [
          0,
          -0.0963,
          0.14015
        ],
        "radius": 0.24858
      },
      "cpu_fabric_cross": {
        "center": [
          0,
          -0.0963,
          0.14015
        ],
        "radius": 0.24858
      },
      "l2_cache": {
        "center": [
          0.35769,
          0.26138,
          0.14015
        ],
        "radius": 0.17524
      },
      "l3_cache": {
        "center": [
          -0.34393,
          0.27515,
          0.14015
        ],
        "radius": 0.17765
      },
      "memory_controller": {
        "center": [
          0.34394,
          -0.46774,
          0.14015
        ],
        "radius": 0.16059
      },
      "io_controller": {
        "center": [
          -0.35769,
          -0.454,
          0.14015
        ],
        "radius": 0.12814
      },
      "heat_spreader": {
        "center": [
          0,
          -0.0963,
          0.27773
        ],
        "radius": 0.64296
      },
      "thermal_interface": {
        "center": [
          0,
          -0.0963,
          0.23646
        ],
        "radius": 0.66153
      },
      "heatsink_fins": {
        "center": [
          0,
          -0.0963,
          0.03009
        ],
        "radius": 0.65773
      },
      "heatsink_base": {
        "center": [
          0,
          -0.0963,
          -0.43765
        ],
        "radius": 0.71034
      },
      "alignment_marker": {
        "center": [
          -0.45399,
          -0.55029,
          0.34651
        ],
        "radius": 0.06844
      },
      "mounting_notch_1": {
        "center": [
          0,
          0.44024,
          0.04385
        ],
        "radius": 0.07872
      },
      "mounting_notch_2": {
        "center": [
          0,
          -0.63283,
          0.04385
        ],
        "radius": 0.07872
      },
      "lga_contact_1": {
        "center": [
          -0.42647,
          -0.52277,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_2": {
        "center": [
          -0.25451,
          -0.52277,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_3": {
        "center": [
          -0.08254,
          -0.52277,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_4": {
        "center": [
          0.08943,
          -0.52277,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_5": {
        "center": [
          0.26139,
          -0.52277,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_6": {
        "center": [
          0.43336,
          -0.52277,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_7": {
        "center": [
          -0.42647,
          -0.35081,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_8": {
        "center": [
          -0.25451,
          -0.35081,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_9": {
        "center": [
          -0.08254,
          -0.35081,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_10": {
        "center": [
          0.08943,
          -0.35081,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_11": {
        "center": [
          0.26139,
          -0.35081,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_12": {
        "center": [
          0.43336,
          -0.35081,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_13": {
        "center": [
          -0.42647,
          -0.17884,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_14": {
        "center": [
          -0.25451,
          -0.17884,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_15": {
        "center": [
          -0.08254,
          -0.17884,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_16": {
        "center": [
          0.08943,
          -0.17884,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_17": {
        "center": [
          0.26139,
          -0.17884,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_18": {
        "center": [
          0.43336,
          -0.17884,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_19": {
        "center": [
          -0.42647,
          -0.00688,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_20": {
        "center": [
          -0.25451,
          -0.00688,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_21": {
        "center": [
          -0.08254,
          -0.00688,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_22": {
        "center": [
          0.08943,
          -0.00688,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_23": {
        "center": [
          0.26139,
          -0.00688,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_24": {
        "center": [
          0.43336,
          -0.00688,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_25": {
        "center": [
          -0.42647,
          0.16508,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_26": {
        "center": [
          -0.25451,
          0.16508,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_27": {
        "center": [
          -0.08254,
          0.16508,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_28": {
        "center": [
          0.08943,
          0.16508,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_29": {
        "center": [
          0.26139,
          0.16508,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_30": {
        "center": [
          0.43336,
          0.16508,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_31": {
        "center": [
          -0.42647,
          0.33706,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_32": {
        "center": [
          -0.25451,
          0.33706,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_33": {
        "center": [
          -0.08254,
          0.33706,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_34": {
        "center": [
          0.08943,
          0.33706,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_35": {
        "center": [
          0.26139,
          0.33706,
          -0.01806
        ],
        "radius": 0.04972
      },
      "lga_contact_36": {
        "center": [
          0.43336,
          0.33706,
          -0.01806
        ],
        "radius": 0.04972
      },
      "bus_trace_1": {
        "center": [
          -0.4815,
          0.28203,
          0.15391
        ],
        "radius": 0.41279
      },
      "bus_trace_2": {
        "center": [
          -0.2889,
          0.28203,
          0.15391
        ],
        "radius": 0.41279
      },
      "bus_trace_3": {
        "center": [
          -0.0963,
          0.28203,
          0.15391
        ],
        "radius": 0.41279
      },
      "bus_trace_4": {
        "center": [
          0.0963,
          0.28203,
          0.15391
        ],
        "radius": 0.41279
      },
      "bus_trace_5": {
        "center": [
          0.2889,
          0.28203,
          0.15391
        ],
        "radius": 0.41279
      },
      "bus_trace_6": {
        "center": [
          0.4815,
          0.28203,
          0.15391
        ],
        "radius": 0.41279
      }
    }
  },
  {
    "id": "computer-science/memory",
    "category": "computer-science",
    "name": "Memory Module",
    "path": "/models/computer-science/memory.glb",
    "fallbackType": "box",
    "defaultColor": "#1f6f4a",
    "aliases": [
      "memory",
      "ram",
      "ram stick"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 50,
    "meshCount": 50,
    "materialCount": 13,
    "bounds": {
      "min": [
        -0.94382,
        -0.28923,
        -0.15984
      ],
      "max": [
        0.94382,
        0.28923,
        0.15984
      ],
      "size": [
        1.88764,
        0.57846,
        0.31968
      ],
      "radius": 1
    },
    "triangles": 684,
    "bytes": 71096,
    "semanticAnchors": [
      "pcb",
      "dram_bank_1",
      "dram_bank_2",
      "dram_bank_3",
      "dram_bank_4",
      "memory_chip_1",
      "memory_chip_2",
      "memory_chip_3",
      "memory_chip_4",
      "memory_chip_5",
      "memory_chip_6",
      "memory_chip_7",
      "memory_chip_8",
      "memory_trace_1",
      "memory_trace_2",
      "memory_trace_3",
      "memory_trace_4",
      "memory_trace_5",
      "memory_trace_6",
      "spd_chip",
      "gold_contact_edge",
      "contact_pin_1",
      "contact_pin_2",
      "contact_pin_3",
      "contact_pin_4",
      "contact_pin_5",
      "contact_pin_6",
      "contact_pin_7",
      "contact_pin_8",
      "contact_pin_9",
      "contact_pin_10",
      "contact_pin_11",
      "contact_pin_12",
      "contact_pin_13",
      "contact_pin_14",
      "contact_pin_15",
      "contact_pin_16",
      "contact_pin_17",
      "contact_pin_18",
      "contact_pin_19",
      "contact_pin_20",
      "contact_pin_21",
      "contact_pin_22",
      "notch",
      "heat_spreader",
      "heat_spreader_fins",
      "memory_bank_label",
      "rgb_diffuser",
      "side_latch_1",
      "side_latch_2"
    ],
    "anchors": {
      "pcb": {
        "center": [
          0,
          0.02029,
          -0.03298
        ],
        "radius": 0.90942
      },
      "dram_bank_1": {
        "center": [
          -0.6698,
          0.0406,
          0.04821
        ],
        "radius": 0.22464
      },
      "dram_bank_2": {
        "center": [
          -0.22327,
          0.0406,
          0.04821
        ],
        "radius": 0.22465
      },
      "dram_bank_3": {
        "center": [
          0.22327,
          0.0406,
          0.04821
        ],
        "radius": 0.22465
      },
      "dram_bank_4": {
        "center": [
          0.66981,
          0.0406,
          0.04821
        ],
        "radius": 0.22464
      },
      "memory_chip_1": {
        "center": [
          -0.7104,
          0.0406,
          0.07865
        ],
        "radius": 0.15877
      },
      "memory_chip_2": {
        "center": [
          -0.50743,
          0.0406,
          0.07865
        ],
        "radius": 0.15877
      },
      "memory_chip_3": {
        "center": [
          -0.30446,
          0.0406,
          0.07865
        ],
        "radius": 0.15877
      },
      "memory_chip_4": {
        "center": [
          -0.10148,
          0.0406,
          0.07865
        ],
        "radius": 0.15877
      },
      "memory_chip_5": {
        "center": [
          0.10149,
          0.0406,
          0.07865
        ],
        "radius": 0.15877
      },
      "memory_chip_6": {
        "center": [
          0.30446,
          0.0406,
          0.07865
        ],
        "radius": 0.15877
      },
      "memory_chip_7": {
        "center": [
          0.50743,
          0.0406,
          0.07865
        ],
        "radius": 0.15877
      },
      "memory_chip_8": {
        "center": [
          0.71041,
          0.0406,
          0.07865
        ],
        "radius": 0.15877
      },
      "memory_trace_1": {
        "center": [
          0,
          -0.14208,
          0.00761
        ],
        "radius": 0.76119
      },
      "memory_trace_2": {
        "center": [
          0,
          -0.09641,
          0.00761
        ],
        "radius": 0.76119
      },
      "memory_trace_3": {
        "center": [
          0,
          -0.05074,
          0.00761
        ],
        "radius": 0.76119
      },
      "memory_trace_4": {
        "center": [
          0,
          -0.00507,
          0.00761
        ],
        "radius": 0.76119
      },
      "memory_trace_5": {
        "center": [
          0,
          0.0406,
          0.00761
        ],
        "radius": 0.76119
      },
      "memory_trace_6": {
        "center": [
          0,
          0.08626,
          0.00761
        ],
        "radius": 0.76119
      },
      "spd_chip": {
        "center": [
          -0.79159,
          0.16238,
          0.07865
        ],
        "radius": 0.08963
      },
      "gold_contact_edge": {
        "center": [
          0,
          -0.23342,
          -0.01268
        ],
        "radius": 0.81332
      },
      "contact_pin_1": {
        "center": [
          -0.7307,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_2": {
        "center": [
          -0.66067,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_3": {
        "center": [
          -0.59065,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_4": {
        "center": [
          -0.52062,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_5": {
        "center": [
          -0.45059,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_6": {
        "center": [
          -0.38057,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_7": {
        "center": [
          -0.31054,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_8": {
        "center": [
          -0.24052,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_9": {
        "center": [
          -0.17049,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_10": {
        "center": [
          -0.10047,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_11": {
        "center": [
          -0.03044,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_12": {
        "center": [
          0.03958,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_13": {
        "center": [
          0.10961,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_14": {
        "center": [
          0.17963,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_15": {
        "center": [
          0.24966,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_16": {
        "center": [
          0.31968,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_17": {
        "center": [
          0.38971,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_18": {
        "center": [
          0.45973,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_19": {
        "center": [
          0.52976,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_20": {
        "center": [
          0.59978,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_21": {
        "center": [
          0.66981,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "contact_pin_22": {
        "center": [
          0.73984,
          -0.23341,
          -0.01269
        ],
        "radius": 0.04685
      },
      "notch": {
        "center": [
          0.22327,
          -0.23341,
          -0.01268
        ],
        "radius": 0.08818
      },
      "heat_spreader": {
        "center": [
          0,
          0.08118,
          -0.03299
        ],
        "radius": 0.79069
      },
      "heat_spreader_fins": {
        "center": [
          0,
          0.137,
          0.1294
        ],
        "radius": 0.74701
      },
      "memory_bank_label": {
        "center": [
          -0.40594,
          0.22327,
          0.07865
        ],
        "radius": 0.25714
      },
      "rgb_diffuser": {
        "center": [
          0,
          0.26386,
          0.06851
        ],
        "radius": 0.81254
      },
      "side_latch_1": {
        "center": [
          -0.91337,
          0,
          -0.03298
        ],
        "radius": 0.19202
      },
      "side_latch_2": {
        "center": [
          0.91338,
          0,
          -0.03298
        ],
        "radius": 0.19202
      }
    }
  },
  {
    "id": "computer-science/linked-list-node",
    "category": "computer-science",
    "name": "Linked List Node",
    "path": "/models/computer-science/linked-list-node.glb",
    "fallbackType": "box",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "linked list node",
      "node box"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.8011,
        -0.55249,
        -0.2302
      ],
      "max": [
        0.8011,
        0.55249,
        0.2302
      ],
      "size": [
        1.6022,
        1.10498,
        0.4604
      ],
      "radius": 1
    },
    "triangles": 48,
    "bytes": 6052,
    "semanticAnchors": [
      "node_data",
      "node_pointer",
      "node_value",
      "node_next_slot"
    ],
    "anchors": {
      "node_data": {
        "center": [
          -0.24862,
          0,
          -0.04604
        ],
        "radius": 0.80275
      },
      "node_pointer": {
        "center": [
          0.63536,
          0,
          -0.04604
        ],
        "radius": 0.5873
      },
      "node_value": {
        "center": [
          -0.43278,
          0,
          0.17496
        ],
        "radius": 0.36879
      },
      "node_next_slot": {
        "center": [
          0.30387,
          0,
          0.17496
        ],
        "radius": 0.36878
      }
    }
  },
  {
    "id": "computer-science/stack-block",
    "category": "computer-science",
    "name": "Stack Block",
    "path": "/models/computer-science/stack-block.glb",
    "fallbackType": "box",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "stack block",
      "stack frame"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.69317,
        -0.19755,
        -0.69317
      ],
      "max": [
        0.69317,
        0.19755,
        0.69317
      ],
      "size": [
        1.38634,
        0.3951,
        1.38634
      ],
      "radius": 1
    },
    "triangles": 24,
    "bytes": 3132,
    "semanticAnchors": [
      "stack_block",
      "stack_pointer_slot"
    ],
    "anchors": {
      "stack_block": {
        "center": [
          0,
          -0.03119,
          0
        ],
        "radius": 0.99431
      },
      "stack_pointer_slot": {
        "center": [
          0,
          0.1629,
          0
        ],
        "radius": 0.39365
      }
    }
  },
  {
    "id": "computer-science/data-structure",
    "category": "computer-science",
    "name": "Data Structure Block",
    "path": "/models/computer-science/data-structure.glb",
    "fallbackType": "box",
    "defaultColor": "#7f6ad9",
    "aliases": [
      "data structure",
      "heap block"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 3,
    "meshCount": 3,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.63217,
        -0.54788,
        -0.54788
      ],
      "max": [
        0.63217,
        0.54788,
        0.54788
      ],
      "size": [
        1.26434,
        1.09576,
        1.09576
      ],
      "radius": 0.99999
    },
    "triangles": 36,
    "bytes": 4388,
    "semanticAnchors": [
      "ds_body",
      "ds_front",
      "ds_top"
    ],
    "anchors": {
      "ds_body": {
        "center": [
          0,
          -0.02107,
          -0.02107
        ],
        "radius": 0.97709
      },
      "ds_front": {
        "center": [
          0,
          -0.02107,
          0.52681
        ],
        "radius": 0.82317
      },
      "ds_top": {
        "center": [
          0,
          0.52681,
          -0.02107
        ],
        "radius": 0.82317
      }
    }
  },
  {
    "id": "mathematics/cube",
    "category": "mathematics",
    "name": "Cube",
    "path": "/models/mathematics/cube.glb",
    "fallbackType": "box",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "cube",
      "hexahedron"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.57735,
        -0.57735,
        -0.57735
      ],
      "max": [
        0.57735,
        0.57735,
        0.57735
      ],
      "size": [
        1.1547,
        1.1547,
        1.1547
      ],
      "radius": 1
    },
    "triangles": 24,
    "bytes": 3104,
    "semanticAnchors": [
      "cube",
      "edge_highlight"
    ],
    "anchors": {
      "cube": {
        "center": [
          0,
          -0.01604,
          0
        ],
        "radius": 0.97222
      },
      "edge_highlight": {
        "center": [
          0,
          0.5533,
          0
        ],
        "radius": 0.81685
      }
    }
  },
  {
    "id": "mathematics/rectangular-prism",
    "category": "mathematics",
    "name": "Rectangular Prism",
    "path": "/models/mathematics/rectangular-prism.glb",
    "fallbackType": "box",
    "defaultColor": "#7fbf8a",
    "aliases": [
      "cuboid",
      "rectangular prism"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.78836,
        -0.39844,
        -0.46876
      ],
      "max": [
        0.78836,
        0.39844,
        0.46876
      ],
      "size": [
        1.57672,
        0.79688,
        0.93752
      ],
      "radius": 1
    },
    "triangles": 24,
    "bytes": 3100,
    "semanticAnchors": [
      "prism",
      "width_axis"
    ],
    "anchors": {
      "prism": {
        "center": [
          0,
          -0.01492,
          0
        ],
        "radius": 0.97734
      },
      "width_axis": {
        "center": [
          0,
          0.38566,
          0
        ],
        "radius": 0.78857
      }
    }
  },
  {
    "id": "mathematics/sphere",
    "category": "mathematics",
    "name": "Sphere",
    "path": "/models/mathematics/sphere.glb",
    "fallbackType": "sphere",
    "defaultColor": "#8a7ad9",
    "aliases": [
      "sphere"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 6,
    "meshCount": 6,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.58314,
        -0.57443,
        -0.57443
      ],
      "max": [
        0.58314,
        0.57443,
        0.57443
      ],
      "size": [
        1.16628,
        1.14886,
        1.14886
      ],
      "radius": 1
    },
    "triangles": 7264,
    "bytes": 146180,
    "semanticAnchors": [
      "sphere",
      "sphere_equator",
      "sphere_meridian",
      "radius_axis",
      "radius_end",
      "center"
    ],
    "anchors": {
      "sphere": {
        "center": [
          -0.0087,
          0,
          0
        ],
        "radius": 0.9648
      },
      "sphere_equator": {
        "center": [
          -0.00871,
          0,
          0
        ],
        "radius": 0.81244
      },
      "sphere_meridian": {
        "center": [
          -0.00871,
          0,
          0
        ],
        "radius": 0.81244
      },
      "radius_axis": {
        "center": [
          0.26981,
          0,
          0
        ],
        "radius": 0.29629
      },
      "radius_end": {
        "center": [
          0.54832,
          0,
          0
        ],
        "radius": 0.0603
      },
      "center": {
        "center": [
          -0.00871,
          0,
          0
        ],
        "radius": 0.0603
      }
    }
  },
  {
    "id": "mathematics/cone",
    "category": "mathematics",
    "name": "Cone",
    "path": "/models/mathematics/cone.glb",
    "fallbackType": "cone",
    "defaultColor": "#e08a5c",
    "aliases": [
      "cone"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 5,
    "meshCount": 5,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.56599,
        -0.59943,
        -0.56599
      ],
      "max": [
        0.56599,
        0.59943,
        0.56599
      ],
      "size": [
        1.13198,
        1.19886,
        1.13198
      ],
      "radius": 1
    },
    "triangles": 2898,
    "bytes": 63980,
    "semanticAnchors": [
      "cone",
      "height_axis",
      "apex",
      "radius_arrow",
      "base_circle"
    ],
    "anchors": {
      "cone": {
        "center": [
          0,
          0.01629,
          0
        ],
        "radius": 0.95062
      },
      "height_axis": {
        "center": [
          0,
          0.01629,
          0
        ],
        "radius": 0.54903
      },
      "apex": {
        "center": [
          0,
          0.56513,
          0
        ],
        "radius": 0.05941
      },
      "radius_arrow": {
        "center": [
          -0.04116,
          -0.53255,
          0
        ],
        "radius": 0.25217
      },
      "base_circle": {
        "center": [
          0,
          -0.53255,
          0
        ],
        "radius": 0.8005
      }
    }
  },
  {
    "id": "mathematics/cylinder",
    "category": "mathematics",
    "name": "Cylinder",
    "path": "/models/mathematics/cylinder.glb",
    "fallbackType": "cylinder",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "cylinder"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 7,
    "meshCount": 7,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.54991,
        -0.64126,
        -0.53515
      ],
      "max": [
        0.54991,
        0.64126,
        0.53515
      ],
      "size": [
        1.09982,
        1.28252,
        1.0703
      ],
      "radius": 1
    },
    "triangles": 5514,
    "bytes": 116232,
    "semanticAnchors": [
      "cylinder",
      "radius_arrow",
      "height_axis",
      "center_top",
      "center_bottom",
      "top_circle",
      "bottom_circle"
    ],
    "anchors": {
      "cylinder": {
        "center": [
          -0.01477,
          0.02122,
          0
        ],
        "radius": 0.9395
      },
      "radius_arrow": {
        "center": [
          -0.05352,
          -0.56929,
          0
        ],
        "radius": 0.24259
      },
      "height_axis": {
        "center": [
          0.53884,
          0.02122,
          0
        ],
        "radius": 0.59072
      },
      "center_top": {
        "center": [
          -0.01476,
          0.61173,
          0
        ],
        "radius": 0.05114
      },
      "center_bottom": {
        "center": [
          -0.01476,
          -0.56929,
          0
        ],
        "radius": 0.05114
      },
      "top_circle": {
        "center": [
          -0.01476,
          0.61173,
          0
        ],
        "radius": 0.7569
      },
      "bottom_circle": {
        "center": [
          -0.01476,
          -0.56929,
          0
        ],
        "radius": 0.7569
      }
    }
  },
  {
    "id": "mathematics/torus",
    "category": "mathematics",
    "name": "Torus",
    "path": "/models/mathematics/torus.glb",
    "fallbackType": "sphere",
    "defaultColor": "#c96ad9",
    "aliases": [
      "torus",
      "donut"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.62853,
        -0.45816,
        -0.62853
      ],
      "max": [
        0.62853,
        0.45816,
        0.62853
      ],
      "size": [
        1.25706,
        0.91632,
        1.25706
      ],
      "radius": 1.00001
    },
    "triangles": 3460,
    "bytes": 71392,
    "semanticAnchors": [
      "torus",
      "major_radius",
      "minor_radius",
      "center_circle"
    ],
    "anchors": {
      "torus": {
        "center": [
          0,
          -0.27071,
          0
        ],
        "radius": 0.90843
      },
      "major_radius": {
        "center": [
          0.03309,
          0.00496,
          0
        ],
        "radius": 0.20265
      },
      "minor_radius": {
        "center": [
          0.42701,
          0.00496,
          0
        ],
        "radius": 0.1108
      },
      "center_circle": {
        "center": [
          0,
          0.00496,
          0
        ],
        "radius": 0.64096
      }
    }
  },
  {
    "id": "mathematics/triangular-prism",
    "category": "mathematics",
    "name": "Triangular Prism",
    "path": "/models/mathematics/triangular-prism.glb",
    "fallbackType": "box",
    "defaultColor": "#7fbfd9",
    "aliases": [
      "triangular prism"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.66224,
        -0.33774,
        -0.66886
      ],
      "max": [
        0.66224,
        0.33774,
        0.66886
      ],
      "size": [
        1.32448,
        0.67548,
        1.33772
      ],
      "radius": 1
    },
    "triangles": 156,
    "bytes": 5068,
    "semanticAnchors": [
      "triangular_prism",
      "base_edge"
    ],
    "anchors": {
      "triangular_prism": {
        "center": [
          0,
          0.33774,
          -0.00662
        ],
        "radius": 0.93655
      },
      "base_edge": {
        "center": [
          0,
          -0.32449,
          0.65562
        ],
        "radius": 0.33165
      }
    }
  },
  {
    "id": "mathematics/polygon-prism",
    "category": "mathematics",
    "name": "Polygon Prism",
    "path": "/models/mathematics/polygon-prism.glb",
    "fallbackType": "box",
    "defaultColor": "#7f9ad9",
    "aliases": [
      "polygon prism",
      "prism"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.65465,
        0,
        -0.75593
      ],
      "max": [
        0.65465,
        0,
        0.75593
      ],
      "size": [
        1.3093,
        0,
        1.51186
      ],
      "radius": 1
    },
    "triangles": 48,
    "bytes": 2644,
    "semanticAnchors": [
      "polygon_prism",
      "polygon_base"
    ],
    "anchors": {
      "polygon_prism": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 1
      },
      "polygon_base": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.65472
      }
    }
  },
  {
    "id": "mathematics/pyramid",
    "category": "mathematics",
    "name": "Square Pyramid",
    "path": "/models/mathematics/pyramid.glb",
    "fallbackType": "cone",
    "defaultColor": "#d9a05c",
    "aliases": [
      "pyramid"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.67492,
        -0.63274,
        -0.37964
      ],
      "max": [
        0.67492,
        0.63274,
        0.37964
      ],
      "size": [
        1.34984,
        1.26548,
        0.75928
      ],
      "radius": 1
    },
    "triangles": 100,
    "bytes": 5020,
    "semanticAnchors": [
      "pyramid",
      "pyramid_height"
    ],
    "anchors": {
      "pyramid": {
        "center": [
          0,
          0,
          -0.37964
        ],
        "radius": 0.92514
      },
      "pyramid_height": {
        "center": [
          0,
          0.05905,
          0.29527
        ],
        "radius": 0.58566
      }
    }
  },
  {
    "id": "mathematics/frustum",
    "category": "mathematics",
    "name": "Frustum",
    "path": "/models/mathematics/frustum.glb",
    "fallbackType": "cone",
    "defaultColor": "#c98a5c",
    "aliases": [
      "frustum",
      "truncated cone"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.61785,
        -0.55522,
        -0.55677
      ],
      "max": [
        0.61785,
        0.55522,
        0.55677
      ],
      "size": [
        1.2357,
        1.11044,
        1.11354
      ],
      "radius": 1
    },
    "triangles": 590,
    "bytes": 19340,
    "semanticAnchors": [
      "frustum",
      "frustum_height",
      "frustum_r1",
      "frustum_r2"
    ],
    "anchors": {
      "frustum": {
        "center": [
          -0.06108,
          0,
          0
        ],
        "radius": 0.93
      },
      "frustum_height": {
        "center": [
          0.55754,
          0.0433,
          0
        ],
        "radius": 0.45979
      },
      "frustum_r1": {
        "center": [
          -0.10284,
          -0.49491,
          0
        ],
        "radius": 0.2519
      },
      "frustum_r2": {
        "center": [
          -0.08429,
          0.49491,
          0
        ],
        "radius": 0.15731
      }
    }
  },
  {
    "id": "mathematics/coordinate-system",
    "category": "mathematics",
    "name": "Coordinate System",
    "path": "/models/mathematics/coordinate-system.glb",
    "fallbackType": "sphere",
    "defaultColor": "#e05f5f",
    "aliases": [
      "coordinate system",
      "axes",
      "xyz axes"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 7,
    "meshCount": 7,
    "materialCount": 7,
    "bounds": {
      "min": [
        -0.50596,
        -0.60992,
        -0.60992
      ],
      "max": [
        0.50596,
        0.60992,
        0.60992
      ],
      "size": [
        1.01192,
        1.21984,
        1.21984
      ],
      "radius": 1
    },
    "triangles": 1522,
    "bytes": 40768,
    "semanticAnchors": [
      "x_axis",
      "y_axis",
      "z_axis",
      "xy_plane",
      "yz_plane",
      "xz_plane",
      "origin"
    ],
    "anchors": {
      "x_axis": {
        "center": [
          0,
          -0.15248,
          -0.15248
        ],
        "radius": 0.51514
      },
      "y_axis": {
        "center": [
          -0.04851,
          -0.10396,
          -0.15248
        ],
        "radius": 0.51513
      },
      "z_axis": {
        "center": [
          -0.04851,
          -0.15248,
          -0.10396
        ],
        "radius": 0.51513
      },
      "xy_plane": {
        "center": [
          -0.04852,
          -0.15178,
          0.22872
        ],
        "radius": 0.53911
      },
      "yz_plane": {
        "center": [
          0.33269,
          -0.15248,
          -0.15248
        ],
        "radius": 0.53911
      },
      "xz_plane": {
        "center": [
          -0.04852,
          0.22872,
          -0.15248
        ],
        "radius": 0.53911
      },
      "origin": {
        "center": [
          -0.04851,
          -0.15248,
          -0.15248
        ],
        "radius": 0.07203
      }
    }
  },
  {
    "id": "mathematics/vector",
    "category": "mathematics",
    "name": "Vector Arrow",
    "path": "/models/mathematics/vector.glb",
    "fallbackType": "arrow",
    "defaultColor": "#e05f5f",
    "aliases": [
      "vector",
      "vector arrow"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 2,
    "meshCount": 2,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.45122,
        -0.87948,
        -0.1514
      ],
      "max": [
        0.45122,
        0.87948,
        0.1514
      ],
      "size": [
        0.90244,
        1.75896,
        0.3028
      ],
      "radius": 1
    },
    "triangles": 102,
    "bytes": 5448,
    "semanticAnchors": [
      "vector",
      "vector_tail"
    ],
    "anchors": {
      "vector": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 1
      },
      "vector_tail": {
        "center": [
          -0.03131,
          -0.08834,
          0
        ],
        "radius": 0.09365
      }
    }
  },
  {
    "id": "mathematics/vector-sum",
    "category": "mathematics",
    "name": "Vector Addition",
    "path": "/models/mathematics/vector-sum.glb",
    "fallbackType": "arrow",
    "defaultColor": "#4a9ee8",
    "aliases": [
      "vector sum",
      "vector addition",
      "resultant"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 4,
    "meshCount": 4,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.89908,
        -0.42449,
        -0.10703
      ],
      "max": [
        0.89908,
        0.42449,
        0.10703
      ],
      "size": [
        1.79816,
        0.84898,
        0.21406
      ],
      "radius": 1
    },
    "triangles": 272,
    "bytes": 12556,
    "semanticAnchors": [
      "vector_a",
      "vector_b",
      "resultant",
      "parallelogram"
    ],
    "anchors": {
      "vector_a": {
        "center": [
          -0.50841,
          -0.02428,
          -0.05351
        ],
        "radius": 0.39776
      },
      "vector_b": {
        "center": [
          0.30206,
          0.00506,
          -0.05351
        ],
        "radius": 0.34881
      },
      "resultant": {
        "center": [
          -0.53081,
          0,
          0.05352
        ],
        "radius": 0.53615
      },
      "parallelogram": {
        "center": [
          0.17661,
          0.1764,
          0.05352
        ],
        "radius": 0.74983
      }
    }
  },
  {
    "id": "mathematics/parallelepiped",
    "category": "mathematics",
    "name": "Parallelepiped",
    "path": "/models/mathematics/parallelepiped.glb",
    "fallbackType": "box",
    "defaultColor": "#9a7ad9",
    "aliases": [
      "parallelepiped"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 3,
    "meshCount": 3,
    "materialCount": 3,
    "bounds": {
      "min": [
        -0.7557,
        -0.48972,
        -0.43486
      ],
      "max": [
        0.7557,
        0.48972,
        0.43486
      ],
      "size": [
        1.5114,
        0.97944,
        0.86972
      ],
      "radius": 1.00001
    },
    "triangles": 36,
    "bytes": 4536,
    "semanticAnchors": [
      "parallelepiped",
      "a_edge",
      "b_edge"
    ],
    "anchors": {
      "parallelepiped": {
        "center": [
          -0.01756,
          -0.01428,
          -0.00853
        ],
        "radius": 0.97603
      },
      "a_edge": {
        "center": [
          -0.01756,
          0.32679,
          0.41781
        ],
        "radius": 0.71075
      },
      "b_edge": {
        "center": [
          0.66456,
          -0.01428,
          0.41781
        ],
        "radius": 0.36578
      }
    }
  },
  {
    "id": "mathematics/unit-circle",
    "category": "mathematics",
    "name": "Unit Circle",
    "path": "/models/mathematics/unit-circle.glb",
    "fallbackType": "sphere",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "unit circle"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 17,
    "meshCount": 17,
    "materialCount": 2,
    "bounds": {
      "min": [
        -0.5828,
        -0.5663,
        -0.5828
      ],
      "max": [
        0.5828,
        0.5663,
        0.5828
      ],
      "size": [
        1.1656,
        1.1326,
        1.1656
      ],
      "radius": 1
    },
    "triangles": 21376,
    "bytes": 430548,
    "semanticAnchors": [
      "unit_circle",
      "quadrant_marker_1",
      "quadrant_marker_2",
      "quadrant_marker_3",
      "quadrant_marker_4",
      "unit_point_1",
      "unit_point_2",
      "unit_point_3",
      "unit_point_4",
      "unit_point_5",
      "unit_point_6",
      "unit_point_7",
      "unit_point_8",
      "unit_point_9",
      "unit_point_10",
      "unit_point_11",
      "unit_point_12"
    ],
    "anchors": {
      "unit_circle": {
        "center": [
          0,
          0,
          0
        ],
        "radius": 0.80104
      },
      "quadrant_marker_1": {
        "center": [
          0,
          0.02199,
          0.54981
        ],
        "radius": 0.05714
      },
      "quadrant_marker_2": {
        "center": [
          -0.54981,
          0.02199,
          0
        ],
        "radius": 0.05714
      },
      "quadrant_marker_3": {
        "center": [
          0,
          0.02199,
          -0.54981
        ],
        "radius": 0.05714
      },
      "quadrant_marker_4": {
        "center": [
          0.54981,
          0.02199,
          0
        ],
        "radius": 0.05714
      },
      "unit_point_1": {
        "center": [
          0.54981,
          0,
          0
        ],
        "radius": 0.04761
      },
      "unit_point_2": {
        "center": [
          0.47615,
          0,
          0.2749
        ],
        "radius": 0.04761
      },
      "unit_point_3": {
        "center": [
          0.2749,
          0,
          0.47615
        ],
        "radius": 0.04761
      },
      "unit_point_4": {
        "center": [
          0,
          0,
          0.54981
        ],
        "radius": 0.04761
      },
      "unit_point_5": {
        "center": [
          -0.2749,
          0,
          0.47615
        ],
        "radius": 0.04761
      },
      "unit_point_6": {
        "center": [
          -0.47615,
          0,
          0.2749
        ],
        "radius": 0.04761
      },
      "unit_point_7": {
        "center": [
          -0.54981,
          0,
          0
        ],
        "radius": 0.04761
      },
      "unit_point_8": {
        "center": [
          -0.47615,
          0,
          -0.2749
        ],
        "radius": 0.04761
      },
      "unit_point_9": {
        "center": [
          -0.2749,
          0,
          -0.47615
        ],
        "radius": 0.04761
      },
      "unit_point_10": {
        "center": [
          0,
          0,
          -0.54981
        ],
        "radius": 0.04761
      },
      "unit_point_11": {
        "center": [
          0.2749,
          0,
          -0.47615
        ],
        "radius": 0.04761
      },
      "unit_point_12": {
        "center": [
          0.47615,
          0,
          -0.2749
        ],
        "radius": 0.04761
      }
    }
  },
  {
    "id": "mathematics/grid-plane",
    "category": "mathematics",
    "name": "Coordinate Grid",
    "path": "/models/mathematics/grid-plane.glb",
    "fallbackType": "plane",
    "defaultColor": "#e8e8f0",
    "aliases": [
      "grid",
      "graph plane",
      "xy plane"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 37,
    "meshCount": 37,
    "materialCount": 4,
    "bounds": {
      "min": [
        -0.70689,
        -0.02467,
        -0.70689
      ],
      "max": [
        0.70689,
        0.02467,
        0.70689
      ],
      "size": [
        1.41378,
        0.04934,
        1.41378
      ],
      "radius": 1
    },
    "triangles": 8512,
    "bytes": 205108,
    "semanticAnchors": [
      "xy_plane",
      "grid_line_x_0",
      "grid_line_z_0",
      "grid_line_x_1",
      "grid_line_z_1",
      "grid_line_x_2",
      "grid_line_z_2",
      "grid_line_x_3",
      "grid_line_z_3",
      "grid_line_x_4",
      "grid_line_z_4",
      "grid_line_x_5",
      "grid_line_z_5",
      "grid_line_x_6",
      "grid_line_z_6",
      "grid_line_x_7",
      "grid_line_z_7",
      "grid_line_x_8",
      "grid_line_z_8",
      "grid_line_x_9",
      "grid_line_z_9",
      "grid_line_x_10",
      "grid_line_z_10",
      "grid_line_x_11",
      "grid_line_z_11",
      "grid_line_x_12",
      "grid_line_z_12",
      "grid_line_x_13",
      "grid_line_z_13",
      "grid_line_x_14",
      "grid_line_z_14",
      "grid_line_x_15",
      "grid_line_z_15",
      "grid_line_x_16",
      "grid_line_z_16",
      "grid_x_arrow",
      "grid_z_arrow"
    ],
    "anchors": {
      "xy_plane": {
        "center": [
          0,
          -0.00352,
          0
        ],
        "radius": 0.99685
      },
      "grid_line_x_0": {
        "center": [
          -0.70488,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_0": {
        "center": [
          0,
          -0.00156,
          -0.70488
        ],
        "radius": 0.70489
      },
      "grid_line_x_1": {
        "center": [
          -0.61677,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_1": {
        "center": [
          0,
          -0.00156,
          -0.61677
        ],
        "radius": 0.70489
      },
      "grid_line_x_2": {
        "center": [
          -0.52866,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_2": {
        "center": [
          0,
          -0.00156,
          -0.52866
        ],
        "radius": 0.70489
      },
      "grid_line_x_3": {
        "center": [
          -0.44055,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_3": {
        "center": [
          0,
          -0.00156,
          -0.44055
        ],
        "radius": 0.70489
      },
      "grid_line_x_4": {
        "center": [
          -0.35244,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_4": {
        "center": [
          0,
          -0.00156,
          -0.35244
        ],
        "radius": 0.70489
      },
      "grid_line_x_5": {
        "center": [
          -0.26433,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_5": {
        "center": [
          0,
          -0.00156,
          -0.26433
        ],
        "radius": 0.70489
      },
      "grid_line_x_6": {
        "center": [
          -0.17622,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_6": {
        "center": [
          0,
          -0.00156,
          -0.17622
        ],
        "radius": 0.70489
      },
      "grid_line_x_7": {
        "center": [
          -0.08811,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_7": {
        "center": [
          0,
          -0.00156,
          -0.08811
        ],
        "radius": 0.70489
      },
      "grid_line_x_8": {
        "center": [
          0,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_8": {
        "center": [
          0,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_x_9": {
        "center": [
          0.08811,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_9": {
        "center": [
          0,
          -0.00156,
          0.08811
        ],
        "radius": 0.70489
      },
      "grid_line_x_10": {
        "center": [
          0.17622,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_10": {
        "center": [
          0,
          -0.00156,
          0.17622
        ],
        "radius": 0.70489
      },
      "grid_line_x_11": {
        "center": [
          0.26433,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_11": {
        "center": [
          0,
          -0.00156,
          0.26433
        ],
        "radius": 0.70489
      },
      "grid_line_x_12": {
        "center": [
          0.35244,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_12": {
        "center": [
          0,
          -0.00156,
          0.35244
        ],
        "radius": 0.70489
      },
      "grid_line_x_13": {
        "center": [
          0.44055,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_13": {
        "center": [
          0,
          -0.00156,
          0.44055
        ],
        "radius": 0.70489
      },
      "grid_line_x_14": {
        "center": [
          0.52866,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_14": {
        "center": [
          0,
          -0.00156,
          0.52866
        ],
        "radius": 0.70489
      },
      "grid_line_x_15": {
        "center": [
          0.61677,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_15": {
        "center": [
          0,
          -0.00156,
          0.61677
        ],
        "radius": 0.70489
      },
      "grid_line_x_16": {
        "center": [
          0.70488,
          -0.00156,
          0
        ],
        "radius": 0.70489
      },
      "grid_line_z_16": {
        "center": [
          0,
          -0.00156,
          0.70488
        ],
        "radius": 0.70489
      },
      "grid_x_arrow": {
        "center": [
          0.01762,
          0,
          0
        ],
        "radius": 0.35412
      },
      "grid_z_arrow": {
        "center": [
          0,
          0,
          0.01762
        ],
        "radius": 0.35412
      }
    }
  },
  {
    "id": "mathematics/wave-surface",
    "category": "mathematics",
    "name": "Wave Surface",
    "path": "/models/mathematics/wave-surface.glb",
    "fallbackType": "plane",
    "defaultColor": "#4aa3d8",
    "aliases": [
      "wave surface",
      "transverse wave"
    ],
    "boundingRadius": 1,
    "recommendedCameraDistance": 4.185,
    "partCount": 5,
    "meshCount": 5,
    "materialCount": 5,
    "bounds": {
      "min": [
        -0.7978,
        -0.26098,
        -0.5435
      ],
      "max": [
        0.7978,
        0.26098,
        0.5435
      ],
      "size": [
        1.5956,
        0.52196,
        1.087
      ],
      "radius": 0.99999
    },
    "triangles": 2862,
    "bytes": 62424,
    "semanticAnchors": [
      "wave_surface",
      "equilibrium_plane",
      "amplitude_arrow",
      "wavelength_span",
      "wave_direction"
    ],
    "anchors": {
      "wave_surface": {
        "center": [
          0,
          0.12137,
          0.1446
        ],
        "radius": 0.90283
      },
      "equilibrium_plane": {
        "center": [
          0,
          0.12137,
          0.1446
        ],
        "radius": 0.89197
      },
      "amplitude_arrow": {
        "center": [
          -0.62328,
          -0.01825,
          0.38395
        ],
        "radius": 0.06423
      },
      "wavelength_span": {
        "center": [
          0.01496,
          -0.23764,
          0.38395
        ],
        "radius": 0.38539
      },
      "wave_direction": {
        "center": [
          0,
          0.04159,
          -0.31912
        ],
        "radius": 0.22686
      }
    }
  }
];

export const GENERATED_ASSETS_BY_ID: Record<string, GeneratedAsset> = Object.fromEntries(
  GENERATED_ASSETS.map((asset) => [asset.id, asset]),
);
