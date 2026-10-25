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
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: String,
    pub name: String,
    pub image: std::sync::Arc<str>,
    pub duration: f64,
    pub title: String,
    pub subtitle: String,
    pub color: String,
    pub fit: String,
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
    #[serde(default = "default_filter")]
    pub filter: String,
    #[serde(default = "default_intensity")]
    pub filter_intensity: f64,
    #[serde(default = "default_one")]
    pub speed: f64,
    #[serde(default = "default_true")]
    pub pitch: bool,
    #[serde(default, alias = "fade_in")]
    pub fade_in: f64,
    #[serde(default, alias = "fade_out")]
    pub fade_out: f64,
}
fn default_one() -> f64 { 1.0 }
fn default_filter() -> String { "none".into() }
fn default_intensity() -> f64 { 100.0 }
fn default_true() -> bool { true }
const FILTER_IDS: &[&str] = &["none", "vivid", "warm", "cool", "mono", "film", "noir", "dream"];
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Project {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub aspect: String,
    pub scenes: Vec<Scene>,
    pub policy: Policy,
}
impl Default for Project {
    fn default() -> Self {
        Self {
            schema_version: 1,
            id: "new-project".into(),
            name: "Untitled story".into(),
            aspect: "16:9".into(),
            scenes: vec![],
            policy: Policy::default(),
        }
    }
}
impl Project {
    pub fn validate(&mut self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err(
                "Unsupported project version. The original file has not been changed.".into(),
            );
        }
        if self.name.chars().count() > 120
            || self.id.is_empty()
            || !["16:9", "9:16", "1:1", "4:5"].contains(&self.aspect.as_str())
            || self.scenes.len() > 100
        {
            return Err("Invalid project format.".into());
        }
        let mut ids = std::collections::HashSet::new();
        let mut size = 0;
        for s in &self.scenes {
            if !ids.insert(&s.id)
                || s.id.is_empty()
                || !s.duration.is_finite()
                || !(0.5..=30.0).contains(&s.duration)
                || s.title.chars().count() > 120
                || s.subtitle.chars().count() > 200
                || !["cover", "contain", "blur"].contains(&s.fit.as_str())
                || s.color.len() != 7
                || !s.color.starts_with('#')
                || !s.color[1..].chars().all(|c| c.is_ascii_hexdigit())
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
                || !FILTER_IDS.contains(&s.filter.as_str())
                || !s.filter_intensity.is_finite()
                || !(0.0..=100.0).contains(&s.filter_intensity)
                || !s.speed.is_finite()
                || !(0.25..=4.0).contains(&s.speed)
                || !s.fade_in.is_finite()
                || s.fade_in < 0.0
                || s.fade_in > s.duration
                || !s.fade_out.is_finite()
                || s.fade_out < 0.0
                || s.fade_out > s.duration
                || ![
                    "data:image/png;base64,",
                    "data:image/jpeg;base64,",
                    "data:image/webp;base64,",
                ]
                .iter()
                .any(|prefix| s.image.starts_with(prefix))
            {
                return Err("Invalid scene, image, or duration.".into());
            }
            size += s.image.len();
        }
        if size > 90_000_000 {
            return Err("Project exceeds the 64 MB image budget.".into());
        }
        self.policy = Policy::default();
        Ok(())
    }
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateItem {
    pub id: String,
    pub new_id: String,
}
#[derive(Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Command {
    Replace { project: Project },
    Rename { name: String },
    Aspect { aspect: String },
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
        at: f64,
        #[serde(rename = "newId")]
        new_id: String,
    },
    UpdateMany { scenes: Vec<Scene> },
    RemoveMany { ids: Vec<String> },
    DuplicateMany { items: Vec<DuplicateItem> },
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
pub struct View {
    pub project: Project,
    pub can_undo: bool,
    pub can_redo: bool,
}
impl Session {
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
        let mut p = self.project.clone();
        match command {
            Command::Replace { project } => p = project,
            Command::Rename { name } => p.name = name,
            Command::Aspect { aspect } => p.aspect = aspect,
            Command::Add { scenes } => p.scenes.extend(scenes),
            Command::Update { scene } => {
                if let Some(s) = p.scenes.iter_mut().find(|s| s.id == scene.id) {
                    *s = scene;
                }
            }
            Command::Remove { id } => p.scenes.retain(|s| s.id != id),
            Command::Move { id, offset } => {
                if let Some(i) = p.scenes.iter().position(|s| s.id == id) {
                    let target = i as i64 + offset as i64;
                    if target >= 0 && (target as usize) < p.scenes.len() {
                        let scene = p.scenes.remove(i);
                        p.scenes.insert(target as usize, scene);
                    }
                }
            }
            Command::Duplicate { id, new_id } => {
                let Some(i) = p.scenes.iter().position(|s| s.id == id) else {
                    return Err("Select a scene to duplicate.".into());
                };
                if p.scenes.iter().any(|s| s.id == new_id) {
                    return Err("A scene with this ID already exists.".into());
                }
                let mut copy = p.scenes[i].clone();
                copy.id = new_id;
                copy.name = format!("{} copy", copy.name);
                p.scenes.insert(i + 1, copy);
            }
            Command::Split { id, at, new_id } => {
                let Some(i) = p.scenes.iter().position(|s| s.id == id) else {
                    return Err("Select a scene to split.".into());
                };
                let scene = p.scenes[i].clone();
                if !at.is_finite() || at < 0.5 || scene.duration - at < 0.5 {
                    return Err(
                        "Move the playhead at least half a second inside the clip to split it."
                            .into(),
                    );
                }
                if p.scenes.iter().any(|s| s.id == new_id) {
                    return Err("A scene with this ID already exists.".into());
                }
                let at = (at * 1000.0).round() / 1000.0;
                let remaining = ((scene.duration - at) * 1000.0).round() / 1000.0;
                let mut left = scene.clone();
                left.duration = at;
                left.fade_in = left.fade_in.min(at);
                left.fade_out = 0.0;
                let mut right = scene;
                right.id = new_id;
                right.duration = remaining;
                right.fade_in = 0.0;
                right.fade_out = right.fade_out.min(remaining);
                p.scenes.splice(i..=i, [left, right]);
            }
            Command::UpdateMany { scenes } => {
                for scene in scenes {
                    if let Some(existing) = p.scenes.iter_mut().find(|s| s.id == scene.id) {
                        *existing = scene;
                    }
                }
            }
            Command::RemoveMany { ids } => {
                let removed: std::collections::HashSet<String> = ids.into_iter().collect();
                p.scenes.retain(|scene| !removed.contains(&scene.id));
            }
            Command::DuplicateMany { items } => {
                let existing: std::collections::HashSet<String> =
                    p.scenes.iter().map(|scene| scene.id.clone()).collect();
                let mut new_ids = std::collections::HashSet::new();
                let mut by_id = std::collections::HashMap::new();
                for item in &items {
                    if !existing.contains(&item.id) {
                        return Err("Select a scene to duplicate.".into());
                    }
                    if existing.contains(&item.new_id) || !new_ids.insert(item.new_id.clone()) {
                        return Err("A scene with this ID already exists.".into());
                    }
                    if by_id.insert(item.id.clone(), item.new_id.clone()).is_some() {
                        return Err("A scene can only be duplicated once at a time.".into());
                    }
                }
                let mut next = Vec::with_capacity(p.scenes.len() + items.len());
                for scene in &p.scenes {
                    next.push(scene.clone());
                    if let Some(new_id) = by_id.get(&scene.id) {
                        let mut copy = scene.clone();
                        copy.id = new_id.clone();
                        copy.name = format!("{} copy", copy.name);
                        next.push(copy);
                    }
                }
                p.scenes = next;
            }
            _ => unreachable!(),
        }
        p.validate()?;
        self.past.push(std::mem::replace(&mut self.project, p));
        if self.past.len() > 30 {
            self.past.remove(0);
        }
        self.future.clear();
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn scene() -> Scene {
        Scene {
            id: "one".into(),
            name: "Test".into(),
            image: "data:image/png;base64,AA==".into(),
            duration: 4.0,
            title: "Hello".into(),
            subtitle: "".into(),
            color: "#ffffff".into(),
            fit: "cover".into(),
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            exposure: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            temperature: 0.0,
            tint: 0.0,
            filter: "none".into(),
            filter_intensity: 100.0,
            speed: 1.0,
            pitch: true,
            fade_in: 0.0,
            fade_out: 0.0,
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
        assert!(s.project.scenes.is_empty());
        s.apply(Command::Redo).unwrap();
        assert_eq!(s.project.scenes.len(), 1);
        s.apply(Command::Undo).unwrap();
        s.apply(Command::Rename { name: "New".into() }).unwrap();
        assert!(s.future.is_empty());
    }
    #[test]
    fn invalid_edit_leaves_project_untouched() {
        let mut s = Session::default();
        let original = s.project.clone();
        let mut bad = scene();
        bad.duration = -1.0;
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
    fn future_schema_is_rejected() {
        let mut p = Project::default();
        p.schema_version = 2;
        assert!(p.validate().is_err());
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
            at: 1.5,
            new_id: "two".into(),
        })
        .unwrap();
        assert_eq!(s.project.scenes.len(), 2);
        assert_eq!(s.project.scenes[0].duration, 1.5);
        assert_eq!(s.project.scenes[1].duration, 2.5);
        assert_eq!(s.project.scenes[0].fade_out, 0.0);
        assert_eq!(s.project.scenes[1].fade_in, 0.0);
        s.apply(Command::Undo).unwrap();
        assert_eq!(s.project.scenes.len(), 1);
        assert_eq!(s.project.scenes[0].duration, 4.0);
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
                at: 0.2,
                new_id: "two".into(),
            })
            .is_err());
        assert!(s
            .apply(Command::Split {
                id: "one".into(),
                at: 3.8,
                new_id: "two".into(),
            })
            .is_err());
        assert!(s
            .apply(Command::Split {
                id: "one".into(),
                at: 1.5,
                new_id: "one".into(),
            })
            .is_err());
        assert_eq!(s.project.scenes.len(), 1);
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
            s.project.scenes.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["one", "copy", "two"]
        );
        assert_eq!(s.project.scenes[1].name, "Test copy");
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
            s.project.scenes.iter().map(|s| s.title.as_str()).collect::<Vec<_>>(),
            vec!["A", "Hello", "C"]
        );
        s.apply(Command::RemoveMany {
            ids: vec!["one".into(), "three".into()],
        })
        .unwrap();
        assert_eq!(s.project.scenes.len(), 1);
        assert_eq!(s.project.scenes[0].id, "two");
        s.apply(Command::Undo).unwrap();
        assert_eq!(s.project.scenes.len(), 3);
        assert_eq!(
            s.project.scenes.iter().map(|s| s.title.as_str()).collect::<Vec<_>>(),
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
            s.project.scenes.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["one", "copy"]
        );
        assert_eq!(s.project.scenes[1].name, "Test copy");
        s.apply(Command::Undo).unwrap();
        assert_eq!(s.project.scenes.len(), 1);
        assert!(s
            .apply(Command::DuplicateMany {
                items: vec![DuplicateItem {
                    id: "one".into(),
                    new_id: "one".into(),
                }],
            })
            .is_err());
        assert_eq!(s.project.scenes.len(), 1);
    }
    #[test]
    fn scene_controls_serialize_as_camel_case() {
        let value = serde_json::to_value(scene()).unwrap();
        for key in ["fadeIn", "fadeOut", "filterIntensity", "speed", "pitch"] {
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
        assert!(s.project.scenes.is_empty());
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
            at: 2.0,
            new_id: "two".into(),
        })
        .unwrap();
        assert_eq!(s.project.scenes[0].duration, 2.0);
        assert_eq!(s.project.scenes[0].fade_in, 2.0);
        assert_eq!(s.project.scenes[0].fade_out, 0.0);
        assert_eq!(s.project.scenes[1].duration, 2.0);
        assert_eq!(s.project.scenes[1].fade_in, 0.0);
        assert_eq!(s.project.scenes[1].fade_out, 2.0);
    }
}
