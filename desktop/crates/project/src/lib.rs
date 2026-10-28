#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]
use serde::{Deserialize, Serialize};

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
    fn valid(&self) -> bool {
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

fn valid_curve(points: &[[f64; 2]]) -> bool {
    (2..=12).contains(&points.len())
        && points.iter().enumerate().all(|(index, point)| {
            point[0].is_finite() && point[1].is_finite()
                && (0.0..=1.0).contains(&point[0])
                && (0.0..=1.0).contains(&point[1])
                && (index == 0 || point[0] > points[index - 1][0])
        })
}

fn valid_curves(curves: &ToneCurves) -> bool {
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
fn default_hundred() -> f64 {
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
fn validate_framing_keyframes(frames: &mut [FramingKeyframe], duration_seconds: f64) -> bool {
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

fn validate_keyframes(frames: &mut [Keyframe], duration_seconds: f64) -> bool {
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

fn validate_elements(elements: &mut Vec<ElementLayer>, total: u64, limit: usize, timebase: &Timebase) -> bool {
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
    fn normalize_elements(&mut self) {
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

    fn normalize_transition(&mut self, timebase: &Timebase) -> Result<(), String> {
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
    fn normalize_text_layers(&mut self, timebase: &Timebase) -> Result<(), String> {
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
fn text_layer_is_valid(layer: &mut TextLayer, timebase: &Timebase, ids: &mut std::collections::HashSet<String>) -> bool {
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

fn default_pip_x() -> f64 { 0.8 }
fn default_pip_y() -> f64 { 0.78 }
fn default_pip_width() -> f64 { 0.32 }
fn default_pip_height() -> f64 { 0.32 }
fn default_pip_radius() -> f64 { 0.06 }
fn default_pip_shadow() -> f64 { 60.0 }
fn default_one() -> f64 { 1.0 }
fn default_filter() -> String { "none".into() }
fn default_intensity() -> f64 { 100.0 }
fn default_true() -> bool { true }
fn default_black() -> String { "#000000".into() }
fn default_white() -> String { "#FFFFFF".into() }
fn default_backdrop_opacity() -> f64 { 45.0 }
fn default_backdrop_blur() -> f64 { 18.0 }
fn default_backdrop_padding() -> f64 { 24.0 }
fn default_backdrop_radius() -> f64 { 16.0 }
fn default_backdrop_noise() -> f64 { 8.0 }
fn default_shadow_intensity() -> f64 { 60.0 }
fn default_glow_blur() -> f64 { 24.0 }
fn default_glow_intensity() -> f64 { 55.0 }
fn default_music_volume() -> f64 { 0.8 }
fn default_text_x() -> f64 { 0.09 }
fn default_text_y() -> f64 { 0.78 }
fn default_text_width() -> f64 { 0.82 }
fn default_text_align() -> String { "left".into() }
fn default_text_font() -> String { "inter".into() }
fn default_text_weight() -> f64 { 600.0 }
fn default_text_style() -> String { "normal".into() }
fn default_text_size() -> f64 { 0.068 }
fn default_text_line_height() -> f64 { 1.2 }
fn default_text_opacity() -> f64 { 100.0 }
fn default_text_subtitle_scale() -> f64 { 0.4 }
fn is_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}
fn valid_mask(mask: &Mask) -> bool {
    ["rectangle", "ellipse", "triangle", "star"].contains(&mask.shape.as_str())
        && mask.x.is_finite() && (0.0..=1.0).contains(&mask.x)
        && mask.y.is_finite() && (0.0..=1.0).contains(&mask.y)
        && mask.width.is_finite() && (0.01..=1.0).contains(&mask.width)
        && mask.height.is_finite() && (0.01..=1.0).contains(&mask.height)
        && mask.rotation.is_finite() && (-180.0..=180.0).contains(&mask.rotation)
        && mask.feather.is_finite() && (0.0..=100.0).contains(&mask.feather)
}
fn valid_chroma(chroma: &ChromaKey) -> bool {
    is_hex_color(&chroma.color)
        && chroma.similarity.is_finite() && (0.0..=100.0).contains(&chroma.similarity)
        && chroma.softness.is_finite() && (0.0..=100.0).contains(&chroma.softness)
        && chroma.spill.is_finite() && (0.0..=100.0).contains(&chroma.spill)
}
const FILTER_IDS: &[&str] = &["none", "vivid", "warm", "cool", "mono", "film", "noir", "dream"];
fn is_audio_data(value: &str) -> bool {
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
fn is_asset_ref(value: &str) -> bool {
    value.strip_prefix("pixcut-asset:").is_some_and(|id| {
        id.len() == 64 && id.chars().all(|character| character.is_ascii_hexdigit())
    })
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub kind: String,
    pub name: String,
    /// `overlay` marks the picture-in-picture visual track.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default)]
    pub clips: Vec<Scene>,
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub muted: bool,
    #[serde(default)]
    pub locked: bool,
}
impl Track {
    pub fn visual() -> Self {
        Self {
            id: "visual-1".into(),
            kind: "visual".into(),
            name: "Visuals".into(),
            role: None,
            clips: vec![],
            hidden: false,
            muted: false,
            locked: false,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MusicTrack {
    pub id: String,
    pub name: String,
    pub data: std::sync::Arc<str>,
    pub volume: f64,
    pub fade_in: f64,
    pub fade_out: f64,
    pub duration_seconds: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioClip {
    pub id: String,
    pub name: String,
    pub data: std::sync::Arc<str>,
    #[serde(default)]
    pub lane: u32,
    #[serde(default)]
    pub start_ticks: u64,
    #[serde(default)]
    pub duration_ticks: u64,
    #[serde(default)]
    pub source_in_seconds: f64,
    #[serde(default)]
    pub source_duration_seconds: f64,
    #[serde(default = "default_music_volume")]
    pub volume: f64,
    #[serde(default)]
    pub fade_in: f64,
    #[serde(default)]
    pub fade_out: f64,
    /// Three-band EQ in dB (−12…12). Missing means flat.
    #[serde(default)]
    pub low: f64,
    #[serde(default)]
    pub mid: f64,
    #[serde(default)]
    pub high: f64,
}
/// Mixer level for one audio lane. Missing lanes play at full volume.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AudioLaneMix {
    pub lane: u32,
    pub volume: f64,
    pub muted: bool,
}
impl Default for AudioLaneMix {
    fn default() -> Self {
        Self { lane: 0, volume: 1.0, muted: false }
    }
}
/// Audio lanes plus the bus for sound inside imported video clips.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AudioMix {
    pub video: f64,
    pub lanes: Vec<AudioLaneMix>,
}
impl Default for AudioMix {
    fn default() -> Self {
        Self { video: 1.0, lanes: vec![] }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SceneFormatOverride {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_x: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_y: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_zoom: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub framing_background: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FormatVariant {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub aspect: String,
    pub width: u32,
    pub height: u32,
    #[serde(default = "default_export_fps")]
    pub fps: u32,
    #[serde(default = "default_export_quality")]
    pub quality: String,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preset_id: Option<String>,
    #[serde(default)]
    pub overrides: std::collections::HashMap<String, SceneFormatOverride>,
}
fn default_export_fps() -> u32 { 30 }
fn default_export_quality() -> String { "standard".into() }
impl FormatVariant {
    fn original(aspect: &str) -> Self {
        let (width, height) = match aspect {
            "9:16" => (1080, 1920),
            "4:5" => (1080, 1350),
            "1:1" => (1080, 1080),
            _ => (1920, 1080),
        };
        Self { id: "format-original".into(), name: "Original".into(), platform: "Original".into(), aspect: aspect.into(), width, height, fps: 30, quality: "standard".into(), preset_id: None, overrides: Default::default() }
    }
}
/// A user-imported font embedded in the project as a data URL.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFont {
    pub id: String,
    pub name: String,
    pub data: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Project {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub aspect: String,
    #[serde(default)]
    pub timebase: Timebase,
    #[serde(default)]
    pub tracks: Vec<Track>,
    #[serde(default)]
    pub audio: Vec<AudioClip>,
    /// Lane and video-audio levels. Missing means everything plays fully.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_mix: Option<AudioMix>,
    #[serde(default)]
    pub overlays: Vec<ElementLayer>,
    #[serde(default)]
    pub formats: Vec<FormatVariant>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fonts: Vec<ProjectFont>,
    /// Text that spans scenes. Times are absolute project ticks.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub global_text: Vec<TextLayer>,
    /// Manual beat markers, in project ticks, sorted.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub beat_ticks: Vec<u64>,
    /// How much music is lowered while a video clip is audible (0–100).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ducking: Option<f64>,
    #[serde(default, skip_serializing, rename = "music")]
    pub legacy_music: Option<MusicTrack>,
    #[serde(default, skip_serializing, rename = "scenes")]
    pub legacy_scenes: Vec<Scene>,
    pub policy: Policy,
}
impl Default for Project {
    fn default() -> Self {
        Self {
            schema_version: 15,
            id: "new-project".into(),
            name: "Untitled story".into(),
            aspect: "16:9".into(),
            timebase: Timebase::default(),
            tracks: vec![Track::visual()],
            audio: vec![],
            audio_mix: None,
            overlays: vec![],
            formats: vec![],
            fonts: vec![],
            global_text: vec![],
            beat_ticks: vec![],
            ducking: None,
            legacy_music: None,
            legacy_scenes: vec![],
            policy: Policy::default(),
        }
    }
}
impl Project {
    pub fn visual_clips(&self) -> &[Scene] {
        self.tracks
            .iter()
            .find(|track| track.kind == "visual" && track.role.as_deref() != Some("overlay"))
            .map(|track| track.clips.as_slice())
            .unwrap_or(&[])
    }
    pub fn overlay_clips(&self) -> &[Scene] {
        self.tracks
            .iter()
            .find(|track| track.kind == "visual" && track.role.as_deref() == Some("overlay"))
            .map(|track| track.clips.as_slice())
            .unwrap_or(&[])
    }
    /// Effective gain for one audio lane, including its mute switch.
    pub fn lane_gain(&self, lane: u32) -> f64 {
        self.audio_mix
            .as_ref()
            .and_then(|mix| mix.lanes.iter().find(|item| item.lane == lane))
            .map(|item| if item.muted { 0.0 } else { item.volume })
            .unwrap_or(1.0)
    }
    /// Effective gain for the sound inside imported video clips.
    pub fn video_audio_gain(&self) -> f64 {
        self.audio_mix.as_ref().map(|mix| mix.video).unwrap_or(1.0)
    }
    fn normalize_global_text(&mut self, total_ticks: u64, timebase: &Timebase) -> Result<(), String> {
        if self.global_text.len() > 40 {
            return Err("A project supports up to 40 project text layers.".into());
        }
        if self.global_text.is_empty() {
            return Ok(());
        }
        if total_ticks == 0 {
            return Err("Add a scene before adding project text.".into());
        }
        let mut ids = std::collections::HashSet::new();
        for layer in &mut self.global_text {
            if !text_layer_is_valid(layer, timebase, &mut ids) {
                return Err("Invalid project text layer.".into());
            }
            layer.start_ticks = layer.start_ticks.min(total_ticks - 1);
            if layer.duration_ticks == 0 {
                layer.duration_ticks = total_ticks - layer.start_ticks;
            }
            layer.duration_ticks = layer.duration_ticks.min(total_ticks - layer.start_ticks).max(1);
        }
        Ok(())
    }
    pub fn total_ticks(&self) -> u64 {
        self.visual_clips()
            .iter()
            .map(|scene| scene.start_ticks + scene.duration_ticks)
            .max()
            .unwrap_or(0)
    }
    /// Rough size of the media an undo snapshot would pin in memory, in bytes.
    /// Used to keep history from holding many copies of a large story.
    pub fn media_bytes(&self) -> usize {
        let source = |value: &Option<String>| value.as_ref().map_or(0, |text| text.len());
        let overlays = self
            .overlays
            .iter()
            .map(|layer| source(&layer.source) + source(&layer.poster))
            .sum::<usize>();
        let scenes = self
            .tracks
            .iter()
            .flat_map(|track| track.clips.iter())
            .map(|scene| {
                scene.image.len()
                    + scene
                        .elements
                        .iter()
                        .map(|layer| source(&layer.source) + source(&layer.poster))
                        .sum::<usize>()
            })
            .sum::<usize>();
        let audio = self
            .audio
            .iter()
            .map(|clip| clip.data.len())
            .sum::<usize>();
        overlays + scenes + audio
    }
    /// Sets one layer's stack position (0–100000, bigger draws on top).
    /// Kept separate from the other edits so the lightweight `order` command
    /// can move a layer without touching or re-encoding any media.
    pub fn reorder(
        &mut self,
        kind: &str,
        scene_id: Option<&str>,
        id: &str,
        z: f64,
    ) -> Result<(), String> {
        if !z.is_finite() || !(0.0..=100_000.0).contains(&z) {
            return Err("Layer order must be between 0 and 100000.".into());
        }
        let missing = || "That layer is no longer in the project.".to_string();
        match kind {
            "overlay" => {
                self.overlays
                    .iter_mut()
                    .find(|layer| layer.id == id)
                    .ok_or_else(missing)?
                    .z = Some(z);
            }
            "element" | "text" => {
                let scene_id = scene_id.ok_or("That layer's scene is missing.")?;
                let scene = self
                    .tracks
                    .iter_mut()
                    .flat_map(|track| track.clips.iter_mut())
                    .find(|scene| scene.id == scene_id)
                    .ok_or("That scene is no longer in the project.")?;
                if kind == "element" {
                    scene
                        .elements
                        .iter_mut()
                        .find(|layer| layer.id == id)
                        .ok_or_else(missing)?
                        .z = Some(z);
                } else {
                    scene
                        .text_layers
                        .iter_mut()
                        .find(|layer| layer.id == id)
                        .ok_or_else(missing)?
                        .z = Some(z);
                }
            }
            _ => return Err("Unknown layer kind.".into()),
        }
        Ok(())
    }
    pub fn validate(&mut self) -> Result<(), String> {
        if self.schema_version != 1 && self.schema_version != 2 && self.schema_version != 3 && self.schema_version != 4 && self.schema_version != 5 && self.schema_version != 6 && self.schema_version != 7 && self.schema_version != 8 && self.schema_version != 9 && self.schema_version != 10 && self.schema_version != 11 && self.schema_version != 12 && self.schema_version != 13 && self.schema_version != 14 && self.schema_version != 15 {
            return Err(
                "Unsupported project version. The original file has not been changed.".into(),
            );
        }
        if self.name.chars().count() > 120
            || self.id.is_empty()
            || !["16:9", "9:16", "1:1", "4:5"].contains(&self.aspect.as_str())
        {
            return Err("Invalid project format.".into());
        }
        let migrating_seconds = self.schema_version == 1;
        let legacy_layout = self.schema_version < 3;
        if migrating_seconds {
            self.timebase = Timebase::default();
        }
        let timebase = self.timebase.clone();
        if timebase.numerator == 0
            || timebase.denominator == 0
            || timebase.numerator > timebase.denominator
            || timebase.denominator > 1_000_000
        {
            return Err("Invalid project timebase.".into());
        }
        let step = timebase.seconds_per_tick();
        if !step.is_finite() || step <= 0.0 {
            return Err("Invalid project timebase.".into());
        }
        let minimum = timebase.min_ticks();
        let maximum = timebase.max_ticks();
        let mut tracks = if legacy_layout {
            let clips = std::mem::take(&mut self.legacy_scenes);
            vec![Track {
                id: "visual-1".into(),
                kind: "visual".into(),
                name: "Visuals".into(),
                role: None,
                clips,
                hidden: false,
                muted: false,
                locked: false,
            }]
        } else {
            std::mem::take(&mut self.tracks)
        };
        self.legacy_scenes.clear();
        let migrating_music = self.schema_version < 5;
        self.schema_version = 15;
        if tracks.is_empty() {
            tracks.push(Track::visual());
        }
        if tracks.len() > 8 {
            return Err("A project supports up to 8 tracks in this build.".into());
        }
        let mut track_ids = std::collections::HashSet::new();
        let mut clip_ids = std::collections::HashSet::new();
        let mut visual_count = 0;
        let mut bytes = 0;
        for track in &mut tracks {
            if track.id.is_empty() || !track_ids.insert(track.id.clone()) {
                return Err("Invalid or duplicate track ID.".into());
            }
            if track.name.chars().count() > 120 {
                return Err("Invalid track name.".into());
            }
            if !["visual", "text", "audio"].contains(&track.kind.as_str()) {
                return Err("Invalid track kind.".into());
            }
            if track.role.is_some() && (track.kind != "visual" || !["base", "overlay"].contains(&track.role.as_deref().unwrap_or_default())) {
                return Err("Invalid track role.".into());
            }
            let is_overlay = track.kind == "visual" && track.role.as_deref() == Some("overlay");
            if track.kind == "visual" {
                visual_count += 1;
            } else if !track.clips.is_empty() {
                return Err("Only visual clips are supported in this build.".into());
            }
            let mut cursor = 0u64;
            for s in &mut track.clips {
                if migrating_seconds {
                    let seconds = s
                        .legacy_duration
                        .ok_or("A scene is missing its duration.")?;
                    if !seconds.is_finite() || !(0.5..=30.0).contains(&seconds) {
                        return Err("Invalid scene duration.".into());
                    }
                    s.duration_ticks = (seconds / step).round() as u64;
                }
                s.legacy_duration = None;
                let duration = timebase.ticks_to_seconds(s.duration_ticks);
                let framing_ok = validate_framing_keyframes(&mut s.framing_keyframes, duration);
                let is_video = s.media_kind.as_deref() == Some("video");
                let mask_ok = s.mask.as_ref().is_none_or(|mask| !is_video && valid_mask(mask));
                let maximum = if is_video { timebase.max_video_ticks() } else { maximum };
                if s.duration_ticks < minimum || s.duration_ticks > maximum {
                    return Err("Invalid scene duration.".into());
                }
                let pip_ok = s.pip.as_ref().is_none_or(|pip| {
                    pip.x.is_finite() && (0.0..=1.0).contains(&pip.x)
                        && pip.y.is_finite() && (0.0..=1.0).contains(&pip.y)
                        && pip.width.is_finite() && (0.05..=1.0).contains(&pip.width)
                        && pip.height.is_finite() && (0.05..=1.0).contains(&pip.height)
                        && pip.radius.is_finite() && (0.0..=0.5).contains(&pip.radius)
                        && pip.shadow.is_finite() && (0.0..=100.0).contains(&pip.shadow)
                });
                if !pip_ok || (is_overlay && s.pip.is_none()) {
                    return Err("Invalid picture-in-picture placement.".into());
                }
                if is_overlay {
                    // Overlay clips keep their own start and cannot carry a
                    // transition; both are properties of the base track.
                    s.transition = None;
                } else {
                    s.pip = None;
                    s.start_ticks = cursor;
                    cursor += s.duration_ticks;
                }
                let media_ok = is_asset_ref(&s.image)
                    || if is_video {
                        [
                            "data:video/mp4;base64,",
                            "data:video/quicktime;base64,",
                            "data:video/x-m4v;base64,",
                            "data:video/webm;base64,",
                        ]
                        .iter()
                        .any(|prefix| s.image.starts_with(prefix))
                    } else {
                        [
                            "data:image/png;base64,",
                            "data:image/jpeg;base64,",
                            "data:image/webp;base64,",
                        ]
                        .iter()
                        .any(|prefix| s.image.starts_with(prefix))
                    };
                let poster_ok = s.video_poster.as_deref().is_none_or(|poster| {
                    poster.starts_with("data:image/jpeg;base64,")
                        || poster.starts_with("data:image/png;base64,")
                });
                let kind_ok = s.media_kind.as_deref().is_none_or(|kind| kind == "video");
                let source_ok = s
                    .source_duration_seconds
                    .is_none_or(|seconds| seconds.is_finite() && seconds > 0.0 && seconds <= 3600.0);
                s.normalize_elements();
                let elements_ok = validate_elements(&mut s.elements, s.duration_ticks, 12, &timebase);
                let motion_ok = s.motion.as_deref().is_none_or(|motion| {
                    ["none", "zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down", "ken-burns"].contains(&motion)
                }) && s.motion_amount.is_none_or(|amount| amount.is_finite() && (0.0..=0.6).contains(&amount));
                if !clip_ids.insert(s.id.clone())
                    || s.id.is_empty()
                    || !source_ok
                    || s.title.chars().count() > 120
                    || s.subtitle.chars().count() > 200
                    || !["cover", "contain", "blur"].contains(&s.fit.as_str())
                    || !s.image_x.is_finite()
                    || !(-1.0..=1.0).contains(&s.image_x)
                    || !s.image_y.is_finite()
                    || !(-1.0..=1.0).contains(&s.image_y)
                    || !s.image_zoom.is_finite()
                    || !(1.0..=4.0).contains(&s.image_zoom)
                    || !is_hex_color(&s.framing_background)
                    || !is_hex_color(&s.color)
                    || !s.brightness.is_finite()
                    || !(0.0..=2.5).contains(&s.brightness)
                    || !s.contrast.is_finite()
                    || !(0.0..=2.5).contains(&s.contrast)
                    || !s.saturation.is_finite()
                    || !(0.0..=2.5).contains(&s.saturation)
                    || !s.exposure.is_finite()
                    || !(-3.0..=3.0).contains(&s.exposure)
                    || !s.highlights.is_finite()
                    || !(-1.0..=1.0).contains(&s.highlights)
                    || !s.shadows.is_finite()
                    || !(-1.0..=1.0).contains(&s.shadows)
                    || !s.temperature.is_finite()
                    || !(-1.0..=1.0).contains(&s.temperature)
                    || !s.tint.is_finite()
                    || !(-1.0..=1.0).contains(&s.tint)
                    || !s.hue.is_finite()
                    || !(-180.0..=180.0).contains(&s.hue)
                    || !s.vibrance.is_finite()
                    || !(-100.0..=100.0).contains(&s.vibrance)
                    || s.curves.as_ref().is_some_and(|curves| !valid_curves(curves))
                    || !is_hex_color(&s.shadow_tint_color)
                    || !s.shadow_tint_amount.is_finite()
                    || !(0.0..=100.0).contains(&s.shadow_tint_amount)
                    || !is_hex_color(&s.highlight_tint_color)
                    || !s.highlight_tint_amount.is_finite()
                    || !(0.0..=100.0).contains(&s.highlight_tint_amount)
                    || !FILTER_IDS.contains(&s.filter.as_str())
                    || !s.filter_intensity.is_finite()
                    || !(0.0..=100.0).contains(&s.filter_intensity)
                    || !s.speed.is_finite()
                    || !(0.25..=4.0).contains(&s.speed)
                    || s.speed_end.is_some_and(|value| !value.is_finite() || !(0.25..=4.0).contains(&value))
                    || s.video_volume.is_some_and(|volume| !volume.is_finite() || !(0.0..=100.0).contains(&volume))
                    || !s.fade_in.is_finite()
                    || s.fade_in < 0.0
                    || s.fade_in > duration
                    || !s.fade_out.is_finite()
                    || s.fade_out < 0.0
                    || s.fade_out > duration
                    || !s.text_backdrop_opacity.is_finite()
                    || !(0.0..=100.0).contains(&s.text_backdrop_opacity)
                    || !s.text_backdrop_blur.is_finite()
                    || !(0.0..=60.0).contains(&s.text_backdrop_blur)
                    || !s.text_backdrop_padding.is_finite()
                    || !(0.0..=80.0).contains(&s.text_backdrop_padding)
                    || !s.text_backdrop_radius.is_finite()
                    || !(0.0..=60.0).contains(&s.text_backdrop_radius)
                    || !s.text_backdrop_noise.is_finite()
                    || !(0.0..=100.0).contains(&s.text_backdrop_noise)
                    || !is_hex_color(&s.text_backdrop_color)
                    || !is_hex_color(&s.text_stroke_color)
                    || !s.text_stroke_width.is_finite()
                    || !(0.0..=12.0).contains(&s.text_stroke_width)
                    || !is_hex_color(&s.text_shadow_color)
                    || !s.text_shadow_intensity.is_finite()
                    || !(0.0..=100.0).contains(&s.text_shadow_intensity)
                    || !s.text_shadow_blur.is_finite()
                    || !(0.0..=60.0).contains(&s.text_shadow_blur)
                    || !s.text_shadow_offset_x.is_finite()
                    || !(-40.0..=40.0).contains(&s.text_shadow_offset_x)
                    || !s.text_shadow_offset_y.is_finite()
                    || !(-40.0..=40.0).contains(&s.text_shadow_offset_y)
                    || !is_hex_color(&s.text_glow_color)
                    || !s.text_glow_blur.is_finite()
                    || !(0.0..=80.0).contains(&s.text_glow_blur)
                    || !s.text_glow_intensity.is_finite()
                    || !(0.0..=100.0).contains(&s.text_glow_intensity)
                    || !s.text_x.is_finite()
                    || !(0.0..=1.0).contains(&s.text_x)
                    || !s.text_y.is_finite()
                    || !(0.0..=1.0).contains(&s.text_y)
                    || !s.text_width.is_finite()
                    || !(0.05..=1.0).contains(&s.text_width)
                    || !["left", "center", "right"].contains(&s.text_align.as_str())
                    || s.text_font.chars().count() > 60
                    || !s.text_font_weight.is_finite()
                    || !(100.0..=900.0).contains(&s.text_font_weight)
                    || !["normal", "italic"].contains(&s.text_font_style.as_str())
                    || !s.text_size.is_finite()
                    || !(0.01..=0.5).contains(&s.text_size)
                    || !s.text_line_height.is_finite()
                    || !(0.5..=3.0).contains(&s.text_line_height)
                    || !s.text_letter_spacing.is_finite()
                    || !(-0.05..=0.2).contains(&s.text_letter_spacing)
                    || !s.text_rotation.is_finite()
                    || !(-180.0..=180.0).contains(&s.text_rotation)
                    || !s.text_opacity.is_finite()
                    || !(0.0..=100.0).contains(&s.text_opacity)
                    || !s.text_subtitle_scale.is_finite()
                    || !(0.2..=1.0).contains(&s.text_subtitle_scale)
                    || !media_ok
                    || !poster_ok
                    || !kind_ok
                    || !elements_ok
                    || !motion_ok
                    || !framing_ok
                    || !mask_ok
                {
                    return Err("Invalid scene, image, or duration.".into());
                }
                s.normalize_text_layers(&timebase)?;
                s.normalize_transition(&timebase)?;
                bytes += s.image.len() + s.elements.iter().map(|e| e.source.as_ref().map_or(0, String::len)).sum::<usize>();
            }
        }
        let base_count = tracks
            .iter()
            .filter(|track| track.kind == "visual" && track.role.as_deref() != Some("overlay"))
            .count();
        let overlay_count = tracks
            .iter()
            .filter(|track| track.kind == "visual" && track.role.as_deref() == Some("overlay"))
            .count();
        if base_count != 1 || overlay_count > 1 {
            return Err("A project needs one base visual track and at most one picture-in-picture track.".into());
        }
        let _ = visual_count;
        if bytes > 140_000_000 {
            return Err("Project exceeds the 100 MB media budget.".into());
        }
        let total_ticks = tracks
            .iter()
            .filter(|track| track.kind == "visual" && track.role.as_deref() != Some("overlay"))
            .flat_map(|track| track.clips.iter())
            .map(|clip| clip.start_ticks + clip.duration_ticks)
            .max()
            .unwrap_or(0);
        if let Some(overlay) = tracks.iter().find(|track| track.kind == "visual" && track.role.as_deref() == Some("overlay")) {
            if overlay.clips.len() > 50 {
                return Err("A picture-in-picture track supports up to 50 clips.".into());
            }
            let mut ordered: Vec<&Scene> = overlay.clips.iter().collect();
            ordered.sort_by_key(|clip| clip.start_ticks);
            let mut end = 0;
            for clip in ordered {
                if clip.start_ticks < end {
                    return Err("Picture-in-picture clips cannot overlap on the same track.".into());
                }
                if total_ticks == 0 || clip.start_ticks >= total_ticks || clip.start_ticks + clip.duration_ticks > total_ticks {
                    return Err("A picture-in-picture clip extends beyond the timeline.".into());
                }
                end = clip.start_ticks + clip.duration_ticks;
            }
        }
        if !validate_elements(&mut self.overlays, total_ticks, 64, &timebase) { return Err("Invalid project overlay or action.".into()); }
        self.normalize_global_text(total_ticks, &timebase)?;
        bytes += self.overlays.iter().map(|e| e.source.as_ref().map_or(0, String::len)).sum::<usize>();
        if bytes > 140_000_000 { return Err("Project exceeds the 100 MB media budget.".into()); }
        let mut audio = if migrating_music {
            if let Some(music) = &self.legacy_music {
                let total_seconds = timebase.ticks_to_seconds(total_ticks);
                let source_duration = if music.duration_seconds > 0.0 {
                    music.duration_seconds
                } else {
                    total_seconds
                };
                let duration_seconds = total_seconds.min(source_duration);
                let duration_ticks = ((duration_seconds / timebase.seconds_per_tick()).round() as u64)
                    .max(1)
                    .min(total_ticks.max(1));
                vec![AudioClip {
                    id: music.id.clone(),
                    name: music.name.clone(),
                    data: music.data.clone(),
                    lane: 0,
                    start_ticks: 0,
                    duration_ticks,
                    source_in_seconds: 0.0,
                    source_duration_seconds: source_duration.max(duration_seconds),
                    volume: music.volume,
                    fade_in: music.fade_in,
                    fade_out: music.fade_out, low: 0.0, mid: 0.0, high: 0.0,
                }]
            } else {
                vec![]
            }
        } else {
            std::mem::take(&mut self.audio)
        };
        self.legacy_music = None;
        if audio.len() > 256 {
            return Err("A project supports up to 256 audio clips in this build.".into());
        }
        let mut audio_ids = std::collections::HashSet::new();
        let mut audio_bytes = 0usize;
        for clip in &mut audio {
            let duration = timebase.ticks_to_seconds(clip.duration_ticks);
            if clip.id.is_empty() || !audio_ids.insert(clip.id.clone()) {
                return Err("Invalid or duplicate audio ID.".into());
            }
            if clip.name.is_empty() || clip.name.chars().count() > 120 {
                return Err("Invalid audio name.".into());
            }
            if clip.lane > 7 {
                return Err("A project supports up to 8 audio tracks.".into());
            }
            if clip.duration_ticks == 0 || clip.start_ticks + clip.duration_ticks > total_ticks {
                return Err("An audio clip extends beyond the project.".into());
            }
            if !clip.source_in_seconds.is_finite()
                || !(0.0..=600.0).contains(&clip.source_in_seconds)
                || !clip.source_duration_seconds.is_finite()
                || !(0.0..=600.0).contains(&clip.source_duration_seconds)
                || clip.source_in_seconds + duration > clip.source_duration_seconds + 0.05
            {
                return Err("Invalid audio trim.".into());
            }
            if !clip.volume.is_finite()
                || !(0.0..=1.0).contains(&clip.volume)
                || !clip.fade_in.is_finite()
                || !(0.0..=30.0).contains(&clip.fade_in)
                || !clip.fade_out.is_finite()
                || !(0.0..=30.0).contains(&clip.fade_out)
                || !clip.low.is_finite()
                || !(-12.0..=12.0).contains(&clip.low)
                || !clip.mid.is_finite()
                || !(-12.0..=12.0).contains(&clip.mid)
                || !clip.high.is_finite()
                || !(-12.0..=12.0).contains(&clip.high)
            {
                return Err("Invalid audio level.".into());
            }
            if clip.data.len() > 70_000_000
                || (!is_audio_data(&clip.data) && !is_asset_ref(&clip.data))
            {
                return Err("Invalid audio data or an audio clip exceeds the 50 MB budget.".into());
            }
            audio_bytes += clip.data.len();
        }
        if audio_bytes > 280_000_000 {
            return Err("Audio exceeds the 200 MB project budget.".into());
        }
        self.audio = audio;
        if self.formats.is_empty() {
            self.formats.push(FormatVariant::original(&self.aspect));
        }
        if self.formats.len() > 24 {
            return Err("A project supports up to 24 output formats.".into());
        }
        let mut format_ids = std::collections::HashSet::new();
        for format in &mut self.formats {
            if format.id.is_empty() || !format_ids.insert(format.id.clone()) {
                return Err("Invalid or duplicate output format ID.".into());
            }
            if format.name.is_empty() || format.name.chars().count() > 80 || format.platform.is_empty() || format.platform.chars().count() > 80 {
                return Err("Invalid output format name.".into());
            }
            if format.aspect.is_empty() || format.aspect.chars().count() > 20
                || format.width < 160 || format.height < 160 || format.width > 3840 || format.height > 3840
                || format.width % 2 != 0 || format.height % 2 != 0
                || !(15..=60).contains(&format.fps)
                || !["draft", "standard", "high"].contains(&format.quality.as_str())
            {
                return Err("Invalid output format settings.".into());
            }
            format.overrides.retain(|scene_id, _| clip_ids.contains(scene_id));
            for override_value in format.overrides.values() {
                if override_value.image_x.is_some_and(|value| !value.is_finite() || !(-1.0..=1.0).contains(&value))
                    || override_value.image_y.is_some_and(|value| !value.is_finite() || !(-1.0..=1.0).contains(&value))
                    || override_value.image_zoom.is_some_and(|value| !value.is_finite() || !(1.0..=4.0).contains(&value))
                    || override_value.fit.as_ref().is_some_and(|value| !["cover", "contain", "blur"].contains(&value.as_str()))
                    || override_value.framing_background.as_ref().is_some_and(|value| !is_hex_color(value))
                {
                    return Err("Invalid output format override.".into());
                }
            }
        }
        self.tracks = tracks;
        if self.fonts.len() > 8 {
            return Err("A project supports up to 8 imported fonts.".into());
        }
        let mut font_ids = std::collections::HashSet::new();
        let mut font_bytes = 0usize;
        for font in &self.fonts {
            if font.id.is_empty() || !font_ids.insert(font.id.clone()) {
                return Err("Invalid imported font ID.".into());
            }
            let name = font.name.trim();
            if name.is_empty() || name.chars().count() > 60 {
                return Err("Invalid imported font name.".into());
            }
            let known = ["data:font/ttf;base64,", "data:font/otf;base64,", "data:font/woff;base64,", "data:font/woff2;base64,"]
                .iter()
                .any(|prefix| font.data.starts_with(prefix));
            if !known || font.data.len() > 3_000_000 {
                return Err("Invalid imported font data.".into());
            }
            font_bytes += font.data.len();
        }
        if font_bytes > 12_000_000 {
            return Err("Imported fonts exceed the 9 MB budget.".into());
        }
        if self.ducking.is_some_and(|amount| !amount.is_finite() || !(0.0..=100.0).contains(&amount)) {
            return Err("Invalid music ducking amount.".into());
        }
        if let Some(mix) = &self.audio_mix {
            if !mix.video.is_finite() || !(0.0..=1.0).contains(&mix.video) || mix.lanes.len() > 8 {
                return Err("Invalid audio mix.".into());
            }
            let mut lanes = std::collections::HashSet::new();
            for lane in &mix.lanes {
                if lane.lane > 7
                    || !lanes.insert(lane.lane)
                    || !lane.volume.is_finite()
                    || !(0.0..=1.0).contains(&lane.volume)
                {
                    return Err("Invalid audio track level.".into());
                }
            }
        }
        let total_beats = self.total_ticks();
        self.beat_ticks.sort_unstable();
        self.beat_ticks.dedup();
        if self.beat_ticks.len() > 500
            || self.beat_ticks.iter().any(|tick| *tick > total_beats)
            || self.beat_ticks.windows(2).any(|pair| pair[0] >= pair[1])
        {
            return Err("Invalid beat markers.".into());
        }
        self.policy = Policy::default();
        Ok(())
    }
}
pub fn normalize_starts(clips: &mut [Scene]) {
    let mut cursor = 0u64;
    for clip in clips {
        clip.start_ticks = cursor;
        cursor += clip.duration_ticks;
    }
}
fn split_elements(elements: &[ElementLayer], at_ticks: u64) -> (Vec<ElementLayer>, Vec<ElementLayer>) {
    let mut left = Vec::new();
    let mut right = Vec::new();
    for element in elements {
        let end = element.start_ticks + element.duration_ticks;
        if element.start_ticks < at_ticks {
            let mut copy = element.clone();
            copy.duration_ticks = (at_ticks - element.start_ticks).min(element.duration_ticks).max(1);
            left.push(copy);
        }
        if end > at_ticks {
            let mut copy = element.clone();
            copy.start_ticks = element.start_ticks.saturating_sub(at_ticks);
            copy.duration_ticks = (end - element.start_ticks.max(at_ticks)).max(1);
            right.push(copy);
        }
    }
    (left, right)
}

fn split_text_layers(layers: &[TextLayer], at: u64) -> (Vec<TextLayer>, Vec<TextLayer>) {
    let left = layers
        .iter()
        .filter(|layer| layer.start_ticks < at)
        .map(|layer| {
            let mut copy = (*layer).clone();
            copy.duration_ticks = copy.duration_ticks.min(at - copy.start_ticks).max(1);
            copy
        })
        .collect();
    let right = layers
        .iter()
        .filter(|layer| layer.start_ticks + layer.duration_ticks > at)
        .map(|layer| {
            let mut copy = (*layer).clone();
            let end = copy.start_ticks + copy.duration_ticks;
            copy.start_ticks = copy.start_ticks.saturating_sub(at);
            copy.duration_ticks = (end - at).max(1);
            copy
        })
        .collect();
    (left, right)
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateItem {
    pub id: String,
    pub new_id: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
// Boxing the payloads would change the serialized command shape.
#[allow(clippy::large_enum_variant)]
pub enum Command {
    Replace { project: Project },
    Rename { name: String },
    Aspect { aspect: String },
    Audio { audio: Vec<AudioClip> },
    AudioMix { mix: AudioMix },
    Formats { formats: Vec<FormatVariant> },
    Fonts { fonts: Vec<ProjectFont> },
    #[serde(rename = "globalText")]
    GlobalText {
        #[serde(rename = "layers")]
        global_text: Vec<TextLayer>,
    },
    Beats {
        #[serde(rename = "beatTicks")]
        beat_ticks: Vec<u64>,
    },
    Ducking { amount: f64 },
    Overlays { overlays: Vec<ElementLayer> },
    Add { scenes: Vec<Scene> },
    Update { scene: Scene },
    Remove { id: String },
    Move { id: String, offset: i32 },
    Duplicate {
        id: String,
        #[serde(rename = "newId")]
        new_id: String,
    },
    Split {
        id: String,
        #[serde(rename = "atTicks")]
        at_ticks: u64,
        #[serde(rename = "newId")]
        new_id: String,
    },
    UpdateMany { scenes: Vec<Scene> },
    RemoveMany { ids: Vec<String> },
    DuplicateMany { items: Vec<DuplicateItem> },
    /// Replaces the picture-in-picture track; an empty list removes it.
    Pip { scenes: Vec<Scene> },
    /// Stack position only, so a button press never ships media with it.
    Order {
        kind: String,
        #[serde(rename = "sceneId")]
        scene_id: Option<String>,
        id: String,
        z: f64,
    },
    Undo,
    Redo,
}
#[derive(Clone, Default)]
pub struct Session {
    pub project: Project,
    pub past: Vec<Project>,
    pub future: Vec<Project>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct History {
    pub can_undo: bool,
    pub can_redo: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct View {
    pub project: Project,
    pub can_undo: bool,
    pub can_redo: bool,
}
/// Undo depth is capped by count and by the media those snapshots keep alive,
/// so a long story with large photos cannot pin gigabytes in memory while the
/// editor nudges a layer up and down.
const MAX_HISTORY: usize = 30;
const MAX_HISTORY_MEDIA_BYTES: usize = 160_000_000;

impl Session {
    fn remember(&mut self, previous: Project) {
        self.past.push(previous);
        while self.past.len() > 1
            && (self.past.len() > MAX_HISTORY
                || self.past.iter().map(Project::media_bytes).sum::<usize>() > MAX_HISTORY_MEDIA_BYTES)
        {
            self.past.remove(0);
        }
    }
    pub fn view(&self) -> View {
        View {
            project: self.project.clone(),
            can_undo: !self.past.is_empty(),
            can_redo: !self.future.is_empty(),
        }
    }
    pub fn apply(&mut self, command: Command) -> Result<(), String> {
        match command {
            Command::Undo => {
                if let Some(p) = self.past.pop() {
                    self.future.push(std::mem::replace(&mut self.project, p));
                }
                return Ok(());
            }
            Command::Redo => {
                if let Some(p) = self.future.pop() {
                    self.past.push(std::mem::replace(&mut self.project, p));
                }
                return Ok(());
            }
            _ => {}
        }
        if let Command::Order {
            kind,
            scene_id,
            id,
            z,
        } = &command
        {
            let mut next = self.project.clone();
            next.reorder(kind, scene_id.as_deref(), id, *z)?;
            next.validate()?;
            let previous = std::mem::replace(&mut self.project, next);
            self.remember(previous);
            self.future.clear();
            return Ok(());
        }
        if let Command::Replace { project } = command {
            let mut next = project;
            next.validate()?;
            let previous = std::mem::replace(&mut self.project, next);
            self.remember(previous);
            self.future.clear();
            return Ok(());
        }
        let mut p = self.project.clone();
        if let Command::Rename { name } = &command {
            p.name = name.clone();
        }
        if let Command::Aspect { aspect } = &command {
            p.aspect = aspect.clone();
        }
        if let Command::Audio { audio } = &command {
            p.audio = audio.clone();
        }
        if let Command::AudioMix { mix } = &command {
            let clean = mix.video == 1.0 && mix.lanes.iter().all(|lane| lane.volume == 1.0 && !lane.muted);
            p.audio_mix = (!clean).then(|| mix.clone());
        }
        if let Command::Overlays { overlays } = &command { p.overlays = overlays.clone(); }
        if let Command::Formats { formats } = &command {
            p.formats = formats.clone();
        }
        if let Command::Fonts { fonts } = &command {
            p.fonts = fonts.clone();
        }
        if let Command::GlobalText { global_text } = &command {
            p.global_text = global_text.clone();
        }
        if let Command::Pip { scenes } = &command {
            if let Some(track) = p.tracks.iter_mut().find(|track| track.kind == "visual" && track.role.as_deref() == Some("overlay")) {
                track.clips = scenes.clone();
            } else if !scenes.is_empty() {
                p.tracks.push(Track {
                    id: "visual-pip".into(),
                    kind: "visual".into(),
                    name: "Picture in picture".into(),
                    role: Some("overlay".into()),
                    clips: scenes.clone(),
                    hidden: false,
                    muted: false,
                    locked: false,
                });
            }
            if scenes.is_empty() {
                p.tracks.retain(|track| !(track.kind == "visual" && track.role.as_deref() == Some("overlay")));
            }
        }
        if let Command::Beats { beat_ticks } = &command {
            p.beat_ticks = beat_ticks.clone();
        }
        if let Command::Ducking { amount } = &command {
            p.ducking = (*amount > 0.0).then_some(*amount);
        }
        let track_index = p
            .tracks
            .iter()
            .position(|track| track.kind == "visual")
            .ok_or("This project has no visual track.")?;
        let timebase = p.timebase.clone();
        {
            let clips = &mut p.tracks[track_index].clips;
            match command {
                Command::Replace { .. } | Command::Rename { .. } | Command::Aspect { .. } | Command::Audio { .. } | Command::AudioMix { .. } | Command::Formats { .. } | Command::Fonts { .. } | Command::GlobalText { .. } | Command::Pip { .. } | Command::Beats { .. } | Command::Ducking { .. } | Command::Overlays { .. } | Command::Order { .. } => {}
                Command::Add { scenes } => clips.extend(scenes),
                Command::Update { scene } => {
                    if let Some(s) = clips.iter_mut().find(|s| s.id == scene.id) {
                        *s = scene;
                    }
                }
                Command::Remove { id } => clips.retain(|s| s.id != id),
                Command::Move { id, offset } => {
                    if let Some(i) = clips.iter().position(|s| s.id == id) {
                        let target = i as i64 + offset as i64;
                        if target >= 0 && (target as usize) < clips.len() {
                            let scene = clips.remove(i);
                            clips.insert(target as usize, scene);
                        }
                    }
                }
                Command::Duplicate { id, new_id } => {
                    let Some(i) = clips.iter().position(|s| s.id == id) else {
                        return Err("Select a scene to duplicate.".into());
                    };
                    if clips.iter().any(|s| s.id == new_id) {
                        return Err("A scene with this ID already exists.".into());
                    }
                    let mut copy = clips[i].clone();
                    copy.id = new_id;
                    copy.name = format!("{} copy", copy.name);
                    clips.insert(i + 1, copy);
                }
                Command::Split { id, at_ticks, new_id } => {
                    let Some(i) = clips.iter().position(|s| s.id == id) else {
                        return Err("Select a scene to split.".into());
                    };
                    let scene = clips[i].clone();
                    let minimum = timebase.min_ticks();
                    if at_ticks < minimum || scene.duration_ticks.saturating_sub(at_ticks) < minimum {
                        return Err(
                            "Move the playhead at least half a second inside the clip to split it."
                                .into(),
                        );
                    }
                    if clips.iter().any(|s| s.id == new_id) {
                        return Err("A scene with this ID already exists.".into());
                    }
                    let remaining_ticks = scene.duration_ticks - at_ticks;
                    let left_seconds = timebase.ticks_to_seconds(at_ticks);
                    let right_seconds = timebase.ticks_to_seconds(remaining_ticks);
                    let (left_layers, right_layers) = split_text_layers(&scene.text_layers, at_ticks);
                    let (left_elements, right_elements) = split_elements(&scene.elements, at_ticks);
                    let mut left = scene.clone();
                    left.duration_ticks = at_ticks;
                    left.legacy_duration = None;
                    left.fade_in = left.fade_in.min(left_seconds);
                    left.fade_out = 0.0;
                    left.text_layers = left_layers;
                    left.elements = left_elements;
                    left.title = left.text_layers.first().map(|layer| layer.title.clone()).unwrap_or_default();
                    left.subtitle = left.text_layers.first().map(|layer| layer.subtitle.clone()).unwrap_or_default();
                    let mut right = scene;
                    right.id = new_id;
                    right.start_ticks = 0;
                    right.source_in_ticks += at_ticks;
                    right.duration_ticks = remaining_ticks;
                    right.legacy_duration = None;
                    right.fade_in = 0.0;
                    right.fade_out = right.fade_out.min(right_seconds);
                    right.text_layers = right_layers;
                    right.elements = right_elements;
                    right.title = right.text_layers.first().map(|layer| layer.title.clone()).unwrap_or_default();
                    right.subtitle = right.text_layers.first().map(|layer| layer.subtitle.clone()).unwrap_or_default();
                    clips.splice(i..=i, [left, right]);
                }
                Command::UpdateMany { scenes } => {
                    for scene in scenes {
                        if let Some(existing) = clips.iter_mut().find(|s| s.id == scene.id) {
                            *existing = scene;
                        }
                    }
                }
                Command::RemoveMany { ids } => {
                    let removed: std::collections::HashSet<String> = ids.into_iter().collect();
                    clips.retain(|scene| !removed.contains(&scene.id));
                }
                Command::DuplicateMany { items } => {
                    let existing: std::collections::HashSet<String> =
                        clips.iter().map(|scene| scene.id.clone()).collect();
                    let mut new_ids = std::collections::HashSet::new();
                    let mut by_id = std::collections::HashMap::new();
                    for item in &items {
                        if !existing.contains(&item.id) {
                            return Err("Select a scene to duplicate.".into());
                        }
                        if existing.contains(&item.new_id) || !new_ids.insert(item.new_id.clone())
                        {
                            return Err("A scene with this ID already exists.".into());
                        }
                        if by_id.insert(item.id.clone(), item.new_id.clone()).is_some() {
                            return Err("A scene can only be duplicated once at a time.".into());
                        }
                    }
                    let mut next = Vec::with_capacity(clips.len() + items.len());
                    for scene in &*clips {
                        next.push(scene.clone());
                        if let Some(new_id) = by_id.get(&scene.id) {
                            let mut copy = scene.clone();
                            copy.id = new_id.clone();
                            copy.name = format!("{} copy", copy.name);
                            next.push(copy);
                        }
                    }
                    *clips = next;
                }
                Command::Undo | Command::Redo => unreachable!(),
            }
            normalize_starts(clips);
        }
        let total_ticks = p
            .visual_clips()
            .iter()
            .map(|clip| clip.start_ticks + clip.duration_ticks)
            .max()
            .unwrap_or(0);
        p.audio = std::mem::take(&mut p.audio)
            .into_iter()
            .filter_map(|mut clip| {
                if total_ticks == 0 || clip.start_ticks >= total_ticks {
                    return None;
                }
                clip.duration_ticks = clip.duration_ticks.min(total_ticks - clip.start_ticks);
                (clip.duration_ticks > 0).then_some(clip)
            })
            .collect();
        p.global_text.retain(|layer| total_ticks > 0 && layer.start_ticks < total_ticks);
        if let Some(track) = p.tracks.iter_mut().find(|track| track.kind == "visual" && track.role.as_deref() == Some("overlay")) {
            track.clips.retain(|clip| total_ticks > 0 && clip.start_ticks < total_ticks);
            for clip in &mut track.clips {
                clip.duration_ticks = clip.duration_ticks.min(total_ticks - clip.start_ticks).max(1);
            }
        }
        p.validate()?;
        let previous = std::mem::replace(&mut self.project, p);
        self.remember(previous);
        self.future.clear();
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn scene() -> Scene {
        Scene {
            media_kind: None,
            video_poster: None,
            elements: vec![],
            motion: None,
            motion_amount: None,
            video_volume: None,
            speed_end: None,
            reverse: false,
            pip: None,
            id: "one".into(),
            name: "Test".into(),
            image: "data:image/png;base64,AA==".into(),
            start_ticks: 0,
            source_in_ticks: 0,
            source_duration_seconds: None,
            duration_ticks: 120,
            legacy_duration: None,
            title: "Hello".into(),
            subtitle: "".into(),
            text_layers: vec![],
            transition: None,
            color: "#ffffff".into(),
            fit: "cover".into(),
            image_x: 0.0,
            image_y: 0.0,
            image_zoom: 1.0,
            framing_keyframes: Vec::new(),
            mask: None,
            curves: None,
            framing_background: "#000000".into(),
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            exposure: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            temperature: 0.0,
            tint: 0.0,
            hue: 0.0,
            vibrance: 0.0,
            shadow_tint_color: "#000000".into(),
            shadow_tint_amount: 0.0,
            highlight_tint_color: "#000000".into(),
            highlight_tint_amount: 0.0,
            filter: "none".into(),
            filter_intensity: 100.0,
            speed: 1.0,
            pitch: true,
            fade_in: 0.0,
            fade_out: 0.0,
            text_backdrop_enabled: false,
            text_backdrop_color: "#000000".into(),
            text_backdrop_opacity: 45.0,
            text_backdrop_blur: 18.0,
            text_backdrop_padding: 24.0,
            text_backdrop_radius: 16.0,
            text_backdrop_noise: 8.0,
            text_stroke_color: "#000000".into(),
            text_outline_enabled: false,
            text_stroke_width: 0.0,
            text_shadow_color: "#000000".into(),
            text_shadow_enabled: false,
            text_shadow_intensity: 60.0,
            text_shadow_blur: 0.0,
            text_shadow_offset_x: 0.0,
            text_shadow_offset_y: 0.0,
            text_glow_enabled: false,
            text_glow_color: "#FFFFFF".into(),
            text_glow_blur: 24.0,
            text_glow_intensity: 55.0,
            text_x: 0.09,
            text_y: 0.78,
            text_width: 0.82,
            text_align: "left".into(),
            text_font: "inter".into(),
            text_font_weight: 600.0,
            text_font_style: "normal".into(),
            text_size: 0.068,
            text_line_height: 1.2,
            text_letter_spacing: 0.0,
            text_rotation: 0.0,
            text_opacity: 100.0,
            text_subtitle_scale: 0.4,
        }
    }
    #[test]
    fn changes_are_undoable_and_new_edits_clear_redo() {
        let mut s = Session::default();
        s.apply(Command::Add {
            scenes: vec![scene()],
        })
        .unwrap();
        s.apply(Command::Undo).unwrap();
        assert!(s.project.visual_clips().is_empty());
        s.apply(Command::Redo).unwrap();
        assert_eq!(s.project.visual_clips().len(), 1);
        s.apply(Command::Undo).unwrap();
        s.apply(Command::Rename { name: "New".into() }).unwrap();
        assert!(s.future.is_empty());
    }
    #[test]
    fn invalid_edit_leaves_project_untouched() {
        let mut s = Session::default();
        let original = s.project.clone();
        let mut bad = scene();
        bad.duration_ticks = 0;
        assert!(s.apply(Command::Add { scenes: vec![bad] }).is_err());
        assert_eq!(s.project, original);
        assert!(s.past.is_empty());
    }
    #[test]
    fn imported_policy_cannot_enable_branding() {
        let mut p = Project::default();
        p.policy.watermark = true;
        p.policy.pixcut_outro = true;
        p.validate().unwrap();
        assert_eq!(p.policy, Policy::default());
    }
    #[test]
    fn validates_the_picture_in_picture_track() {
        let placement = PipStyle { x: 0.8, y: 0.78, width: 0.32, height: 0.32, radius: 0.06, shadow: 60.0 };
        let mut pip = scene();
        pip.id = "pip".into();
        pip.start_ticks = 30;
        pip.duration_ticks = 30;
        pip.pip = Some(placement.clone());

        let mut project = Project::default();
        project.tracks[0].clips = vec![scene()];
        project.tracks.push(Track {
            id: "visual-pip".into(),
            kind: "visual".into(),
            name: "Picture in picture".into(),
            role: Some("overlay".into()),
            clips: vec![pip.clone()],
            hidden: false,
            muted: false,
            locked: false,
        });
        project.validate().unwrap();
        // Overlay clips do not extend the timeline.
        assert_eq!(project.total_ticks(), 120);
        assert_eq!(project.visual_clips().len(), 1);
        assert_eq!(project.overlay_clips().len(), 1);

        let with_pip = |clips: Vec<Scene>| {
            let mut next = project.clone();
            next.tracks.iter_mut().find(|track| track.role.as_deref() == Some("overlay")).unwrap().clips = clips;
            next
        };
        let mut missing = pip.clone();
        missing.pip = None;
        assert!(with_pip(vec![missing]).validate().is_err(), "placement is required");
        let mut overlapping = pip.clone();
        overlapping.id = "pip-2".into();
        overlapping.start_ticks = 50;
        assert!(with_pip(vec![pip.clone(), overlapping]).validate().is_err(), "overlay clips cannot overlap");
        let mut beyond = pip.clone();
        beyond.start_ticks = 110;
        assert!(with_pip(vec![beyond]).validate().is_err(), "overlay clips stay inside the timeline");
        let mut bad_placement = pip.clone();
        bad_placement.pip = Some(PipStyle { width: 2.0, ..placement.clone() });
        assert!(with_pip(vec![bad_placement]).validate().is_err());

        let mut second_overlay = project.clone();
        second_overlay.tracks.push(Track {
            id: "visual-pip-2".into(),
            kind: "visual".into(),
            name: "Another".into(),
            role: Some("overlay".into()),
            clips: vec![],
            hidden: false,
            muted: false,
            locked: false,
        });
        assert!(second_overlay.validate().is_err(), "only one overlay track");

        let mut session = Session::default();
        session.apply(Command::Add { scenes: vec![scene()] }).unwrap();
        session.apply(Command::Pip { scenes: vec![pip] }).unwrap();
        assert_eq!(session.project.overlay_clips().len(), 1);
        session.apply(Command::Pip { scenes: vec![] }).unwrap();
        assert!(session.project.overlay_clips().is_empty());
    }

    #[test]
    fn validates_project_level_text() {
        let mut p = Project::default();
        p.tracks[0].clips = vec![scene()];
        let total = p.total_ticks();
        p.global_text = vec![TextLayer { id: "global".into(), title: "Across".into(), start_ticks: 0, duration_ticks: total + 100, ..TextLayer::default() }];
        p.validate().unwrap();
        assert_eq!(p.global_text[0].duration_ticks, total, "project text is clamped to the timeline");
        p.global_text[0].start_ticks = total + 50;
        p.global_text[0].duration_ticks = 10;
        p.validate().unwrap();
        assert_eq!(p.global_text[0].start_ticks, total - 1);
        assert_eq!(p.global_text[0].duration_ticks, 1);

        let mut duplicate = p.clone();
        let layer = TextLayer { id: "same".into(), title: "One".into(), start_ticks: 0, duration_ticks: total, ..TextLayer::default() };
        duplicate.global_text = vec![layer.clone(), layer];
        assert!(duplicate.validate().is_err());

        let mut too_many = p.clone();
        too_many.global_text = (0..41).map(|index| TextLayer { id: format!("t{index}"), title: "Many".into(), start_ticks: 0, duration_ticks: total, ..TextLayer::default() }).collect();
        assert!(too_many.validate().is_err());

        let mut session = Session::default();
        session.apply(Command::Add { scenes: vec![scene()] }).unwrap();
        session.apply(Command::GlobalText {
            global_text: vec![TextLayer { id: "g".into(), title: "Hi".into(), start_ticks: 0, duration_ticks: total, ..TextLayer::default() }],
        }).unwrap();
        assert_eq!(session.project.global_text[0].title, "Hi");
        session.apply(Command::Remove { id: "one".into() }).unwrap();
        assert!(session.project.global_text.is_empty(), "removing the last scene clears project text");
    }

    #[test]
    fn audio_must_be_local_and_bounded() {
        let mut p = Project::default();
        p.tracks[0].clips.push(scene());
        p.audio = vec![AudioClip {
            id: "audio".into(),
            name: "Track.mp3".into(),
            data: "data:audio/mpeg;base64,AA==".into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 120,
            source_in_seconds: 0.0,
            source_duration_seconds: 30.0,
            volume: 0.8,
            fade_in: 1.0,
            fade_out: 1.0, low: 0.0, mid: 0.0, high: 0.0,
        }];
        p.validate().unwrap();
        let mut bad_volume = p.clone();
        bad_volume.audio[0].volume = 2.0;
        assert!(bad_volume.validate().is_err());
        let mut bad_data = p.clone();
        bad_data.audio[0].data = "https://example.com/track.mp3".into();
        assert!(bad_data.validate().is_err());
        let mut bad_trim = p.clone();
        bad_trim.audio[0].source_in_seconds = 29.0;
        assert!(bad_trim.validate().is_err());
        let mut eq = p.clone();
        eq.audio[0].low = 12.0; eq.audio[0].mid = -12.0; eq.audio[0].high = 6.0;
        eq.validate().unwrap();
        for bad in [(13.0, 0.0, 0.0), (0.0, -13.0, 0.0), (0.0, 0.0, f64::NAN)] {
            let mut invalid = p.clone();
            invalid.audio[0].low = bad.0; invalid.audio[0].mid = bad.1; invalid.audio[0].high = bad.2;
            assert!(invalid.validate().is_err(), "{bad:?} should be rejected");
        }
        let mut s = Session::default();
        s.apply(Command::Add { scenes: vec![scene()] }).unwrap();
        s.apply(Command::Audio { audio: p.audio.clone() }).unwrap();
        assert_eq!(s.project.audio[0].name, "Track.mp3");
        s.apply(Command::Audio { audio: vec![] }).unwrap();
        assert!(s.project.audio.is_empty());
        s.apply(Command::Audio { audio: p.audio.clone() }).unwrap();
        s.apply(Command::Remove { id: "one".into() }).unwrap();
        assert!(s.project.audio.is_empty());
    }
    #[test]
    fn validates_per_format_overrides() {
        let empty: SceneFormatOverride = serde_json::from_str(r#"{"imageX":null,"imageY":null,"imageZoom":null,"fit":null,"framingBackground":null}"#).unwrap();
        assert_eq!(serde_json::to_string(&empty).unwrap(), "{}");
        let mut s = Session::default();
        s.apply(Command::Add { scenes: vec![scene()] }).unwrap();
        let mut overrides = std::collections::HashMap::new();
        overrides.insert("one".into(), SceneFormatOverride { image_x: Some(-0.25), image_y: Some(0.1), image_zoom: Some(1.8), fit: Some("contain".into()), framing_background: Some("#112233".into()) });
        let formats = vec![
            FormatVariant { id: "yt".into(), name: "YouTube".into(), platform: "YouTube".into(), aspect: "16:9".into(), width: 1920, height: 1080, fps: 30, quality: "standard".into(), preset_id: Some("youtube-video".into()), overrides: Default::default() },
            FormatVariant { id: "reels".into(), name: "Reels".into(), platform: "Instagram".into(), aspect: "9:16".into(), width: 1080, height: 1920, fps: 30, quality: "standard".into(), preset_id: Some("instagram-reels".into()), overrides },
        ];
        s.apply(Command::Formats { formats }).unwrap();
        assert_eq!(s.project.formats.len(), 2);
        assert_eq!(s.project.formats[1].overrides["one"].image_zoom, Some(1.8));
        let mut bad_size = s.project.formats.clone();
        bad_size[0].width = 100;
        assert!(s.apply(Command::Formats { formats: bad_size }).is_err());
        let mut bad_override = s.project.formats.clone();
        bad_override[1].overrides.get_mut("one").unwrap().image_zoom = Some(9.0);
        assert!(s.apply(Command::Formats { formats: bad_override }).is_err());
    }
    #[test]
    fn validates_imported_fonts() {
        let font = |id: &str, data: &str| ProjectFont { id: id.into(), name: "Custom face".into(), data: data.into() };
        let mut p = Project::default();
        p.tracks[0].clips = vec![scene()];
        p.fonts = vec![font("f1", "data:font/ttf;base64,AA==")];
        p.validate().unwrap();
        p.fonts = vec![font("", "data:font/ttf;base64,AA==")];
        assert!(p.validate().is_err());
        p.fonts = vec![font("f1", "data:application/octet-stream;base64,AA==")];
        assert!(p.validate().is_err());
        p.fonts = vec![font("f1", "data:font/ttf;base64,AA=="), font("f1", "data:font/ttf;base64,AA==")];
        assert!(p.validate().is_err());
        p.fonts = (0..9).map(|index| font(&format!("f{index}"), "data:font/ttf;base64,AA==")).collect();
        assert!(p.validate().is_err());
    }

    #[test]
    fn beat_markers_are_sorted_bounded_and_deduplicated() {
        let mut s = Session::default();
        let mut long = scene();
        long.media_kind = Some("video".into());
        long.image = "data:video/mp4;base64,AA==".into();
        long.duration_ticks = 3_000;
        s.apply(Command::Add { scenes: vec![long] }).unwrap();
        s.apply(Command::Beats { beat_ticks: vec![60, 0, 30, 30] }).unwrap();
        assert_eq!(s.project.beat_ticks, vec![0, 30, 60]);
        assert!(s.apply(Command::Beats { beat_ticks: vec![9_999] }).is_err());
        let too_many: Vec<u64> = (0..501).collect();
        assert!(s.apply(Command::Beats { beat_ticks: too_many }).is_err());
    }

    #[test]
    fn validates_framing_keyframes() {
        let mut s = Session::default();
        let mut clip = scene();
        clip.framing_keyframes = vec![FramingKeyframe { at: 1.0, x: Some(-0.3), y: Some(0.2), zoom: Some(1.6) }];
        s.apply(Command::Add { scenes: vec![clip.clone()] }).unwrap();
        assert_eq!(s.project.visual_clips()[0].framing_keyframes.len(), 1);
        for bad in [
            vec![FramingKeyframe { at: 99.0, ..Default::default() }],
            vec![FramingKeyframe { at: 1.0, zoom: Some(9.0), ..Default::default() }],
            vec![FramingKeyframe { at: 1.0, x: Some(2.0), ..Default::default() }],
        ] {
            let mut next = clip.clone();
            next.framing_keyframes = bad;
            assert!(s.apply(Command::Update { scene: next }).is_err());
        }
    }

    #[test]
    fn validates_text_layer_keyframes() {
        let mut s = Session::default();
        let layer = |keyframes: Vec<Keyframe>| TextLayer {
            id: "layer-1".into(),
            title: "Hello".into(),
            start_ticks: 0,
            duration_ticks: 90,
            x: 0.2,
            y: 0.3,
            width: 0.7,
            size: 0.06,
            keyframes,
            ..Default::default()
        };
        let mut clip = scene();
        clip.duration_ticks = 90;
        clip.text_layers = vec![layer(vec![
            Keyframe { at: 1.0, x: Some(0.4), scale: Some(1.2), ..Default::default() },
            Keyframe { at: 2.0, opacity: Some(40.0), ..Default::default() },
        ])];
        s.apply(Command::Add { scenes: vec![clip.clone()] }).unwrap();
        assert_eq!(s.project.visual_clips()[0].text_layers[0].keyframes.len(), 2);

        for bad in [
            vec![Keyframe { at: 99.0, ..Default::default() }],
            vec![Keyframe { at: 1.0, scale: Some(9.0), ..Default::default() }],
            vec![Keyframe { at: f64::NAN, ..Default::default() }],
            (0..25).map(|index| Keyframe { at: index as f64 * 0.05, ..Default::default() }).collect(),
        ] {
            let mut next = clip.clone();
            next.text_layers = vec![layer(bad)];
            assert!(s.apply(Command::Update { scene: next }).is_err());
        }
    }

    #[test]
    fn video_clips_allow_longer_durations_and_a_clip_sound_level() {
        let mut session = Session::default();
        // 120 s at 30 fps: rejected for a photo, accepted for a video.
        let mut long = scene();
        long.duration_ticks = 3_600;
        assert!(session.apply(Command::Add { scenes: vec![long.clone()] }).is_err());
        long.media_kind = Some("video".into());
        long.image = "data:video/mp4;base64,AA==".into();
        session.apply(Command::Add { scenes: vec![long.clone()] }).unwrap();
        assert_eq!(session.project.visual_clips()[0].duration_ticks, 3_600);

        let mut quiet = long.clone();
        quiet.video_volume = Some(0.0);
        session.apply(Command::Update { scene: quiet }).unwrap();
        assert_eq!(session.project.visual_clips()[0].video_volume, Some(0.0));

        for invalid in [-1.0, 101.0, f64::NAN] {
            let mut bad = long.clone();
            bad.video_volume = Some(invalid);
            assert!(session.apply(Command::Update { scene: bad }).is_err());
        }

        let mut too_long = long;
        too_long.duration_ticks = 18_001;
        assert!(session.apply(Command::Update { scene: too_long }).is_err());
    }

    #[test]
    fn accepts_compact_output_formats_down_to_160_pixels() {
        let mut session = Session::default();
        session.apply(Command::Add { scenes: vec![scene()] }).unwrap();
        let format = |width: u32, height: u32| FormatVariant {
            id: "compact".into(),
            name: "Compact".into(),
            platform: "Sizes".into(),
            aspect: "16:9".into(),
            width,
            height,
            fps: 30,
            quality: "draft".into(),
            preset_id: Some("tiny-320".into()),
            overrides: Default::default(),
        };
        // The size ladder starts at 320×180, below the old 240 px floor.
        for (width, height) in [(320, 180), (480, 854), (640, 360), (160, 160)] {
            session
                .apply(Command::Formats { formats: vec![format(width, height)] })
                .unwrap_or_else(|error| panic!("{width}×{height} should be accepted: {error}"));
        }
        assert!(session
            .apply(Command::Formats { formats: vec![format(158, 160)] })
            .is_err());
        assert!(session
            .apply(Command::Formats { formats: vec![format(320, 181)] })
            .is_err());
    }

    #[test]
    fn accepts_twenty_four_deliverables_and_rejects_more() {
        let mut s = Session::default();
        s.apply(Command::Add { scenes: vec![scene()] }).unwrap();
        let format = |index: usize| FormatVariant {
            id: format!("format-{index}"),
            name: format!("Delivery {index}"),
            platform: "Custom".into(),
            aspect: "9:16".into(),
            width: 1080,
            height: 1920,
            fps: 30,
            quality: "standard".into(),
            preset_id: None,
            overrides: Default::default(),
        };
        let formats: Vec<FormatVariant> = (0..24).map(format).collect();
        s.apply(Command::Formats { formats }).unwrap();
        assert_eq!(s.project.formats.len(), 24);
        let too_many: Vec<FormatVariant> = (0..25).map(format).collect();
        assert!(s.apply(Command::Formats { formats: too_many }).is_err());
        assert_eq!(s.project.formats.len(), 24);
    }
    #[test]
    fn validates_transitions_and_text_animations() {
        let mut s = Session::default();
        s.apply(Command::Add { scenes: vec![scene()] }).unwrap();
        let mut clip = s.project.visual_clips()[0].clone();
        clip.transition = Some(Transition { kind: "fade".into(), duration: 0.6 });
        s.apply(Command::Update { scene: clip.clone() }).unwrap();
        assert_eq!(s.project.visual_clips()[0].transition.as_ref().unwrap().kind, "fade");
        clip.transition = Some(Transition { kind: "zoom".into(), duration: 8.0 });
        s.apply(Command::Update { scene: clip.clone() }).unwrap();
        assert_eq!(s.project.visual_clips()[0].transition.as_ref().unwrap().duration, 2.0);
        clip.transition = Some(Transition { kind: "bogus".into(), duration: 0.5 });
        assert!(s.apply(Command::Update { scene: clip }).is_err());
        let mut animated = s.project.visual_clips()[0].clone();
        animated.text_layers[0].animation = "slide-up".into();
        animated.text_layers[0].animation_duration = 1.2;
        s.apply(Command::Update { scene: animated.clone() }).unwrap();
        assert_eq!(s.project.visual_clips()[0].text_layers[0].animation, "slide-up");
        animated.text_layers[0].animation = "spin".into();
        assert!(s.apply(Command::Update { scene: animated }).is_err());
    }
    #[test]
    fn migrates_and_splits_independent_text_layers() {
        let mut s = Session::default();
        s.apply(Command::Add { scenes: vec![scene()] }).unwrap();
        let mut first = s.project.visual_clips()[0].clone();
        assert_eq!(first.text_layers.len(), 1);
        assert_eq!(first.text_layers[0].title, "Hello");
        let mut second = first.text_layers[0].clone();
        second.id = "layer-2".into();
        second.title = "Second".into();
        second.start_ticks = 30;
        second.duration_ticks = 60;
        second.x = 0.5;
        second.size = 0.1;
        first.text_layers.push(second.clone());
        s.apply(Command::Update { scene: first }).unwrap();
        assert_eq!(s.project.visual_clips()[0].text_layers.len(), 2);
        assert_eq!(s.project.visual_clips()[0].text_layers[1].title, "Second");
        s.apply(Command::Split { id: "one".into(), at_ticks: 60, new_id: "two".into() }).unwrap();
        assert_eq!(s.project.visual_clips()[0].text_layers[1].duration_ticks, 30);
        assert_eq!(s.project.visual_clips()[1].text_layers[1].start_ticks, 0);
        assert_eq!(s.project.visual_clips()[1].text_layers[1].duration_ticks, 30);
        let mut bad = s.project.visual_clips()[0].clone();
        bad.text_layers[0].size = 0.9;
        assert!(s.apply(Command::Update { scene: bad }).is_err());
    }
    #[test]
    fn migrates_legacy_music_to_an_audio_clip() {
        let mut p = Project::default();
        p.schema_version = 4;
        p.tracks[0].clips.push(scene());
        p.legacy_music = Some(MusicTrack {
            id: "music".into(),
            name: "Bed.mp3".into(),
            data: "data:audio/mpeg;base64,AA==".into(),
            volume: 0.7,
            fade_in: 0.5,
            fade_out: 0.5,
            duration_seconds: 2.0,
        });
        p.validate().unwrap();
        assert_eq!(p.schema_version, 15);
        assert_eq!(p.audio.len(), 1);
        assert_eq!(p.audio[0].start_ticks, 0);
        assert_eq!(p.audio[0].duration_ticks, 60);
        assert_eq!(p.audio[0].source_duration_seconds, 2.0);
        let serialized = serde_json::to_value(&p).unwrap();
        assert!(serialized.get("music").is_none());
        assert_eq!(serialized["audio"][0]["name"], "Bed.mp3");
    }
    #[test]
    fn independent_overlays_span_scenes_and_preserve_actions_in_v11() {
        let mut p = Project::default();
        let mut second = scene(); second.id = "second".into();
        p.tracks[0].clips = vec![scene(), second];
        let overlay: ElementLayer = serde_json::from_value(serde_json::json!({"id":"global-bell","kind":"bell","x":0.5,"y":0.5,"width":0.2,"height":0.2,"rotation":0,"color":"#FFCC66","opacity":100,"startTicks":15,"durationTicks":90,"animation":"fade","loop":false,"action":{"kind":"ring","startTicks":30,"durationTicks":30,"repeat":false,"sound":true}})).unwrap();
        p.schema_version = 10; p.overlays = vec![overlay]; p.validate().unwrap();
        assert_eq!(p.schema_version, 15); assert_eq!(p.overlays[0].duration_ticks, 90);
        let original = p.clone();
        let mut restored: Project = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap(); restored.validate().unwrap(); assert_eq!(original, restored);
        let mut session = Session { project: p, ..Default::default() };
        let mut layers = session.project.overlays.clone(); layers[0].start_ticks = 30;
        session.apply(Command::Overlays { overlays: layers }).unwrap();
        assert_eq!(session.project.overlays[0].start_ticks, 30);
        session.apply(Command::Undo).unwrap(); assert_eq!(session.project, original);
        session.apply(Command::RemoveMany { ids: session.project.tracks[0].clips.iter().map(|s| s.id.clone()).collect() }).unwrap();
        assert!(session.project.overlays.is_empty());
        session.apply(Command::Undo).unwrap(); assert_eq!(session.project, original);
        restored.overlays[0].action.as_mut().unwrap().kind = "unknown".into(); assert!(restored.validate().is_err());
    }
    #[test]
    fn modern_elements_migrate_and_preserve_editable_unicode_labels() {
        for kind in ["label", "name-tag", "link", "quote", "counter", "status"] {
            let mut project = Project::default(); project.schema_version = 11; project.tracks[0].clips = vec![scene()];
            project.overlays = vec![serde_json::from_value(serde_json::json!({"id":"modern","kind":kind,"x":0.5,"y":0.5,"width":0.4,"height":0.2,"rotation":0,"color":"#C5B4FF","opacity":100,"startTicks":0,"durationTicks":30,"label":"Za kulisami · 東京","animation":"fade"})).unwrap()];
            project.validate().unwrap(); assert_eq!(project.schema_version, 15);
            let mut restored: Project = serde_json::from_str(&serde_json::to_string(&project).unwrap()).unwrap(); restored.validate().unwrap(); assert_eq!(restored, project);
        }
    }
    #[test]
    fn dynamic_elements_migrate_round_trip_and_reject_invalid_settings() {
        for kind in ["caption", "chapter", "callout", "keycaps", "mouse", "device", "comparison", "checklist", "rating", "countdown", "waveform", "message", "qr", "end-screen"] {
            let mut p = Project::default(); p.schema_version = 12; p.tracks[0].clips = vec![scene()];
            p.overlays = vec![serde_json::from_value(serde_json::json!({"id":"dynamic","kind":kind,"x":0.5,"y":0.5,"width":0.4,"height":0.2,"rotation":0,"color":"#C5B4FF","opacity":100,"startTicks":0,"durationTicks":30,"label":"東京", "animation":"none", "exit":"fade", "behavior":{"atSeconds":1,"intervalSeconds":0.5,"countFrom":5,"countTo":0,"repeat":true,"variant":"click","audioId":"track"}})).unwrap()];
            p.validate().unwrap(); assert_eq!(p.schema_version, 15);
            let mut restored: Project = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap(); restored.validate().unwrap(); assert_eq!(p, restored);
            restored.overlays[0].behavior.as_mut().unwrap().interval_seconds = Some(0.0); assert!(restored.validate().is_err());
            restored = p.clone(); restored.overlays[0].behavior.as_mut().unwrap().variant = Some("unknown".into()); assert!(restored.validate().is_err());
            restored = p; restored.overlays[0].exit = Some("unknown".into()); assert!(restored.validate().is_err());
        }
    }
    #[test]
    fn designer_presets_migrate_round_trip_and_validate_identifiers() {
        for collection in ["creator", "lower-thirds", "captions", "chapters", "notifications", "tutorials", "timers", "audio", "screens", "travel", "food", "fitness", "shopping", "events", "reactions", "badges", "data", "callouts", "end-screens", "stories"] {
            for variant in 1..=10 {
                let id = format!("{collection}-{variant:02}");
                let mut p = Project::default(); p.schema_version = 13; p.tracks[0].clips = vec![scene()];
                p.overlays = vec![serde_json::from_value(serde_json::json!({"id":"preset","kind":"label","presetId":id,"x":0.5,"y":0.5,"width":0.4,"height":0.2,"rotation":0,"color":"#C5B4FF","opacity":100,"startTicks":0,"durationTicks":30,"label":"Twoja historia · 東京","animation":"none"})).unwrap()];
                p.validate().unwrap(); assert_eq!(p.schema_version, 15);
                let mut restored: Project = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap(); restored.validate().unwrap(); assert_eq!(restored, p);
                assert_eq!(restored.overlays[0].preset_id.as_deref(), Some(id.as_str()));
            }
        }
        for invalid in ["", "../unsafe", "UPPER CASE", &"a".repeat(81)] {
            let mut p = Project::default(); p.tracks[0].clips = vec![scene()];
            p.overlays = vec![serde_json::from_value(serde_json::json!({"id":"preset","kind":"label","presetId":invalid,"x":0.5,"y":0.5,"width":0.4,"height":0.2,"rotation":0,"color":"#C5B4FF","opacity":100,"startTicks":0,"durationTicks":30,"animation":"none"})).unwrap()];
            assert!(p.validate().is_err());
        }
    }
    #[test]
    fn validates_element_layers() {
        let mut p = Project::default();
        let mut clip = scene();
        clip.elements.push(ElementLayer {
            preset_id: None,
            mask: None,
            chroma: None,
            id: "element".into(),
            kind: "star".into(),
            behavior: None, exit: None, z: None, action: None, label: None, source: None, poster: None, source_in_seconds: None, source_duration_seconds: None, loop_animation: None, animation_duration: None,
            x: 0.5,
            y: 0.5,
            width: 0.3,
            height: 0.3,
            rotation: 0.0,
            color: "#9D7CFF".into(),
            opacity: 100.0,
            start_ticks: 0,
            duration_ticks: clip.duration_ticks,
            animation: "none".into(),
            keyframes: Vec::new(),
        });
        p.tracks[0].clips.push(clip);
        p.validate().unwrap();
        for animation in ["slide-down", "slide-left", "slide-right", "zoom-out", "bounce", "spin", "swing", "pulse", "float"] {
            p.schema_version = 7;
            p.tracks[0].clips[0].elements[0].animation = animation.into();
            p.validate().unwrap();
            assert_eq!(p.schema_version, 15);
            assert_eq!(p.tracks[0].clips[0].elements[0].animation, animation);
        }
        for kind in ["burst", "frame", "dots", "tape", "chevron"] {
            p.tracks[0].clips[0].elements[0].kind = kind.into();
            p.validate().unwrap();
            assert_eq!(p.tracks[0].clips[0].elements[0].kind, kind);
        }
        for (kind, source) in [("image", "data:image/png;base64,AA=="), ("video", "data:video/mp4;base64,AA==")] {
            let mut overlay = p.clone();
            let element = &mut overlay.tracks[0].clips[0].elements[0];
            element.kind = kind.into(); element.source = Some(source.into()); element.loop_animation = Some(true); element.animation_duration = Some(1.2);
            overlay.validate().unwrap();
            let mut restored: Project = serde_json::from_str(&serde_json::to_string(&overlay).unwrap()).unwrap(); restored.validate().unwrap();
            assert_eq!(restored, overlay);
            restored.tracks[0].clips[0].elements[0].source = Some("https://example.com/asset".into());
            assert!(restored.validate().is_err());
        }
        p.schema_version = 8;
        p.tracks[0].clips[0].elements[0].label = Some("登録する · اشترك · Subskrybuj".into());
        p.validate().unwrap();
        assert_eq!(p.schema_version, 15);
        let mut roundtrip: Project = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        roundtrip.validate().unwrap();
        assert_eq!(roundtrip.tracks[0].clips[0].elements[0].label, p.tracks[0].clips[0].elements[0].label);
        let mut invalid_label = p.clone();
        invalid_label.tracks[0].clips[0].elements[0].label = Some("x".repeat(81));
        assert!(invalid_label.validate().is_err());
        let mut invalid = p.clone();
        invalid.tracks[0].clips[0].elements[0].animation = "unknown".into();
        assert!(invalid.validate().is_err());
        p.tracks[0].clips[0].elements[0].animation = "none".into();
        p.tracks[0].clips[0].elements[0].kind = "bogus".into();
        assert!(p.validate().is_err());
    }

    #[test]
    fn accepts_video_scene_payloads_and_rejects_mismatched_kinds() {
        let mut p = Project::default();
        let mut clip = scene();
        clip.image = "data:video/mp4;base64,AAAA".into();
        clip.media_kind = Some("video".into());
        clip.video_poster = Some("data:image/jpeg;base64,AAAA".into());
        p.tracks[0].clips.push(clip.clone());
        p.validate().unwrap();
        clip.image = "data:image/png;base64,AAAA".into();
        p.tracks[0].clips[0] = clip;
        assert!(p.validate().is_err());
    }

    #[test]
    fn accepts_local_asset_references() {
        let mut p = Project::default();
        let mut clip = scene();
        clip.image = format!("pixcut-asset:{}", "a".repeat(64)).into();
        p.tracks[0].clips.push(clip);
        p.audio = vec![AudioClip {
            id: "audio".into(),
            name: "Track.wav".into(),
            data: format!("pixcut-asset:{}", "b".repeat(64)).into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 120,
            source_in_seconds: 0.0,
            source_duration_seconds: 10.0,
            volume: 0.8,
            fade_in: 0.0,
            fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0,
        }];
        p.validate().unwrap();
    }
    #[test]
    fn future_schema_is_rejected() {
        let mut p = Project::default();
        p.schema_version = 16;
        assert!(p.validate().is_err());
    }
    #[test]
    fn migrates_legacy_seconds_to_frame_ticks() {
        let mut p: Project = serde_json::from_value(serde_json::json!({
            "schema_version": 1,
            "id": "legacy",
            "name": "Legacy",
            "aspect": "16:9",
            "scenes": [{
                "id": "one",
                "name": "Photo",
                "image": "data:image/png;base64,AA==",
                "duration": 4.0,
                "title": "",
                "subtitle": "",
                "color": "#ffffff",
                "fit": "cover"
            }],
            "policy": { "watermark": false, "pixcut_outro": false, "privacy": "local" }
        }))
        .unwrap();
        p.validate().unwrap();
        assert_eq!(p.schema_version, 15);
        assert_eq!(p.timebase, Timebase::default());
        assert_eq!(p.tracks.len(), 1);
        assert_eq!(p.tracks[0].kind, "visual");
        assert_eq!(p.visual_clips()[0].duration_ticks, 120);
        assert_eq!(p.visual_clips()[0].start_ticks, 0);
        let serialized = serde_json::to_value(&p).unwrap();
        assert!(serialized.get("scenes").is_none());
        assert!(serialized["tracks"][0]["clips"][0].get("duration").is_none());
        assert_eq!(serialized["tracks"][0]["clips"][0]["durationTicks"], 120);
    }
    #[test]
    fn wraps_v2_scenes_into_a_visual_track() {
        let mut p: Project = serde_json::from_value(serde_json::json!({
            "schema_version": 2,
            "id": "v2",
            "name": "V2",
            "aspect": "16:9",
            "timebase": { "numerator": 1, "denominator": 30 },
            "scenes": [
                { "id": "one", "name": "Photo", "image": "data:image/png;base64,AA==", "durationTicks": 120, "title": "", "subtitle": "", "color": "#ffffff", "fit": "cover" },
                { "id": "two", "name": "Photo", "image": "data:image/png;base64,AA==", "durationTicks": 60, "title": "", "subtitle": "", "color": "#ffffff", "fit": "cover" }
            ],
            "policy": { "watermark": false, "pixcut_outro": false, "privacy": "local" }
        }))
        .unwrap();
        p.validate().unwrap();
        assert_eq!(p.schema_version, 15);
        assert_eq!(p.tracks.len(), 1);
        assert_eq!(p.tracks[0].kind, "visual");
        assert_eq!(p.visual_clips()[0].start_ticks, 0);
        assert_eq!(p.visual_clips()[1].start_ticks, 120);
    }
    #[test]
    fn move_recomputes_clip_starts() {
        let mut s = Session::default();
        s.apply(Command::Add {
            scenes: vec![scene()],
        })
        .unwrap();
        let mut second = scene();
        second.id = "two".into();
        second.duration_ticks = 60;
        s.apply(Command::Add { scenes: vec![second] }).unwrap();
        s.apply(Command::Move {
            id: "two".into(),
            offset: -1,
        })
        .unwrap();
        assert_eq!(s.project.visual_clips()[0].id, "two");
        assert_eq!(s.project.visual_clips()[0].start_ticks, 0);
        assert_eq!(s.project.visual_clips()[1].start_ticks, 60);
    }
    #[test]
    fn split_preserves_timing_and_is_undoable() {
        let mut s = Session::default();
        s.apply(Command::Add {
            scenes: vec![scene()],
        })
        .unwrap();
        s.apply(Command::Split {
            id: "one".into(),
            at_ticks: 45,
            new_id: "two".into(),
        })
        .unwrap();
        assert_eq!(s.project.visual_clips().len(), 2);
        assert_eq!(s.project.visual_clips()[0].duration_ticks, 45);
        assert_eq!(s.project.visual_clips()[1].duration_ticks, 75);
        assert_eq!(s.project.visual_clips()[0].start_ticks, 0);
        assert_eq!(s.project.visual_clips()[1].start_ticks, 45);
        assert_eq!(s.project.visual_clips()[0].fade_out, 0.0);
        assert_eq!(s.project.visual_clips()[1].fade_in, 0.0);
        s.apply(Command::Undo).unwrap();
        assert_eq!(s.project.visual_clips().len(), 1);
        assert_eq!(s.project.visual_clips()[0].duration_ticks, 120);
    }
    #[test]
    fn split_rejects_thin_edges_and_duplicate_ids() {
        let mut s = Session::default();
        s.apply(Command::Add {
            scenes: vec![scene()],
        })
        .unwrap();
        assert!(s
            .apply(Command::Split {
                id: "one".into(),
                at_ticks: 6,
                new_id: "two".into(),
            })
            .is_err());
        assert!(s
            .apply(Command::Split {
                id: "one".into(),
                at_ticks: 114,
                new_id: "two".into(),
            })
            .is_err());
        assert!(s
            .apply(Command::Split {
                id: "one".into(),
                at_ticks: 45,
                new_id: "one".into(),
            })
            .is_err());
        assert_eq!(s.project.visual_clips().len(), 1);
    }
    #[test]
    fn duplicate_inserts_a_copy_after_the_original() {
        let mut second = scene();
        second.id = "two".into();
        let mut s = Session::default();
        s.apply(Command::Add {
            scenes: vec![scene(), second],
        })
        .unwrap();
        s.apply(Command::Duplicate {
            id: "one".into(),
            new_id: "copy".into(),
        })
        .unwrap();
        assert_eq!(
            s.project.visual_clips().iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["one", "copy", "two"]
        );
        assert_eq!(s.project.visual_clips()[1].name, "Test copy");
    }
    #[test]
    fn batch_edits_are_atomic_and_undoable() {
        let mut second = scene();
        second.id = "two".into();
        let mut third = scene();
        third.id = "three".into();
        let mut s = Session::default();
        s.apply(Command::Add {
            scenes: vec![scene(), second, third],
        })
        .unwrap();
        let mut first = scene();
        first.title = "A".into();
        let mut last = scene();
        last.id = "three".into();
        last.title = "C".into();
        s.apply(Command::UpdateMany {
            scenes: vec![first, last],
        })
        .unwrap();
        assert_eq!(
            s.project.visual_clips().iter().map(|s| s.title.as_str()).collect::<Vec<_>>(),
            vec!["A", "Hello", "C"]
        );
        s.apply(Command::RemoveMany {
            ids: vec!["one".into(), "three".into()],
        })
        .unwrap();
        assert_eq!(s.project.visual_clips().len(), 1);
        assert_eq!(s.project.visual_clips()[0].id, "two");
        s.apply(Command::Undo).unwrap();
        assert_eq!(s.project.visual_clips().len(), 3);
        assert_eq!(
            s.project.visual_clips().iter().map(|s| s.title.as_str()).collect::<Vec<_>>(),
            vec!["A", "Hello", "C"]
        );
    }
    #[test]
    fn duplicate_many_inserts_all_copies_in_one_history_step() {
        let mut s = Session::default();
        s.apply(Command::Add {
            scenes: vec![scene()],
        })
        .unwrap();
        s.apply(Command::DuplicateMany {
            items: vec![DuplicateItem {
                id: "one".into(),
                new_id: "copy".into(),
            }],
        })
        .unwrap();
        assert_eq!(
            s.project.visual_clips().iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["one", "copy"]
        );
        assert_eq!(s.project.visual_clips()[1].name, "Test copy");
        s.apply(Command::Undo).unwrap();
        assert_eq!(s.project.visual_clips().len(), 1);
        assert!(s
            .apply(Command::DuplicateMany {
                items: vec![DuplicateItem {
                    id: "one".into(),
                    new_id: "one".into(),
                }],
            })
            .is_err());
        assert_eq!(s.project.visual_clips().len(), 1);
    }
    #[test]
    fn scene_controls_serialize_as_camel_case() {
        let value = serde_json::to_value(scene()).unwrap();
        for key in ["fadeIn", "fadeOut", "filterIntensity", "speed", "pitch", "textBackdropOpacity", "textStrokeWidth", "textShadowBlur", "textGlowBlur", "textShadowIntensity", "textOutlineEnabled"] {
            assert!(value.get(key).is_some(), "{key} should serialize");
        }
        assert!(value.get("fade_in").is_none());
    }
    #[test]
    fn legacy_snake_case_fades_still_load() {
        let legacy = serde_json::json!({
            "id": "one",
            "name": "Test",
            "image": "data:image/png;base64,AA==",
            "duration": 4.0,
            "title": "",
            "subtitle": "",
            "color": "#ffffff",
            "fit": "cover",
            "fade_in": 1.25,
            "fade_out": 0.5
        });
        let parsed: Scene = serde_json::from_value(legacy).unwrap();
        assert_eq!(parsed.fade_in, 1.25);
        assert_eq!(parsed.fade_out, 0.5);
        assert_eq!(parsed.filter, "none");
        assert_eq!(parsed.speed, 1.0);
    }
    #[test]
    fn shape_masks_round_trip_and_stay_on_media_layers() {
        let mut p = Project::default();
        let mut clip = scene();
        clip.elements.push(ElementLayer {
            preset_id: None,
            mask: Some(Mask {
                shape: "star".into(), x: 0.4, y: 0.6, width: 0.7, height: 0.7, rotation: 22.0, feather: 18.0, invert: true,
            }),
            chroma: None,
            keyframes: Vec::new(),
            id: "masked".into(),
            kind: "image".into(),
            behavior: None, exit: None, z: None, action: None, label: None,
            source: Some("data:image/png;base64,AA==".into()), poster: None,
            source_in_seconds: None, source_duration_seconds: None, loop_animation: None, animation_duration: None,
            x: 0.5, y: 0.5, width: 0.4, height: 0.4, rotation: 0.0,
            color: "#FFFFFF".into(), opacity: 100.0, start_ticks: 0, duration_ticks: 120, animation: "none".into(),
        });
        p.tracks[0].clips.push(clip);
        p.validate().unwrap();
        let mask = p.tracks[0].clips[0].elements[0].mask.as_ref().unwrap();
        assert_eq!(mask.shape, "star");
        assert_eq!((mask.x, mask.y, mask.feather, mask.invert), (0.4, 0.6, 18.0, true));

        let mut shape_invalid = p.clone();
        shape_invalid.tracks[0].clips[0].elements[0].kind = "star".into();
        shape_invalid.tracks[0].clips[0].elements[0].source = None;
        assert!(shape_invalid.validate().is_err());
        let mut feather_invalid = p.clone();
        feather_invalid.tracks[0].clips[0].elements[0].mask.as_mut().unwrap().feather = 101.0;
        assert!(feather_invalid.validate().is_err());
    }

    #[test]
    fn colour_balance_fields_round_trip_and_validate() {
        let mut p = Project::default();
        let mut clip = scene();
        clip.hue = 24.0;
        clip.vibrance = 18.0;
        clip.shadow_tint_color = "#203050".into();
        clip.shadow_tint_amount = 30.0;
        clip.highlight_tint_color = "#f0d0a0".into();
        clip.highlight_tint_amount = 45.0;
        p.tracks[0].clips.push(clip);
        p.validate().unwrap();
        let restored: Project = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        let clip = &restored.tracks[0].clips[0];
        assert_eq!((clip.hue, clip.vibrance, clip.shadow_tint_amount, clip.highlight_tint_amount), (24.0, 18.0, 30.0, 45.0));
        assert_eq!(clip.shadow_tint_color, "#203050");
        let mut invalid = p.clone();
        invalid.tracks[0].clips[0].hue = 200.0;
        assert!(invalid.validate().is_err());
        let mut invalid = p.clone();
        invalid.tracks[0].clips[0].shadow_tint_amount = -1.0;
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn chroma_keys_round_trip_and_reject_invalid_values() {
        let mut p = Project::default();
        let mut clip = scene();
        clip.elements.push(ElementLayer {
            preset_id: None, mask: None, chroma: Some(ChromaKey {
                color: "#12ab34".into(), similarity: 42.0, softness: 12.0, spill: 75.0,
            }),
            keyframes: Vec::new(), id: "keyed".into(), kind: "image".into(),
            behavior: None, exit: None, z: None, action: None, label: None,
            source: Some("data:image/png;base64,AA==".into()), poster: None,
            source_in_seconds: None, source_duration_seconds: None, loop_animation: None, animation_duration: None,
            x: 0.5, y: 0.5, width: 0.4, height: 0.4, rotation: 0.0,
            color: "#FFFFFF".into(), opacity: 100.0, start_ticks: 0, duration_ticks: 120, animation: "none".into(),
        });
        p.tracks[0].clips.push(clip);
        p.validate().unwrap();
        let chroma = p.tracks[0].clips[0].elements[0].chroma.as_ref().unwrap();
        assert_eq!((chroma.similarity, chroma.softness, chroma.spill), (42.0, 12.0, 75.0));
        let mut invalid = p.clone();
        invalid.tracks[0].clips[0].elements[0].chroma.as_mut().unwrap().similarity = 101.0;
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn tone_curves_round_trip_and_reject_invalid_points() {
        let mut p = Project::default();
        let mut clip = scene();
        clip.curves = Some(ToneCurves {
            master: Some(vec![[0.0, 0.0], [0.5, 0.7], [1.0, 1.0]]),
            red: Some(vec![[0.0, 0.02], [1.0, 0.98]]),
            green: None,
            blue: None,
        });
        p.tracks[0].clips.push(clip);
        p.validate().unwrap();
        let curves = p.tracks[0].clips[0].curves.as_ref().unwrap();
        assert_eq!(curves.master.as_ref().unwrap()[1], [0.5, 0.7]);
        let mut invalid = p.clone();
        invalid.tracks[0].clips[0].curves.as_mut().unwrap().red = Some(vec![[0.6, 0.2], [0.4, 0.8]]);
        assert!(invalid.validate().is_err());
        let mut invalid = p.clone();
        invalid.tracks[0].clips[0].curves.as_mut().unwrap().master = Some(vec![[0.0, 0.0]]);
        assert!(invalid.validate().is_err());
        let mut invalid = p.clone();
        invalid.tracks[0].clips[0].curves.as_mut().unwrap().green = Some(vec![[0.0, 1.2], [1.0, 1.0]]);
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn keeps_layer_stack_order_and_rejects_out_of_range_values() {
        let mut p = Project::default();
        let mut clip = scene();
        clip.elements.push(ElementLayer {
            preset_id: None,
            mask: None,
            chroma: None,
            keyframes: Vec::new(),
            id: "element".into(),
            kind: "star".into(),
            behavior: None, exit: None, z: Some(9_000.0), action: None, label: None, source: None, poster: None, source_in_seconds: None, source_duration_seconds: None, loop_animation: None, animation_duration: None,
            x: 0.5, y: 0.5, width: 0.3, height: 0.3, rotation: 0.0,
            color: "#9D7CFF".into(), opacity: 100.0, start_ticks: 0, duration_ticks: 120, animation: "none".into(),
        });
        clip.text_layers.push(TextLayer { id: "text".into(), title: "Caption".into(), z: Some(20.0), start_ticks: 0, duration_ticks: 120, ..TextLayer::default() });
        p.tracks[0].clips.push(clip);
        p.validate().unwrap();
        let serialized = serde_json::to_value(&p).unwrap();
        assert_eq!(serialized["tracks"][0]["clips"][0]["elements"][0]["z"], 9_000.0);
        assert_eq!(serialized["tracks"][0]["clips"][0]["textLayers"][0]["z"], 20.0);
        let mut restored: Project = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        restored.validate().unwrap();
        assert_eq!(restored, p);

        // Projects written before stacking existed simply omit the field.
        let mut legacy: Project = serde_json::from_value(serialized).unwrap();
        legacy.tracks[0].clips[0].elements[0].z = None;
        legacy.tracks[0].clips[0].text_layers[0].z = None;
        legacy.validate().unwrap();
        let plain = serde_json::to_value(&legacy).unwrap();
        assert!(plain["tracks"][0]["clips"][0]["elements"][0].get("z").is_none());
        assert!(plain["tracks"][0]["clips"][0]["textLayers"][0].get("z").is_none());

        let mut bad_element = p.clone();
        bad_element.tracks[0].clips[0].elements[0].z = Some(100_001.0);
        assert!(bad_element.validate().is_err());
        let mut not_finite = p.clone();
        not_finite.tracks[0].clips[0].elements[0].z = Some(f64::NAN);
        assert!(not_finite.validate().is_err());
        let mut bad_text = p.clone();
        bad_text.tracks[0].clips[0].text_layers[0].z = Some(-1.0);
        assert!(bad_text.validate().is_err());
    }

    #[test]
    fn keeps_undo_history_within_the_media_budget() {
        let mut session = Session::default();
        let mut project = Project::default();
        let mut clip = scene();
        // 8 MB of media per snapshot: 30 copies would pin 240 MB in memory.
        clip.image = format!("data:image/png;base64,{}", "A".repeat(8_000_000)).into();
        clip.elements.push(ElementLayer {
            preset_id: None,
            mask: None,
            chroma: None,
            keyframes: Vec::new(),
            id: "element".into(),
            kind: "star".into(),
            behavior: None, exit: None, z: None, action: None, label: None, source: None, poster: None, source_in_seconds: None, source_duration_seconds: None, loop_animation: None, animation_duration: None,
            x: 0.5, y: 0.5, width: 0.3, height: 0.3, rotation: 0.0,
            color: "#9D7CFF".into(), opacity: 100.0, start_ticks: 0, duration_ticks: 120, animation: "none".into(),
        });
        let scene_id = clip.id.clone();
        project.tracks[0].clips.push(clip);
        session.apply(Command::Replace { project }).unwrap();
        for step in 0..30 {
            session
                .apply(Command::Order {
                    kind: "element".into(),
                    scene_id: Some(scene_id.clone()),
                    id: "element".into(),
                    z: step as f64,
                })
                .unwrap();
        }
        let held: usize = session.past.iter().map(Project::media_bytes).sum();
        assert!(held <= 160_000_000, "history media stays bounded: {held}");
        assert!(
            session.past.len() < 30,
            "old snapshots are dropped: {}",
            session.past.len()
        );
        assert!(session.past.len() >= 1, "the last edit is still undoable");
        // Undo still walks back through the surviving snapshots.
        session.apply(Command::Undo).unwrap();
        assert_eq!(
            session.project.tracks[0].clips[0].elements[0].z,
            Some(28.0)
        );
    }

    #[test]
    fn order_command_moves_one_layer_and_keeps_undo_history() {
        let mut session = Session::default();
        let mut project = Project::default();
        let mut clip = scene();
        clip.elements.push(ElementLayer {
            preset_id: None,
            mask: None,
            chroma: None,
            keyframes: Vec::new(),
            id: "element".into(),
            kind: "star".into(),
            behavior: None, exit: None, z: None, action: None, label: None, source: None, poster: None, source_in_seconds: None, source_duration_seconds: None, loop_animation: None, animation_duration: None,
            x: 0.5, y: 0.5, width: 0.3, height: 0.3, rotation: 0.0,
            color: "#9D7CFF".into(), opacity: 100.0, start_ticks: 0, duration_ticks: 120, animation: "none".into(),
        });
        clip.text_layers.push(TextLayer { id: "text".into(), title: "Caption".into(), z: None, start_ticks: 0, duration_ticks: 120, ..TextLayer::default() });
        let scene_id = clip.id.clone();
        project.tracks[0].clips.push(clip);
        project.overlays.push(ElementLayer {
            preset_id: None,
            mask: None,
            chroma: None,
            keyframes: Vec::new(),
            id: "overlay".into(),
            kind: "rectangle".into(),
            behavior: None, exit: None, z: None, action: None, label: None, source: None, poster: None, source_in_seconds: None, source_duration_seconds: None, loop_animation: None, animation_duration: None,
            x: 0.5, y: 0.5, width: 0.4, height: 0.4, rotation: 0.0,
            color: "#112233".into(), opacity: 100.0, start_ticks: 0, duration_ticks: 120, animation: "none".into(),
        });
        session.apply(Command::Replace { project }).unwrap();
        let before = session.project.clone();

        // The command carries no media at all, only the new stack position.
        let order = Command::Order { kind: "text".into(), scene_id: Some(scene_id.clone()), id: "text".into(), z: 7_500.0 };
        let encoded = serde_json::to_string(&order).unwrap();
        assert!(encoded.len() < 120, "order command stays tiny: {encoded}");
        session.apply(order).unwrap();
        assert_eq!(
            session.project.tracks[0].clips[0].text_layers[0].z,
            Some(7_500.0)
        );
        assert_eq!(session.project.overlays[0].z, None);
        assert!(session.view().can_undo);

        session.apply(Command::Order { kind: "overlay".into(), scene_id: None, id: "overlay".into(), z: 12.5 }).unwrap();
        assert_eq!(session.project.overlays[0].z, Some(12.5));

        session.apply(Command::Undo).unwrap();
        assert_eq!(session.project.tracks[0].clips[0].text_layers[0].z, Some(7_500.0));
        session.apply(Command::Undo).unwrap();
        assert_eq!(session.project, before);

        for bad in [-1.0, 100_001.0, f64::INFINITY] {
            assert!(session
                .apply(Command::Order { kind: "overlay".into(), scene_id: None, id: "overlay".into(), z: bad })
                .is_err());
        }
        assert!(session
            .apply(Command::Order { kind: "text".into(), scene_id: Some(scene_id), id: "missing".into(), z: 10.0 })
            .is_err());
        assert!(session
            .apply(Command::Order { kind: "text".into(), scene_id: None, id: "text".into(), z: 10.0 })
            .is_err());
        assert!(session
            .apply(Command::Order { kind: "scene".into(), scene_id: None, id: "text".into(), z: 10.0 })
            .is_err());
    }

    #[test]
    fn validates_text_layout_controls() {
        let mut p = Project::default();
        let mut valid = scene();
        valid.text_x = 0.2;
        valid.text_y = 0.4;
        valid.text_width = 0.6;
        valid.text_align = "center".into();
        valid.text_font = "playfair".into();
        valid.text_font_weight = 700.0;
        valid.text_font_style = "italic".into();
        valid.text_size = 0.1;
        valid.text_line_height = 1.4;
        valid.text_letter_spacing = 0.01;
        valid.text_rotation = 12.0;
        valid.text_opacity = 80.0;
        valid.text_subtitle_scale = 0.5;
        p.tracks[0].clips.push(valid);
        p.validate().unwrap();
        let serialized = serde_json::to_value(&p).unwrap();
        assert_eq!(serialized["tracks"][0]["clips"][0]["textAlign"], "center");
        assert_eq!(serialized["tracks"][0]["clips"][0]["textFont"], "playfair");

        let mut bad = Project::default();
        let mut clip = scene();
        clip.text_x = 2.0;
        bad.tracks[0].clips.push(clip);
        assert!(bad.validate().is_err());

        let mut bad_align = Project::default();
        let mut clip = scene();
        clip.text_align = "justify".into();
        bad_align.tracks[0].clips.push(clip);
        assert!(bad_align.validate().is_err());
    }
    #[test]
    fn batch_command_tags_deserialize_from_camel_case() {
        let update: Command = serde_json::from_value(serde_json::json!({
            "type": "updateMany",
            "scenes": []
        }))
        .unwrap();
        assert!(matches!(update, Command::UpdateMany { .. }));
        let remove: Command = serde_json::from_value(serde_json::json!({
            "type": "removeMany",
            "ids": ["one"]
        }))
        .unwrap();
        assert!(matches!(remove, Command::RemoveMany { .. }));
        let duplicate: Command = serde_json::from_value(serde_json::json!({
            "type": "duplicateMany",
            "items": [{ "id": "one", "newId": "two" }]
        }))
        .unwrap();
        match duplicate {
            Command::DuplicateMany { items } => {
                assert_eq!(items.len(), 1);
                assert_eq!(items[0].id, "one");
                assert_eq!(items[0].new_id, "two");
            }
            _ => panic!("expected duplicateMany"),
        }
        let split: Command = serde_json::from_value(serde_json::json!({
            "type": "split",
            "id": "one",
            "atTicks": 45,
            "newId": "two"
        }))
        .unwrap();
        match split {
            Command::Split { id, at_ticks, new_id } => {
                assert_eq!(id, "one");
                assert_eq!(at_ticks, 45);
                assert_eq!(new_id, "two");
            }
            _ => panic!("expected split"),
        }
    }
    #[test]
    fn rejects_invalid_color_controls_speed_and_fades() {
        let mut s = Session::default();
        let mut bad_filter = scene();
        bad_filter.filter = "vintage".into();
        assert!(s.apply(Command::Add { scenes: vec![bad_filter] }).is_err());
        let mut bad_intensity = scene();
        bad_intensity.filter_intensity = 150.0;
        assert!(s.apply(Command::Add { scenes: vec![bad_intensity] }).is_err());
        let mut bad_exposure = scene();
        bad_exposure.exposure = 4.0;
        assert!(s.apply(Command::Add { scenes: vec![bad_exposure] }).is_err());
        let mut bad_speed = scene();
        bad_speed.speed = 0.1;
        assert!(s.apply(Command::Add { scenes: vec![bad_speed] }).is_err());
        let mut bad_fade = scene();
        bad_fade.fade_in = 5.0;
        assert!(s.apply(Command::Add { scenes: vec![bad_fade] }).is_err());
        let mut bad_backdrop = scene();
        bad_backdrop.text_backdrop_opacity = 101.0;
        assert!(s.apply(Command::Add { scenes: vec![bad_backdrop] }).is_err());
        let mut bad_stroke = scene();
        bad_stroke.text_stroke_color = "red".into();
        assert!(s.apply(Command::Add { scenes: vec![bad_stroke] }).is_err());
        let mut bad_shadow = scene();
        bad_shadow.text_shadow_offset_y = 41.0;
        assert!(s.apply(Command::Add { scenes: vec![bad_shadow] }).is_err());
        let mut bad_zoom = scene();
        bad_zoom.image_zoom = 9.0;
        assert!(s.apply(Command::Add { scenes: vec![bad_zoom] }).is_err());
        let mut bad_pan = scene();
        bad_pan.image_x = 2.0;
        assert!(s.apply(Command::Add { scenes: vec![bad_pan] }).is_err());
        let mut bad_letterbox = scene();
        bad_letterbox.framing_background = "black".into();
        assert!(s.apply(Command::Add { scenes: vec![bad_letterbox] }).is_err());
        let mut bad_glow_color = scene();
        bad_glow_color.text_glow_color = "white".into();
        assert!(s.apply(Command::Add { scenes: vec![bad_glow_color] }).is_err());
        let mut bad_glow_intensity = scene();
        bad_glow_intensity.text_glow_intensity = 101.0;
        assert!(s.apply(Command::Add { scenes: vec![bad_glow_intensity] }).is_err());
        assert!(s.project.visual_clips().is_empty());
    }
    #[test]
    fn split_clamps_fades_to_the_new_durations() {
        let mut fading = scene();
        fading.fade_in = 3.0;
        fading.fade_out = 3.5;
        let mut s = Session::default();
        s.apply(Command::Add { scenes: vec![fading] }).unwrap();
        s.apply(Command::Split {
            id: "one".into(),
            at_ticks: 60,
            new_id: "two".into(),
        })
        .unwrap();
        assert_eq!(s.project.visual_clips()[0].duration_ticks, 60);
        assert_eq!(s.project.visual_clips()[0].fade_in, 2.0);
        assert_eq!(s.project.visual_clips()[0].fade_out, 0.0);
        assert_eq!(s.project.visual_clips()[1].duration_ticks, 60);
        assert_eq!(s.project.visual_clips()[1].fade_in, 0.0);
        assert_eq!(s.project.visual_clips()[1].fade_out, 2.0);
    }
    #[test]
    fn audio_mix_levels_apply_and_clear() {
        let mut s = Session::default();
        s.apply(Command::AudioMix {
            mix: AudioMix {
                video: 0.5,
                lanes: vec![
                    AudioLaneMix { lane: 1, volume: 0.4, muted: false },
                    AudioLaneMix { lane: 3, volume: 1.0, muted: true },
                ],
            },
        })
        .unwrap();
        assert_eq!(s.project.video_audio_gain(), 0.5);
        assert_eq!(s.project.lane_gain(1), 0.4);
        assert_eq!(s.project.lane_gain(3), 0.0);
        assert_eq!(s.project.lane_gain(0), 1.0);
        s.apply(Command::AudioMix { mix: AudioMix::default() }).unwrap();
        assert!(s.project.audio_mix.is_none());
        assert_eq!(s.project.video_audio_gain(), 1.0);
    }
    #[test]
    fn rejects_invalid_audio_mix_levels() {
        for mix in [
            AudioMix { video: 1.5, lanes: vec![] },
            AudioMix { video: 1.0, lanes: vec![AudioLaneMix { lane: 8, volume: 1.0, muted: false }] },
            AudioMix { video: 1.0, lanes: vec![AudioLaneMix { lane: 0, volume: 1.0, muted: false }, AudioLaneMix { lane: 0, volume: 0.5, muted: false }] },
            AudioMix { video: 1.0, lanes: vec![AudioLaneMix { lane: 0, volume: 1.5, muted: false }] },
        ] {
            let mut p = Project::default();
            p.audio_mix = Some(mix);
            assert!(p.validate().is_err());
        }
    }
    #[test]
    fn audio_mix_defaults_on_v14_migration() {
        let mut p = Project::default();
        p.schema_version = 14;
        p.validate().unwrap();
        assert_eq!(p.schema_version, 15);
        assert!(p.audio_mix.is_none());
    }
}
