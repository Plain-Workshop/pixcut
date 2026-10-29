use super::*;


#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Policy {
    pub watermark: bool,
    pub pixcut_outro: bool,
    pub privacy: String,
}
impl Default for Policy {
    fn default() -> Self {
        Self {
            watermark: false,
            pixcut_outro: false,
            privacy: "local".into(),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Timebase {
    pub numerator: u32,
    pub denominator: u32,
}
impl Default for Timebase {
    fn default() -> Self {
        Self {
            numerator: 1,
            denominator: 30,
        }
    }
}
impl Timebase {
    pub fn seconds_per_tick(&self) -> f64 {
        self.numerator as f64 / self.denominator as f64
    }
    pub fn fps(&self) -> f64 {
        self.denominator as f64 / self.numerator as f64
    }
    pub fn min_ticks(&self) -> u64 {
        (0.5 / self.seconds_per_tick()).ceil() as u64
    }
    pub fn max_ticks(&self) -> u64 {
        (30.0 / self.seconds_per_tick()).floor() as u64
    }
    /// Imported video can run for ten minutes; photos stay at the 30 s cap.
    pub fn max_video_ticks(&self) -> u64 {
        (600.0 / self.seconds_per_tick()).floor() as u64
    }
    pub fn ticks_to_seconds(&self, ticks: u64) -> f64 {
        ticks as f64 * self.seconds_per_tick()
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Transition {
    #[serde(rename = "type")]
    pub kind: String,
    pub duration: f64,
}
/// A keyframed pan/zoom on a photo: seconds from the scene start.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct FramingKeyframe {
    pub at: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zoom: Option<f64>,
}

/// One motion keyframe: seconds from the layer start, with optional overrides.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Keyframe {
    pub at: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scale: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rotation: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct TextLayer {
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub color: String,
    /// Stacking order; bigger draws on top. Missing keeps the classic order.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub z: Option<f64>,
    pub start_ticks: u64,
    pub duration_ticks: u64,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub align: String,
    pub font: String,
    pub font_weight: f64,
    pub font_style: String,
    pub size: f64,
    pub line_height: f64,
    pub letter_spacing: f64,
    pub rotation: f64,
    pub opacity: f64,
    pub subtitle_scale: f64,
    pub backdrop_enabled: bool,
    pub backdrop_color: String,
    pub backdrop_opacity: f64,
    pub backdrop_blur: f64,
    pub backdrop_padding: f64,
    pub backdrop_radius: f64,
    pub backdrop_noise: f64,
    pub outline_enabled: bool,
    pub stroke_color: String,
    pub stroke_width: f64,
    pub shadow_enabled: bool,
    pub shadow_color: String,
    pub shadow_intensity: f64,
    pub shadow_blur: f64,
    pub shadow_offset_x: f64,
    pub shadow_offset_y: f64,
    pub glow_enabled: bool,
    pub glow_color: String,
    pub glow_blur: f64,
    pub glow_intensity: f64,
    pub animation: String,
    pub animation_duration: f64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub keyframes: Vec<Keyframe>,
}
impl Default for TextLayer {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: String::new(),
            subtitle: String::new(),
            color: default_white(),
            z: None,
            start_ticks: 0,
            duration_ticks: 0,
            x: default_text_x(),
            y: default_text_y(),
            width: default_text_width(),
            align: default_text_align(),
            font: default_text_font(),
            font_weight: default_text_weight(),
            font_style: default_text_style(),
            size: default_text_size(),
            line_height: default_text_line_height(),
            letter_spacing: 0.0,
            rotation: 0.0,
            opacity: default_text_opacity(),
            subtitle_scale: default_text_subtitle_scale(),
            backdrop_enabled: false,
            backdrop_color: default_black(),
            backdrop_opacity: default_backdrop_opacity(),
            backdrop_blur: default_backdrop_blur(),
            backdrop_padding: default_backdrop_padding(),
            backdrop_radius: default_backdrop_radius(),
            backdrop_noise: default_backdrop_noise(),
            outline_enabled: false,
            stroke_color: default_black(),
            stroke_width: 0.0,
            shadow_enabled: false,
            shadow_color: default_black(),
            shadow_intensity: default_shadow_intensity(),
            shadow_blur: 0.0,
            shadow_offset_x: 0.0,
            shadow_offset_y: 0.0,
            glow_enabled: false,
            glow_color: default_white(),
            glow_blur: default_glow_blur(),
            glow_intensity: default_glow_intensity(),
            animation: "none".into(),
            animation_duration: 0.5,
            keyframes: Vec::new(),
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ElementAction { pub kind: String, pub start_ticks: u64, pub duration_ticks: u64, pub repeat: bool, pub sound: bool }
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ElementBehavior {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interval_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count_from: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count_to: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeat: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
}
impl ElementBehavior {
    pub(crate) fn valid(&self) -> bool {
        self.at_seconds.is_none_or(|n| n.is_finite() && (0.0..=3600.0).contains(&n))
        && self.interval_seconds.is_none_or(|n| n.is_finite() && (0.1..=60.0).contains(&n))
        && self.count_from.is_none_or(|n| n.is_finite() && (0.0..=9999.0).contains(&n))
        && self.count_to.is_none_or(|n| n.is_finite() && (0.0..=9999.0).contains(&n))
        && self.audio_id.as_ref().is_none_or(|s| s.chars().count() <= 200)
        && self.variant.as_ref().is_none_or(|s| ["click", "double-click", "drag", "phone", "browser"].contains(&s.as_str()))
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Mask {
    pub shape: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub feather: f64,
    pub invert: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChromaKey {
    pub color: String,
    pub similarity: f64,
    pub softness: f64,
    pub spill: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ToneCurves {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub master: Option<Vec<[f64; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub red: Option<Vec<[f64; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub green: Option<Vec<[f64; 2]>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blue: Option<Vec<[f64; 2]>>,
}

pub(crate) fn valid_curve(points: &[[f64; 2]]) -> bool {
    (2..=12).contains(&points.len())
        && points.iter().enumerate().all(|(index, point)| {
            point[0].is_finite() && point[1].is_finite()
                && (0.0..=1.0).contains(&point[0])
                && (0.0..=1.0).contains(&point[1])
                && (index == 0 || point[0] > points[index - 1][0])
        })
}

pub(crate) fn valid_curves(curves: &ToneCurves) -> bool {
    [&curves.master, &curves.red, &curves.green, &curves.blue]
        .into_iter()
        .all(|channel| channel.as_ref().is_none_or(|points| valid_curve(points)))
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ElementLayer {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub behavior: Option<ElementBehavior>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit: Option<String>,
    /// Stacking order; bigger draws on top. Missing keeps the classic order.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub z: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<ElementAction>,
    pub id: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub poster: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_in_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_duration_seconds: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[serde(rename = "loop")]
    pub loop_animation: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animation_duration: Option<f64>,
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default)]
    pub width: f64,
    #[serde(default)]
    pub height: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "default_white")]
    pub color: String,
    #[serde(default = "default_hundred")]
    pub opacity: f64,
    #[serde(default)]
    pub start_ticks: u64,
    #[serde(default)]
    pub duration_ticks: u64,
    #[serde(default)]
    pub animation: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub keyframes: Vec<Keyframe>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mask: Option<Mask>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chroma: Option<ChromaKey>,
}
pub(crate) fn default_hundred() -> f64 {
    100.0
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PipStyle {
    #[serde(default = "default_pip_x")]
    pub x: f64,
    #[serde(default = "default_pip_y")]
    pub y: f64,
    #[serde(default = "default_pip_width")]
    pub width: f64,
    #[serde(default = "default_pip_height")]
    pub height: f64,
    #[serde(default = "default_pip_radius")]
    pub radius: f64,
    #[serde(default = "default_pip_shadow")]
    pub shadow: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: String,
    pub name: String,
    pub image: std::sync::Arc<str>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_poster: Option<String>,
    #[serde(default)]
    pub elements: Vec<ElementLayer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub motion: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub motion_amount: Option<f64>,
    #[serde(default)]
    pub start_ticks: u64,
    #[serde(default)]
    pub source_in_ticks: u64,
    /// Full length of the imported source, in seconds. Video clips use it to
    /// bound trimming; photos leave it empty.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_duration_seconds: Option<f64>,
    #[serde(default)]
    pub duration_ticks: u64,
    #[serde(default, skip_serializing, rename = "duration")]
    pub legacy_duration: Option<f64>,
    pub title: String,
    pub subtitle: String,
    #[serde(default)]
    pub text_layers: Vec<TextLayer>,
    #[serde(default)]
    pub transition: Option<Transition>,
    /// Placement on the picture-in-picture track.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pip: Option<PipStyle>,
    pub color: String,
    pub fit: String,
    #[serde(default)]
    pub image_x: f64,
    #[serde(default)]
    pub image_y: f64,
    #[serde(default = "default_one")]
    pub image_zoom: f64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub framing_keyframes: Vec<FramingKeyframe>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mask: Option<Mask>,
    /// RGB tone curves applied after the regular grade.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub curves: Option<ToneCurves>,
    #[serde(default = "default_black")]
    pub framing_background: String,
    #[serde(default = "default_one")]
    pub brightness: f64,
    #[serde(default = "default_one")]
    pub contrast: f64,
    #[serde(default = "default_one")]
    pub saturation: f64,
    #[serde(default)]
    pub exposure: f64,
    #[serde(default)]
    pub highlights: f64,
    #[serde(default)]
    pub shadows: f64,
    #[serde(default)]
    pub temperature: f64,
    #[serde(default)]
    pub tint: f64,
    #[serde(default)]
    pub hue: f64,
    #[serde(default)]
    pub vibrance: f64,
    #[serde(default = "default_black")]
    pub shadow_tint_color: String,
    #[serde(default)]
    pub shadow_tint_amount: f64,
    #[serde(default = "default_black")]
    pub highlight_tint_color: String,
    #[serde(default)]
    pub highlight_tint_amount: f64,
    #[serde(default = "default_filter")]
    pub filter: String,
    #[serde(default = "default_intensity")]
    pub filter_intensity: f64,
    #[serde(default = "default_one")]
    pub speed: f64,
    /// End of a linear speed ramp. Missing means the clip is constant.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub speed_end: Option<f64>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub reverse: bool,
    #[serde(default = "default_true")]
    pub pitch: bool,
    /// Imported clip sound level, 0–100. Missing means 100.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_volume: Option<f64>,
    #[serde(default, alias = "fade_in")]
    pub fade_in: f64,
    #[serde(default, alias = "fade_out")]
    pub fade_out: f64,
    #[serde(default)]
    pub text_backdrop_enabled: bool,
    #[serde(default = "default_black")]
    pub text_backdrop_color: String,
    #[serde(default = "default_backdrop_opacity")]
    pub text_backdrop_opacity: f64,
    #[serde(default = "default_backdrop_blur")]
    pub text_backdrop_blur: f64,
    #[serde(default = "default_backdrop_padding")]
    pub text_backdrop_padding: f64,
    #[serde(default = "default_backdrop_radius")]
    pub text_backdrop_radius: f64,
    #[serde(default = "default_backdrop_noise")]
    pub text_backdrop_noise: f64,
    #[serde(default = "default_black")]
    pub text_stroke_color: String,
    #[serde(default)]
    pub text_outline_enabled: bool,
    #[serde(default)]
    pub text_stroke_width: f64,
    #[serde(default = "default_black")]
    pub text_shadow_color: String,
    #[serde(default)]
    pub text_shadow_enabled: bool,
    #[serde(default = "default_shadow_intensity")]
    pub text_shadow_intensity: f64,
    #[serde(default)]
    pub text_shadow_blur: f64,
    #[serde(default)]
    pub text_shadow_offset_x: f64,
    #[serde(default)]
    pub text_shadow_offset_y: f64,
    #[serde(default)]
    pub text_glow_enabled: bool,
    #[serde(default = "default_white")]
    pub text_glow_color: String,
    #[serde(default = "default_glow_blur")]
    pub text_glow_blur: f64,
    #[serde(default = "default_glow_intensity")]
    pub text_glow_intensity: f64,
    #[serde(default = "default_text_x")]
    pub text_x: f64,
    #[serde(default = "default_text_y")]
    pub text_y: f64,
    #[serde(default = "default_text_width")]
    pub text_width: f64,
    #[serde(default = "default_text_align")]
    pub text_align: String,
    #[serde(default = "default_text_font")]
    pub text_font: String,
    #[serde(default = "default_text_weight")]
    pub text_font_weight: f64,
    #[serde(default = "default_text_style")]
    pub text_font_style: String,
    #[serde(default = "default_text_size")]
    pub text_size: f64,
    #[serde(default = "default_text_line_height")]
    pub text_line_height: f64,
    #[serde(default)]
    pub text_letter_spacing: f64,
    #[serde(default)]
    pub text_rotation: f64,
    #[serde(default = "default_text_opacity")]
    pub text_opacity: f64,
    #[serde(default = "default_text_subtitle_scale")]
    pub text_subtitle_scale: f64,
}
pub(crate) fn validate_framing_keyframes(frames: &mut [FramingKeyframe], duration_seconds: f64) -> bool {
    if frames.len() > 24 { return false; }
    let valid = frames.iter().all(|frame| {
        frame.at.is_finite()
            && frame.at >= 0.0
            && frame.at <= duration_seconds + 1e-6
            && frame.x.is_none_or(|value| value.is_finite() && (-1.0..=1.0).contains(&value))
            && frame.y.is_none_or(|value| value.is_finite() && (-1.0..=1.0).contains(&value))
            && frame.zoom.is_none_or(|value| value.is_finite() && (1.0..=4.0).contains(&value))
    });
    if valid {
        frames.sort_by(|a, b| a.at.partial_cmp(&b.at).unwrap_or(std::cmp::Ordering::Equal));
    }
    valid
}

pub(crate) fn validate_keyframes(frames: &mut [Keyframe], duration_seconds: f64) -> bool {
    if frames.len() > 24 { return false; }
    let valid = frames.iter().all(|frame| {
        frame.at.is_finite()
            && frame.at >= 0.0
            && frame.at <= duration_seconds + 1e-6
            && frame.x.is_none_or(|value| value.is_finite() && (0.0..=1.0).contains(&value))
            && frame.y.is_none_or(|value| value.is_finite() && (0.0..=1.0).contains(&value))
            && frame.scale.is_none_or(|value| value.is_finite() && (0.05..=5.0).contains(&value))
            && frame.rotation.is_none_or(|value| value.is_finite() && (-180.0..=180.0).contains(&value))
            && frame.opacity.is_none_or(|value| value.is_finite() && (0.0..=100.0).contains(&value))
    });
    if valid {
        frames.sort_by(|a, b| a.at.partial_cmp(&b.at).unwrap_or(std::cmp::Ordering::Equal));
    }
    valid
}

pub(crate) fn validate_elements(elements: &mut Vec<ElementLayer>, total: u64, limit: usize, timebase: &Timebase) -> bool {
    if total == 0 { elements.clear(); return true; }
    for element in elements.iter_mut() {
        element.start_ticks = element.start_ticks.min(total.saturating_sub(1));
        element.duration_ticks = element.duration_ticks.min(total.saturating_sub(element.start_ticks)).max(1);
        if let Some(action) = &mut element.action {
            action.start_ticks = action.start_ticks.min(element.duration_ticks.saturating_sub(1));
            action.duration_ticks = action.duration_ticks.min(element.duration_ticks.saturating_sub(action.start_ticks));
        }
        if !validate_keyframes(&mut element.keyframes, timebase.ticks_to_seconds(element.duration_ticks)) {
            return false;
        }
    }
    elements.len() <= limit && {
                    let mut ids = std::collections::HashSet::new();
                    elements.iter().all(|element| {
                        ids.insert(element.id.clone())
                            && !element.id.is_empty()
                            && ["caption", "chapter", "callout", "keycaps", "mouse", "device", "comparison", "checklist", "rating", "countdown", "waveform", "message", "qr", "end-screen", "image", "video", "label", "name-tag", "link", "quote", "counter", "status", "burst", "frame", "dots", "tape", "chevron", "rectangle", "ellipse", "triangle", "star", "sparkle", "line", "arrow", "heart", "subscribe", "like", "bell", "comment", "share", "play", "progress", "location", "music", "check", "cross", "ring", "cursor", "underline"].contains(&element.kind.as_str())
                            && element.preset_id.as_ref().is_none_or(|s| !s.is_empty() && s.len() <= 80 && s.as_bytes().first().is_some_and(|c| c.is_ascii_lowercase()) && s.bytes().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-'))
                            && element.behavior.as_ref().is_none_or(|b| b.valid())
                            && element.exit.as_ref().is_none_or(|s| ["none", "fade", "slide-down"].contains(&s.as_str()))
                            && element.z.is_none_or(|z| z.is_finite() && (0.0..=100_000.0).contains(&z))
                            && element.x.is_finite() && (0.0..=1.0).contains(&element.x)
                            && element.y.is_finite() && (0.0..=1.0).contains(&element.y)
                            && element.width.is_finite() && (0.02..=1.0).contains(&element.width)
                            && element.height.is_finite() && (0.02..=1.0).contains(&element.height)
                            && element.rotation.is_finite() && (-180.0..=180.0).contains(&element.rotation)
                            && element.action.as_ref().is_none_or(|a| ["ring", "pulse", "float", "spin"].contains(&a.kind.as_str()) && a.duration_ticks > 0 && a.start_ticks.saturating_add(a.duration_ticks) <= element.duration_ticks)
                            && element.animation_duration.is_none_or(|n| n.is_finite() && (0.1..=5.0).contains(&n))
                            && element.source_in_seconds.is_none_or(|n| n.is_finite() && n >= 0.0)
                            && element.source_duration_seconds.is_none_or(|n| n.is_finite() && n > 0.0 && n <= 3600.0)
                            && (element.kind != "image" && element.kind != "video" || element.source.as_ref().is_some_and(|source| {
                                is_asset_ref(source) || if element.kind == "video" { ["data:video/mp4;base64,", "data:video/webm;base64,", "data:video/quicktime;base64,", "data:video/x-m4v;base64,"].iter().any(|prefix| source.starts_with(prefix)) }
                                else { ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"].iter().any(|prefix| source.starts_with(prefix)) }
                            }))
                            && element.source.as_ref().is_none_or(|source| is_asset_ref(source) || ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,", "data:video/mp4;base64,", "data:video/webm;base64,", "data:video/quicktime;base64,", "data:video/x-m4v;base64,"].iter().any(|prefix| source.starts_with(prefix)))
                            && element.poster.as_ref().is_none_or(|source| is_asset_ref(source) || ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"].iter().any(|prefix| source.starts_with(prefix)))
                            && element.label.as_ref().is_none_or(|label| label.chars().count() <= 80)
                            && is_hex_color(&element.color)
                            && element.opacity.is_finite() && (0.0..=100.0).contains(&element.opacity)
                            && element.duration_ticks > 0
                            && element.start_ticks + element.duration_ticks <= total
                            && element.mask.as_ref().is_none_or(|mask| {
                                (element.kind == "image" || element.kind == "video") && valid_mask(mask)
                            })
                            && element.chroma.as_ref().is_none_or(|chroma| {
                                (element.kind == "image" || element.kind == "video") && valid_chroma(chroma)
                            })
                            && ["", "none", "fade", "pop", "slide-up", "pulse", "float", "slide-down", "slide-left", "slide-right", "zoom-out", "bounce", "spin", "swing"].contains(&element.animation.as_str())
                    })
                }
}
impl Scene {
    pub(crate) fn normalize_elements(&mut self) {
        let total = self.duration_ticks.max(1);
        for element in &mut self.elements {
            if element.start_ticks >= total {
                element.start_ticks = total.saturating_sub(1);
            }
            element.duration_ticks = element
                .duration_ticks
                .min(total.saturating_sub(element.start_ticks))
                .max(1);
        }
    }

    pub(crate) fn normalize_transition(&mut self, timebase: &Timebase) -> Result<(), String> {
        let Some(transition) = self.transition.take() else { return Ok(()) };
        if transition.kind == "none" {
            return Ok(());
        }
        if !["fade", "slide", "wipe", "zoom", "blur", "circle", "slide-up", "spin"].contains(&transition.kind.as_str())
            || !transition.duration.is_finite()
        {
            return Err("Invalid transition.".into());
        }
        let max = 2.0_f64.min(timebase.ticks_to_seconds(self.duration_ticks) * 0.5);
        self.transition = Some(Transition {
            kind: transition.kind,
            duration: transition.duration.max(0.1).min(max.max(0.1)),
        });
        Ok(())
    }
    pub(crate) fn normalize_text_layers(&mut self, timebase: &Timebase) -> Result<(), String> {
        let duration = self.duration_ticks;
        if self.text_layers.is_empty() && (!self.title.is_empty() || !self.subtitle.is_empty()) {
            self.text_layers.push(TextLayer {
                id: format!("{}-text", self.id),
                title: self.title.clone(),
                subtitle: self.subtitle.clone(),
                color: self.color.clone(),
                z: None,
                start_ticks: 0,
                duration_ticks: duration,
                x: self.text_x,
                y: self.text_y,
                width: self.text_width,
                align: self.text_align.clone(),
                font: self.text_font.clone(),
                font_weight: self.text_font_weight,
                font_style: self.text_font_style.clone(),
                size: self.text_size,
                line_height: self.text_line_height,
                letter_spacing: self.text_letter_spacing,
                rotation: self.text_rotation,
                opacity: self.text_opacity,
                subtitle_scale: self.text_subtitle_scale,
                backdrop_enabled: self.text_backdrop_enabled,
                backdrop_color: self.text_backdrop_color.clone(),
                backdrop_opacity: self.text_backdrop_opacity,
                backdrop_blur: self.text_backdrop_blur,
                backdrop_padding: self.text_backdrop_padding,
                backdrop_radius: self.text_backdrop_radius,
                backdrop_noise: self.text_backdrop_noise,
                outline_enabled: self.text_outline_enabled,
                stroke_color: self.text_stroke_color.clone(),
                stroke_width: self.text_stroke_width,
                shadow_enabled: self.text_shadow_enabled,
                shadow_color: self.text_shadow_color.clone(),
                shadow_intensity: self.text_shadow_intensity,
                shadow_blur: self.text_shadow_blur,
                shadow_offset_x: self.text_shadow_offset_x,
                shadow_offset_y: self.text_shadow_offset_y,
                glow_enabled: self.text_glow_enabled,
                glow_color: self.text_glow_color.clone(),
                glow_blur: self.text_glow_blur,
                glow_intensity: self.text_glow_intensity,
                animation: "none".into(),
                animation_duration: 0.5,
                keyframes: Vec::new(),
            });
        }
        if self.text_layers.len() > 8 {
            return Err("A scene supports up to 8 text layers.".into());
        }
        let mut ids = std::collections::HashSet::new();
        for layer in &mut self.text_layers {
            if !text_layer_is_valid(layer, timebase, &mut ids) {
                return Err("Invalid text layer.".into());
            }
            if duration == 0 {
                return Err("A scene is too short for text.".into());
            }
            layer.start_ticks = layer.start_ticks.min(duration - 1);
            if layer.duration_ticks == 0 {
                layer.duration_ticks = duration - layer.start_ticks;
            }
            layer.duration_ticks = layer.duration_ticks.min(duration - layer.start_ticks).max(1);
        }
        self.title = self.text_layers.first().map(|layer| layer.title.clone()).unwrap_or_default();
        self.subtitle = self.text_layers.first().map(|layer| layer.subtitle.clone()).unwrap_or_default();
        Ok(())
    }
}
/// Field ranges shared by scene text and project-level text. Keyframes are
/// clamped in place, so the layer is taken by `&mut`.
pub(crate) fn text_layer_is_valid(layer: &mut TextLayer, timebase: &Timebase, ids: &mut std::collections::HashSet<String>) -> bool {
            let keyframes_ok = validate_keyframes(&mut layer.keyframes, timebase.ticks_to_seconds(layer.duration_ticks));
            let valid = keyframes_ok
                && !layer.id.is_empty()
                && ids.insert(layer.id.clone())
                && layer.title.chars().count() <= 120
                && layer.subtitle.chars().count() <= 200
                && is_hex_color(&layer.color)
                && layer.z.is_none_or(|z| z.is_finite() && (0.0..=100_000.0).contains(&z))
                && layer.x.is_finite()
                && (0.0..=1.0).contains(&layer.x)
                && layer.y.is_finite()
                && (0.0..=1.0).contains(&layer.y)
                && layer.width.is_finite()
                && (0.05..=1.0).contains(&layer.width)
                && ["left", "center", "right"].contains(&layer.align.as_str())
                && layer.font.chars().count() <= 60
                && layer.font_weight.is_finite()
                && (100.0..=900.0).contains(&layer.font_weight)
                && ["normal", "italic"].contains(&layer.font_style.as_str())
                && layer.size.is_finite()
                && (0.01..=0.5).contains(&layer.size)
                && layer.line_height.is_finite()
                && (0.5..=3.0).contains(&layer.line_height)
                && layer.letter_spacing.is_finite()
                && (-0.05..=0.2).contains(&layer.letter_spacing)
                && layer.rotation.is_finite()
                && (-180.0..=180.0).contains(&layer.rotation)
                && layer.opacity.is_finite()
                && (0.0..=100.0).contains(&layer.opacity)
                && layer.subtitle_scale.is_finite()
                && (0.2..=1.0).contains(&layer.subtitle_scale)
                && is_hex_color(&layer.backdrop_color)
                && layer.backdrop_opacity.is_finite()
                && (0.0..=100.0).contains(&layer.backdrop_opacity)
                && layer.backdrop_blur.is_finite()
                && (0.0..=60.0).contains(&layer.backdrop_blur)
                && layer.backdrop_padding.is_finite()
                && (0.0..=80.0).contains(&layer.backdrop_padding)
                && layer.backdrop_radius.is_finite()
                && (0.0..=60.0).contains(&layer.backdrop_radius)
                && layer.backdrop_noise.is_finite()
                && (0.0..=100.0).contains(&layer.backdrop_noise)
                && is_hex_color(&layer.stroke_color)
                && layer.stroke_width.is_finite()
                && (0.0..=12.0).contains(&layer.stroke_width)
                && is_hex_color(&layer.shadow_color)
                && layer.shadow_intensity.is_finite()
                && (0.0..=100.0).contains(&layer.shadow_intensity)
                && layer.shadow_blur.is_finite()
                && (0.0..=60.0).contains(&layer.shadow_blur)
                && layer.shadow_offset_x.is_finite()
                && (-40.0..=40.0).contains(&layer.shadow_offset_x)
                && layer.shadow_offset_y.is_finite()
                && (-40.0..=40.0).contains(&layer.shadow_offset_y)
                && is_hex_color(&layer.glow_color)
                && layer.glow_blur.is_finite()
                && (0.0..=80.0).contains(&layer.glow_blur)
                && layer.glow_intensity.is_finite()
                && (0.0..=100.0).contains(&layer.glow_intensity)
                && ["none", "fade", "slide-up", "slide-left", "pop"].contains(&layer.animation.as_str())
                && layer.animation_duration.is_finite()
                && (0.1..=2.0).contains(&layer.animation_duration);
    valid
}

pub(crate) fn default_pip_x() -> f64 { 0.8 }
pub(crate) fn default_pip_y() -> f64 { 0.78 }
pub(crate) fn default_pip_width() -> f64 { 0.32 }
pub(crate) fn default_pip_height() -> f64 { 0.32 }
pub(crate) fn default_pip_radius() -> f64 { 0.06 }
pub(crate) fn default_pip_shadow() -> f64 { 60.0 }
pub(crate) fn default_one() -> f64 { 1.0 }
pub(crate) fn default_filter() -> String { "none".into() }
pub(crate) fn default_intensity() -> f64 { 100.0 }
pub(crate) fn default_true() -> bool { true }
pub(crate) fn default_black() -> String { "#000000".into() }
pub(crate) fn default_white() -> String { "#FFFFFF".into() }
pub(crate) fn default_backdrop_opacity() -> f64 { 45.0 }
pub(crate) fn default_backdrop_blur() -> f64 { 18.0 }
pub(crate) fn default_backdrop_padding() -> f64 { 24.0 }
pub(crate) fn default_backdrop_radius() -> f64 { 16.0 }
pub(crate) fn default_backdrop_noise() -> f64 { 8.0 }
pub(crate) fn default_shadow_intensity() -> f64 { 60.0 }
pub(crate) fn default_glow_blur() -> f64 { 24.0 }
pub(crate) fn default_glow_intensity() -> f64 { 55.0 }
pub(crate) fn default_music_volume() -> f64 { 0.8 }
pub(crate) fn default_text_x() -> f64 { 0.09 }
pub(crate) fn default_text_y() -> f64 { 0.78 }
pub(crate) fn default_text_width() -> f64 { 0.82 }
pub(crate) fn default_text_align() -> String { "left".into() }
pub(crate) fn default_text_font() -> String { "inter".into() }
pub(crate) fn default_text_weight() -> f64 { 600.0 }
pub(crate) fn default_text_style() -> String { "normal".into() }
pub(crate) fn default_text_size() -> f64 { 0.068 }
pub(crate) fn default_text_line_height() -> f64 { 1.2 }
pub(crate) fn default_text_opacity() -> f64 { 100.0 }
pub(crate) fn default_text_subtitle_scale() -> f64 { 0.4 }
pub(crate) fn is_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}
pub(crate) fn valid_mask(mask: &Mask) -> bool {
    ["rectangle", "ellipse", "triangle", "star"].contains(&mask.shape.as_str())
        && mask.x.is_finite() && (0.0..=1.0).contains(&mask.x)
        && mask.y.is_finite() && (0.0..=1.0).contains(&mask.y)
        && mask.width.is_finite() && (0.01..=1.0).contains(&mask.width)
        && mask.height.is_finite() && (0.01..=1.0).contains(&mask.height)
        && mask.rotation.is_finite() && (-180.0..=180.0).contains(&mask.rotation)
        && mask.feather.is_finite() && (0.0..=100.0).contains(&mask.feather)
}
pub(crate) fn valid_chroma(chroma: &ChromaKey) -> bool {
    is_hex_color(&chroma.color)
        && chroma.similarity.is_finite() && (0.0..=100.0).contains(&chroma.similarity)
        && chroma.softness.is_finite() && (0.0..=100.0).contains(&chroma.softness)
        && chroma.spill.is_finite() && (0.0..=100.0).contains(&chroma.spill)
}
pub(crate) const FILTER_IDS: &[&str] = &["none", "vivid", "warm", "cool", "mono", "film", "noir", "dream"];
pub(crate) fn is_audio_data(value: &str) -> bool {
    [
        "data:audio/mpeg;base64,",
        "data:audio/mp3;base64,",
        "data:audio/wav;base64,",
        "data:audio/x-wav;base64,",
        "data:audio/mp4;base64,",
        "data:audio/aac;base64,",
        "data:audio/ogg;base64,",
        "data:audio/webm;base64,",
    ]
    .iter()
    .any(|prefix| value.starts_with(prefix))
}
pub(crate) fn is_asset_ref(value: &str) -> bool {
    value.strip_prefix("pixcut-asset:").is_some_and(|id| {
        id.len() == 64 && id.chars().all(|character| character.is_ascii_hexdigit())
    })
}
