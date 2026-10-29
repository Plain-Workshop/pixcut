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
        fade_out: 1.0, low: 0.0, mid: 0.0, high: 0.0, credit: None,
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
        fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0, credit: None,
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

#[test]
fn audio_credit_is_optional_trimmed_and_bounded() {
    let mut p = Project::default();
    p.tracks[0].clips.push(scene());
    let clip = |credit: Option<&str>| AudioClip {
        id: "audio".into(),
        name: "Track.mp3".into(),
        data: "data:audio/mpeg;base64,AA==".into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 120,
        source_in_seconds: 0.0,
        source_duration_seconds: 30.0,
        volume: 0.8,
        fade_in: 0.0,
        fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0,
        credit: credit.map(str::to_string),
    };
    p.audio = vec![clip(Some("  “Song” by Artist – CC BY 4.0  "))];
    p.validate().unwrap();
    assert_eq!(p.audio[0].credit.as_deref(), Some("“Song” by Artist – CC BY 4.0"));
    p.audio = vec![clip(Some("   "))];
    p.validate().unwrap();
    assert_eq!(p.audio[0].credit, None);
    p.audio = vec![clip(Some(&"x".repeat(601)))];
    assert!(p.validate().is_err());
}

#[test]
fn audio_clips_without_a_credit_still_load_and_stay_compact() {
    let old = r#"{"id":"a","name":"Old.mp3","data":"data:audio/mpeg;base64,AA==","lane":0,"startTicks":0,"durationTicks":120,"sourceInSeconds":0,"sourceDurationSeconds":30,"volume":0.8,"fadeIn":0,"fadeOut":0}"#;
    let clip: AudioClip = serde_json::from_str(old).unwrap();
    assert_eq!(clip.credit, None);
    assert!(!serde_json::to_string(&clip).unwrap().contains("credit"));
    let mut with_credit = clip.clone();
    with_credit.credit = Some("Credit".into());
    let json = serde_json::to_string(&with_credit).unwrap();
    assert!(json.contains("\"credit\":\"Credit\""));
    assert_eq!(serde_json::from_str::<AudioClip>(&json).unwrap().credit.as_deref(), Some("Credit"));
}

#[test]
fn audio_mix_command_round_trips_through_json_like_the_editor_sends_it() {
    let command: Command = serde_json::from_str(r#"{"type":"audioMix","mix":{"video":1,"lanes":[{"lane":0,"volume":1,"muted":true},{"lane":2,"volume":0.25,"muted":false}]}}"#).unwrap();
    let mut s = Session::default();
    s.apply(command).unwrap();
    let json = serde_json::to_value(&s.project).unwrap();
    assert_eq!(json["audioMix"]["lanes"][0]["muted"], true);
    assert_eq!(json["audioMix"]["lanes"][1]["volume"], 0.25);
    assert_eq!(s.project.lane_gain(0), 0.0);
    assert_eq!(s.project.lane_gain(2), 0.25);
    // Reload: the saved project keeps the mix.
    let again: Project = serde_json::from_value(json).unwrap();
    assert_eq!(again.lane_gain(0), 0.0);
}

#[test]
fn project_uses_the_editors_camel_case_keys_and_still_reads_the_old_snake_case_ones() {
    let mut p = Project::default();
    p.audio_mix = Some(AudioMix { video: 0.5, lanes: vec![AudioLaneMix { lane: 1, volume: 0.5, muted: true }] });
    p.beat_ticks = vec![3, 9];
    let json = serde_json::to_value(&p).unwrap();
    for key in ["audioMix", "beatTicks"] {
        assert!(json.get(key).is_some(), "{key} missing");
    }
    for key in ["audio_mix", "beat_ticks", "global_text"] {
        assert!(json.get(key).is_none(), "{key} should not be written");
    }
    // Projects saved by earlier builds used snake_case keys.
    let mut old = json.clone();
    let map = old.as_object_mut().unwrap();
    let mix = map.remove("audioMix").unwrap();
    let beats = map.remove("beatTicks").unwrap();
    map.insert("audio_mix".into(), mix);
    map.insert("beat_ticks".into(), beats);
    let loaded: Project = serde_json::from_value(old).unwrap();
    assert_eq!(loaded.lane_gain(1), 0.0);
    assert_eq!(loaded.beat_ticks, vec![3, 9]);
}
