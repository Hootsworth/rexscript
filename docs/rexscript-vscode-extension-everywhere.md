# RexScript VS Code Extension Guide (Local To Marketplace)

This guide explains how to run RexScript as a first-class language in VS Code, then publish it so it can be installed anywhere.

## 1) What Already Exists In This Repo

The extension scaffold is already present at `extensions/vscode-rexscript` with:

- language id: `rexscript`
- file extension: `.rex`
- TextMate grammar registration
- commands for check/compile/run/trace
- optional custom icon theme

Main files:

- `extensions/vscode-rexscript/package.json`
- `extensions/vscode-rexscript/extension.js`
- `extensions/vscode-rexscript/syntaxes/rexscript.tmLanguage.json`
- `extensions/vscode-rexscript/language-configuration.json`

## 2) Run It Locally

1. Open `extensions/vscode-rexscript` in VS Code.
2. Press `F5` to start an Extension Development Host.
3. In the new host window, open any `.rex` file.
4. Run command palette actions:
   - `RexScript: Check Current RexScript File`
   - `RexScript: Compile Current RexScript File`
   - `RexScript: Run Current RexScript File`
   - `RexScript: Trace Current RexScript File`

The extension resolves compiler paths from either:

- `rexscript/compiler`
- `compiler`

## 3) Install As A VSIX On Any Machine

From project root:

```bash
cd extensions/vscode-rexscript
npm i -g @vscode/vsce
vsce package
```

This creates a `.vsix` file. Install it using one of these:

- VS Code UI: Extensions panel -> `...` menu -> `Install from VSIX...`
- CLI:

```bash
code --install-extension rexscript-vscode-support-0.1.0.vsix
```

## 4) Publish To VS Code Marketplace (So It Works Everywhere)

1. Create an Azure DevOps publisher account.
2. Create a Personal Access Token (PAT) with Marketplace publish scope.
3. Login and publish:

```bash
cd extensions/vscode-rexscript
vsce login <your-publisher-id>
vsce publish
```

4. Users everywhere can now install by searching your extension name.

## 5) Keep Language Support Solid

- Keep grammar scopes updated in `syntaxes/rexscript.tmLanguage.json`.
- Add integration checks for grammar tokens and commands.
- Version extension on every release (`package.json` version bump).
- Document new RexScript keywords in extension README.

## 6) Optional: Bundle Compiler With Extension

If you want users to run RexScript without cloning the full repo:

1. Bundle compiler artifacts into extension package.
2. Update command runner in `extension.js` to use bundled binaries.
3. Add platform-aware runtime checks for Node availability.

This turns the extension into a near self-contained language toolchain.

## 7) Optional: Add LSP For Rich IDE Features

For global-scale language support, add a Language Server for:

- diagnostics as-you-type
- completion for keywords and snippets
- hover docs
- go-to definition for aliases and symbols

Architecture:

- client: VS Code extension (`extension.js`)
- server: Node process using `vscode-languageserver`
- parser/semantic reuse from `compiler/src`

That is the long-term path to make RexScript feel like a mature language in every VS Code install.