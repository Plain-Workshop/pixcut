# Official technical references and investigation notes

Checked in October 2026 for broad capability and licensing context (recheck exact versions before engineering):
- Tauri 2 plugin architecture and commands: https://v2.tauri.app/develop/plugins/ ; https://tauri.app/develop/plugins/ . Tauri provides a webview shell, Rust native commands and plugins, not a ready-made editing engine.
- MLT documented features (tracks, transitions, keyframes, LGPLv2.1): https://www.mltframework.org/features/ ; https://mltframework.org/docs/ . Evaluate module-specific licensing and native GPU preview integration separately.
- GStreamer Editing Services: https://gstreamer.freedesktop.org/documentation/gst-editing-services/ ; Rust docs: https://gstreamer.freedesktop.org/documentation/rust/stable/latest/docs/gstreamer_editing_services/ . Cross-platform timeline framework with Rust bindings, needs packaging tests.
- FFmpeg licensing: https://ffmpeg.org/legal.html . LGPL/GPL configuration and codec patents require explicit due diligence.
- wgpu native GPU abstraction: https://docs.rs/wgpu/ . Not a nonlinear video editor by itself.

## Unknowns requiring experiments
Exact preview texture path per OS, commercial redistribution of selected native modules, H.264/HEVC codec distribution obligations per market, HDR/SDR equivalence, model commercial licenses, and cost structure of third-party inference. Do not fabricate a model's availability or per-generation cost. Product prices and release durations are proposals and should be validated with beta users.
