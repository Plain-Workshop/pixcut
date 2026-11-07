use super::*;

fn reference() -> String {
    format!("pixcut-asset:{}", "a".repeat(64))
}

#[test]
fn summaries_measure_seconds_from_ticks() {
    let mut project = Project::default();
    project.tracks[0].clips = vec![Scene::photo("one", "Photo", reference(), 120, "cover")];
    let view = Session { project, ..Default::default() }.view();
    let summary = project_summary(&view);
    assert_eq!(summary.scene_count, 1);
    assert!((summary.duration_seconds - 4.0).abs() < 0.01);
    assert_eq!(summary.scenes[0].media, reference());
    assert_eq!(summary.scenes[0].duration_seconds, 4.0);
}

#[test]
fn inline_media_is_never_returned_verbatim() {
    let mut project = Project::default();
    let mut scene = Scene::photo("one", "Photo", reference(), 120, "cover");
    scene.video_poster = Some("data:image/png;base64,AAAA".into());
    project.tracks[0].clips = vec![scene];
    let json = redacted_json(&project).expect("serializes");
    let text = serde_json::to_string(&json).expect("encodes");
    assert!(!text.contains("data:image/png"));
    assert!(text.contains("<inline media"));
}

#[test]
fn text_updates_create_the_first_layer_and_mirror_the_label() {
    let mut scene = Scene::photo("one", "Photo", reference(), 120, "cover");
    set_scene_text(&mut scene, Some("Hello".into()), Some("World".into()));
    assert_eq!(scene.title, "Hello");
    assert_eq!(scene.subtitle, "World");
    assert_eq!(scene.text_layers.len(), 1);
    assert_eq!(scene.text_layers[0].title, "Hello");
    assert_eq!(scene.text_layers[0].duration_ticks, 120);
    set_scene_text(&mut scene, Some("Again".into()), None);
    assert_eq!(scene.text_layers.len(), 1);
    assert_eq!(scene.text_layers[0].title, "Again");
    assert_eq!(scene.text_layers[0].subtitle, "World");
}

#[test]
fn scene_ids_do_not_collide_with_existing_clips() {
    let mut project = Project::default();
    project.tracks[0].clips = vec![Scene::photo("taken", "Photo", reference(), 120, "cover")];
    let id = new_scene_id(&project);
    assert!(id.starts_with("scene-"));
    assert_ne!(id, "taken");
}

#[test]
fn ffmpeg_durations_are_parsed() {
    let text = "  Duration: 00:03:12.50, start: 0.0, bitrate: 128 kb/s";
    assert!((parse_duration(text).unwrap() - 192.5).abs() < 1e-9);
    assert!(parse_duration("Duration: N/A, bitrate").is_none());
    assert!(parse_duration("nothing").is_none());
}

#[test]
fn seconds_convert_and_are_clamped() {
    let timebase = Timebase::default();
    assert_eq!(seconds_to_ticks(4.0, &timebase), 120);
    assert_eq!(clamp_seconds(f64::NAN), 4.0);
    assert_eq!(clamp_seconds(0.0), 0.5);
    assert_eq!(clamp_seconds(100.0), 30.0);
}
