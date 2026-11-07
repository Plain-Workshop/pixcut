# Agent access (MCP)

PixCut can expose the open project to an AI agent over the
[Model Context Protocol](https://modelcontextprotocol.io). The server runs inside
the desktop app, listens only on `127.0.0.1`, requires a bearer token, and is off
until you turn it on.

There is no cloud service, no telemetry, and no request leaves the machine.

## Turn it on

1. Open **Settings → Agent access**.
2. Switch on **Allow agent access (MCP)**.
3. Copy the endpoint and token, or press **Copy configuration** for a ready-made
   client entry.

The endpoint is `http://127.0.0.1:47821/mcp` unless that port was taken, in which
case PixCut picks the next free one and shows it. The choice is remembered, so a
client configuration keeps working across restarts.

The server starts again on the next launch if it was left on. **New token**
invalidates every configured client immediately; the port does not change.

## Configure a client

The configuration shown in Settings is a remote MCP server entry. For opencode:

```json
{
  "mcp": {
    "pixcut": {
      "type": "remote",
      "enabled": true,
      "url": "http://127.0.0.1:47821/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

For Claude Code:

```sh
claude mcp add --transport http pixcut http://127.0.0.1:47821/mcp \
  --header "Authorization: Bearer <token>"
```

Any client that speaks Streamable HTTP with custom headers works the same way.
Clients that only launch stdio servers (such as Claude Desktop's plain
configuration) cannot connect directly. A local bridge such as `mcp-remote`
can sit between them; it still talks only to `127.0.0.1`:

```json
{
  "mcpServers": {
    "pixcut": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://127.0.0.1:47821/mcp",
               "--header", "Authorization: Bearer <token>"]
    }
  }
}
```

This runs a third-party package from npm, so install it only if you trust it.

## Tools

| Tool | What it does |
| --- | --- |
| `get_project` | Name, format, duration, undo state and every clip summary |
| `get_scene` | One clip with framing, grade, fades, motion and text |
| `get_history` | Can undo / can redo |
| `list_media` | Referenced media, its kind, and its path in the local store |
| `get_app_status` | Export busy flag, FFmpeg availability, version |
| `import_media` | Copy a picture or video into the local asset store |
| `add_scene` | Append a picture clip (path or `pixcut-asset:` reference) |
| `update_scene` | Change text, length, fit, motion, fades, framing, grade |
| `set_transition` | Set or clear the transition into a clip (fade, slide, wipe, zoom, blur, circle, slide-up, spin) |
| `add_audio` / `update_audio` / `remove_audio` | Add a music track from a file path (needs FFmpeg to read its length), change start, length, volume and fades, or remove it |
| `set_global_text` / `remove_global_text` | Add or change a text layer that spans the story, or remove it |
| `remove_scene` | Delete a clip and close the gap |
| `move_scene` | Move a clip by an offset or to an index |
| `duplicate_scene` | Copy a clip after itself, returning the new id |
| `split_scene` | Cut a clip at a number of seconds from its start |
| `update_project` | Rename the project or change its aspect ratio |
| `undo` / `redo` | Step through the same history as the editor |
| `save_project` | Write a `.pixcut` package to a path, without a dialog |
| `open_project` | Open a `.pixcut` package in the window |

Media is always reported as `pixcut-asset:<sha256>`. An agent never receives
base64 media, and inline data URLs are replaced with a size marker.

### Limits

- **Pictures can be added.** Video import needs the webview to probe duration and
  build a poster frame, so `add_scene` rejects a video reference with a message
  pointing at the app.
- **Export is not exposed.** Frames are rendered by the canvas compositor in the
  editor, so exporting stays in the Export dialog.
- **Tool calls are rejected while an export runs**, with a message to retry when
  it finishes.
- Undo history is the normal 30-step session history. Every tool call is one
  step, so an agent's edits can be undone in the window.

## How the editor stays in sync

Every mutating tool applies the same `Command` a button press would, writes
recovery, and emits a `project-changed` event. The editor waits for any local
command in flight and then pulls the new view, so an agent's change appears
immediately without a second copy of the project travelling over IPC.

## Security

- Bound to `127.0.0.1`; the port is not reachable from the network.
- Every request needs `Authorization: Bearer <token>`; comparison is
  constant-time.
- The token lives in `mcp.json` in PixCut's app config directory with owner-only
  permissions on Unix.
- Host-header validation rejects non-loopback hosts.
- The server is off by default and stops the moment the switch is turned off.

## Development

- `desktop/src-tauri/src/mcp/mod.rs` — lifecycle, router, Tauri commands.
- `desktop/src-tauri/src/mcp/tools.rs` — tool arguments and handlers.
- `desktop/src-tauri/src/mcp/backend.rs` — the `Backend` trait, the real
  implementation, and the in-memory test double.
- `desktop/src-tauri/src/mcp/auth.rs` — bearer-token check.
- `desktop/src-tauri/src/mcp/config.rs` — persisted settings and port fallback.

The HTTP transport is covered by an in-process test that starts the real router
on an ephemeral port, asserts an unauthorized request gets `401`, initializes a
session, and lists the tools.
