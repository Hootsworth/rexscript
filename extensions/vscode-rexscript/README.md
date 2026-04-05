# RexScript VS Code Support

This extension adds:

- RexScript language registration for `.rex` files
- TextMate syntax highlighting
- Standalone keyword completions, snippets, hovers, and quick fixes
- Custom `rs` file icon mapping for `.rex`
- Repo-backed diagnostics and command palette actions grouped under `RexScript`
- Mode picker (`default`, `strict`, `dynamic`) when running commands
- Streaming command output in the `RexScript` output channel

## Standalone vs Repo-Backed Features

This extension is safe to install on its own from the Marketplace.

Standalone features work immediately after install:

- syntax highlighting
- file icons
- keyword completions
- snippets
- hover docs
- quick fixes for common authoring issues

Compiler-backed features require a workspace that contains the RexScript compiler:

- live diagnostics
- `Check`, `Compile`, `Run`, and `Trace` commands

The extension looks for the compiler in one of these workspace paths:

- `rexscript/compiler`
- `compiler`

If no compiler is found, the extension stays in standalone authoring mode and shows a friendly message instead of failing silently.

## Local Development

1. Open this folder in VS Code:
   - `rexscript/extensions/vscode-rexscript`
2. Install dependencies if needed (none required for runtime).
3. Press `F5` to launch an Extension Development Host.
4. Open any `.rex` file and verify highlighting, snippets, and hovers.

## Commands

Use the Command Palette and search for `RexScript`:

- `RexScript: Open RexScript Command Menu`
- `RexScript: Check Current RexScript File`
- `RexScript: Compile Current RexScript File`
- `RexScript: Run Current RexScript File`
- `RexScript: Trace Current RexScript File`

You can also run a `.rex` file directly from the editor title bar using the play button.

When you run any command:

1. The active `.rex` file is validated and saved if dirty.
2. If the compiler workspace is available, you choose a mode (`default`, `strict`, or `dynamic`).
3. Output streams to the `RexScript` output panel.

If the compiler is not present, the extension explains how to enable repo-backed features instead of showing a broken command experience.

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
