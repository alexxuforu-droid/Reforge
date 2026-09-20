// scenes — extracted from wallpaper_engine.rs (V2 pillar 2, zero behavior change).
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Scene definitions
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct SceneConfig {
    pub id: String,
    pub name: String,
    pub kind: String, // particles | waves | geometric | parallax | aurora | stars | matrix | embers
    pub mood: String, // calm | energetic | nature | space | seasonal | fun
    pub speed: f64,   // 0.2 .. 3.0
    pub density: f64, // 0.2 .. 2.0
    pub colors: Vec<String>,
}

pub fn default_scene() -> SceneConfig {
    SceneConfig {
        id: "aurora-drift".into(),
        name: "Aurora Drift".into(),
        kind: "aurora".into(),
        mood: "calm".into(),
        speed: 1.0,
        density: 1.0,
        colors: vec!["#38bdf8".into(), "#818cf8".into(), "#c084fc".into()],
    }
}

pub fn builtin_scenes() -> Vec<SceneConfig> {
    let mut v = Vec::new();
    macro_rules! scene {
        ($id:expr, $name:expr, $kind:expr, $mood:expr, $speed:expr, $density:expr, [$($c:expr),*]) => {
            v.push(SceneConfig {
                id: $id.into(), name: $name.into(), kind: $kind.into(), mood: $mood.into(),
                speed: $speed, density: $density,
                colors: vec![$($c.into()),*],
            });
        };
    }
    // calm
    scene!(
        "aurora-drift",
        "Aurora Drift",
        "aurora",
        "calm",
        0.6,
        1.0,
        ["#38bdf8", "#818cf8", "#c084fc"]
    );
    scene!(
        "deep-tide",
        "Deep Tide",
        "waves",
        "calm",
        0.7,
        1.0,
        ["#0ea5e9", "#1d4ed8", "#0f172a"]
    );
    scene!(
        "moonlit-dunes",
        "Moonlit Dunes",
        "particles",
        "calm",
        0.5,
        0.7,
        ["#fde68a", "#f8fafc", "#64748b"]
    );
    scene!(
        "misty-forest",
        "Misty Forest",
        "parallax",
        "calm",
        0.5,
        1.0,
        ["#10b981", "#065f46", "#022c22"]
    );
    // energetic
    scene!(
        "neon-surge",
        "Neon Surge",
        "particles",
        "energetic",
        1.6,
        1.5,
        ["#f0abfc", "#22d3ee", "#a78bfa"]
    );
    scene!(
        "synth-grid",
        "Synth Grid",
        "geometric",
        "energetic",
        1.3,
        1.2,
        ["#f472b6", "#818cf8", "#0f172a"]
    );
    scene!(
        "ember-storm",
        "Ember Storm",
        "embers",
        "energetic",
        1.4,
        1.3,
        ["#fb923c", "#ef4444", "#facc15"]
    );
    scene!(
        "retro-sunset",
        "Retro Sunset",
        "geometric",
        "energetic",
        0.9,
        1.1,
        ["#ff2e88", "#7b2ff7", "#fbbf24"]
    );
    // nature
    scene!(
        "meadow-breeze",
        "Meadow Breeze",
        "particles",
        "nature",
        0.6,
        0.8,
        ["#a3e635", "#84cc16", "#166534"]
    );
    scene!(
        "coral-reef",
        "Coral Reef",
        "waves",
        "nature",
        0.8,
        1.1,
        ["#2dd4bf", "#f472b6", "#0ea5e9"]
    );
    scene!(
        "autumn-leaves",
        "Autumn Drift",
        "parallax",
        "nature",
        0.7,
        1.2,
        ["#f59e0b", "#ea580c", "#78350f"]
    );
    scene!(
        "river-glow",
        "River Glow",
        "embers",
        "nature",
        0.6,
        0.9,
        ["#34d399", "#059669", "#1e293b"]
    );
    // space
    scene!(
        "stardust",
        "Stardust",
        "stars",
        "space",
        0.5,
        1.0,
        ["#e2e8f0", "#818cf8", "#fbbf24"]
    );
    scene!(
        "nebula-bloom",
        "Nebula Bloom",
        "aurora",
        "space",
        0.7,
        1.2,
        ["#c084fc", "#6366f1", "#f472b6"]
    );
    scene!(
        "orbital",
        "Orbital",
        "geometric",
        "space",
        0.8,
        0.9,
        ["#38bdf8", "#e2e8f0", "#111827"]
    );
    scene!(
        "comet-trail",
        "Comet Trail",
        "stars",
        "space",
        1.0,
        1.1,
        ["#f8fafc", "#60a5fa", "#f472b6"]
    );
    // seasonal
    scene!(
        "winter-snow",
        "Winter Snowfall",
        "particles",
        "seasonal",
        0.7,
        1.4,
        ["#f8fafc", "#bae6fd", "#0f172a"]
    );
    scene!(
        "spring-blossom",
        "Spring Blossom",
        "parallax",
        "seasonal",
        0.6,
        1.1,
        ["#f9a8d4", "#fda4af", "#0f172a"]
    );
    scene!(
        "holiday-lights",
        "Holiday Lights",
        "stars",
        "seasonal",
        0.8,
        1.2,
        ["#fbbf24", "#34d399", "#ef4444"]
    );
    scene!(
        "cherry-fall",
        "Cherry Petals",
        "particles",
        "seasonal",
        0.7,
        1.0,
        ["#f9a8d4", "#f472b6", "#1e293b"]
    );
    // A6.1 — new kinds: rain, fireflies, snowfall-wind, bokeh, smoke, waves-3d
    scene!(
        "midnight-rain",
        "Midnight Rain",
        "rain",
        "calm",
        0.8,
        1.2,
        ["#60a5fa", "#38bdf8", "#0f172a"]
    );
    scene!(
        "firefly-grove",
        "Firefly Grove",
        "fireflies",
        "nature",
        0.5,
        0.9,
        ["#fde047", "#a3e635", "#1e293b"]
    );
    scene!(
        "blizzard-drift",
        "Blizzard Drift",
        "snowfall-wind",
        "seasonal",
        1.1,
        1.3,
        ["#f8fafc", "#e0f2fe", "#1e3a8a"]
    );
    scene!(
        "bokeh-aurora",
        "Bokeh Bloom",
        "bokeh",
        "space",
        0.4,
        0.8,
        ["#c084fc", "#f472b6", "#38bdf8"]
    );
    scene!(
        "smoke-ember",
        "Smoke & Ember",
        "smoke",
        "energetic",
        0.9,
        0.9,
        ["#fb923c", "#ef4444", "#facc15"]
    );
    scene!(
        "ocean-depth",
        "Ocean Depth",
        "waves-3d",
        "nature",
        0.8,
        1.0,
        ["#0ea5e9", "#06b6d4", "#0f172a"]
    );
    // S5 — catalog expansion: 26 → 48. Includes the matrix kind (previously
    // supported by the renderer but never used) plus fresh color stories across
    // the existing kinds. Mock SCENES + KNOWN_SCENE_IDS mirror these exactly.
    scene!(
        "digital-rain",
        "Digital Rain",
        "matrix",
        "energetic",
        1.2,
        1.5,
        ["#22c55e", "#4ade80", "#052e16"]
    );
    scene!(
        "cipher-fall",
        "Cipher Fall",
        "matrix",
        "focused",
        0.9,
        1.3,
        ["#22d3ee", "#e2e8f0", "#0f172a"]
    );
    scene!(
        "amber-rain",
        "Amber Rain",
        "rain",
        "cozy",
        0.7,
        1.0,
        ["#f59e0b", "#fbbf24", "#1c1917"]
    );
    scene!(
        "violet-rain",
        "Violet Rain",
        "rain",
        "calm",
        0.6,
        1.1,
        ["#a78bfa", "#c4b5fd", "#1e1b4b"]
    );
    scene!(
        "ember-fireflies",
        "Ember Fireflies",
        "fireflies",
        "cozy",
        0.5,
        0.9,
        ["#fb923c", "#fde047", "#1c1917"]
    );
    scene!(
        "glacier-drift",
        "Glacier Drift",
        "snowfall-wind",
        "calm",
        0.9,
        1.2,
        ["#bae6fd", "#e0f2fe", "#0c4a6e"]
    );
    scene!(
        "aurora-snow",
        "Aurora Snow",
        "snowfall-wind",
        "playful",
        0.8,
        1.1,
        ["#c4b5fd", "#f8fafc", "#312e81"]
    );
    scene!(
        "bokeh-city",
        "Bokeh City",
        "bokeh",
        "energetic",
        0.6,
        1.1,
        ["#f472b6", "#22d3ee", "#0f172a"]
    );
    scene!(
        "incense-smoke",
        "Incense Smoke",
        "smoke",
        "calm",
        0.4,
        0.8,
        ["#d6d3d1", "#fbbf24", "#292524"]
    );
    scene!(
        "crimson-tide",
        "Crimson Tide",
        "waves-3d",
        "energetic",
        1.1,
        1.2,
        ["#ef4444", "#f97316", "#450a0a"]
    );
    scene!(
        "aurora-boreal",
        "Aurora Boreal",
        "aurora",
        "calm",
        0.7,
        1.1,
        ["#34d399", "#818cf8", "#0f172a"]
    );
    scene!(
        "starlight-sea",
        "Starlight Sea",
        "waves",
        "calm",
        0.6,
        0.9,
        ["#1d4ed8", "#60a5fa", "#fbbf24"]
    );
    scene!(
        "hologram-grid",
        "Hologram Grid",
        "geometric",
        "energetic",
        1.2,
        1.1,
        ["#22d3ee", "#e879f9", "#0f172a"]
    );
    scene!(
        "pine-snow",
        "Pine Snow",
        "parallax",
        "calm",
        0.6,
        1.0,
        ["#4ade80", "#e2e8f0", "#022c22"]
    );
    scene!(
        "cloud-veil",
        "Cloud Veil",
        "parallax",
        "calm",
        0.5,
        0.9,
        ["#cbd5e1", "#f8fafc", "#1e293b"]
    );
    scene!(
        "gold-dust",
        "Gold Dust",
        "particles",
        "playful",
        0.8,
        1.0,
        ["#fbbf24", "#fde68a", "#1c1917"]
    );
    scene!(
        "cosmic-dust",
        "Cosmic Dust",
        "particles",
        "calm",
        0.5,
        0.9,
        ["#e2e8f0", "#818cf8", "#fbbf24"]
    );
    scene!(
        "rose-mist",
        "Rose Mist",
        "particles",
        "playful",
        0.6,
        0.9,
        ["#fda4af", "#f9a8d4", "#1e293b"]
    );
    scene!(
        "ember-wind",
        "Ember Wind",
        "embers",
        "energetic",
        1.2,
        1.1,
        ["#f97316", "#ef4444", "#1c1917"]
    );
    scene!(
        "forge-glow",
        "Forge Glow",
        "embers",
        "cozy",
        0.6,
        0.8,
        ["#fb923c", "#facc15", "#1c1917"]
    );
    scene!(
        "shooting-stars",
        "Shooting Stars",
        "stars",
        "energetic",
        1.1,
        1.2,
        ["#f8fafc", "#60a5fa", "#7c3aed"]
    );
    scene!(
        "polaris",
        "Polaris",
        "stars",
        "calm",
        0.6,
        1.0,
        ["#e2e8f0", "#93c5fd", "#1e1b4b"]
    );
    v
}
