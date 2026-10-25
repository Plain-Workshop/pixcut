# Social formats, AI resizing and linked versions

## Format system
Define output profile as width, height, fps, pixel aspect, color profile, safe-area template, export encoder preset, and platform metadata. Ship editable profiles: YouTube landscape 16:9, Shorts/Reels/TikTok 9:16, Instagram Feed 4:5, square 1:1, photo/story other formats, and custom. Do not hardcode platform limits forever; publish signed/updatable preset catalog with date/version. Do not claim universal platform-specific safe-zone rectangles.

## Conversion modes
1. Crop: center/manual crop, optional subject tracker and keyframes.
2. Fit: letterbox, blur/duplicate/color/gradient background.
3. AI Extend: fill spatial gaps in still images with masks and protected original region.
4. AI Recompose: crop/reposition/extend as needed; preview original and output with aspect-safe guides.
5. Video outpaint (later): temporal boundary generation; background-only preferred; render short ranges and approve before applying.

## Linked versions design
Root `CreativeProject` stores shared source media and logical scene IDs. Each `OutputVariant` stores aspect ratio/profile, clip inclusion/trim overrides, transforms/crops, track additions, caption placement, intro/outro and independent output settings. Explicit inheritance: `shared` changes propagate until variant has an override; show 'Linked' vs 'Customized' badge, with reset-to-parent and detach options.

## Workflow
Select `Create Versions` -> choose target formats -> system previews crop/fit options for each -> select suggested crop or AI extend -> auto-safe-place captions -> review side-by-side snapshots -> export one or all. Each variant can be opened in same full editor while retaining source and other variants. If shared edit invalidates an override, signal review required rather than silently changing creative output.

## UI
Top preview format switcher (16:9, 9:16, 4:5, 1:1); preview grid compare view as optional; inspector `Adapt` with Source/Target, Method, Subject Lock, Content Preservation, safe-zone overlay, per-variant override. Timeline labels show current variant; when entering variants, preserve playhead time if corresponding scene exists.

## Acceptance
Variant transforms survive save/reopen; base text change propagates to linked variant but not manually overridden text; captions remain within configured safe guides unless explicitly moved; two versions can export without overwriting paths; user can return to original with no image mutation.
