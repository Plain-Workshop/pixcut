use super::*;
fn encoding_args(options: &ExportOptions) -> Vec<String> {
    let hardware = if options.hardware { hardware_candidates(options.codec).first().copied() } else { None };
    video_encoding_args(options, hardware)
}
#[test]
fn menu_labels_follow_the_interface_language() {
    assert_eq!(menu_label("en", "File"), "File");
    assert_eq!(menu_label("pl", "File"), "Plik");
    assert_eq!(menu_label("pl", "Export Video…"), "Eksportuj wideo…");
    assert_eq!(menu_label("uk", "File"), "Файл");
    assert_eq!(menu_label("uk", "Keyboard Shortcuts…"), "Клавіатурні скорочення…");
    assert_eq!(menu_label("de", "Save"), "Sichern");
    assert_eq!(menu_label("fr", "File"), "Fichier");
    assert_eq!(menu_label("es", "Export Video…"), "Exportar vídeo…");
    assert_eq!(menu_label("pt", "New Project"), "Novo projeto");
    assert_eq!(menu_label("it", "Settings…"), "Impostazioni…");
    assert_eq!(menu_label("ja", "File"), "ファイル");
    assert_eq!(menu_label("ko", "File"), "파일");
    assert_eq!(menu_label("zh", "File"), "文件");
    assert_eq!(menu_label("ru", "Save"), "Save", "unknown languages fall back");
    assert_eq!(menu_label("pl", "A future item"), "A future item", "unknown keys fall back");
}

fn export_options() -> ExportOptions {
    ExportOptions { width: 1920, height: 1080, fps: 30, crf: 20, filename: "Test export".into(), codec: ExportCodec::H264, container: ExportContainer::Mp4, speed: EncodeSpeed::Medium, hardware: false }
}
#[test]
fn accepts_compact_exports_down_to_160_pixels() {
    // The size ladder starts at 320×180 and 480×854, so the floor has to
    // allow heights below the old 240-pixel rule while staying even.
    let mut options = export_options();
    for (width, height) in [(320, 180), (480, 854), (640, 360), (854, 480), (160, 160)] {
        options.width = width;
        options.height = height;
        assert!(validate_export_options(&options).is_ok(), "{width}×{height} should be allowed");
    }
    options.width = 158;
    options.height = 160;
    assert!(validate_export_options(&options).is_err());
    options.width = 320;
    options.height = 181;
    assert!(validate_export_options(&options).is_err());
}
#[test]
fn qsv_amf_and_vaapi_arguments_match_their_encoders() {
    let mut options = export_options();
    options.hardware = true;
    options.speed = EncodeSpeed::Fast;
    let qsv = hardware_video_args(&options, "h264_qsv", HardwareFamily::Qsv);
    assert!(qsv.windows(2).any(|pair| pair[0] == "-c:v" && pair[1] == "h264_qsv"), "{qsv:?}");
    assert!(qsv.windows(2).any(|pair| pair[0] == "-global_quality" && pair[1] == "20"));
    assert!(qsv.windows(2).any(|pair| pair[0] == "-preset" && pair[1] == "veryfast"));
    let amf = hardware_video_args(&options, "h264_amf", HardwareFamily::Amf);
    assert!(amf.windows(2).any(|pair| pair[0] == "-rc" && pair[1] == "cqp"));
    assert!(amf.windows(2).any(|pair| pair[0] == "-qp_i" && pair[1] == "20"));
    assert!(amf.windows(2).any(|pair| pair[0] == "-quality" && pair[1] == "speed"));
    let vaapi = hardware_video_args(&options, "hevc_vaapi", HardwareFamily::Vaapi);
    assert!(vaapi.windows(2).any(|pair| pair[0] == "-c:v" && pair[1] == "hevc_vaapi"));
    assert!(vaapi.windows(2).any(|pair| pair[0] == "-qp" && pair[1] == "20"));
    assert!(vaapi.iter().any(|arg| arg == "-vaapi_device"));
    // Every platform offers a hardware candidate only where it can exist.
    assert!(hardware_candidates(ExportCodec::Prores).is_empty());
    assert!(hardware_candidates(ExportCodec::Vp9).is_empty());
}

#[test]
fn hardware_encoder_falls_back_to_software_when_none_is_available() {
    let mut options = export_options();
    options.hardware = true;
    let args = video_encoding_args(&options, None);
    assert!(args.windows(2).any(|pair| pair[0] == "-c:v" && pair[1] == "libx264"), "{args:?}");
    assert!(!args.iter().any(|arg| arg.ends_with("_qsv") || arg.ends_with("_amf")));
}

#[test]
fn nvenc_arguments_use_constant_quality() {
    let mut options = export_options();
    options.hardware = true;
    options.speed = EncodeSpeed::Fast;
    let args = hardware_video_args(&options, "h264_nvenc", HardwareFamily::Nvenc);
    assert!(args.windows(2).any(|pair| pair[0] == "-c:v" && pair[1] == "h264_nvenc"), "{args:?}");
    assert!(args.windows(2).any(|pair| pair[0] == "-preset" && pair[1] == "p3"));
    assert!(args.windows(2).any(|pair| pair[0] == "-cq" && pair[1] == "20"));
    assert!(args.windows(2).any(|pair| pair[0] == "-b:v" && pair[1] == "0"));
    options.codec = ExportCodec::Hevc;
    options.container = ExportContainer::Mov;
    options.speed = EncodeSpeed::Slow;
    let hevc = hardware_video_args(&options, "hevc_nvenc", HardwareFamily::Nvenc);
    assert!(hevc.windows(2).any(|pair| pair[0] == "-preset" && pair[1] == "p7"));
    assert!(hevc.windows(2).any(|pair| pair[0] == "-tag:v" && pair[1] == "hvc1"));
    assert!(hardware_candidates(ExportCodec::Vp9).is_empty());
}

#[test]
#[cfg(target_os = "macos")]
fn hardware_encoding_uses_videotoolbox_and_a_sane_bitrate() {
    let mut options = export_options();
    options.hardware = true;
    let args = encoding_args(&options);
    assert!(args.windows(2).any(|pair| pair[0] == "-c:v" && pair[1] == "h264_videotoolbox"), "{args:?}");
    let index = args.iter().position(|arg| arg == "-b:v").expect("bitrate");
    let bitrate: u64 = args[index + 1].parse().expect("numeric bitrate");
    assert!((1_500_000..=60_000_000).contains(&bitrate));
    options.codec = ExportCodec::Hevc;
    let hevc = encoding_args(&options);
    assert!(hevc.iter().any(|arg| arg == "hevc_videotoolbox"));
    options.codec = ExportCodec::Vp9;
    assert!(!encoding_args(&options).iter().any(|arg| arg.ends_with("videotoolbox")));
}

#[test]
#[ignore = "Requires FFmpeg with h264_videotoolbox and ffprobe installed"]
#[cfg(target_os = "macos")]
fn real_hardware_export_encodes_h264() {
    let binary = ffmpeg().expect("FFmpeg is installed");
    if !encoder_named(&binary, "h264_videotoolbox") {
        eprintln!("h264_videotoolbox is not in this FFmpeg build; skipping");
        return;
    }
    let temp = tempfile::tempdir().unwrap();
    let (project, frames) = fixture_project();
    let mut options = export_options();
    options.width = 320; options.height = 240; options.hardware = true; options.speed = EncodeSpeed::Fast;
    let output = temp.path().join("hardware.mp4");
    encode_movie(project, frames, vec![15, 15], options, binary.clone(), output.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let probe = Process::new(binary.with_file_name("ffprobe"))
        .args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "json"])
        .arg(&output)
        .output()
        .unwrap();
    assert!(probe.status.success(), "{}", String::from_utf8_lossy(&probe.stderr));
    let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
    assert_eq!(info["streams"][0]["codec_name"], "h264");
    assert_eq!(info["streams"][0]["width"], 320);
}

#[test]
fn export_codec_container_defaults_and_arguments() {
    let old: ExportOptions = serde_json::from_str(r#"{"width":320,"height":240,"fps":30,"crf":23,"filename":"Story.mp4"}"#).unwrap();
    assert_eq!(old.codec, ExportCodec::H264); assert_eq!(old.container, ExportContainer::Mp4);
    let mut options = old; options.codec = ExportCodec::Hevc; options.container = ExportContainer::Mov;
    assert_eq!(export_output_name(&options), "Story.mov");
    let args = encoding_args(&options); assert!(args.iter().any(|a| a == "libx265")); assert!(args.iter().any(|a| a == "hvc1"));
    options.container = ExportContainer::Mkv;
    assert_eq!(export_output_name(&options), "Story.mkv"); assert!(!encoding_args(&options).iter().any(|a| a == "-movflags"));
    assert!(serde_json::from_str::<ExportOptions>(r#"{"width":320,"height":240,"fps":30,"crf":23,"filename":"x","codec":"injected"}"#).is_err());
}
#[test]
fn webm_and_prores_options_use_their_own_encoders_and_containers() {
    let mut options = export_options();
    options.codec = ExportCodec::Vp9;
    options.container = ExportContainer::Webm;
    options.filename = "Story.webm".into();
    assert_eq!(export_output_name(&options), "Story.webm");
    assert!(validate_export_options(&options).is_ok());
    let video = encoding_args(&options);
    assert!(video.iter().any(|arg| arg == "libvpx-vp9"));
    assert!(video.windows(2).any(|pair| pair == ["-b:v", "0"]));
    assert!(!video.iter().any(|arg| arg == "-preset"));
    assert!(!video.iter().any(|arg| arg == "-movflags"));
    let audio = audio_encoding_args(&options);
    assert!(audio.iter().any(|arg| arg == "libopus"));

    options.codec = ExportCodec::Prores;
    options.container = ExportContainer::Mov;
    options.filename = "Story.mov".into();
    assert_eq!(export_output_name(&options), "Story.mov");
    assert!(validate_export_options(&options).is_ok());
    let video = encoding_args(&options);
    assert!(video.iter().any(|arg| arg == "prores_ks"));
    assert!(video.iter().any(|arg| arg == "yuv422p10le"));
    assert!(video.iter().any(|arg| arg == "-movflags"));
    assert!(audio_encoding_args(&options).iter().any(|arg| arg == "pcm_s16le"));

    options.codec = ExportCodec::Vp9;
    assert!(validate_export_options(&options).is_err());
    options.codec = ExportCodec::Prores;
    options.container = ExportContainer::Mp4;
    assert!(validate_export_options(&options).is_err());
    options.codec = ExportCodec::H264;
    options.container = ExportContainer::Webm;
    assert!(validate_export_options(&options).is_err());
}
#[test]
#[ignore = "Requires FFmpeg with libvpx-vp9, libopus, prores_ks and ffprobe installed"]
fn real_webm_and_prores_exports_match_their_containers() {
    let binary = ffmpeg().expect("FFmpeg is installed");
    let temp = tempfile::tempdir().unwrap();
    for (codec, container, expected_video, expected_audio) in [
        (ExportCodec::Vp9, ExportContainer::Webm, "vp9", "opus"),
        (ExportCodec::Prores, ExportContainer::Mov, "prores", "pcm_s16le"),
    ] {
        let (mut project, frames) = fixture_project();
        project.audio = vec![AudioClip {
            id: "audio-1".into(),
            name: "Bed.wav".into(),
            data: format!("data:audio/wav;base64,{}", STANDARD.encode(wav_silence(1.0))).into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 30,
            source_in_seconds: 0.0,
            source_duration_seconds: 1.0,
            volume: 0.8,
            fade_in: 0.0,
            fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
        let mut options = export_options();
        options.width = 320; options.height = 240; options.codec = codec;
        options.container = container; options.speed = EncodeSpeed::Fast;
        options.crf = if codec == ExportCodec::Vp9 { 32 } else { 24 };
        let output = temp.path().join(format!("photo.{}", container.extension()));
        let plan = ExportPlan {
            segments: frames.into_iter().map(|png| PlanSegment {
                kind: "image".into(), png: Some(png), video: None, source_in_seconds: None,
                fit: None, speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, audio_duration_ticks: None, duration_ticks: 15, overlays: vec![],
            }).collect(),
            options: options.clone(),
        };
        encode_plan(&project, plan, binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let probe = Process::new(binary.with_file_name("ffprobe"))
            .args(["-v","error","-show_entries","stream=codec_type,codec_name:format=format_name,duration","-of","json"])
            .arg(&output)
            .output()
            .unwrap();
        assert!(probe.status.success(), "{}", String::from_utf8_lossy(&probe.stderr));
        let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
        let streams = info["streams"].as_array().unwrap();
        let video = streams.iter().find(|stream| stream["codec_type"] == "video").unwrap();
        let audio = streams.iter().find(|stream| stream["codec_type"] == "audio").unwrap();
        assert_eq!(video["codec_name"], expected_video);
        assert_eq!(audio["codec_name"], expected_audio);
        let duration: f64 = info["format"]["duration"].as_str().unwrap().parse().unwrap();
        assert!((duration - 1.0).abs() < 0.08);
    }
}
#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_compact_deliverables_encode_at_their_own_size() {
    // The size ladder goes below the old 240 px floor (320×180, 480×854), so
    // both render paths have to encode those frames at exactly that size.
    let binary = ffmpeg().expect("FFmpeg is installed");
    assert!(encoder_available(&binary, ExportCodec::H264));
    let temp = tempfile::tempdir().unwrap();
    for (width, height) in [(320u32, 180u32), (480, 854), (640, 360)] {
        let (project, frames) = fixture_project();
        let mut options = export_options();
        options.width = width;
        options.height = height;
        options.speed = EncodeSpeed::Fast;
        let name = format!("compact-{width}x{height}.mp4");
        options.filename = name.clone();
        let output = temp.path().join(&name);
        encode_movie(project.clone(), frames.clone(), vec![15, 15], options.clone(), binary.clone(), output.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let plan = ExportPlan {
            segments: frames.into_iter().map(|png| PlanSegment {
                kind: "image".into(), png: Some(png), video: None, source_in_seconds: None,
                fit: None, speed: None, speed_end: None, reverse: false, lut: None,
                fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true,
                audio_duration_ticks: None, duration_ticks: 15, overlays: vec![],
            }).collect(),
            options: options.clone(),
        };
        let plan_output = temp.path().join(format!("plan-{width}x{height}.mp4"));
        encode_plan(&project, plan, binary.clone(), plan_output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        for file in [output, plan_output] {
            let probe = Process::new("ffprobe")
                .args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "json"])
                .arg(&file)
                .output()
                .unwrap();
            assert!(probe.status.success(), "{width}×{height} probe failed");
            let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
            assert_eq!(info["streams"][0]["codec_name"], "h264");
            assert_eq!(info["streams"][0]["width"], width, "width of {file:?}");
            assert_eq!(info["streams"][0]["height"], height, "height of {file:?}");
        }
    }
}

#[test]
#[ignore = "Requires FFmpeg with libx264, libx265 and ffprobe installed"]
fn real_hevc_exports_all_containers_and_both_render_paths() {
    let binary = ffmpeg().expect("FFmpeg is installed"); assert!(encoder_available(&binary, ExportCodec::Hevc));
    let temp = tempfile::tempdir().unwrap();
    for container in [ExportContainer::Mp4, ExportContainer::Mov, ExportContainer::Mkv] {
        let (project, frames) = fixture_project();
        let mut options = export_options(); options.width = 320; options.height = 240; options.codec = ExportCodec::Hevc; options.container = container; options.speed = EncodeSpeed::Fast;
        let output = temp.path().join(format!("photo.{}", container.extension()));
        encode_movie(project.clone(), frames.clone(), vec![15,15], options.clone(), binary.clone(), output.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let plan = ExportPlan { segments: frames.into_iter().map(|png| PlanSegment { kind: "image".into(), png: Some(png), video: None, source_in_seconds: None, fit: None, speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, audio_duration_ticks: None, duration_ticks: 15, overlays: vec![] }).collect(), options };
        let plan_output = temp.path().join(format!("plan.{}", container.extension()));
        encode_plan(&project, plan, binary.clone(), plan_output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        for file in [output, plan_output] {
            let probe = Process::new("ffprobe").args(["-v","error","-select_streams","v:0","-show_entries","stream=codec_name,width,height:format=duration","-of","json"]).arg(file).output().unwrap();
            assert!(probe.status.success()); let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
            assert_eq!(info["streams"][0]["codec_name"], "hevc"); assert_eq!(info["streams"][0]["width"], 320);
            let duration: f64 = info["format"]["duration"].as_str().unwrap().parse().unwrap(); assert!((duration - 1.0).abs() < 0.05);
        }
    }
}
#[test]
fn audio_eq_only_emits_bands_that_change() {
    assert_eq!(eq_filters(0.0, 0.0, 0.0), "");
    let bass = eq_filters(6.0, 0.0, 0.0);
    assert!(bass.contains("equalizer=f=120") && bass.contains("g=6.00"), "{bass}");
    assert!(!bass.contains("f=1000") && !bass.contains("f=6000"));
    let all = eq_filters(-3.0, 4.0, 2.0);
    assert!(all.contains("f=120") && all.contains("f=1000") && all.contains("f=6000"), "{all}");
    assert!(all.contains("g=-3.00") && all.contains("g=4.00") && all.contains("g=2.00"));
}

#[test]
fn ramp_and_reverse_arguments_are_well_formed() {
    assert!(ramp_setpts(1.0, 1.0, 2.0).is_none());
    let ramp = ramp_setpts(1.0, 2.0, 2.0).expect("ramp");
    assert!(ramp.starts_with("setpts="), "{ramp}");
    assert!(ramp.contains("sqrt(") && ramp.contains("PTS*TB") && ramp.contains("/TB"), "{ramp}");
    // The inverse curve must map source 0 to output 0.
    assert!(ramp.contains("(-1.000000+sqrt(1.000000*1.000000+"), "{ramp}");

    let (nodes, label) = ramp_atempo_nodes("[2:a]", 1.0, 2.0, 2.0, "rt");
    assert_eq!(label, "[rt]");
    assert!(nodes[0].contains("asplit=8"), "{}", nodes[0]);
    assert_eq!(nodes.iter().filter(|node| node.contains("atempo=")).count(), 8);
    assert!(nodes.last().unwrap().contains("concat=n=8:v=0:a=1[rt]"));
    // The eight slices consume the ramp's source span (3 s for 2 s at 1→2×).
    let consumed: f64 = nodes.iter()
        .filter_map(|node| node.split("atrim=start=").nth(1))
        .filter_map(|rest| rest.split(":end=").next())
        .filter_map(|value| value.parse::<f64>().ok())
        .fold(0.0, |sum, value| sum + value);
    assert!(consumed > 0.0);
    let mut previous = 0.0;
    let mut total = 0.0;
    for node in nodes.iter().filter(|node| node.contains("atrim=start=")) {
        let start: f64 = node.split("atrim=start=").nth(1).unwrap().split(':').next().unwrap().parse().unwrap();
        let end: f64 = node.split(":end=").nth(1).unwrap().split(',').next().unwrap().parse().unwrap();
        assert!((start - previous).abs() < 1e-6, "slices must be contiguous");
        previous = end;
        total += end - start;
    }
    assert!((total - 3.0).abs() < 0.02, "span {total}");
}

#[test]
fn plan_allows_sound_to_outlast_a_shortened_video_segment() {
    let (project, frames) = fixture_project();
    let image = |ticks: u64| PlanSegment {
        kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
        fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0,
        video_volume: None, include_audio: true, audio_duration_ticks: None, duration_ticks: ticks, overlays: vec![],
    };
    let video = |audio: Option<u64>| PlanSegment {
        kind: "video".into(), png: None, video: Some("data:video/mp4;base64,AA==".into()),
        source_in_seconds: Some(0.0), fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None,
        fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true,
        audio_duration_ticks: audio, duration_ticks: 16, overlays: vec![],
    };
    let with = |first: PlanSegment| ExportPlan {
        segments: std::iter::once(first).chain((0..14).map(|_| image(1))).collect(),
        options: export_options(),
    };
    // The visual ends 14 ticks early; the soundtrack covers the baked tail.
    assert!(validate_plan(&project, &with(video(Some(30)))).is_ok());
    // Sound shorter than the picture cannot happen and is rejected.
    assert!(validate_plan(&project, &with(video(Some(10)))).is_err());
    assert!(validate_plan(&project, &with(video(None))).is_ok());
}

#[test]
fn plan_validates_video_speed_and_grade_lut() {
    let (project, frames) = fixture_project();
    let image = || PlanSegment {
        kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
        fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, audio_duration_ticks: None, duration_ticks: 15, overlays: vec![],
    };
    let video = |speed: Option<f64>, lut: Option<String>| PlanSegment {
        kind: "video".into(), png: None, video: Some("data:video/mp4;base64,AA==".into()),
        source_in_seconds: Some(0.0), fit: Some("cover".into()), speed, speed_end: None, reverse: false, lut,
        fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, audio_duration_ticks: None, duration_ticks: 15, overlays: vec![],
    };
    let plan = |second: PlanSegment| ExportPlan { segments: vec![image(), second], options: export_options() };
    assert!(validate_plan(&project, &plan(video(None, None))).is_ok());
    assert!(validate_plan(&project, &plan(video(Some(2.0), Some("LUT_3D_SIZE 2\n".into())))).is_ok());
    assert!(validate_plan(&project, &plan(video(Some(0.1), None))).is_err());
    assert!(validate_plan(&project, &plan(video(Some(9.0), None))).is_err());
    assert!(validate_plan(&project, &plan(video(None, Some("not a lut".into())))).is_err());
    assert!(validate_plan(&project, &plan(video(None, Some(String::new())))).is_err());
}

#[test]
fn plan_rejects_negative_or_non_finite_fades() {
    let (project, frames) = fixture_project();
    let segment = |fade_in: f64, fade_out: f64| PlanSegment {
        kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
        fit: None, speed: None, speed_end: None, reverse: false, lut: None, fade_in, fade_out, video_volume: None, include_audio: true, audio_duration_ticks: None, duration_ticks: 15, overlays: vec![],
    };
    let plan = |first: PlanSegment, second: PlanSegment| ExportPlan { segments: vec![first, second], options: export_options() };
    assert!(validate_plan(&project, &plan(segment(0.25, 0.25), segment(0.25, 0.25))).is_ok());
    assert!(validate_plan(&project, &plan(segment(-0.1, 0.0), segment(0.0, 0.0))).is_err());
    assert!(validate_plan(&project, &plan(segment(0.0, f64::NAN), segment(0.0, 0.0))).is_err());
    assert!(validate_plan(&project, &plan(segment(0.0, f64::INFINITY), segment(0.0, 0.0))).is_err());
}

#[test]
fn tempo_chain_uses_supported_steps_and_keeps_the_speed() {
    assert_eq!(atempo_chain(1.0), "atempo=1.000000");
    assert_eq!(atempo_chain(2.0), "atempo=2.000000");
    assert_eq!(atempo_chain(4.0), "atempo=2.000000,atempo=2.000000");
    assert_eq!(atempo_chain(0.5), "atempo=0.500000");
    assert_eq!(atempo_chain(0.25), "atempo=0.500000,atempo=0.500000");
    for speed in [0.3, 0.75, 1.5, 2.5, 3.0] {
        let steps: Vec<f64> = atempo_chain(speed)
            .split(',')
            .map(|step| step.trim_start_matches("atempo=").parse::<f64>().unwrap())
            .collect();
        let product: f64 = steps.iter().product();
        assert!((product - speed).abs() < 1e-5, "speed {speed} became {steps:?}");
        assert!(steps.iter().all(|step| (0.5..=2.0).contains(step)), "out-of-range step in {steps:?}");
    }
}

#[test]
#[ignore = "Requires FFmpeg with libx264, aac and ffprobe installed"]
fn plan_export_keeps_imported_video_audio() {
    let binary = ffmpeg().expect("FFmpeg must be installed for this test");
    assert!(encoder_available(&binary, ExportCodec::H264));
    let temp = tempfile::tempdir().unwrap();
    let clip = temp.path().join("tone.mp4");
    let status = Process::new(&binary)
        .args([
            "-y", "-v", "error",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
            "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest",
        ])
        .arg(&clip)
        .status()
        .unwrap();
    assert!(status.success());
    assert!(has_audio_stream(&binary, &clip), "the fixture clip must carry audio");
    let silent = temp.path().join("silent.mp4");
    let silent_status = Process::new(&binary)
        .args(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=30:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p"])
        .arg(&silent)
        .status()
        .unwrap();
    assert!(silent_status.success());
    assert!(!has_audio_stream(&binary, &silent));

    let video = format!("data:video/mp4;base64,{}", STANDARD.encode(fs::read(&clip).unwrap()));
    let (mut project, frames) = fixture_project();
    // A music bed plus ducking exercises the volume expression in the graph.
    project.audio = vec![AudioClip {
        id: "music".into(),
        name: "Bed.wav".into(),
        data: format!("data:audio/wav;base64,{}", STANDARD.encode(wav_silence(1.0))).into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 30,
        source_in_seconds: 0.0,
        source_duration_seconds: 1.0,
        volume: 0.8,
        fade_in: 0.0,
        fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
    project.ducking = Some(60.0);
    let plan = |include_audio: bool| ExportPlan {
        segments: vec![
            PlanSegment {
                kind: "video".into(), png: None, video: Some(video.clone()), source_in_seconds: Some(0.0),
                fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio,
                duration_ticks: 15, audio_duration_ticks: None, overlays: vec![],
            },
            PlanSegment {
                kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
                fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio,
                duration_ticks: 15, audio_duration_ticks: None, overlays: vec![],
            },
        ],
        options: export_options(),
    };
    let output = temp.path().join("video-audio.mp4");
    encode_plan(&project, plan(true), binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let probe = Process::new(binary.with_file_name("ffprobe"))
        .args(["-v", "error", "-show_entries", "stream=codec_type", "-of", "json"])
        .arg(&output)
        .output()
        .unwrap();
    assert!(probe.status.success(), "{}", String::from_utf8_lossy(&probe.stderr));
    let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
    assert!(info["streams"].as_array().unwrap().iter().any(|stream| stream["codec_type"] == "audio"));
    let volume = Process::new(&binary)
        .args(["-hide_banner", "-nostats", "-i"])
        .arg(&output)
        .args(["-af", "volumedetect", "-f", "null", "-"])
        .output()
        .unwrap();
    let log = String::from_utf8_lossy(&volume.stderr);
    let mean = log.lines().find(|line| line.contains("mean_volume:")).unwrap_or("mean_volume: -inf dB");
    let db: f64 = mean.split("mean_volume:").nth(1).unwrap_or(" -inf ").split("dB").next().unwrap_or(" -inf ").trim().parse().unwrap_or(-100.0);
    assert!(db > -40.0, "expected the imported tone, got {mean}");

    // The timeline's video-audio bus silences imported sound on export too.
    project.audio.clear();
    project.ducking = None;
    project.audio_mix = Some(pixcut_project::AudioMix { video: 0.0, lanes: vec![] });
    let bus_muted = temp.path().join("video-bus-muted.mp4");
    encode_plan(&project, plan(true), binary.clone(), bus_muted.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let bus_volume = Process::new(&binary)
        .args(["-hide_banner", "-nostats", "-i"])
        .arg(&bus_muted)
        .args(["-af", "volumedetect", "-f", "null", "-"])
        .output()
        .unwrap();
    let bus_log = String::from_utf8_lossy(&bus_volume.stderr);
    let bus_mean = bus_log.lines().find(|line| line.contains("mean_volume:")).unwrap_or("mean_volume: -inf dB");
    let bus_db: f64 = bus_mean.split("mean_volume:").nth(1).unwrap_or(" -inf ").split("dB").next().unwrap_or(" -inf ").trim().parse().unwrap_or(-100.0);
    assert!(bus_db < -80.0, "expected the muted video bus to be silent, got {bus_mean}");
    project.audio_mix = None;

    // The export dialog's include-audio switch also drops the music bed.
    let muted = temp.path().join("video-muted.mp4");
    encode_plan(&project, plan(false), binary.clone(), muted.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let muted_probe = Process::new(binary.with_file_name("ffprobe"))
        .args(["-v", "error", "-show_entries", "stream=codec_type", "-of", "json"])
        .arg(&muted)
        .output()
        .unwrap();
    assert!(muted_probe.status.success(), "{}", String::from_utf8_lossy(&muted_probe.stderr));
    let muted_info: serde_json::Value = serde_json::from_slice(&muted_probe.stdout).unwrap();
    assert!(!muted_info["streams"].as_array().unwrap().iter().any(|stream| stream["codec_type"] == "audio"));
}

#[test]
#[ignore = "Requires FFmpeg with libx264, aac and ffprobe installed"]
fn export_applies_audio_lane_gain_and_mute() {
    let binary = ffmpeg().expect("FFmpeg must be installed for this test");
    assert!(encoder_available(&binary, ExportCodec::H264));
    let temp = tempfile::tempdir().unwrap();
    let (mut project, frames) = fixture_project();
    project.audio = vec![AudioClip {
        id: "tone".into(),
        name: "Tone.wav".into(),
        data: format!("data:audio/wav;base64,{}", STANDARD.encode(wav_tone(1.0, 440.0))).into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 30,
        source_in_seconds: 0.0,
        source_duration_seconds: 1.0,
        volume: 1.0,
        fade_in: 0.0,
        fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
    let plan = || ExportPlan {
        segments: vec![PlanSegment {
            kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
            fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None,
            fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true,
            duration_ticks: 30, audio_duration_ticks: None, overlays: vec![],
        }],
        options: export_options(),
    };
    let mut level = |name: &str, mix: Option<pixcut_project::AudioMix>| {
        project.audio_mix = mix;
        let output = temp.path().join(name);
        encode_plan(&project, plan(), binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let volume = Process::new(&binary)
            .args(["-hide_banner", "-nostats", "-i"])
            .arg(&output)
            .args(["-af", "volumedetect", "-f", "null", "-"])
            .output()
            .unwrap();
        let log = String::from_utf8_lossy(&volume.stderr);
        let mean = log.lines().find(|line| line.contains("mean_volume:")).unwrap_or("mean_volume: -inf dB");
        mean.split("mean_volume:").nth(1).unwrap_or(" -inf ").split("dB").next().unwrap_or(" -inf ").trim().parse::<f64>().unwrap_or(-100.0)
    };
    let full = level("full.mp4", None);
    let half = level("half.mp4", Some(pixcut_project::AudioMix { video: 1.0, lanes: vec![pixcut_project::AudioLaneMix { lane: 0, volume: 0.5, muted: false }] }));
    let muted = level("muted.mp4", Some(pixcut_project::AudioMix { video: 1.0, lanes: vec![pixcut_project::AudioLaneMix { lane: 0, volume: 1.0, muted: true }] }));
    assert!(full > -40.0, "expected the tone, got {full} dB");
    assert!((full - half - 6.02).abs() < 1.5, "half volume should be about 6 dB quieter: {full} vs {half}");
    assert!(muted < -80.0, "a muted lane should be silent, got {muted} dB");
}

#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_video_export_applies_grade_fade_and_speed() {
    let binary = ffmpeg().expect("FFmpeg is installed");
    assert!(encoder_available(&binary, ExportCodec::H264));
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("source.mp4");
    let status = Process::new(&binary)
        .args(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=320x240:r=30:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p"])
        .arg(&source).status().unwrap();
    assert!(status.success());
    let video = format!("data:video/mp4;base64,{}", STANDARD.encode(fs::read(&source).unwrap()));
    let (mut project, _) = fixture_project();
    project.tracks[0].clips.truncate(1);
    project.tracks[0].clips[0].media_kind = Some("video".into());
    project.tracks[0].clips[0].image = video.clone().into();
    project.tracks[0].clips[0].duration_ticks = 15;
    project.tracks[0].clips[0].speed = 2.0;
    project.tracks[0].clips[0].fade_in = 0.2;
    // A 2-point LUT that maps every input colour to white proves the cube reaches FFmpeg.
    let mut lut = String::from("LUT_3D_SIZE 2\n");
    for _ in 0..8 { lut.push_str("1.000000 1.000000 1.000000\n"); }
    let mut options = export_options();
    options.width = 320; options.height = 240; options.speed = EncodeSpeed::Fast; options.filename = "graded.mp4".into();
    let plan = ExportPlan {
        segments: vec![PlanSegment {
            kind: "video".into(), png: None, video: Some(video), source_in_seconds: Some(0.0),
            fit: Some("cover".into()), speed: Some(2.0), speed_end: None, reverse: false, lut: Some(lut),
            fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, audio_duration_ticks: None, duration_ticks: 15, overlays: vec![],
        }],
        options,
    };
    let output = temp.path().join("graded.mp4");
    encode_plan(&project, plan, binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let probe = Process::new(&binary).args(["-hide_banner", "-i"]).arg(&output).output().unwrap();
    let text = String::from_utf8_lossy(&probe.stderr);
    assert!(text.contains("Duration: 00:00:00.50"), "{text}");
    let pixel_at = |seconds: &str| {
        let result = Process::new(&binary).args(["-v", "error", "-ss", seconds, "-i"]).arg(&output)
            .args(["-frames:v", "1", "-vf", "crop=2:2:0:0,format=rgb24", "-f", "rawvideo", "-"])
            .output().unwrap();
        assert!(result.status.success());
        result.stdout
    };
    let faded = pixel_at("0.02");
    let graded = pixel_at("0.4");
    assert!(faded[0] < 140, "fade-in should darken the first frame: {faded:?}");
    assert!(graded[0] > 240 && graded[1] > 240 && graded[2] > 240, "the LUT should turn the red clip white: {graded:?}");
}

#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_video_transition_keeps_duration_and_sound() {
    let binary = ffmpeg().expect("FFmpeg is installed");
    assert!(encoder_available(&binary, ExportCodec::H264));
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("source.mp4");
    let status = Process::new(&binary)
        .args([
            "-y", "-v", "error",
            "-f", "lavfi", "-i", "color=c=red:s=320x240:r=30:d=1",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
        ])
        .arg(&source).status().unwrap();
    assert!(status.success());
    let video = format!("data:video/mp4;base64,{}", STANDARD.encode(fs::read(&source).unwrap()));
    let (project, frames) = fixture_project();
    let mut options = export_options();
    options.width = 320; options.height = 240; options.speed = EncodeSpeed::Fast;
    let mut segments = vec![PlanSegment {
        kind: "video".into(), png: None, video: Some(video), source_in_seconds: Some(0.0),
        fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0,
        video_volume: None, include_audio: true, audio_duration_ticks: Some(30),
        duration_ticks: 16, overlays: vec![],
    }];
    for _ in 0..14 {
        segments.push(PlanSegment {
            kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
            fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0,
            video_volume: None, include_audio: true, audio_duration_ticks: None,
            duration_ticks: 1, overlays: vec![],
        });
    }
    let output = temp.path().join("transition.mp4");
    encode_plan(&project, ExportPlan { segments, options }, binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let probe = Process::new(binary.with_file_name("ffprobe"))
        .args(["-v", "error", "-show_entries", "stream=codec_type:format=duration,nb_streams", "-of", "json"])
        .arg(&output).output().unwrap();
    assert!(probe.status.success(), "{}", String::from_utf8_lossy(&probe.stderr));
    let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
    let streams = info["streams"].as_array().unwrap();
    assert!(streams.iter().any(|stream| stream["codec_type"] == "audio"));
    let duration: f64 = info["format"]["duration"].as_str().unwrap().parse().unwrap();
    assert!((duration - 1.0).abs() < 0.08, "duration {duration}");
}

#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_reverse_and_ramp_video_export() {
    let binary = ffmpeg().expect("FFmpeg is installed");
    assert!(encoder_available(&binary, ExportCodec::H264));
    let temp = tempfile::tempdir().unwrap();
    let (project, frames) = fixture_project();
    let mut options = export_options();
    options.width = 320; options.height = 240; options.speed = EncodeSpeed::Fast;
    let probe_duration = |file: &Path| -> f64 {
        let probe = Process::new(binary.with_file_name("ffprobe"))
            .args(["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0"])
            .arg(file).output().unwrap();
        String::from_utf8_lossy(&probe.stdout).trim().parse().unwrap()
    };
    let frame_at = |file: &Path, seconds: &str| -> Vec<u8> {
        let output = Process::new(&binary)
            .args(["-v", "error", "-ss", seconds, "-i"]).arg(file)
            .args(["-frames:v", "1", "-vf", "scale=2:2,format=gray", "-f", "rawvideo", "-"])
            .output().unwrap();
        assert!(output.status.success());
        output.stdout
    };

    // A clip that ends on a white flash: reversing puts the flash first.
    let source = temp.path().join("flash.mp4");
    let status = Process::new(&binary)
        .args([
            "-y", "-v", "error",
            "-f", "lavfi", "-i", "color=c=black:s=160x120:r=30:d=0.9",
            "-f", "lavfi", "-i", "color=c=white:s=160x120:r=30:d=0.1",
            "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
        ])
        .arg(&source).status().unwrap();
    assert!(status.success());
    let video = format!("data:video/mp4;base64,{}", STANDARD.encode(fs::read(&source).unwrap()));
    let reverse_plan = ExportPlan {
        segments: vec![PlanSegment {
            kind: "video".into(), png: None, video: Some(video), source_in_seconds: Some(0.0),
            fit: Some("cover".into()), speed: None, speed_end: None, reverse: true, lut: None,
            fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true,
            audio_duration_ticks: None, duration_ticks: 30, overlays: vec![],
        }],
        options: options.clone(),
    };
    let reversed = temp.path().join("reversed.mp4");
    encode_plan(&project, reverse_plan, binary.clone(), reversed.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    assert!((probe_duration(&reversed) - 1.0).abs() < 0.08);
    let first = frame_at(&reversed, "0.05");
    let last = frame_at(&reversed, "0.7");
    assert!(first.iter().all(|value| *value > 180), "reversed start should be the white flash: {first:?}");
    assert!(last.iter().all(|value| *value < 70), "reversed end should be black: {last:?}");

    // A 1 s output with a 1×→2× ramp consumes 1.5 s of a 2 s source.
    let ramp_source = temp.path().join("ramp.mp4");
    let status = Process::new(&binary)
        .args(["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=320x240:r=30:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p"])
        .arg(&ramp_source).status().unwrap();
    assert!(status.success());
    let ramp_video = format!("data:video/mp4;base64,{}", STANDARD.encode(fs::read(&ramp_source).unwrap()));
    let ramp_plan = ExportPlan {
        segments: vec![PlanSegment {
            kind: "video".into(), png: None, video: Some(ramp_video), source_in_seconds: Some(0.0),
            fit: Some("cover".into()), speed: Some(1.0), speed_end: Some(2.0), reverse: false, lut: None,
            fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true,
            audio_duration_ticks: None, duration_ticks: 30, overlays: vec![],
        }],
        options: options.clone(),
    };
    let ramped = temp.path().join("ramped.mp4");
    encode_plan(&project, ramp_plan, binary.clone(), ramped.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    assert!((probe_duration(&ramped) - 1.0).abs() < 0.1, "ramp duration {}", probe_duration(&ramped));
}

fn fixture_project() -> (Project, Vec<String>) {
    let frames: Vec<String> = [
        include_bytes!("../../tests/fixtures/red.png").as_slice(),
        include_bytes!("../../tests/fixtures/green.png").as_slice(),
    ]
    .iter()
    .map(|bytes| format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
    .collect();
    let mut p = Project::default();
    p.tracks[0].clips = frames
        .iter()
        .enumerate()
        .map(|(i, frame)| pixcut_project::Scene {
            media_kind: None,
            video_poster: None,
            elements: vec![],
            motion: None,
            motion_amount: None,
            id: i.to_string(),
            name: "Fixture".into(),
            image: frame.as_str().into(),
            start_ticks: i as u64 * 15,
            source_in_ticks: 0,
            source_duration_seconds: None,
            duration_ticks: 15,
            legacy_duration: None,
            title: "".into(),
            subtitle: "".into(),
            text_layers: vec![],
            transition: None,
            pip: None,
            color: "#ffffff".into(),
            fit: "cover".into(),
            image_x: 0.0,
            image_y: 0.0,
            image_zoom: 1.0,
            framing_keyframes: vec![],
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
            speed_end: None,
            reverse: false,
            pitch: true,
            video_volume: None,
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
        })
        .collect();
    p.formats = vec![pixcut_project::FormatVariant {
        id: "format-original".into(),
        name: "Original".into(),
        platform: "Original".into(),
        aspect: "16:9".into(),
        width: 1920,
        height: 1080,
        fps: 30,
        quality: "standard".into(),
        preset_id: None,
        overrides: Default::default(),
    }];
    (p, frames)
}
#[test]
fn project_save_roundtrips_and_replaces_atomically() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("project.json");
    let (mut p, _) = fixture_project();
    atomic_write(&path, &p).unwrap();
    assert_eq!(read_project(&path).unwrap(), p);
    p.name = "Changed".into();
    atomic_write(&path, &p).unwrap();
    assert_eq!(read_project(&path).unwrap().name, "Changed");
}
#[test]
fn invalid_export_preserves_existing_destination() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("movie.mp4");
    fs::write(&path, b"original movie").unwrap();
    let (p, _) = fixture_project();
    assert!(encode_movie(p, vec!["invalid".into(); 2], vec![15, 15], export_options(), "ffmpeg".into(), path.clone(), Arc::new(AtomicBool::new(false)), |_| {}).is_err());
    assert_eq!(fs::read(&path).unwrap(), b"original movie");
}
#[test]
fn guard_turns_a_panic_into_a_friendly_error() {
    let error = guard("testing", || -> Result<(), String> { panic!("boom") }).unwrap_err();
    assert!(error.contains("recovered"), "{error}");
    assert!(error.contains("boom"), "{error}");
    assert!(error.contains("still saved"), "{error}");
}

#[test]
fn cancelled_export_writes_nothing() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("movie.mp4");
    let (p, frames) = fixture_project();
    let error = encode_movie(
        p,
        frames,
        vec![15, 15],
        export_options(),
        "ffmpeg".into(),
        path.clone(),
        Arc::new(AtomicBool::new(true)),
        |_| {},
    )
    .unwrap_err();
    assert!(error.contains("cancelled"), "{error}");
    assert!(!path.exists());
}

#[test]
fn video_assets_roundtrip_through_the_local_store() {
    let temp = tempfile::tempdir().unwrap();
    let (mut p, _) = fixture_project();
    p.tracks[0].clips[0].image = "data:video/mp4;base64,AAAA".into();
    p.tracks[0].clips[0].media_kind = Some("video".into());
    persist_project(temp.path(), &mut p).unwrap();
    assert!(p.tracks[0].clips[0].image.starts_with("pixcut-asset:"));
    // The editor keeps imported video on disk and serves it through the
    // asset protocol; a full hydration still returns the original data.
    hydrate_project(temp.path(), &mut p, true).unwrap();
    assert!(p.tracks[0].clips[0].image.starts_with("pixcut-asset:"));
    assert_eq!(p.tracks[0].clips[0].media_kind.as_deref(), Some("video"));
    hydrate_project(temp.path(), &mut p, false).unwrap();
    assert_eq!(p.tracks[0].clips[0].image.as_ref(), "data:video/mp4;base64,AAAA");
}

#[test]
fn second_instance_routes_only_project_paths() {
    assert_eq!(pixcut_path_from_args(["/Applications/PixCut.app/Contents/MacOS/pixcut"]), None);
    assert_eq!(pixcut_path_from_args(["--flag", "/tmp/notes.txt"]), None);
    assert_eq!(
        pixcut_path_from_args(["/Applications/PixCut.app/Contents/MacOS/pixcut", "/tmp/Story.PIXCUT"]),
        Some(PathBuf::from("/tmp/Story.PIXCUT"))
    );
}

#[test]
fn project_filename_is_safe_and_bounded() {        assert_eq!(safe_filename("A little further"), "A little further");
    assert_eq!(safe_filename("../../etc/passwd"), "etcpasswd");
    assert_eq!(safe_filename("   "), "PixCut project");
    assert_eq!(safe_filename(&"x".repeat(200)).chars().count(), 120);
}

#[test]
fn asset_store_reports_and_prunes_only_hashed_media() {
    let temp = tempfile::tempdir().unwrap();
    let directory = temp.path();
    let keep_id = "a".repeat(64);
    let drop_id = "b".repeat(64);
    fs::write(directory.join(format!("{keep_id}.mp4")), vec![0u8; 100]).unwrap();
    fs::write(directory.join(format!("{drop_id}.wav")), vec![0u8; 50]).unwrap();
    fs::write(directory.join("notes.txt"), b"not an asset").unwrap();
    let usage = store_usage(directory);
    assert_eq!(usage.files, 2);
    assert_eq!(usage.bytes, 150);
    let keep = std::collections::HashSet::from([keep_id.clone()]);
    let removed = prune_store(directory, &keep).unwrap();
    assert_eq!(removed.files, 1);
    assert_eq!(removed.bytes, 50);
    assert!(directory.join(format!("{keep_id}.mp4")).exists());
    assert!(!directory.join(format!("{drop_id}.wav")).exists());
    assert!(directory.join("notes.txt").exists());
    assert_eq!(store_usage(directory).files, 1);
}

#[test]
fn asset_file_finds_streamed_media_and_rejects_bad_ids() {
    let temp = tempfile::tempdir().unwrap();
    let bytes = b"streamed video bytes";
    let id = asset_hash(bytes);
    fs::write(temp.path().join(format!("{id}.mp4")), bytes).unwrap();
    let found = asset_file(temp.path(), &id).expect("stored asset is found");
    assert!(found.ends_with(format!("{id}.mp4")));
    assert!(asset_file(temp.path(), "../escape").is_none());
    assert!(asset_file(temp.path(), &"z".repeat(64)).is_none());
    assert!(asset_file(temp.path(), &id[..63]).is_none());
}

#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn plan_export_reads_streamed_video_assets() {
    let binary = ffmpeg().expect("FFmpeg is installed");
    assert!(encoder_available(&binary, ExportCodec::H264));
    let temp = tempfile::tempdir().unwrap();
    let clip = temp.path().join("source.mp4");
    let status = Process::new(&binary)
        .args(["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30", "-t", "1", "-pix_fmt", "yuv420p"])
        .arg(&clip)
        .status()
        .unwrap();
    assert!(status.success());
    let bytes = fs::read(&clip).unwrap();
    let id = asset_hash(&bytes);
    let store = temp.path().join("store");
    fs::create_dir_all(&store).unwrap();
    fs::write(store.join(format!("{id}.mp4")), &bytes).unwrap();

    let audio_bytes = wav_silence(1.0);
    let audio_id = asset_hash(&audio_bytes);
    fs::write(store.join(format!("{audio_id}.wav")), &audio_bytes).unwrap();
    let (mut project, frames) = fixture_project();
    project.audio = vec![AudioClip {
        id: "streamed-audio".into(),
        name: "Bed.wav".into(),
        data: format!("pixcut-asset:{audio_id}").into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 30,
        source_in_seconds: 0.0,
        source_duration_seconds: 1.0,
        volume: 0.8,
        fade_in: 0.0,
        fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
    let plan = ExportPlan {
        segments: vec![
            PlanSegment {
                kind: "video".into(), png: None, video: Some(format!("pixcut-asset:{id}")), source_in_seconds: Some(0.0),
                fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None,
                include_audio: true, audio_duration_ticks: None, duration_ticks: 15, overlays: vec![],
            },
            PlanSegment {
                kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
                fit: Some("cover".into()), speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None,
                include_audio: true, audio_duration_ticks: None, duration_ticks: 15, overlays: vec![],
            },
        ],
        options: export_options(),
    };
    validate_plan(&project, &plan).unwrap();
    let output = temp.path().join("streamed.mp4");
    encode_plan(&project, plan, binary.clone(), output.clone(), &store, Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let probe = Process::new(binary.with_file_name("ffprobe"))
        .args(["-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json"])
        .arg(&output)
        .output()
        .unwrap();
    assert!(probe.status.success(), "{}", String::from_utf8_lossy(&probe.stderr));
    let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
    let video = info["streams"].as_array().unwrap().iter().find(|stream| stream["codec_type"] == "video").unwrap();
    assert_eq!(video["width"], 1920);
    assert_eq!(video["height"], 1080);
    assert!(info["streams"].as_array().unwrap().iter().any(|stream| stream["codec_type"] == "audio"));
}

#[test]
fn ducking_expression_targets_video_windows() {
    let expression = ducking_expression(&[(2.0, 4.0)], 1.0, 60.0);
    assert!(expression.starts_with("1-0.600000*max(0,"), "{expression}");
    assert!(expression.contains("t+1.000000-2.000000"), "{expression}");
    assert!(expression.contains("4.000000-(t+1.000000)"), "{expression}");
    let two = ducking_expression(&[(2.0, 4.0), (6.0, 8.0)], 0.0, 50.0);
    assert_eq!(two.matches("min(max(").count(), 4);
    assert!(!two.contains("clip("));
    assert!(ducking_expression(&[(2.0, 4.0)], 0.0, 0.0).starts_with("1-0.000000*max(0,"));
}

#[test]
fn still_frames_accept_only_png_and_jpeg_payloads() {
    assert_eq!(still_frame_extension("image/png"), Some("png"));
    assert_eq!(still_frame_extension("image/jpeg"), Some("jpg"));
    assert_eq!(still_frame_extension("image/webp"), None);
    assert_eq!(still_frame_extension("audio/mpeg"), None);
    let (mime, bytes) = parse_data_url("data:image/png;base64,iVBORw0KGgo=").unwrap();
    assert_eq!(still_frame_extension(mime), Some("png"));
    assert_eq!(bytes.len(), 8);
}
#[test]
fn legacy_project_file_migrates_without_mutating_source() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("legacy.json");
    let legacy = serde_json::json!({
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
    });
    fs::write(&path, serde_json::to_vec(&legacy).unwrap()).unwrap();
    let before = fs::read_to_string(&path).unwrap();
    let (project, migrated) = read_project_with_migration(&path).unwrap();
    assert!(migrated);
    assert_eq!(project.schema_version, 15);
    assert_eq!(project.visual_clips()[0].duration_ticks, 120);
    assert_eq!(fs::read_to_string(&path).unwrap(), before);
}
fn wav_silence(seconds: f32) -> Vec<u8> {
    let sample_rate = 8_000u32;
    let samples = (sample_rate as f32 * seconds) as u32;
    let data_len = samples * 2;
    let mut bytes = Vec::with_capacity(44 + data_len as usize);
    bytes.extend(b"RIFF");
    bytes.extend(&(36 + data_len).to_le_bytes());
    bytes.extend(b"WAVEfmt ");
    bytes.extend(&16u32.to_le_bytes());
    bytes.extend(&1u16.to_le_bytes());
    bytes.extend(&1u16.to_le_bytes());
    bytes.extend(&sample_rate.to_le_bytes());
    bytes.extend(&(sample_rate * 2).to_le_bytes());
    bytes.extend(&2u16.to_le_bytes());
    bytes.extend(&16u16.to_le_bytes());
    bytes.extend(b"data");
    bytes.extend(&data_len.to_le_bytes());
    bytes.extend(vec![0u8; data_len as usize]);
    bytes
}
fn wav_tone(seconds: f32, frequency: f32) -> Vec<u8> {
    let sample_rate = 8_000u32;
    let samples = (sample_rate as f32 * seconds) as u32;
    let data_len = samples * 2;
    let mut bytes = Vec::with_capacity(44 + data_len as usize);
    bytes.extend(b"RIFF");
    bytes.extend(&(36 + data_len).to_le_bytes());
    bytes.extend(b"WAVEfmt ");
    bytes.extend(&16u32.to_le_bytes());
    bytes.extend(&1u16.to_le_bytes());
    bytes.extend(&1u16.to_le_bytes());
    bytes.extend(&sample_rate.to_le_bytes());
    bytes.extend(&(sample_rate * 2).to_le_bytes());
    bytes.extend(&2u16.to_le_bytes());
    bytes.extend(&16u16.to_le_bytes());
    bytes.extend(b"data");
    bytes.extend(&data_len.to_le_bytes());
    for index in 0..samples {
        let value = (index as f32 / sample_rate as f32 * frequency * std::f32::consts::TAU).sin();
        bytes.extend(((value * 12_000.0) as i16).to_le_bytes());
    }
    bytes
}
#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn plan_export_encodes_video_and_image_segments() {
    let binary = ffmpeg().expect("FFmpeg must be installed for this test");
    let temp = tempfile::tempdir().unwrap();
    let clip = temp.path().join("clip.mp4");
    let status = Process::new(&binary)
        .args(["-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30", "-t", "1", "-pix_fmt", "yuv420p"])
        .arg(&clip)
        .status()
        .unwrap();
    assert!(status.success());
    let video = format!(
        "data:video/mp4;base64,{}",
        STANDARD.encode(fs::read(&clip).unwrap())
    );
    let overlay_path = temp.path().join("overlay.png");
    let overlay_status = Process::new(&binary)
        .args(["-y", "-f", "lavfi", "-i", "color=c=black@0.0:s=640x360", "-frames:v", "1"])
        .arg(&overlay_path)
        .status()
        .unwrap();
    assert!(overlay_status.success());
    let overlay = format!(
        "data:image/png;base64,{}",
        STANDARD.encode(fs::read(&overlay_path).unwrap())
    );
    let red_path = temp.path().join("red-overlay.png");
    let red_status = Process::new(&binary)
        .args(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=640x360", "-frames:v", "1"])
        .arg(&red_path).status().unwrap();
    assert!(red_status.success());
    let red_overlay = format!("data:image/png;base64,{}", STANDARD.encode(fs::read(red_path).unwrap()));
    let (mut project, frames) = fixture_project();
    project.tracks[0].clips[1].media_kind = Some("video".into());
    let plan = ExportPlan {
        segments: vec![
            PlanSegment {
                kind: "image".into(),
                png: Some(frames[0].clone()),
                video: None,
                source_in_seconds: None,
                fit: Some("cover".into()),
                speed: None, speed_end: None, reverse: false,
                lut: None,
                fade_in: 0.0,
                fade_out: 0.0,
                video_volume: None,
                include_audio: true,
                audio_duration_ticks: None,
                duration_ticks: 15,
                overlays: vec![],
            },
            PlanSegment {
                kind: "video".into(),
                png: None,
                video: Some(video),
                source_in_seconds: Some(0.0),
                fit: Some("cover".into()),
                speed: None, speed_end: None, reverse: false,
                lut: None,
                fade_in: 0.0,
                fade_out: 0.0,
                video_volume: None,
                include_audio: true,
                audio_duration_ticks: None,
                duration_ticks: 15,
                overlays: vec![PlanOverlay { png: overlay.clone(), frames: (0..15).map(|index| if index < 7 { overlay.clone() } else { red_overlay.clone() }).collect(), start_ticks: 15, duration_ticks: 15 }],
            },
        ],
        options: export_options(),
    };
    let output = temp.path().join("plan.mp4");
    encode_plan(&project, plan, binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    assert!(output.exists());
    let probe = Process::new(&binary)
        .args(["-hide_banner", "-i"])
        .arg(&output)
        .output()
        .unwrap();
    let text = String::from_utf8_lossy(&probe.stderr);
    assert!(text.contains("Video: h264"), "{text}");
    assert!(text.contains("Duration: 00:00:01.00"), "{text}");
    // The overlay sequence begins at the video cut, not at the project origin.
    let pixel_at = |seconds: &str| {
        let result = Process::new(&binary).args(["-v", "error", "-ss", seconds, "-i"])
            .arg(&output).args(["-frames:v", "1", "-vf", "crop=2:2:0:0,format=rgb24", "-f", "rawvideo", "-"])
            .output().unwrap();
        assert!(result.status.success());
        result.stdout
    };
    let early = pixel_at("0.55");
    let late = pixel_at("0.85");
    assert!(early.len() >= 3 && late.len() >= 3);
    assert!(early[0] < 40, "first overlay frame should be black: {early:?}");
    assert!(late[0] > 180 && late[1] < 60, "later overlay frame should be red: {late:?}");
}

#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_mp4_includes_multiple_audio_clips() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("music.mp4");
    let (mut project, frames) = fixture_project();
    project.audio = vec![AudioClip {
        id: "audio-1".into(),
        name: "Bed.wav".into(),
        data: format!(
            "data:audio/wav;base64,{}",
            STANDARD.encode(wav_silence(1.0))
        )
        .into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 15,
        source_in_seconds: 0.0,
        source_duration_seconds: 1.0,
        volume: 0.8,
        fade_in: 0.2,
        fade_out: 0.2, low: 0.0, mid: 0.0, high: 0.0, credit: None }, AudioClip {
        id: "audio-2".into(),
        name: "Bed 2.wav".into(),
        data: format!(
            "data:audio/wav;base64,{}",
            STANDARD.encode(wav_silence(1.0))
        )
        .into(),
        lane: 0,
        start_ticks: 15,
        duration_ticks: 15,
        source_in_seconds: 0.2,
        source_duration_seconds: 1.0,
        volume: 0.6,
        fade_in: 0.0,
        fade_out: 0.1, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
    let binary = ffmpeg().expect("FFmpeg must be installed for this test");
    encode_movie(project, frames, vec![15, 15], export_options(), binary.clone(), path.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let result = Process::new(binary.with_file_name("ffprobe"))
        .args([
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,channels",
            "-of",
            "json",
        ])
        .arg(path)
        .output()
        .unwrap();
    assert!(result.status.success());
    let info: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(info["streams"][0]["codec_name"], "aac");
    assert_eq!(info["streams"][0]["channels"], 1);
}
#[test]
fn project_bundle_roundtrips_with_binary_assets() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("story.pixcut");
    let (mut project, _) = fixture_project();
    project.audio = vec![AudioClip {
        id: "audio-1".into(),
        name: "Bed.wav".into(),
        data: format!(
            "data:audio/wav;base64,{}",
            STANDARD.encode(wav_silence(1.0))
        )
        .into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 15,
        source_in_seconds: 0.0,
        source_duration_seconds: 1.0,
        volume: 0.8,
        fade_in: 0.2,
        fade_out: 0.2, low: 0.0, mid: 0.0, high: 0.0, credit: None }, AudioClip {
        id: "audio-2".into(),
        name: "Bed 2.wav".into(),
        data: format!(
            "data:audio/wav;base64,{}",
            STANDARD.encode(wav_silence(1.0))
        )
        .into(),
        lane: 0,
        start_ticks: 15,
        duration_ticks: 15,
        source_in_seconds: 0.2,
        source_duration_seconds: 1.0,
        volume: 0.6,
        fade_in: 0.0,
        fade_out: 0.1, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
    write_project_bundle(&path, &project, None).unwrap();
    let manifest_text = {
        let file = fs::File::open(&path).unwrap();
        let mut archive = ZipArchive::new(file).unwrap();
        let mut text = String::new();
        archive
            .by_name("manifest.json")
            .unwrap()
            .read_to_string(&mut text)
            .unwrap();
        text
    };
    assert!(!manifest_text.contains("data:image"));
    assert!(!manifest_text.contains("data:audio"));
    assert!(manifest_text.contains("pixcut-asset:"));
    let manifest: BundleManifest = serde_json::from_str(&manifest_text).unwrap();
    assert_eq!(manifest.format, "pixcut");
    assert_eq!(manifest.assets.len(), 3);
    assert_eq!(read_project_bundle(&path).unwrap(), project);
}
#[test]
fn captured_export_is_independent_of_later_edits_or_new_projects() {
    let (project, _) = fixture_project(); let frozen = checked_export_snapshot(&project.id, project.clone()).unwrap();
    let mut editor = pixcut_project::Session { project, ..Default::default() };
    editor.apply(Command::Rename { name: "Working version".into() }).unwrap();
    let mut other = Project::default(); other.id = "another-project".into();
    editor.apply(Command::Replace { project: other }).unwrap();
    assert_ne!(editor.project.id, frozen.id);
    assert!(checked_export_snapshot(&frozen.id, frozen.clone()).is_ok());
    assert!(checked_export_snapshot("wrong-id", frozen).is_err());
}
#[test]
fn custom_overlays_roundtrip_in_bundle_and_local_store() {
    let temp = tempfile::tempdir().unwrap();
    let (mut project, _) = fixture_project();
    let source = project.visual_clips()[0].image.clone();
    let overlay = serde_json::json!({"id":"overlay", "kind":"image", "source":source, "loop":true, "animationDuration":0.8, "x":0.7,"y":0.3,"width":0.3,"height":0.2,"rotation":0,"color":"#FFFFFF","opacity":100,"startTicks":0,"durationTicks":15,"animation":"float"});
    project.tracks[0].clips[0].elements = vec![serde_json::from_value(overlay).unwrap()];
    project.overlays = project.tracks[0].clips[0].elements.clone();
    project.overlays[0].id = "global-overlay".into();
    project.audio = vec![AudioClip {
        id: "audio-1".into(),
        name: "Bed.wav".into(),
        data: format!("data:audio/wav;base64,{}", STANDARD.encode(wav_silence(1.0))).into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 15,
        source_in_seconds: 0.0,
        source_duration_seconds: 1.0,
        volume: 0.8,
        fade_in: 0.0,
        fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
    project.validate().unwrap();
    let path = temp.path().join("overlay.pixcut");
    write_project_bundle(&path, &project, None).unwrap();
    assert_eq!(read_project_bundle(&path).unwrap(), project);
    let original = project.clone();
    let directory = temp.path().join("assets");
    persist_project(&directory, &mut project).unwrap();
    assert!(project.tracks[0].clips[0].elements[0].source.as_ref().unwrap().starts_with("pixcut-asset:"));
    assert!(project.overlays[0].source.as_ref().unwrap().starts_with("pixcut-asset:"));
    hydrate_project(&directory, &mut project, true).unwrap();
    hydrate_project(&directory, &mut project, false).unwrap();
    assert_eq!(project, original);
}
#[test]
fn bundles_open_into_the_asset_store_without_loading_media() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("streamed-open.pixcut");
    let directory = temp.path().join("assets");
    let (project, _) = fixture_project();
    write_project_bundle(&path, &project, None).unwrap();
    let opened = read_project_bundle_to_store(&path, &directory).unwrap();
    assert!(opened.visual_clips()[0].image.starts_with("pixcut-asset:"));
    assert!(directory.read_dir().unwrap().count() > 0);
    let mut hydrated = opened;
    hydrate_project(&directory, &mut hydrated, false).unwrap();
    assert_eq!(hydrated, project);
}

#[test]
fn video_overlay_assets_keep_their_mime_when_reopened() {
    for mime in ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"] {
        let temp = tempfile::tempdir().unwrap();
        let (mut project, _) = fixture_project();
        let source = format!("data:{mime};base64,{}", STANDARD.encode(b"local-video-test"));
        project.tracks[0].clips[0].elements = vec![serde_json::from_value(serde_json::json!({"id":"video", "kind":"video", "source":source, "x":0.7,"y":0.3,"width":0.3,"height":0.2,"rotation":0,"color":"#FFFFFF","opacity":100,"startTicks":0,"durationTicks":15,"animation":"none"})).unwrap()];
        project.validate().unwrap(); let original = project.clone();
        let path = temp.path().join("video.pixcut");
        write_project_bundle(&path, &project, None).unwrap();
        assert_eq!(read_project_bundle(&path).unwrap(), original);
        persist_project(temp.path(), &mut project).unwrap();
        hydrate_project(temp.path(), &mut project, false).unwrap();
        assert_eq!(project, original);
    }
}
#[test]
fn project_bundle_deduplicates_identical_assets() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("duplicate.pixcut");
    let (mut project, _) = fixture_project();
    let shared = project.visual_clips()[0].image.clone();
    project.tracks[0].clips[1].image = shared;
    write_project_bundle(&path, &project, None).unwrap();
    let manifest_text = {
        let file = fs::File::open(&path).unwrap();
        let mut archive = ZipArchive::new(file).unwrap();
        let mut text = String::new();
        archive
            .by_name("manifest.json")
            .unwrap()
            .read_to_string(&mut text)
            .unwrap();
        text
    };
    let manifest: BundleManifest = serde_json::from_str(&manifest_text).unwrap();
    assert_eq!(manifest.assets.len(), 1);
    assert_eq!(read_project_bundle(&path).unwrap(), project);
}
#[test]
fn local_asset_store_roundtrips_and_deduplicates() {
    let temp = tempfile::tempdir().unwrap();
    let directory = temp.path().join("assets");
    let (mut project, _) = fixture_project();
    project.audio = vec![AudioClip {
        id: "audio-1".into(),
        name: "Bed.wav".into(),
        data: format!(
            "data:audio/wav;base64,{}",
            STANDARD.encode(wav_silence(1.0))
        )
        .into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 15,
        source_in_seconds: 0.0,
        source_duration_seconds: 1.0,
        volume: 0.8,
        fade_in: 0.2,
        fade_out: 0.2, low: 0.0, mid: 0.0, high: 0.0, credit: None }, AudioClip {
        id: "audio-2".into(),
        name: "Bed 2.wav".into(),
        data: format!(
            "data:audio/wav;base64,{}",
            STANDARD.encode(wav_silence(1.0))
        )
        .into(),
        lane: 0,
        start_ticks: 15,
        duration_ticks: 15,
        source_in_seconds: 0.2,
        source_duration_seconds: 1.0,
        volume: 0.6,
        fade_in: 0.0,
        fade_out: 0.1, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
    let original = project.clone();
    persist_project(&directory, &mut project).unwrap();
    assert!(project
        .visual_clips()
        .iter()
        .all(|scene| scene.image.starts_with("pixcut-asset:")));
    assert!(project.audio[0].data.starts_with("pixcut-asset:"));
    assert_eq!(fs::read_dir(&directory).unwrap().count(), 3);
    project.validate().unwrap();
    let mut again = original.clone();
    persist_project(&directory, &mut again).unwrap();
    assert_eq!(fs::read_dir(&directory).unwrap().count(), 3);
    hydrate_project(&directory, &mut project, true).unwrap();
    assert!(project.visual_clips()[0].image.starts_with("pixcut-asset:"));
    assert!(project.audio[0].data.starts_with("pixcut-asset:"));
    // This test round-trips the stored media, so resolve every reference.
    hydrate_project(&directory, &mut project, false).unwrap();
    assert_eq!(project, original);
}
#[test]
fn streamed_media_saves_into_a_portable_bundle() {
    let temp = tempfile::tempdir().unwrap();
    let directory = temp.path().join("assets");
    let (mut project, _) = fixture_project();
    // Store both a photo and a music bed, leaving references in the project.
    project.audio = vec![AudioClip {
        id: "audio-1".into(),
        name: "Bed.wav".into(),
        data: format!("data:audio/wav;base64,{}", STANDARD.encode(wav_silence(1.0))).into(),
        lane: 0,
        start_ticks: 0,
        duration_ticks: 15,
        source_in_seconds: 0.0,
        source_duration_seconds: 1.0,
        volume: 0.8,
        fade_in: 0.0,
        fade_out: 0.0, low: 0.0, mid: 0.0, high: 0.0, credit: None }];
    let original = project.clone();
    persist_project(&directory, &mut project).unwrap();
    assert!(project.visual_clips().iter().all(|scene| scene.image.starts_with("pixcut-asset:")));
    assert!(project.audio[0].data.starts_with("pixcut-asset:"));
    // Runtime hydration keeps streamed photo/audio references for the asset protocol.
    hydrate_project(&directory, &mut project, true).unwrap();
    assert!(project.visual_clips().iter().all(|scene| scene.image.starts_with("pixcut-asset:")));
    assert!(project.audio[0].data.starts_with("pixcut-asset:"));
    let path = temp.path().join("streamed.pixcut");
    write_project_bundle(&path, &project, Some(&directory)).unwrap();
    // The archive is portable: reading it back resolves the references.
    assert_eq!(read_project_bundle(&path).unwrap(), original);
    assert!(fs::metadata(&path).unwrap().len() > 1_000);
}

#[test]
fn missing_assets_stay_referenced_and_block_portable_saves() {
    let temp = tempfile::tempdir().unwrap();
    let directory = temp.path().join("assets");
    let (mut project, _) = fixture_project();
    let missing = "a".repeat(64);
    project.tracks[0].clips[0].image = format!("pixcut-asset:{missing}").into();
    let available = project.tracks[0].clips[1].image.clone();
    persist_project(&directory, &mut project).unwrap();
    // Full hydration resolves the stored photo and leaves only the missing one.
    hydrate_project(&directory, &mut project, false).unwrap();
    assert_eq!(project.tracks[0].clips[0].image, format!("pixcut-asset:{missing}").into());
    assert_eq!(project.tracks[0].clips[1].image, available);
    assert!(project_has_asset_refs(&project));
    assert!(build_bundle(&project, None).is_err());
    // Relinking replaces the reference with fresh media bytes, then both
    // portable saves and exports are allowed again.
    project.tracks[0].clips[0].image = "data:image/png;base64,iVBORw0KGgo=".into();
    assert!(!project_has_asset_refs(&project));
    assert!(build_bundle(&project, None).is_ok());
}
#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_export_reports_progress() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("progress.mp4");
    let (p, frames) = fixture_project();
    let binary = ffmpeg().expect("FFmpeg must be installed for this test");
    let values = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let sink = values.clone();
    encode_movie(p, frames, vec![15, 15], export_options(), binary, path, Arc::new(AtomicBool::new(false)), move |percent| {
        sink.lock().unwrap().push(percent);
    })
    .unwrap();
    let values = values.lock().unwrap();
    assert!(!values.is_empty());
    assert!(values.iter().max().copied().unwrap_or(0) > 0);
}
#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_mp4_has_expected_dimensions_duration_and_frame_count() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("movie.mp4");
    let (p, frames) = fixture_project();
    let binary = ffmpeg().expect("FFmpeg must be installed for this test");
    encode_movie(p, frames, vec![15, 15], export_options(), binary.clone(), path.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let result = Process::new(binary.with_file_name("ffprobe"))
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-count_frames",
            "-show_entries",
            "stream=width,height,nb_read_frames,codec_name:format=duration",
            "-of",
            "json",
        ])
        .arg(path)
        .output()
        .unwrap();
    assert!(result.status.success());
    let info: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(info["streams"][0]["width"], 1920);
    assert_eq!(info["streams"][0]["height"], 1080);
    assert_eq!(info["streams"][0]["codec_name"], "h264");
    assert_eq!(info["streams"][0]["nb_read_frames"], "30");
    let duration: f64 = info["format"]["duration"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();
    assert!((duration - 1.0).abs() < 0.04);
}
#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_image_export_applies_fades() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("faded.mp4");
    let (mut project, frames) = fixture_project();
    project.tracks[0].clips[0].fade_in = 0.2;
    project.tracks[0].clips[1].fade_out = 0.2;
    let binary = ffmpeg().expect("FFmpeg must be installed for this test");
    encode_movie(project, frames, vec![15, 15], export_options(), binary.clone(), path.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
    let pixel_at = |seconds: &str| {
        let result = Process::new(&binary).args(["-v", "error", "-ss", seconds, "-i"])
            .arg(&path)
            .args(["-frames:v", "1", "-vf", "crop=2:2:0:0,format=rgb24", "-f", "rawvideo", "-"])
            .output().unwrap();
        assert!(result.status.success());
        result.stdout
    };
    let faded_in = pixel_at("0.02");
    let steady = pixel_at("0.3");
    let faded_out = pixel_at("0.94");
    assert!(faded_in[0] < 120, "fade-in should darken the first frame: {faded_in:?}");
    assert!(steady[0] > 200, "the middle of the clip should stay bright: {steady:?}");
    assert!(faded_out[1] < 120, "fade-out should darken the last frame: {faded_out:?}");
}

#[test]
#[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
fn real_transition_frames_all_reach_the_output() {
    let binary = ffmpeg().expect("FFmpeg is installed");
    assert!(encoder_available(&binary, ExportCodec::H264));
    let temp = tempfile::tempdir().unwrap();
    let clip = |name: &str, color: &str| {
        let path = temp.path().join(name);
        let status = Process::new(&binary)
            .args(["-y", "-v", "error", "-f", "lavfi", "-i", &format!("color=c={color}:s=320x240:r=30:d=1"), "-c:v", "libx264", "-pix_fmt", "yuv420p"])
            .arg(&path).status().unwrap();
        assert!(status.success());
        format!("data:video/mp4;base64,{}", STANDARD.encode(fs::read(&path).unwrap()))
    };
    // One-tick stills that fade from red to blue, the way the planner bakes a video transition.
    // The fixture project is 30 ticks long, so the plan has to add up to exactly that.
    const STILLS: usize = 12;
    const HOLD: u64 = 9;
    let still = |index: usize| {
        let red = 255 - index * 255 / (STILLS - 1);
        let path = temp.path().join(format!("still-{index}.png"));
        let status = Process::new(&binary)
            .args(["-y", "-v", "error", "-f", "lavfi", "-i", &format!("color=c=0x{red:02X}00{:02X}:s=320x240", 255 - red), "-frames:v", "1"])
            .arg(&path).status().unwrap();
        assert!(status.success());
        format!("data:image/png;base64,{}", STANDARD.encode(fs::read(&path).unwrap()))
    };
    let segment = |kind: &str, png: Option<String>, video: Option<String>, ticks: u64| PlanSegment {
        kind: kind.into(), png, video, source_in_seconds: video_source(kind), fit: Some("cover".into()),
        speed: None, speed_end: None, reverse: false, lut: None, fade_in: 0.0, fade_out: 0.0,
        video_volume: None, include_audio: false, audio_duration_ticks: None, duration_ticks: ticks, overlays: vec![],
    };
    fn video_source(kind: &str) -> Option<f64> { (kind == "video").then_some(0.0) }
    let mut segments = vec![segment("video", None, Some(clip("red.mp4", "red")), HOLD)];
    for index in 0..STILLS { segments.push(segment("image", Some(still(index)), None, 1)); }
    segments.push(segment("video", None, Some(clip("blue.mp4", "blue")), HOLD));
    let (project, _) = fixture_project();
    let mut options = export_options();
    options.width = 320; options.height = 240; options.speed = EncodeSpeed::Fast;
    let output = temp.path().join("transition.mp4");
    encode_plan(&project, ExportPlan { segments, options }, binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();

    let raw = Process::new(&binary)
        .args(["-v", "error", "-i"]).arg(&output)
        .args(["-vf", "scale=1:1,format=rgb24", "-f", "rawvideo", "-"])
        .output().unwrap();
    assert!(raw.status.success(), "{}", String::from_utf8_lossy(&raw.stderr));
    let pixels: Vec<(u8, u8)> = raw.stdout.chunks_exact(3).map(|rgb| (rgb[0], rgb[2])).collect();
    let expected = HOLD as usize * 2 + STILLS;
    assert_eq!(pixels.len(), expected, "every planned tick must become one output frame: {pixels:?}");
    let blend = &pixels[HOLD as usize..HOLD as usize + STILLS];
    for pair in blend.windows(2) {
        assert!(pair[1].0 < pair[0].0 && pair[1].1 > pair[0].1, "the blend must progress frame by frame: {blend:?}");
    }
    assert!(pixels[0].0 > 200 && pixels[0].1 < 60, "starts red: {:?}", pixels[0]);
    assert!(pixels[expected - 1].1 > 200 && pixels[expected - 1].0 < 60, "ends blue: {:?}", pixels[expected - 1]);
}
