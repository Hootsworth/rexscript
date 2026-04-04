const path = require("node:path");
const fs = require("node:fs");
const cp = require("node:child_process");
const vscode = require("vscode");

const OUTPUT = vscode.window.createOutputChannel("RexScript");
const diagnosticCollection = vscode.languages.createDiagnosticCollection("rexscript");

function updateDiagnostics(document) {
  if (!document.fileName.endsWith(".rex")) return;
  const compilerDir = findCompilerDir();
  if (!compilerDir) return;
  
  const filePath = document.uri.fsPath;
  cp.exec(`${npmExecutable()} run rex:check -- "${filePath}" default --json`, { cwd: compilerDir }, (err, stdout) => {
      try {
          // extract JSON output from stdout, as npm might prepend things in stdout before the raw JSON starts
          const jsonStart = stdout.indexOf('{');
          if (jsonStart === -1) {
              diagnosticCollection.set(document.uri, []);
              return;
          }
          const rawJson = stdout.substring(jsonStart);
          const result = JSON.parse(rawJson);
          const diagnostics = [];
          
          const processItems = (items, severity) => {
             for (const item of (items || [])) {
                const loc = item.loc || { line: 1, column: 1 };
                const line = Math.max(0, loc.line - 1);
                const col = Math.max(0, loc.column - 1);
                const range = new vscode.Range(line, col, line, col + 1); 
                const diag = new vscode.Diagnostic(range, `[${item.code}] ${item.message}`, severity);
                diagnostics.push(diag);
             }
          };

          processItems(result.errors, vscode.DiagnosticSeverity.Error);
          processItems(result.warnings, vscode.DiagnosticSeverity.Warning);

          diagnosticCollection.set(document.uri, diagnostics);
      } catch (e) {
          // silent error on bad parse
      }
  });
}

function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function getActiveRexFilePath() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null;
  }
  const filePath = editor.document.uri.fsPath;
  if (!filePath.toLowerCase().endsWith(".rex")) {
    return null;
  }
  return filePath;
}

function findCompilerDir() {
  const folders = vscode.workspace.workspaceFolders || [];
  for (const folder of folders) {
    const root = folder.uri.fsPath;
    const candidates = [
      path.join(root, "rexscript", "compiler"),
      path.join(root, "compiler")
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, "package.json"))) {
        return candidate;
      }
    }
  }
  return null;
}

async function runRexCommand(scriptName) {
  const activeFile = getActiveRexFilePath();
  if (!activeFile) {
    vscode.window.showWarningMessage("Open a .rex file to run RexScript commands.");
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.isDirty) {
    const saved = await editor.document.save();
    if (!saved) {
      vscode.window.showWarningMessage("Could not save current .rex file before running command.");
      return;
    }
  }

  const mode = await vscode.window.showQuickPick(
    [
      { label: "default", description: "Balanced policy checks" },
      { label: "strict", description: "More restrictive compile checks" },
      { label: "dynamic", description: "Dynamic feature mode" }
    ],
    {
      title: "RexScript Mode"
    }
  );

  if (!mode) {
    return;
  }

  const compilerDir = findCompilerDir();
  if (!compilerDir) {
    vscode.window.showErrorMessage("Could not find rexscript/compiler in this workspace.");
    return;
  }

  const args = ["run", scriptName, "--", activeFile, mode.label];
  OUTPUT.show(true);
  OUTPUT.appendLine("");
  OUTPUT.appendLine(`[rexscript] cwd: ${compilerDir}`);
  OUTPUT.appendLine(`[rexscript] cmd: ${npmExecutable()} ${args.join(" ")}`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `RexScript: ${scriptName}`,
      cancellable: false
    },
    () =>
      new Promise((resolve) => {
        const child = cp.spawn(npmExecutable(), args, {
          cwd: compilerDir,
          shell: false,
          env: process.env
        });

        child.stdout.on("data", (buf) => {
          OUTPUT.append(buf.toString("utf8"));
        });

        child.stderr.on("data", (buf) => {
          OUTPUT.append(buf.toString("utf8"));
        });

        child.on("error", (err) => {
          OUTPUT.appendLine(`[rexscript] process error: ${err.message}`);
          vscode.window.showErrorMessage(`RexScript command failed to start: ${err.message}`);
          resolve();
        });

        child.on("close", (code) => {
          OUTPUT.appendLine(`[rexscript] exit code: ${code}`);
          if (code === 0) {
            vscode.window.showInformationMessage(`RexScript ${scriptName} completed (${mode.label}).`);
          } else {
            vscode.window.showErrorMessage(`RexScript ${scriptName} failed (${mode.label}). See RexScript output.`);
          }
          resolve();
        });
      })
  );
}

function register(context, command, callback) {
  context.subscriptions.push(vscode.commands.registerCommand(command, callback));
}

function activate(context) {
  context.subscriptions.push(OUTPUT);
  context.subscriptions.push(diagnosticCollection);

  vscode.workspace.onDidSaveTextDocument(updateDiagnostics, null, context.subscriptions);
  vscode.workspace.onDidOpenTextDocument(updateDiagnostics, null, context.subscriptions);

  // Run on all currently open files
  if (vscode.window.activeTextEditor) {
      updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  register(context, "rexscript.check", () => runRexCommand("rex:check"));
  register(context, "rexscript.compile", () => runRexCommand("rex:compile"));
  register(context, "rexscript.run", () => runRexCommand("rex:run"));
  register(context, "rexscript.trace", () => runRexCommand("rex:trace"));

  register(context, "rexscript.openMenu", async () => {
    const selected = await vscode.window.showQuickPick(
      [
        { label: "Check current .rex file", command: "rexscript.check" },
        { label: "Compile current .rex file", command: "rexscript.compile" },
        { label: "Run current .rex file", command: "rexscript.run" },
        { label: "Trace current .rex file", command: "rexscript.trace" }
      ],
      {
        title: "RexScript Commands"
      }
    );

    if (!selected) {
      return;
    }

    vscode.commands.executeCommand(selected.command);
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
