# CHANGED: Required App Views / Visual Handoff

## Design tokens
Background dark navy `#0E1023`, surface `#181B32`, elevated `#222640`, foreground `#F7F7FC`, muted `#A9AEC5`, primary violet `#7857F7`, blue `#2987F6`, border `#353A55`, positive `#34C98B`. Tokens are proposed editable starting points, not preexisting company identity. Typography: clean bundled or system sans; support EN/PL/UK text width and RTL-ready layout patterns later. 8pt base spacing, touch targets >= 36px on desktop toolbar, accessible contrast.

## Screens that must be implemented
| ID | View | Required regions | Main interaction |
|---|---|---|---|
| APP-01 | Home | brand, New Video/Photo Movie/Templates, recent projects | open without sign-in |
| APP-02 | Editor | left library, preview, right contextual inspector, bottom timeline | drag, trim, split, undo |
| APP-03 | Photo Movie | import/order photos, choose music/style, preview | finish editable timeline |
| APP-04 | Templates | local category gallery, search, preview and use | no network needed for bundled templates |
| APP-05 | Color Inspector | Basic + Advanced accordion, reset | immediate preview |
| APP-06 | Speed/Fade Inspector | speed presets, fade handles/values | precise numeric editing |
| APP-07 | Filters | thumbnails + intensity, undo | preview before applying |
| APP-08 | Shortcut Help | categories, search, actual shortcuts, customization entry | accessible via Help/? |
| APP-09 | Shortcut Customization | presets, remap recorder, conflict resolution, import/export | save local settings |
| APP-10 | Command Palette | search, synonyms, active bindings, disabled state | Ctrl/Cmd+K |
| APP-11 | Export | format, ratio, resolution, frame rate, quality, no watermark | local export |
| APP-12 | Settings | General, Appearance, Editing, Shortcuts, Updates, Privacy | explain offline defaults |

## Brand placements
One consistent symbol in title bar, dock/taskbar icon, website nav, install icon, onboarding, update dialogue and About screen. Never regenerate separate icon per screenshot; use `brand/pixcut-symbol.svg` and pre-rendered PNG sizes. Always use text `PixCut` (capital P/C).

## Responsive desktop behavior
At narrow widths, media library collapses to an icon rail; right inspector resizes and can float; timeline can maximize. Avoid reducing video preview below practical editing dimensions. Persist workspace preferences, provide `Reset Layout`.

## Visual implementation guidance
Reference boards are not screen-by-screen pixel specifications; they show visual language and screen composition. Implement individual views based on this document and use screenshots of the running app in website after development. Keep imagery licensed or original.
