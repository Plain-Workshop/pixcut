use super::*;
use crate::mcp::backend::fake::FakeBackend;

fn reference() -> String {
    format!("pixcut-asset:{}", "a".repeat(64))
}

fn project_with_two_scenes() -> Project {
    let mut project = Project::default();
    let mut second = Scene::photo("two", "Two", reference(), 120, "cover");
    second.start_ticks = 120;
    project.tracks[0].clips = vec![
        Scene::photo("one", "One", reference(), 120, "cover"),
        second,
    ];
    project
}

fn server(project: Project) -> PixCutServer {
    PixCutServer::new(Arc::new(FakeBackend::with_project(project)))
}

fn text(result: &CallToolResult) -> String {
    result
        .content
        .iter()
        .filter_map(|block| block.as_text().map(|text| text.text.clone()))
        .collect::<Vec<_>>()
        .join("\n")
}

fn json(result: &CallToolResult) -> serde_json::Value {
    serde_json::from_str(&text(result)).expect("tool returns JSON")
}

#[tokio::test]
async fn project_summary_lists_every_clip() {
    let result = server(project_with_two_scenes())
        .get_project(Parameters(EmptyArgs {}))
        .await;
    assert_eq!(result.is_error, Some(false));
    let value = json(&result);
    assert_eq!(value["sceneCount"], 2);
    assert_eq!(value["scenes"][1]["id"], "two");
    assert_eq!(value["durationSeconds"], 8.0);
}

#[tokio::test]
async fn add_scene_appends_and_can_be_undone() {
    let backend = Arc::new(FakeBackend::default());
    let server = PixCutServer::new(backend.clone());
    let result = server
        .add_scene(Parameters(AddSceneArgs {
            path: None,
            reference: Some(reference()),
            name: Some("From the agent".into()),
            seconds: Some(3.0),
            title: Some("Hello".into()),
            subtitle: None,
            fit: Some("contain".into()),
            motion: Some("zoom-in".into()),
            motion_amount: Some(0.4),
            color: None,
        }))
        .await;
    assert_eq!(result.is_error, Some(false), "{}", text(&result));
    let value = json(&result);
    assert_eq!(value["durationSeconds"], 3.0);
    let project = backend.project();
    assert_eq!(project.visual_clips().len(), 1);
    assert_eq!(project.visual_clips()[0].title, "Hello");
    assert_eq!(project.visual_clips()[0].fit, "contain");
    server.undo(Parameters(EmptyArgs {})).await;
    assert!(backend.project().visual_clips().is_empty());
}

#[tokio::test]
async fn add_scene_adds_a_video_with_its_probed_length() {
    let server = server(project_with_two_scenes());
    let args = |path: &str, seconds| AddSceneArgs {
        path: Some(path.into()), reference: None, name: None, seconds, title: None, subtitle: None,
        fit: None, motion: None, motion_amount: None, color: None,
    };
    let added = server.add_scene(Parameters(args("/tmp/clip.mp4", None))).await;
    assert_ne!(added.is_error, Some(true), "{}", text(&added));
    let scene = server.backend.view().unwrap().project.visual_clips().last().cloned().unwrap();
    assert_eq!(scene.media_kind.as_deref(), Some("video"));
    assert_eq!(scene.source_duration_seconds, Some(8.0));
    assert!(scene.video_poster.is_some());
    let shorter = server.add_scene(Parameters(args("/tmp/clip.mp4", Some(2.0)))).await;
    assert_ne!(shorter.is_error, Some(true));
    let last = server.backend.view().unwrap().project.visual_clips().last().cloned().unwrap();
    assert!((server.backend.view().unwrap().project.timebase.ticks_to_seconds(last.duration_ticks) - 2.0).abs() < 0.05);
}

#[tokio::test]
async fn add_scene_rejects_video_and_bad_arguments() {
    let server = server(project_with_two_scenes());
    let video = server
        .add_scene(Parameters(AddSceneArgs {
            path: None,
            reference: Some(reference()),
            name: None,
            seconds: None,
            title: None,
            subtitle: None,
            fit: Some("sideways".into()),
            motion: None,
            motion_amount: None,
            color: None,
        }))
        .await;
    let message = text(&video);
    assert_eq!(video.is_error, Some(true));
    assert!(message.contains("fit must be"), "{message}");
}

#[tokio::test]
async fn update_scene_edits_text_and_clamps_values() {
    let backend = Arc::new(FakeBackend::with_project(project_with_two_scenes()));
    let server = PixCutServer::new(backend.clone());
    let result = server
        .update_scene(Parameters(UpdateSceneArgs {
            id: "one".into(),
            name: None,
            title: Some("Headline".into()),
            subtitle: Some("Support".into()),
            seconds: Some(2.0),
            fit: None,
            motion: None,
            motion_amount: None,
            color: None,
            fade_in: Some(99.0),
            fade_out: None,
            image_x: None,
            image_y: None,
            image_zoom: Some(99.0),
            brightness: None,
            contrast: None,
            saturation: None,
            exposure: None,
            highlights: None,
            shadows: None,
            temperature: None,
            tint: None,
            hue: None,
            vibrance: None,
        }))
        .await;
    assert_eq!(result.is_error, Some(false), "{}", text(&result));
    let project = backend.project();
    let scene = &project.visual_clips()[0];
    assert_eq!(scene.title, "Headline");
    assert_eq!(scene.subtitle, "Support");
    assert_eq!(scene.duration_ticks, 60);
    assert_eq!(scene.fade_in, 2.0);
    assert_eq!(scene.image_zoom, 4.0);
    assert_eq!(scene.text_layers.len(), 1);
}

#[tokio::test]
async fn duplicate_and_split_return_new_ids() {
    let server = server(project_with_two_scenes());
    let duplicated = server
        .duplicate_scene(Parameters(SceneIdArgs { id: "one".into() }))
        .await;
    let value = json(&duplicated);
    let new_id = value["newId"].as_str().expect("new id").to_string();
    assert_ne!(new_id, "one");

    let split = server
        .split_scene(Parameters(SplitSceneArgs { id: "one".into(), at_seconds: 2.0 }))
        .await;
    assert_eq!(split.is_error, Some(false), "{}", text(&split));
    assert!(json(&split)["newId"].as_str().is_some());
}

#[tokio::test]
async fn move_scene_by_offset_stops_at_the_edges() {
    let backend = Arc::new(FakeBackend::with_project(project_with_two_scenes()));
    let server = PixCutServer::new(backend.clone());
    let result = server
        .move_scene(Parameters(MoveSceneArgs { id: "one".into(), offset: Some(1), to_index: None }))
        .await;
    assert_eq!(result.is_error, Some(false));
    assert_eq!(backend.project().visual_clips()[0].id, "two");
    let clamped = server
        .move_scene(Parameters(MoveSceneArgs { id: "two".into(), offset: Some(-99), to_index: None }))
        .await;
    assert_eq!(clamped.is_error, Some(false));
    assert_eq!(backend.project().visual_clips()[0].id, "two");
}

#[tokio::test]
async fn unknown_scene_ids_are_reported_clearly() {
    let result = server(project_with_two_scenes())
        .get_scene(Parameters(GetSceneArgs { id: "missing".into() }))
        .await;
    assert_eq!(result.is_error, Some(true));
    assert!(text(&result).contains("No scene has the id"));
}

#[tokio::test]
async fn get_scene_never_returns_inline_media() {
    let mut project = project_with_two_scenes();
    project.tracks[0].clips[0].video_poster = Some("data:image/png;base64,AAAA".into());
    let result = server(project)
        .get_scene(Parameters(GetSceneArgs { id: "one".into() }))
        .await;
    assert!(!text(&result).contains("base64"));
}

#[tokio::test]
async fn update_project_validates_the_aspect() {
    let server = server(project_with_two_scenes());
    let bad = server
        .update_project(Parameters(UpdateProjectArgs { name: None, aspect: Some("2:1".into()) }))
        .await;
    assert_eq!(bad.is_error, Some(true));
    let good = server
        .update_project(Parameters(UpdateProjectArgs { name: Some("Trip".into()), aspect: Some("9:16".into()) }))
        .await;
    assert_eq!(good.is_error, Some(false));
    assert_eq!(json(&good)["aspect"], "9:16");
}

#[tokio::test]
async fn a_name_and_aspect_change_is_one_undo_step() {
    let backend = Arc::new(FakeBackend::with_project(project_with_two_scenes()));
    let server = PixCutServer::new(backend.clone());
    let result = server
        .update_project(Parameters(UpdateProjectArgs { name: Some("Trip".into()), aspect: Some("9:16".into()) }))
        .await;
    assert_eq!(result.is_error, Some(false));
    server.undo(Parameters(EmptyArgs {})).await;
    let project = backend.project();
    assert_eq!(project.name, "Untitled story");
    assert_eq!(project.aspect, "16:9");
}

#[tokio::test]
async fn save_and_open_pass_the_path_to_the_editor() {
    let backend = Arc::new(FakeBackend::with_project(project_with_two_scenes()));
    let server = PixCutServer::new(backend.clone());
    let saved = server
        .save_project(Parameters(ProjectPathArgs { path: "/tmp/story.pixcut".into() }))
        .await;
    assert_eq!(saved.is_error, Some(false));
    assert_eq!(backend.saved().as_deref(), Some("/tmp/story.pixcut"));

    let opened = server
        .open_project(Parameters(ProjectPathArgs { path: "/tmp/story.pixcut".into() }))
        .await;
    assert_eq!(opened.is_error, Some(false));
    assert_eq!(backend.opened().as_deref(), Some("/tmp/story.pixcut"));
}

#[tokio::test]
async fn set_transition_sets_clamps_clears_and_rejects() {
    let server = server(project_with_two_scenes());
    let id = server.backend.view().unwrap().project.visual_clips()[0].id.clone();
    let args = |kind: &str, seconds| SetTransitionArgs { id: id.clone(), kind: kind.into(), seconds };
    let result = server.set_transition(Parameters(args("fade", Some(99.0)))).await;
    assert_ne!(result.is_error, Some(true), "{}", text(&result));
    let t = server.backend.view().unwrap().project.visual_clips()[0].transition.clone().unwrap();
    assert_eq!(t.kind, "fade");
    assert!(t.duration <= 2.0);
    assert_eq!(server.set_transition(Parameters(args("bogus", None))).await.is_error, Some(true));
    server.set_transition(Parameters(args("none", None))).await;
    assert!(server.backend.view().unwrap().project.visual_clips()[0].transition.is_none());
}

#[tokio::test]
async fn audio_tracks_are_added_edited_and_removed() {
    let server = server(project_with_two_scenes());
    let added = server.add_audio(Parameters(AddAudioArgs {
        path: Some("/tmp/song.mp3".into()), reference: None, source_seconds: None, name: None,
        start_seconds: None, seconds: None, source_in_seconds: None, volume: Some(9.0),
        fade_in: None, fade_out: None, lane: None,
    })).await;
    assert_ne!(added.is_error, Some(true), "{}", text(&added));
    let id = json(&added)["id"].as_str().unwrap().to_string();
    let clip = server.backend.view().unwrap().project.audio[0].clone();
    assert_eq!(clip.volume, 1.0);
    assert!(clip.duration_ticks > 0);
    let updated = server.update_audio(Parameters(UpdateAudioArgs {
        id: id.clone(), start_seconds: Some(1.0), seconds: Some(500.0), volume: Some(0.3), fade_in: Some(99.0), fade_out: None,
    })).await;
    assert_ne!(updated.is_error, Some(true), "{}", text(&updated));
    let clip = server.backend.view().unwrap().project.audio[0].clone();
    assert_eq!(clip.volume, 0.3);
    assert!(clip.fade_in <= 20.0);
    let bad = server.add_audio(Parameters(AddAudioArgs {
        path: Some("/tmp/song.txt".into()), reference: None, source_seconds: None, name: None,
        start_seconds: None, seconds: None, source_in_seconds: None, volume: None, fade_in: None, fade_out: None, lane: None,
    })).await;
    assert_eq!(bad.is_error, Some(true));
    let removed = server.remove_audio(Parameters(SceneIdArgs { id })).await;
    assert_ne!(removed.is_error, Some(true));
    assert!(server.backend.view().unwrap().project.audio.is_empty());
}

#[tokio::test]
async fn global_text_is_added_changed_and_removed() {
    let server = server(project_with_two_scenes());
    let added = server.set_global_text(Parameters(SetGlobalTextArgs {
        id: None, title: Some("Hello".into()), subtitle: None, start_seconds: Some(1.0), seconds: Some(2.0), color: Some("#ff0000".into()),
    })).await;
    assert_ne!(added.is_error, Some(true), "{}", text(&added));
    let id = json(&added)["id"].as_str().unwrap().to_string();
    assert_eq!(server.backend.view().unwrap().project.global_text[0].title, "Hello");
    let bad = server.set_global_text(Parameters(SetGlobalTextArgs {
        id: Some(id.clone()), title: None, subtitle: None, start_seconds: None, seconds: None, color: Some("red".into()),
    })).await;
    assert_eq!(bad.is_error, Some(true));
    let removed = server.remove_global_text(Parameters(SceneIdArgs { id })).await;
    assert_ne!(removed.is_error, Some(true));
    assert!(server.backend.view().unwrap().project.global_text.is_empty());
}

#[tokio::test]
async fn preview_frame_returns_an_image_or_the_window_error() {
    let server = server(project_with_two_scenes());
    let ok = server.preview_frame(Parameters(PreviewFrameArgs { id: None, at_seconds: Some(1.0), max_width: None })).await;
    assert_ne!(ok.is_error, Some(true));
    assert!(serde_json::to_string(&ok).unwrap().contains("image/png"));
    let broken = server.preview_frame(Parameters(PreviewFrameArgs { id: Some("broken".into()), at_seconds: None, max_width: None })).await;
    assert_eq!(broken.is_error, Some(true));
    let nan = server.preview_frame(Parameters(PreviewFrameArgs { id: None, at_seconds: Some(f64::NAN), max_width: None })).await;
    assert_eq!(nan.is_error, Some(true));
}

#[tokio::test]
async fn export_needs_an_absolute_folder_and_reports_status() {
    let server = server(project_with_two_scenes());
    let bad = server.export_video(Parameters(ExportVideoArgs { directory: "relative/dir".into() })).await;
    assert_eq!(bad.is_error, Some(true));
    let ok = server.export_video(Parameters(ExportVideoArgs { directory: "/tmp".into() })).await;
    assert_ne!(ok.is_error, Some(true));
    let status = server.get_export_status(Parameters(EmptyArgs {})).await;
    assert_eq!(json(&status)["state"], "idle");
}

#[test]
fn every_tool_is_registered() {
    let tools = PixCutServer::tool_router().list_all();
    let names: Vec<&str> = tools.iter().map(|tool| tool.name.as_ref()).collect();
    for expected in [
        "get_project", "get_scene", "get_history", "list_media", "get_app_status",
        "import_media", "add_scene", "update_scene", "remove_scene", "move_scene",
        "duplicate_scene", "split_scene", "update_project", "undo", "redo",
        "save_project", "open_project", "set_transition", "add_audio", "update_audio", "preview_frame", "export_video", "get_export_status",
        "remove_audio", "set_global_text", "remove_global_text",
    ] {
        assert!(names.contains(&expected), "missing tool {expected}");
    }
}
