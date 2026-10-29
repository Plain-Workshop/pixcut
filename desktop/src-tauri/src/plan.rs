use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlanOverlay {
    pub(crate) png: String,
    #[serde(default)]
    pub(crate) frames: Vec<String>,
    pub(crate) start_ticks: u64,
    pub(crate) duration_ticks: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PlanSegment {
    pub(crate) kind: String,
    pub(crate) png: Option<String>,
    pub(crate) video: Option<String>,
    pub(crate) source_in_seconds: Option<f64>,
    pub(crate) fit: Option<String>,
    /// Playback speed for imported video clips. 1.0 means real time.
    #[serde(default)]
    pub(crate) speed: Option<f64>,
    /// End of a linear speed ramp. Missing means constant speed.
    #[serde(default)]
    pub(crate) speed_end: Option<f64>,
    /// Picture-only reverse playback.
    #[serde(default)]
    pub(crate) reverse: bool,
    /// A `.cube` 3D LUT baked from the same grade the preview canvas uses.
    #[serde(default)]
    pub(crate) lut: Option<String>,
    /// Visual fade lengths for an imported video clip, used for its own audio.
    #[serde(default)]
    pub(crate) fade_in: f64,
    #[serde(default)]
    pub(crate) fade_out: f64,
    /// Imported clip sound level (0–100). Missing means full volume.
    #[serde(default)]
    pub(crate) video_volume: Option<f64>,
    /// The export dialog's include-audio switch. Older callers omit it.
    #[serde(default = "default_true")]
    pub(crate) include_audio: bool,
    pub(crate) duration_ticks: u64,
    /// A clip's sound can run through a baked transition after its moving
    /// picture has been shortened. Missing means it matches `duration_ticks`.
    #[serde(default)]
    pub(crate) audio_duration_ticks: Option<u64>,
    #[serde(default)]
    pub(crate) overlays: Vec<PlanOverlay>,
}

pub(crate) fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportPlan {
    pub(crate) segments: Vec<PlanSegment>,
    pub(crate) options: ExportOptions,
}

pub(crate) fn validate_plan(project: &Project, plan: &ExportPlan) -> Result<(), String> {
    let options = &plan.options;
    validate_export_options(options)?;
    if plan.segments.is_empty() || plan.segments.len() > 200 {
        return Err("The export plan is empty or too long.".into());
    }
    let mut total = 0u64;
    for segment in &plan.segments {
        if segment.duration_ticks == 0 {
            return Err("An export segment has no duration.".into());
        }
        total += segment.duration_ticks;
        if !segment.fade_in.is_finite()
            || !segment.fade_out.is_finite()
            || segment.fade_in < 0.0
            || segment.fade_out < 0.0
        {
            return Err("An export segment has an invalid fade.".into());
        }
        match segment.kind.as_str() {
            "image" => {
                if !segment.png.as_deref().is_some_and(|value| value.starts_with("data:image/png;base64,")) {
                    return Err("An image segment is missing its render.".into());
                }
            }
            "video" => {
                let source = segment.video.as_deref().unwrap_or_default();
                let streamed = source.strip_prefix("pixcut-asset:").is_some_and(|id| id.len() == 64 && id.chars().all(|character| character.is_ascii_hexdigit()));
                if !source.starts_with("data:video/") && !streamed {
                    return Err("A video segment is missing its source.".into());
                }
                let speed = segment.speed.unwrap_or(1.0);
                if !speed.is_finite() || !(0.25..=4.0).contains(&speed) {
                    return Err("A video segment has an invalid speed.".into());
                }
                if segment.speed_end.is_some_and(|value| !value.is_finite() || !(0.25..=4.0).contains(&value)) {
                    return Err("A video segment has an invalid end speed.".into());
                }
                if let Some(audio_ticks) = segment.audio_duration_ticks {
                    if audio_ticks < segment.duration_ticks {
                        return Err("A video segment's sound is shorter than its picture.".into());
                    }
                }
                if let Some(volume) = segment.video_volume {
                    if !volume.is_finite() || !(0.0..=100.0).contains(&volume) {
                        return Err("A video segment has an invalid sound level.".into());
                    }
                }
                if let Some(lut) = segment.lut.as_deref() {
                    if lut.is_empty()
                        || lut.len() > 8_000_000
                        || lut.contains('\0')
                        || !lut.lines().any(|line| line.trim().starts_with("LUT_3D_SIZE"))
                    {
                        return Err("A video grade lookup table is invalid.".into());
                    }
                }
            }
            _ => return Err("An export segment has an unknown type.".into()),
        }
        if segment.lut.is_some() && segment.kind != "video" {
            return Err("Only video segments can carry a grade lookup table.".into());
        }
        for overlay in &segment.overlays {
            if overlay.duration_ticks == 0 || !overlay.png.starts_with("data:image/png;base64,")
                || (!overlay.frames.is_empty() && (overlay.frames.len() as u64 != overlay.duration_ticks
                    || overlay.frames.iter().any(|frame| !frame.starts_with("data:image/png;base64,")))) {
                return Err("A text overlay is invalid.".into());
            }
        }
    }
    if total != project.total_ticks() {
        return Err("The project changed. Please try exporting again.".into());
    }
    Ok(())
}

pub(crate) fn filter_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    let escaped = text.replace('\\', "\\\\").replace('\'', "\\'");
    format!("'{escaped}'")
}

/// FFmpeg volume expression that lowers music inside the given timeline windows.
/// Times are clip-local, so the windows are shifted by the clip's start.
pub(crate) fn ducking_expression(windows: &[(f64, f64)], clip_start: f64, amount: f64) -> String {
    const RAMP: f64 = 0.15;
    let terms: Vec<String> = windows
        .iter()
        .map(|(start, end)| {
            format!(
                "min(max((t+{clip_start:.6}-{start:.6})/{RAMP:.6},0),1)*min(max(({end:.6}-(t+{clip_start:.6}))/{RAMP:.6},0),1)"
            )
        })
        .collect();
    format!("1-{:.6}*max(0,{})", amount / 100.0, terms.join(","))
}

/// True when the media file carries an audio track. A missing ffprobe is not an
/// error: the export simply keeps behaving like it always has, without the
/// clip's own sound.
pub(crate) fn has_audio_stream(binary: &Path, media: &Path) -> bool {
    let probe = Process::new(binary.with_file_name("ffprobe"))
        .args([
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
        ])
        .arg(media)
        .output();
    match probe {
        Ok(output) => output.status.success() && !String::from_utf8_lossy(&output.stdout).trim().is_empty(),
        Err(_) => false,
    }
}

/// Chains `atempo` so every step stays inside the range older FFmpeg builds
/// accept (0.5–2.0). The product is the requested playback speed.
pub(crate) fn atempo_chain(speed: f64) -> String {
    let mut remaining = if speed.is_finite() { speed.clamp(0.25, 4.0) } else { 1.0 };
    let mut steps = Vec::new();
    while remaining > 2.0 + 1e-9 {
        steps.push(2.0);
        remaining /= 2.0;
    }
    while remaining < 0.5 - 1e-9 {
        steps.push(0.5);
        remaining /= 0.5;
    }
    steps.push(remaining);
    steps
        .iter()
        .map(|value| format!("atempo={value:.6}"))
        .collect::<Vec<_>>()
        .join(",")
}

/// Three-band EQ matching the preview's shelf/peaking filters. Bands at 0 dB
/// are omitted so a flat track keeps the old, shorter filter graph.
pub(crate) fn eq_filters(low: f64, mid: f64, high: f64) -> String {
    let mut chain = String::new();
    if low.abs() > 0.01 {
        chain.push_str(&format!(",equalizer=f=120:width_type=q:width=0.7:g={low:.2}"));
    }
    if mid.abs() > 0.01 {
        chain.push_str(&format!(",equalizer=f=1000:width_type=q:width=1:g={mid:.2}"));
    }
    if high.abs() > 0.01 {
        chain.push_str(&format!(",equalizer=f=6000:width_type=q:width=0.7:g={high:.2}"));
    }
    chain
}

/// Splits the soundtrack into equal output slices and applies one `atempo`
/// value per slice, so a linear speed ramp keeps picture and sound together.
pub(crate) fn ramp_atempo_nodes(input: &str, start: f64, end: f64, duration: f64, tag: &str) -> (Vec<String>, String) {
    const STEPS: usize = 8;
    let seconds = duration.max(0.001);
    let split_labels: String = (0..STEPS).map(|index| format!("[{tag}s{index}]")).collect();
    let mut nodes = vec![format!("{input}asplit={STEPS}{split_labels}")];
    let mut labels = String::new();
    let mut source = 0.0;
    let output_slice = seconds / STEPS as f64;
    for index in 0..STEPS {
        let midpoint = (index as f64 + 0.5) / STEPS as f64;
        let speed = (start + (end - start) * midpoint).clamp(0.25, 4.0);
        let source_slice = speed * output_slice;
        nodes.push(format!(
            "[{tag}s{index}]atrim=start={source:.6}:end={:.6},asetpts=PTS-STARTPTS,atempo={speed:.6}[{tag}{index}]",
            source + source_slice
        ));
        source += source_slice;
        labels.push_str(&format!("[{tag}{index}]"));
    }
    nodes.push(format!("{labels}concat=n={STEPS}:v=0:a=1[{tag}]"));
    (nodes, format!("[{tag}]"))
}

/// `setpts` expression for a linear speed ramp. Solving
/// `s = v0·t + (v1−v0)·t²/(2D)` for output time gives the inverse curve; the
/// result is converted back to timebase units.
pub(crate) fn ramp_setpts(start: f64, end: f64, duration: f64) -> Option<String> {
    if (end - start).abs() <= 1e-9 {
        return None;
    }
    let acceleration = (end - start) / (2.0 * duration.max(0.001));
    Some(format!(
        "setpts='(-{start:.6}+sqrt({start:.6}*{start:.6}+{:.9}*(PTS*TB)))/{:.9}/TB'",
        acceleration * 4.0,
        acceleration * 2.0
    ))
}

pub(crate) fn write_plan_payload(directory: &Path, name: &str, data: &str, prefix: &str) -> Result<PathBuf, String> {
    let payload = data.strip_prefix(prefix).ok_or("A media payload has an unsupported format.")?;
    if payload.len() > 160_000_000 {
        return Err("A media payload exceeds the export size limit.".into());
    }
    let bytes = STANDARD.decode(payload).map_err(|e| e.to_string())?;
    let path = directory.join(name);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}
