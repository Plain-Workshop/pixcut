use super::*;

pub(crate) fn encode_plan(
    project: &Project,
    plan: ExportPlan,
    binary: PathBuf,
    destination: PathBuf,
    asset_dir: &Path,
    cancel: Arc<AtomicBool>,
    progress: impl Fn(u8) + Send + 'static,
) -> Result<Option<String>, String> {
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    let temp = tempfile::tempdir().map_err(|e| e.to_string())?;
    let mut command = Process::new(&binary);
    command.current_dir(temp.path());
    command.args(["-y", "-nostdin", "-hide_banner", "-loglevel", "error"]);
    let mut visual: Vec<(usize, f64, String, f64, Option<PathBuf>)> = Vec::new();
    let mut overlays: Vec<(usize, f64, f64)> = Vec::new();
    // Imported video clips contribute their own soundtrack.
    #[derive(Clone, Copy)]
    struct VideoAudio {
        input: usize,
        speed: f64,
        speed_end: f64,
        duration: f64,
        start: f64,
        fade_in: f64,
        fade_out: f64,
        volume: Option<f64>,
    }
    let mut video_audio: Vec<VideoAudio> = Vec::new();
    let video_audio_gain = project.video_audio_gain();
    let mut duck_windows: Vec<(f64, f64)> = Vec::new();
    let mut input_index = 0usize;
    let mut timeline_offset = 0.0f64;
    for (index, segment) in plan.segments.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            return Err("Export cancelled.".into());
        }
        let duration = project.timebase.ticks_to_seconds(segment.duration_ticks);
        let segment_start = timeline_offset;
        let mut speed = 1.0;
        let mut lut_path = None;
        match segment.kind.as_str() {
            "image" => {
                let path = write_plan_payload(temp.path(), &format!("frame-{index}.png"), segment.png.as_deref().unwrap_or_default(), "data:image/png;base64,")?;
                command.args(["-loop", "1", "-t", &format!("{duration:.6}"), "-i"]).arg(path);
            }
            "video" => {
                let data = segment.video.as_deref().unwrap_or_default();
                let path = if let Some(id) = data.strip_prefix("pixcut-asset:") {
                    asset_file(asset_dir, id).ok_or("A streamed video is missing from the local store. Relink the clip.")?
                } else {
                    let mime = data.split_once(',').map(|(meta, _)| meta).unwrap_or_default();
                    let extension = if mime.starts_with("data:video/mp4") {
                        "mp4"
                    } else if mime.starts_with("data:video/quicktime") {
                        "mov"
                    } else if mime.starts_with("data:video/x-m4v") {
                        "m4v"
                    } else {
                        "webm"
                    };
                    let payload = data.split_once(',').map(|(_, payload)| payload).ok_or("A video payload is invalid.")?;
                    let path = temp.path().join(format!("video-{index}.{extension}"));
                    let bytes = STANDARD.decode(payload).map_err(|e| e.to_string())?;
                    fs::write(&path, bytes).map_err(|e| e.to_string())?;
                    path
                };
                speed = segment.speed.unwrap_or(1.0);
                let speed_end = segment.speed_end.unwrap_or(speed);
                let start = segment.source_in_seconds.unwrap_or(0.0).max(0.0);
                let audio_duration = segment
                    .audio_duration_ticks
                    .map(|ticks| project.timebase.ticks_to_seconds(ticks))
                    .unwrap_or(duration);
                // A ramp consumes the average rate over the full clip, even
                // when a baked transition shortens the moving picture.
                let render_duration = segment.audio_duration_ticks
                    .map(|ticks| project.timebase.ticks_to_seconds(ticks))
                    .unwrap_or(duration);
                let visual_span = render_duration * (speed + speed_end) / 2.0;
                let source_length = visual_span.max(duration);
                command.args(["-ss", &format!("{start:.6}"), "-t", &format!("{source_length:.6}"), "-i"]).arg(path.clone());
                // Reverse is picture-only: a reversed soundtrack is rarely
                // wanted, and the preview stays silent for the same reason.
                if segment.include_audio && !segment.reverse && has_audio_stream(&binary, &path) {
                    if segment.video_volume.unwrap_or(100.0) > 0.0 && video_audio_gain > 0.0 {
                        duck_windows.push((segment_start, segment_start + audio_duration));
                    }
                    video_audio.push(VideoAudio {
                        input: input_index,
                        speed,
                        speed_end,
                        duration: audio_duration,
                        start: segment_start,
                        fade_in: segment.fade_in.min(audio_duration),
                        fade_out: segment.fade_out.min(audio_duration),
                        volume: segment.video_volume,
                    });
                }
                if let Some(lut) = segment.lut.as_deref() {
                    let path = temp.path().join(format!("grade-{index}.cube"));
                    fs::write(&path, lut.as_bytes()).map_err(|e| e.to_string())?;
                    lut_path = Some(path);
                }
            }
            _ => return Err("An export segment has an unknown type.".into()),
        }
        visual.push((input_index, duration, segment.fit.clone().unwrap_or_else(|| "cover".into()), speed, lut_path));
        timeline_offset += duration;
        input_index += 1;
        for overlay in &segment.overlays {
            let start = project.timebase.ticks_to_seconds(overlay.start_ticks);
            let length = project.timebase.ticks_to_seconds(overlay.duration_ticks);
            if overlay.frames.is_empty() {
                let path = write_plan_payload(temp.path(), &format!("overlay-{input_index}.png"), &overlay.png, "data:image/png;base64,")?;
                command.args(["-loop", "1", "-t", &format!("{length:.6}"), "-i"]).arg(path);
            } else {
                for (frame_index, frame) in overlay.frames.iter().enumerate() {
                    if cancel.load(Ordering::SeqCst) { return Err("Export cancelled.".into()); }
                    write_plan_payload(temp.path(), &format!("overlay-{input_index}-{frame_index:06}.png"), frame, "data:image/png;base64,")?;
                }
                let fps = project.timebase.denominator as f64 / project.timebase.numerator as f64;
                command.args(["-framerate", &format!("{fps:.6}"), "-i"])
                    .arg(temp.path().join(format!("overlay-{input_index}-%06d.png")));
            }
            overlays.push((input_index, start, start + length));
            input_index += 1;
        }
    }
    let audio_files = project
        .audio
        .iter()
        .enumerate()
        .map(|(index, clip)| write_audio(temp.path(), clip, index, asset_dir).map(|path| (path, clip)))
        .collect::<Result<Vec<_>, _>>()?;
    let audio_start = input_index;
    for (path, clip) in &audio_files {
        let duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
        command
            .arg("-ss")
            .arg(format!("{:.6}", clip.source_in_seconds))
            .arg("-t")
            .arg(format!("{duration:.6}"))
            .arg("-i")
            .arg(path);
    }

    let width = plan.options.width;
    let height = plan.options.height;
    let fps = plan.options.fps;
    let hardware = if plan.options.hardware { hardware_encoder(plan.options.codec, &binary) } else { None };
    let mut filters = Vec::new();
    for (index, (input, duration, fit, speed, lut)) in visual.iter().enumerate() {
        let geometry = if fit == "contain" {
            format!("scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2")
        } else {
            format!("scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}")
        };
        let mut chain = format!("[{input}:v]{geometry},setsar=1");
        if let Some(segment) = plan.segments.get(index) {
            if segment.reverse {
                chain.push_str(",reverse");
            }
        }
        chain.push_str(",setpts=PTS-STARTPTS");
        let speed_end = plan.segments.get(index).and_then(|segment| segment.speed_end).unwrap_or(*speed);
        let render_duration = plan.segments.get(index)
            .and_then(|segment| segment.audio_duration_ticks)
            .map(|ticks| project.timebase.ticks_to_seconds(ticks))
            .unwrap_or(*duration);
        if let Some(expression) = ramp_setpts(*speed, speed_end, render_duration) {
            chain.push(',');
            chain.push_str(&expression);
        } else if (speed - 1.0).abs() > 1e-9 {
            chain.push_str(&format!(",setpts=(PTS-STARTPTS)/{speed:.6}"));
        }
        chain.push_str(&format!(
            ",fps={fps},tpad=stop_mode=clone:stop_duration=2,trim=duration={duration:.6},setpts=PTS-STARTPTS"
        ));
        if let Some(path) = lut {
            chain.push_str(&format!(",lut3d=file={}", filter_path(path)));
        }
        chain.push_str(&format!("[v{index}]"));
        filters.push(chain);
    }
    let mut current = if visual.len() == 1 {
        "v0".to_string()
    } else {
        let labels: String = (0..visual.len()).map(|index| format!("[v{index}]")).collect();
        filters.push(format!("{labels}concat=n={}:v=1:a=0[base]", visual.len()));
        "base".to_string()
    };
    for (index, (input, start, end)) in overlays.iter().enumerate() {
        let next = format!("ov{index}");
        filters.push(format!("[{input}:v]setpts=PTS-STARTPTS+{start:.6}/TB[overlay{index}]"));
        filters.push(format!("[{current}][overlay{index}]overlay=0:0:enable='gte(t,{start:.6})*lt(t,{end:.6})'[{next}]"));
        current = next;
    }
    let mut fade_index = 0usize;
    for clip in project.visual_clips() {
        let clip_start = project.timebase.ticks_to_seconds(clip.start_ticks);
        let clip_end = project.timebase.ticks_to_seconds(clip.start_ticks + clip.duration_ticks);
        let clip_length = (clip_end - clip_start).max(0.001);
        if clip.fade_in > 0.0 {
            let length = clip.fade_in.min(clip_length).max(0.001);
            let next = format!("fade{fade_index}");
            filters.push(format!("[{current}]fade=t=in:st={clip_start:.6}:d={length:.6}[{next}]"));
            current = next;
            fade_index += 1;
        }
        if clip.fade_out > 0.0 {
            let length = clip.fade_out.min(clip_length).max(0.001);
            let start = (clip_end - length).max(0.0);
            let next = format!("fade{fade_index}");
            filters.push(format!("[{current}]fade=t=out:st={start:.6}:d={length:.6}[{next}]"));
            current = next;
            fade_index += 1;
        }
    }
    if hardware.is_some_and(|(_, family)| family == HardwareFamily::Vaapi) {
        filters.push(format!("[{current}]format=nv12,hwupload[hwout]"));
        current = "hwout".to_string();
    }
    let ducking = project.ducking.unwrap_or(0.0);
    let mut audio_nodes: Vec<String> = Vec::new();
    for (index, (_, clip)) in audio_files.iter().enumerate() {
        let input = audio_start + index;
        let duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
        let level = (clip.volume * project.lane_gain(clip.lane)).clamp(0.0, 1.0);
        let mut node = format!("[{input}:a]asetpts=PTS-STARTPTS,aresample=48000,volume={level:.3}");
        node.push_str(&eq_filters(clip.low, clip.mid, clip.high));
        if ducking > 0.0 && !duck_windows.is_empty() {
            let clip_start = project.timebase.ticks_to_seconds(clip.start_ticks);
            node.push_str(&format!(",volume='{}':eval=frame", ducking_expression(&duck_windows, clip_start, ducking)));
        }
        if clip.fade_in > 0.0 {
            node.push_str(&format!(",afade=t=in:st=0:d={:.3}", clip.fade_in.min(duration)));
        }
        if clip.fade_out > 0.0 {
            let start = (duration - clip.fade_out).max(0.0);
            node.push_str(&format!(",afade=t=out:st={start:.3}:d={:.3}", clip.fade_out.min(duration)));
        }
        let delay = (project.timebase.ticks_to_seconds(clip.start_ticks) * 1000.0).round() as u64;
        node.push_str(&format!(",adelay={delay}:all=1[am{}]", index));
        audio_nodes.push(node);
    }
    for (index, clip) in video_audio.iter().enumerate() {
        let mut node = String::new();
        if (clip.speed_end - clip.speed).abs() > 1e-9 {
            // A ramp is a piecewise `atempo` chain: eight equal output slices,
            // each with its own rate, concatenated back together.
            let (mut extra, label) = ramp_atempo_nodes(
                &format!("[{}:a]", clip.input),
                clip.speed,
                clip.speed_end,
                clip.duration,
                &format!("ra{index}"),
            );
            audio_nodes.append(&mut extra);
            node.push_str(&format!("{label}aresample=48000"));
        } else {
            node.push_str(&format!("[{}:a]asetpts=PTS-STARTPTS,aresample=48000", clip.input));
            if (clip.speed - 1.0).abs() > 1e-9 {
                node.push_str(&format!(",{}", atempo_chain(clip.speed)));
            }
        }
        let level = (clip.volume.unwrap_or(100.0) / 100.0 * video_audio_gain).clamp(0.0, 1.0);
        if level < 0.999_999 {
            node.push_str(&format!(",volume={level:.3}"));
        }
        node.push_str(&format!(",atrim=duration={:.6},asetpts=PTS-STARTPTS", clip.duration));
        if clip.fade_in > 0.0 {
            node.push_str(&format!(",afade=t=in:st=0:d={:.3}", clip.fade_in));
        }
        if clip.fade_out > 0.0 {
            node.push_str(&format!(",afade=t=out:st={:.3}:d={:.3}", (clip.duration - clip.fade_out).max(0.0), clip.fade_out));
        }
        let delay = (clip.start * 1000.0).round() as u64;
        node.push_str(&format!(",adelay={delay}:all=1[av{index}]"));
        audio_nodes.push(node);
    }
    if !audio_nodes.is_empty() {
        let mix = if audio_nodes.len() == 1 {
            let label = if audio_files.is_empty() { "[av0]" } else { "[am0]" };
            format!("{label}anull[aout]")
        } else {
            let mut labels = String::new();
            for index in 0..audio_files.len() {
                labels.push_str(&format!("[am{index}]"));
            }
            for index in 0..video_audio.len() {
                labels.push_str(&format!("[av{index}]"));
            }
            format!(
                "{labels}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[aout]",
                audio_nodes.len()
            )
        };
        filters.push(format!("{};{mix}", audio_nodes.join(";")));
    }

    let duration = project.timebase.ticks_to_seconds(project.total_ticks());
    let output = tempfile::Builder::new()
        .suffix(&format!(".{}", plan.options.container.extension()))
        .tempfile_in(destination.parent().ok_or("Invalid output path")?)
        .map_err(|e| e.to_string())?;
    command
        .args(["-filter_complex", &filters.join(";"), "-map"])
        .arg(format!("[{current}]"));
    if !audio_files.is_empty() || !video_audio.is_empty() {
        command.args(["-map", "[aout]"]).args(audio_encoding_args(&plan.options));
    }
    command.args(video_encoding_args(&plan.options, hardware));
    command.args([
        "-progress",
        "pipe:1",
        "-nostats",
        "-t",
        &format!("{duration:.6}"),
    ]);
    command.arg(output.path()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("FFmpeg progress stream is unavailable.")?;
    let stderr = child.stderr.take().ok_or("FFmpeg error stream is unavailable.")?;
    let progress_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let micros = line
                .strip_prefix("out_time_us=")
                .or_else(|| line.strip_prefix("out_time_ms="))
                .and_then(|value| value.trim().parse::<f64>().ok());
            if let Some(micros) = micros {
                let percent = (micros / 1_000_000.0 / duration.max(0.001) * 100.0).clamp(0.0, 99.0) as u8;
                progress(percent);
            }
        }
    });
    let error_thread = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        text
    });
    let status = loop {
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
        }
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) => break status,
            None => std::thread::sleep(std::time::Duration::from_millis(120)),
        }
    };
    let _ = progress_thread.join();
    let error = error_thread.join().unwrap_or_default();
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    if !status.success() {
        return Err(format!(
            "FFmpeg export failed: {}",
            error.chars().take(1000).collect::<String>()
        ));
    }
    output.persist(&destination).map_err(|e| e.to_string())?;
    Ok(Some(destination.to_string_lossy().to_string()))
}

#[tauri::command]
pub(crate) async fn export_plan_variants(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
    project_id: String,
    plans: Vec<ExportPlan>,
    snapshot: Option<Project>,
) -> Result<Vec<String>, String> {
    if plans.is_empty() || plans.len() > 6 {
        return Err("Choose between one and six export formats.".into());
    }
    if editor
        .exporting
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("An export is already running.".into());
    }
    let _guard = ExportGuard(&editor.exporting);
    let cancel = Arc::clone(&editor.cancel_export);
    cancel.store(false, Ordering::SeqCst);
    let project = match snapshot { Some(project) => project, None => editor.session.lock().map_err(|e| e.to_string())?.project.clone() };
    let project = checked_export_snapshot(&project_id, project)?;
    for plan in &plans {
        validate_plan(&project, plan)?;
    }
    let binary = ffmpeg().ok_or(
        "Install FFmpeg with libx264 or libx265 to export videos.",
    )?;
    for plan in &plans { check_encoder(&binary, &plan.options)?; }
    let Some(folder) = rfd::AsyncFileDialog::new()
        .set_title("Choose a folder for your exports")
        .pick_folder()
        .await
    else {
        return Ok(vec![]);
    };
    let directory = folder.path().to_path_buf();
    let asset_directory = asset_store_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let total = plans.len() as f64;
        let mut written = Vec::new();
        for (index, plan) in plans.into_iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                return Err("Export cancelled.".into());
            }
            check_encoder(&binary, &plan.options)?;
            let filename = export_output_name(&plan.options);
            let destination = directory.join(filename);
            let progress_app = app.clone();
            guard("encoding a video", || {
                encode_plan(&project, plan, binary.clone(), destination.clone(), &asset_directory, Arc::clone(&cancel), move |percent| {
                    let overall = ((index as f64 + percent as f64 / 100.0) / total * 100.0).clamp(0.0, 99.0) as u8;
                    let _ = progress_app.emit("export-progress", overall);
                })
            })?;
            written.push(destination.to_string_lossy().to_string());
        }
        Ok(written)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) fn write_audio(dir: &Path, clip: &AudioClip, index: usize, asset_dir: &Path) -> Result<PathBuf, String> {
    if let Some(id) = clip.data.strip_prefix("pixcut-asset:") {
        return asset_file(asset_dir, id).ok_or_else(|| "An audio clip is missing from the local store. Relink it and export again.".into());
    }
    let (meta, payload) = clip.data.split_once(',').ok_or("Invalid audio data.")?;
    let mime = meta
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .ok_or("Invalid audio encoding.")?;
    let extension = match mime {
        "audio/mpeg" | "audio/mp3" => "mp3",
        "audio/wav" | "audio/x-wav" => "wav",
        "audio/mp4" => "m4a",
        "audio/aac" => "aac",
        "audio/ogg" => "ogg",
        "audio/webm" => "webm",
        _ => return Err("Unsupported audio format.".into()),
    };
    let bytes = STANDARD.decode(payload).map_err(|e| e.to_string())?;
    if bytes.len() > 50_000_000 {
        return Err("An audio clip exceeds the 50 MB budget.".into());
    }
    let path = dir.join(format!("audio-{index}.{extension}"));
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn encode_movie(
    project: Project,
    frames: Vec<String>,
    durations: Vec<u64>,
    options: ExportOptions,
    binary: PathBuf,
    destination: PathBuf,
    cancel: Arc<AtomicBool>,
    progress: impl Fn(u8) + Send + 'static,
) -> Result<Option<String>, String> {
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    let temp = tempfile::tempdir().map_err(|e| e.to_string())?;
    let mut list = String::new();
    for (i, (frame, duration)) in frames.iter().zip(durations.iter()).enumerate() {
        if cancel.load(Ordering::SeqCst) {
            return Err("Export cancelled.".into());
        }
        if frame.len() > 120_000_000 {
            return Err("An export frame exceeds the size limit.".into());
        }
        let bytes = STANDARD
            .decode(
                frame
                    .strip_prefix("data:image/png;base64,")
                    .ok_or("Invalid render frame")?,
            )
            .map_err(|e| e.to_string())?;
        if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            return Err("Invalid PNG frame".into());
        }
        fs::write(temp.path().join(format!("frame-{i}.png")), bytes).map_err(|e| e.to_string())?;
        list.push_str(&format!(
            "file 'frame-{i}.png'\nduration {:.6}\n",
            project.timebase.ticks_to_seconds(*duration)
        ));
    }
    list.push_str(&format!("file 'frame-{}.png'\n", frames.len() - 1));
    fs::write(temp.path().join("scenes.txt"), list).map_err(|e| e.to_string())?;
    // Encode beside the destination, then atomically replace it after success.
    let output = tempfile::Builder::new()
        .suffix(&format!(".{}", options.container.extension()))
        .tempfile_in(destination.parent().ok_or("Invalid output path")?)
        .map_err(|e| e.to_string())?;
    let duration = project.timebase.ticks_to_seconds(project.total_ticks());
    let fps = format!("fps={}", options.fps);
    let audio_files = project
        .audio
        .iter()
        .enumerate()
        .map(|(index, clip)| write_audio(temp.path(), clip, index, temp.path()).map(|path| (path, clip)))
        .collect::<Result<Vec<_>, _>>()?;
    let hardware = if options.hardware { hardware_encoder(options.codec, &binary) } else { None };
    let mut command = Process::new(binary);
    command.current_dir(temp.path()).args([
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        "scenes.txt",
    ]);
    for (index, (path, clip)) in audio_files.iter().enumerate() {
        let clip_duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
        command
            .arg("-ss")
            .arg(format!("{:.6}", clip.source_in_seconds))
            .arg("-t")
            .arg(format!("{clip_duration:.6}"))
            .arg("-i")
            .arg(path);
        let _ = index;
    }
    command.args(video_encoding_args(&options, hardware));
    let mut video_filter = format!("scale={}:{}:flags=lanczos,{}", options.width, options.height, fps);
    for clip in project.visual_clips() {
        let clip_start = project.timebase.ticks_to_seconds(clip.start_ticks);
        let clip_end = project.timebase.ticks_to_seconds(clip.start_ticks + clip.duration_ticks);
        let clip_length = (clip_end - clip_start).max(0.001);
        if clip.fade_in > 0.0 {
            let length = clip.fade_in.min(clip_length).max(0.001);
            video_filter.push_str(&format!(",fade=t=in:st={clip_start:.6}:d={length:.6}"));
        }
        if clip.fade_out > 0.0 {
            let length = clip.fade_out.min(clip_length).max(0.001);
            let start = (clip_end - length).max(0.0);
            video_filter.push_str(&format!(",fade=t=out:st={start:.6}:d={length:.6}"));
        }
    }
    if hardware.is_some_and(|(_, family)| family == HardwareFamily::Vaapi) {
        video_filter.push_str(",format=nv12,hwupload");
    }
    command.args(["-vf", &video_filter]);
    if !audio_files.is_empty() {
        let mut filter_nodes = Vec::new();
        for (index, (_, clip)) in audio_files.iter().enumerate() {
            let clip_duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
            let mut node = format!(
                "[{}:a]asetpts=PTS-STARTPTS,aresample=48000,volume={:.3}",
                index + 1,
                clip.volume
            );
            node.push_str(&eq_filters(clip.low, clip.mid, clip.high));
            if clip.fade_in > 0.0 {
                node.push_str(&format!(",afade=t=in:st=0:d={:.3}", clip.fade_in.min(clip_duration)));
            }
            if clip.fade_out > 0.0 {
                let start = (clip_duration - clip.fade_out).max(0.0);
                node.push_str(&format!(",afade=t=out:st={start:.3}:d={:.3}", clip.fade_out.min(clip_duration)));
            }
            let delay = (project.timebase.ticks_to_seconds(clip.start_ticks) * 1000.0).round() as u64;
            node.push_str(&format!(",adelay={delay}:all=1[a{}]", index + 1));
            filter_nodes.push(node);
        }
        let mix = if audio_files.len() == 1 {
            "[a1]anull[aout]".to_string()
        } else {
            let inputs: String = (1..=audio_files.len()).map(|index| format!("[a{index}]")).collect();
            format!(
                "{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[aout]",
                audio_files.len()
            )
        };
        let filter = format!("{};{mix}", filter_nodes.join(";"));
        command.args(["-filter_complex", filter.as_str(), "-map", "0:v:0", "-map", "[aout]"])
            .args(audio_encoding_args(&options));
    }
    command
        .args(["-progress", "pipe:1", "-nostats", "-t"])
        .arg(format!("{duration:.6}"))
        .arg(output.path())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("FFmpeg progress stream is unavailable.")?;
    let stderr = child.stderr.take().ok_or("FFmpeg error stream is unavailable.")?;
    let progress_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let micros = line
                .strip_prefix("out_time_us=")
                .or_else(|| line.strip_prefix("out_time_ms="))
                .and_then(|value| value.trim().parse::<f64>().ok());
            if let Some(micros) = micros {
                let percent = (micros / 1_000_000.0 / duration.max(0.001) * 100.0).clamp(0.0, 99.0) as u8;
                progress(percent);
            }
        }
    });
    let error_thread = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        text
    });
    let status = loop {
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
        }
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) => break status,
            None => std::thread::sleep(std::time::Duration::from_millis(120)),
        }
    };
    let _ = progress_thread.join();
    let error = error_thread.join().unwrap_or_default();
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    if !status.success() {
        return Err(format!(
            "FFmpeg export failed: {}",
            error.chars().take(1000).collect::<String>()
        ));
    }
    output.persist(&destination).map_err(|e| e.to_string())?;
    Ok(Some(destination.to_string_lossy().to_string()))
}
