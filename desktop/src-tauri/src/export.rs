use super::*;

pub(crate) fn ffmpeg() -> Option<PathBuf> {
    [
        PathBuf::from("ffmpeg"),
        PathBuf::from("/opt/homebrew/bin/ffmpeg"),
        PathBuf::from("/usr/local/bin/ffmpeg"),
    ]
    .into_iter()
    .find(|p| {
        Process::new(p)
            .arg("-version")
            .output()
            .is_ok_and(|o| o.status.success())
    })
}
#[tauri::command]
pub(crate) async fn exporter_available() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| ffmpeg().is_some())
        .await
        .map_err(|e| e.to_string())
}
pub(crate) struct ExportGuard<'a>(pub(crate) &'a AtomicBool);
impl Drop for ExportGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickedMedia {
    pub(crate) name: String,
    pub(crate) mime: String,
    pub(crate) data: String,
}

#[tauri::command]
pub(crate) async fn pick_media(kind: String) -> Result<Vec<PickedMedia>, String> {
    let (label, extensions) = match kind.as_str() {
        "image" => ("Images", vec!["png", "jpg", "jpeg", "webp"]),
        "audio" => ("Audio", vec!["mp3", "wav", "m4a", "aac", "ogg", "oga", "webm"]),
        "video" => ("Videos", vec!["mp4", "m4v", "mov"]),
        _ => return Err("Unknown media type.".into()),
    };
    let Some(files) = rfd::AsyncFileDialog::new()
        .add_filter(label, &extensions)
        .pick_files()
        .await
    else {
        return Ok(vec![]);
    };
    let mut picked = Vec::new();
    for file in files {
        let path = file.path().to_path_buf();
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        let mime = match extension.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "mp3" => "audio/mpeg",
            "wav" => "audio/wav",
            "m4a" => "audio/mp4",
            "aac" => "audio/aac",
            "ogg" | "oga" => "audio/ogg",
            "webm" => "audio/webm",
            "mp4" => "video/mp4",
            "m4v" => "video/x-m4v",
            "mov" => "video/quicktime",
            _ => continue,
        };
        if kind == "video" {
            let size = fs::metadata(&path).map_err(|error| error.to_string())?.len();
            if size > 50 * 1024 * 1024 {
                return Err(format!("“{}” is larger than 50 MB. Choose a shorter clip.", file.file_name()));
            }
        }
        let bytes = fs::read(&path).map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        picked.push(PickedMedia {
            name: file.file_name(),
            mime: mime.into(),
            data: format!("data:{mime};base64,{}", STANDARD.encode(bytes)),
        });
    }
    Ok(picked)
}

#[derive(Clone, Copy, Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ExportCodec { #[default] H264, Hevc, Vp9, Prores }
impl ExportCodec {
    pub(crate) fn encoder(self) -> &'static str {
        match self {
            Self::H264 => "libx264",
            Self::Hevc => "libx265",
            Self::Vp9 => "libvpx-vp9",
            Self::Prores => "prores_ks",
        }
    }
    pub(crate) fn audio_encoder(self) -> &'static str {
        match self {
            Self::Vp9 => "libopus",
            Self::Prores => "pcm_s16le",
            Self::H264 | Self::Hevc => "aac",
        }
    }
    pub(crate) fn supports(self, container: ExportContainer) -> bool {
        match self {
            Self::Vp9 => container == ExportContainer::Webm,
            Self::Prores => container == ExportContainer::Mov,
            Self::H264 | Self::Hevc => matches!(container, ExportContainer::Mp4 | ExportContainer::Mov | ExportContainer::Mkv),
        }
    }
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::H264 => "H.264",
            Self::Hevc => "H.265 / HEVC",
            Self::Vp9 => "VP9",
            Self::Prores => "ProRes 422",
        }
    }
}
#[derive(Clone, Copy, Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ExportContainer { #[default] Mp4, Mov, Mkv, Webm }
impl ExportContainer {
    pub(crate) fn extension(self) -> &'static str {
        match self { Self::Mp4 => "mp4", Self::Mov => "mov", Self::Mkv => "mkv", Self::Webm => "webm" }
    }
    pub(crate) fn label(self) -> &'static str {
        match self { Self::Mp4 => "MP4", Self::Mov => "QuickTime", Self::Mkv => "Matroska", Self::Webm => "WebM" }
    }
    pub(crate) fn is_quicktime_family(self) -> bool { matches!(self, Self::Mp4 | Self::Mov) }
}
#[derive(Clone, Copy, Debug, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub(crate) enum EncodeSpeed { Fast, #[default] Medium, Slow }
impl EncodeSpeed {
    pub(crate) fn preset(self) -> &'static str { match self { Self::Fast => "fast", Self::Medium => "medium", Self::Slow => "slow" } }
    pub(crate) fn vp9_cpu_used(self) -> &'static str { match self { Self::Fast => "5", Self::Medium => "2", Self::Slow => "0" } }
    pub(crate) fn prores_profile(crf: u8) -> &'static str { if crf >= 30 { "1" } else if crf >= 24 { "2" } else { "3" } }
}
pub(crate) fn encoder_available(binary: &Path, codec: ExportCodec) -> bool {
    encoder_named(binary, codec.encoder())
}
/// Hardware encoder families this build can drive, per platform.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum HardwareFamily {
    VideoToolbox,
    Nvenc,
    Qsv,
    Amf,
    Vaapi,
}

/// The render node VAAPI encodes through. `PIXCUT_VAAPI_DEVICE` overrides the
/// probe for multi-GPU machines; the usual render nodes are tried in order.
pub(crate) fn vaapi_device() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("PIXCUT_VAAPI_DEVICE") {
        let path = PathBuf::from(path);
        return path.exists().then_some(path);
    }
    ["/dev/dri/renderD128", "/dev/dri/renderD129"]
        .into_iter()
        .map(PathBuf::from)
        .find(|path| path.exists())
}

pub(crate) fn hardware_candidates(codec: ExportCodec) -> &'static [(&'static str, HardwareFamily)] {
    match codec {
        ExportCodec::H264 if cfg!(target_os = "macos") => &[("h264_videotoolbox", HardwareFamily::VideoToolbox)],
        ExportCodec::Hevc if cfg!(target_os = "macos") => &[("hevc_videotoolbox", HardwareFamily::VideoToolbox)],
        ExportCodec::H264 if cfg!(target_os = "windows") => &[
            ("h264_nvenc", HardwareFamily::Nvenc),
            ("h264_qsv", HardwareFamily::Qsv),
            ("h264_amf", HardwareFamily::Amf),
        ],
        ExportCodec::Hevc if cfg!(target_os = "windows") => &[
            ("hevc_nvenc", HardwareFamily::Nvenc),
            ("hevc_qsv", HardwareFamily::Qsv),
            ("hevc_amf", HardwareFamily::Amf),
        ],
        ExportCodec::H264 if cfg!(target_os = "linux") => &[
            ("h264_nvenc", HardwareFamily::Nvenc),
            ("h264_vaapi", HardwareFamily::Vaapi),
            ("h264_qsv", HardwareFamily::Qsv),
        ],
        ExportCodec::Hevc if cfg!(target_os = "linux") => &[
            ("hevc_nvenc", HardwareFamily::Nvenc),
            ("hevc_vaapi", HardwareFamily::Vaapi),
            ("hevc_qsv", HardwareFamily::Qsv),
        ],
        _ => &[],
    }
}

/// Picks the first hardware encoder this machine's FFmpeg actually provides.
/// VAAPI additionally needs a render node, so a missing device falls back to
/// the next family instead of failing the export later.
pub(crate) fn hardware_encoder(codec: ExportCodec, binary: &Path) -> Option<(&'static str, HardwareFamily)> {
    hardware_candidates(codec)
        .iter()
        .copied()
        .find(|(name, family)| {
            encoder_named(binary, name)
                && (*family != HardwareFamily::Vaapi || vaapi_device().is_some())
        })
}
/// Targets a comparable visual quality to the CRF presets using bits per pixel.
pub(crate) fn hardware_bitrate(options: &ExportOptions) -> u64 {
    let bpp = if options.crf <= 20 { 0.14 } else if options.crf <= 24 { 0.10 } else if options.crf <= 28 { 0.07 } else { 0.05 };
    let efficiency = if options.codec == ExportCodec::Hevc { 0.6 } else { 1.0 };
    let bits = options.width as f64 * options.height as f64 * options.fps as f64 * bpp * efficiency;
    bits.round().clamp(1_500_000.0, 60_000_000.0) as u64
}
#[tauri::command]
pub(crate) fn exporter_hardware() -> bool {
    let Some(binary) = ffmpeg() else { return false };
    [ExportCodec::H264, ExportCodec::Hevc]
        .into_iter()
        .any(|codec| hardware_encoder(codec, &binary).is_some())
}
pub(crate) fn encoder_named(binary: &Path, name: &str) -> bool {
    std::process::Command::new(binary).args(["-hide_banner", "-encoders"]).output().is_ok_and(|output| {
        output.status.success() && String::from_utf8_lossy(&output.stdout).lines().any(|line| line.split_whitespace().nth(1) == Some(name))
    })
}
#[tauri::command]
pub(crate) async fn exporter_capabilities() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(binary) = ffmpeg() else { return vec![] };
        [(ExportCodec::H264,"h264"),(ExportCodec::Hevc,"hevc"),(ExportCodec::Vp9,"vp9"),(ExportCodec::Prores,"prores")]
            .into_iter()
            .filter(|(codec,_)| encoder_available(&binary,*codec) && encoder_named(&binary, codec.audio_encoder()))
            .map(|(_,name)| name.to_owned())
            .collect()
    }).await.map_err(|error| error.to_string())
}
pub(crate) fn check_encoder(binary: &Path, options: &ExportOptions) -> Result<(), String> {
    if options.hardware {
        let _encoder = hardware_encoder(options.codec, binary)
            .map(|(name, _)| name)
            .ok_or_else(|| {
                let vaapi_only = hardware_candidates(options.codec)
                    .iter()
                    .any(|(name, family)| *family == HardwareFamily::Vaapi && encoder_named(binary, name));
                if vaapi_only && vaapi_device().is_none() {
                    "VAAPI hardware encoding needs a render node (/dev/dri/renderD128). Set PIXCUT_VAAPI_DEVICE or turn hardware encoding off."
                } else {
                    "Hardware encoding is not available for this codec with your FFmpeg. Turn it off to use the software encoder."
                }
            })?;
        return if encoder_named(binary, options.codec.audio_encoder()) {
            Ok(())
        } else {
            Err("Your FFmpeg is missing the audio encoder this format needs.".into())
        };
    }
    if !encoder_available(binary, options.codec) {
        return Err(format!("Your FFmpeg does not include {}. Choose another codec or install FFmpeg with this encoder.", options.codec.encoder()));
    }
    if !encoder_named(binary, options.codec.audio_encoder()) {
        return Err(format!("Your FFmpeg does not include the {} audio encoder needed for this format. Choose another format or install a fuller FFmpeg build.", options.codec.audio_encoder()));
    }
    Ok(())
}
pub(crate) fn export_output_name(options: &ExportOptions) -> String {
    let raw = options.filename.trim();
    let stem = [".mp4", ".mov", ".mkv", ".webm"].into_iter().find_map(|suffix| raw.strip_suffix(suffix)).unwrap_or(raw);
    format!("{}.{}", safe_filename(stem), options.container.extension())
}
/// Encoder arguments for the platform hardware path. VideoToolbox is driven by
/// a bitrate; NVENC uses constant quality (CQ) with a VBR rate control. QSV and
/// VAAPI use the `global_quality`/`qp` knobs their encoders expose, and AMF
/// uses constant QP with a quality preset.
pub(crate) fn hardware_video_args(options: &ExportOptions, encoder: &str, family: HardwareFamily) -> Vec<String> {
    let mut args: Vec<String> = match family {
        HardwareFamily::VideoToolbox => vec![
            "-c:v".into(), encoder.into(),
            "-b:v".into(), hardware_bitrate(options).to_string(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        HardwareFamily::Nvenc => vec![
            "-c:v".into(), encoder.into(),
            "-preset".into(), match options.speed { EncodeSpeed::Fast => "p3", EncodeSpeed::Medium => "p5", EncodeSpeed::Slow => "p7" }.into(),
            "-rc".into(), "vbr".into(),
            "-cq".into(), options.crf.to_string(),
            "-b:v".into(), "0".into(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        HardwareFamily::Qsv => vec![
            "-c:v".into(), encoder.into(),
            "-preset".into(), match options.speed { EncodeSpeed::Fast => "veryfast", EncodeSpeed::Medium => "medium", EncodeSpeed::Slow => "slow" }.into(),
            "-global_quality".into(), options.crf.to_string(),
            "-pix_fmt".into(), "nv12".into(),
        ],
        HardwareFamily::Amf => vec![
            "-c:v".into(), encoder.into(),
            "-quality".into(), match options.speed { EncodeSpeed::Fast => "speed", EncodeSpeed::Medium => "balanced", EncodeSpeed::Slow => "quality" }.into(),
            "-rc".into(), "cqp".into(),
            "-qp_i".into(), options.crf.to_string(),
            "-qp_p".into(), options.crf.to_string(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        HardwareFamily::Vaapi => {
            let device = vaapi_device().unwrap_or_else(|| PathBuf::from("/dev/dri/renderD128"));
            vec![
                "-vaapi_device".into(), device.to_string_lossy().into_owned(),
                "-c:v".into(), encoder.into(),
                "-qp".into(), options.crf.to_string(),
                "-pix_fmt".into(), "vaapi".into(),
            ]
        }
    };
    if options.codec == ExportCodec::Hevc && options.container.is_quicktime_family() {
        args.extend(["-tag:v".into(), "hvc1".into()]);
    }
    if options.container.is_quicktime_family() {
        args.extend(["-movflags".into(), "+faststart".into()]);
    }
    args
}

pub(crate) fn video_encoding_args(
    options: &ExportOptions,
    hardware: Option<(&'static str, HardwareFamily)>,
) -> Vec<String> {
    if options.hardware {
        if let Some((encoder, family)) = hardware {
            return hardware_video_args(options, encoder, family);
        }
    }
    let mut args: Vec<String> = match options.codec {
        ExportCodec::H264 | ExportCodec::Hevc => vec![
            "-c:v".into(), options.codec.encoder().into(),
            "-preset".into(), options.speed.preset().into(),
            "-crf".into(), options.crf.to_string(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        ExportCodec::Vp9 => vec![
            "-c:v".into(), "libvpx-vp9".into(),
            "-crf".into(), options.crf.to_string(),
            "-b:v".into(), "0".into(),
            "-row-mt".into(), "1".into(),
            "-deadline".into(), "good".into(),
            "-cpu-used".into(), options.speed.vp9_cpu_used().into(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        ExportCodec::Prores => vec![
            "-c:v".into(), "prores_ks".into(),
            "-profile:v".into(), EncodeSpeed::prores_profile(options.crf).into(),
            "-vendor".into(), "apl0".into(),
            "-pix_fmt".into(), "yuv422p10le".into(),
        ],
    };
    if options.codec == ExportCodec::Hevc && options.container.is_quicktime_family() {
        args.extend(["-tag:v".into(), "hvc1".into()]);
    }
    if options.container.is_quicktime_family() {
        args.extend(["-movflags".into(), "+faststart".into()]);
    }
    args
}
pub(crate) fn audio_encoding_args(options: &ExportOptions) -> Vec<String> {
    match options.codec {
        ExportCodec::Vp9 => vec!["-c:a".into(), "libopus".into(), "-b:a".into(), "160k".into(), "-ar".into(), "48000".into()],
        ExportCodec::Prores => vec!["-c:a".into(), "pcm_s16le".into(), "-ar".into(), "48000".into()],
        ExportCodec::H264 | ExportCodec::Hevc => vec!["-c:a".into(), "aac".into(), "-b:a".into(), "192k".into(), "-ar".into(), "48000".into()],
    }
}
pub(crate) fn validate_export_options(options: &ExportOptions) -> Result<(), String> {
    if options.width < 160
        || options.height < 160
        || options.width > 3840
        || options.height > 3840
        || !options.width.is_multiple_of(2)
        || !options.height.is_multiple_of(2)
        || !(15..=60).contains(&options.fps)
        || !(10..=35).contains(&options.crf)
    {
        return Err("Invalid export settings.".into());
    }
    if !options.codec.supports(options.container) {
        return Err(format!(
            "{} cannot be written to {}. Choose {} or another codec.",
            options.codec.label(),
            options.container.label(),
            if options.codec == ExportCodec::Vp9 { "WebM" } else if options.codec == ExportCodec::Prores { "QuickTime" } else { "MP4, QuickTime or Matroska" }
        ));
    }
    Ok(())
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportOptions {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) fps: u32,
    pub(crate) crf: u8,
    pub(crate) filename: String,
    #[serde(default)]
    pub(crate) codec: ExportCodec,
    #[serde(default)]
    pub(crate) container: ExportContainer,
    #[serde(default)]
    pub(crate) speed: EncodeSpeed,
    /// Prefer the platform encoder (Apple VideoToolbox) over x264/x265.
    #[serde(default)]
    pub(crate) hardware: bool,
}

#[tauri::command]
pub(crate) fn cancel_export(editor: State<'_, Editor>) {
    if editor.exporting.load(Ordering::SeqCst) {
        editor.cancel_export.store(true, Ordering::SeqCst);
    }
}

#[tauri::command]
pub(crate) async fn export_movie(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
    project_id: String,
    frames: Vec<String>,
    durations: Vec<u64>,
    options: ExportOptions,
) -> Result<Option<String>, String> {
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
    let mut project = editor
        .session
        .lock()
        .map_err(|e| e.to_string())?
        .project
        .clone();
    hydrate_project(&asset_store_dir(&app)?, &mut project, false)?;
    if project.id != project_id
        || project.visual_clips().is_empty()
        || frames.is_empty()
        || frames.len() != durations.len()
        || durations.contains(&0)
        || durations.iter().sum::<u64>() != project.total_ticks()
    {
        return Err("The project changed. Please try exporting again.".into());
    }
    validate_export_options(&options)?;
    let binary = ffmpeg().ok_or(
        "Install FFmpeg to export videos.",
    )?;
    check_encoder(&binary, &options)?;
    let filename = export_output_name(&options);
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("Video", &[options.container.extension()])
        .set_file_name(&filename)
        .save_file()
        .await
    else {
        return Ok(None);
    };
    let destination = file.path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = app.clone();
        guard("encoding the video", || {
            encode_movie(project, frames, durations, options, binary, destination, cancel, move |percent| {
                let _ = progress_app.emit("export-progress", percent);
            })
        })
    })
        .await
        .map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportJob {
    pub(crate) frames: Vec<String>,
    pub(crate) durations: Vec<u64>,
    pub(crate) options: ExportOptions,
}

pub(crate) fn checked_export_snapshot(project_id: &str, mut project: Project) -> Result<Project, String> {
    project.validate()?;
    if project.id != project_id || project.visual_clips().is_empty() { return Err("The captured export project is invalid. Start the export again.".into()); }
    Ok(project)
}

#[tauri::command]
pub(crate) async fn export_variants(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
    project_id: String,
    jobs: Vec<ExportJob>,
    snapshot: Option<Project>,
) -> Result<Vec<String>, String> {
    if jobs.is_empty() || jobs.len() > 6 {
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
    let mut project = checked_export_snapshot(&project_id, project)?;
    hydrate_project(&asset_store_dir(&app)?, &mut project, false)?;
    for job in &jobs {
        if job.frames.is_empty()
            || job.frames.len() != job.durations.len()
            || job.durations.contains(&0)
            || job.durations.iter().sum::<u64>() != project.total_ticks()
        {
            return Err("The project changed or export settings are invalid.".into());
        }
        validate_export_options(&job.options)?;
    }
    let binary = ffmpeg().ok_or(
        "Install FFmpeg to export videos.",
    )?;
    for job in &jobs { check_encoder(&binary, &job.options)?; }
    let Some(folder) = rfd::AsyncFileDialog::new().set_title("Choose a folder for your exports").pick_folder().await else {
        return Ok(vec![]);
    };
    let directory = folder.path().to_path_buf();
    let _asset_directory = asset_store_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let total = jobs.len() as f64;
        let mut written = Vec::new();
        for (index, job) in jobs.into_iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                return Err("Export cancelled.".into());
            }
            check_encoder(&binary, &job.options)?;
            let filename = export_output_name(&job.options);
            let destination = directory.join(filename);
            let progress_app = app.clone();
            guard("encoding a video", || {
                encode_movie(project.clone(), job.frames, job.durations, job.options, binary.clone(), destination.clone(), Arc::clone(&cancel), move |percent| {
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
