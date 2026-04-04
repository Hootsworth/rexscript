# RexScript VS Code Support

This extension adds:

- RexScript language registration for `.rex` files
- TextMate syntax highlighting
- Custom `rs` file icon mapping for `.rex`
- Command palette actions grouped under `RexScript`
- Mode picker (`default`, `strict`, `dynamic`) when running commands
- Streaming command output in the `RexScript` output channel

## Local Development

1. Open this folder in VS Code:
   - `rexscript/extensions/vscode-rexscript`
2. Install dependencies if needed (none required for runtime).
3. Press `F5` to launch an Extension Development Host.
4. Open any `.rex` file and verify highlighting.

## Commands

Use the Command Palette and search for `RexScript`:

- `RexScript: Open RexScript Command Menu`
- `RexScript: Check Current RexScript File`
- `RexScript: Compile Current RexScript File`
- `RexScript: Run Current RexScript File`
- `RexScript: Trace Current RexScript File`

You can also run a `.rex` file directly from the editor title bar using the play button.

The extension looks for a compiler directory at one of these paths in the opened workspace:

- `rexscript/compiler`
- `compiler`

When you run any command:

1. The active `.rex` file is validated and saved if dirty.
2. You choose a mode (`default`, `strict`, or `dynamic`).
3. Output streams to the `RexScript` output panel.

## File Icons

To use the custom `rs` icon mapping:

1. Open Command Palette.
2. Run `Preferences: File Icon Theme`.
3. Select `RexScript File Icons`.

## Packaging

Install `vsce` globally and package:

```bash
npm i -g @vscode/vsce
cd rexscript/extensions/vscode-rexscript
vsce package
```

This creates a `.vsix` file that can be installed in VS Code.
