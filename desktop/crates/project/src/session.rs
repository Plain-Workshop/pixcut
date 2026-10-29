use super::*;

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
pub(crate) const MAX_HISTORY: usize = 30;
pub(crate) const MAX_HISTORY_MEDIA_BYTES: usize = 160_000_000;

impl Session {
    pub(crate) fn remember(&mut self, previous: Project) {
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
