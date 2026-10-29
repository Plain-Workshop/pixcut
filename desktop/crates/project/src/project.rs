use super::*;

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
    /// Attribution line for tracks that need one (CC BY). Carried with the clip
    /// so the export credits stay correct after the file is renamed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit: Option<String>,
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
pub(crate) fn default_export_fps() -> u32 { 30 }
pub(crate) fn default_export_quality() -> String { "standard".into() }
impl FormatVariant {
    pub(crate) fn original(aspect: &str) -> Self {
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
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "audioMix", alias = "audio_mix")]
    pub audio_mix: Option<AudioMix>,
    #[serde(default)]
    pub overlays: Vec<ElementLayer>,
    #[serde(default)]
    pub formats: Vec<FormatVariant>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fonts: Vec<ProjectFont>,
    /// Text that spans scenes. Times are absolute project ticks.
    #[serde(default, skip_serializing_if = "Vec::is_empty", rename = "globalText", alias = "global_text")]
    pub global_text: Vec<TextLayer>,
    /// Manual beat markers, in project ticks, sorted.
    #[serde(default, skip_serializing_if = "Vec::is_empty", rename = "beatTicks", alias = "beat_ticks")]
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
    pub(crate) fn normalize_global_text(&mut self, total_ticks: u64, timebase: &Timebase) -> Result<(), String> {
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
                    fade_out: music.fade_out, low: 0.0, mid: 0.0, high: 0.0, credit: None,
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
            if let Some(credit) = &mut clip.credit {
                *credit = credit.trim().to_string();
                if credit.is_empty() { clip.credit = None; }
                else if credit.chars().count() > 600 { return Err("An audio credit is too long.".into()); }
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
pub(crate) fn split_elements(elements: &[ElementLayer], at_ticks: u64) -> (Vec<ElementLayer>, Vec<ElementLayer>) {
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

pub(crate) fn split_text_layers(layers: &[TextLayer], at: u64) -> (Vec<TextLayer>, Vec<TextLayer>) {
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
