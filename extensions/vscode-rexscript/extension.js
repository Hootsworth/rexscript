const path = require("node:path");
const fs = require("node:fs");
const cp = require("node:child_process");
const vscode = require("vscode");

const OUTPUT = vscode.window.createOutputChannel("RexScript");
const diagnosticCollection = vscode.languages.createDiagnosticCollection("rexscript");
const diagnosticTimers = new Map();
let compilerStatusNoticeShown = false;

const KEYWORD_DOCS = {
  observe: {
    summary: "Fetch a page and bind it to an alias.",
    syntax: 'observe page "<url>" with session s as $page'
  },
  hunt: {
    summary: "Observe using hunt semantics for agentic page acquisition.",
    syntax: 'hunt page "<url>" as $page'
  },
  find: {
    summary: "Perform semantic lookup against a page or source object.",
    syntax: 'find "selector" in $page as $result'
  },
  click: {
    summary: "Interact with a semantic target on a page.",
    syntax: 'click "login button" on $page'
  },
  type: {
    summary: "Type text into a semantic target on a page.",
    syntax: 'type "user@example.com" into "username field" on $page'
  },
  scroll: {
    summary: "Scroll a semantic target into view.",
    syntax: 'scroll to "footer" on $page'
  },
  extract: {
    summary: "Extract typed fields from a source object using a schema.",
    syntax: 'extract { price: number, inStock: boolean } from $page as $data'
  },
  watch: {
    summary: "Poll a URL until a condition appears or a timeout elapses.",
    syntax: 'watch "https://example.com/status" for "available" until 5m as $statusPage'
  },
  verify: {
    summary: "Assert that a target matches a claim.",
    syntax: 'verify $data.price is "a reasonable value"'
  },
  budget: {
    summary: "Run a block under token, cost, and time limits.",
    syntax: 'budget max_cost=$0.10, max_tokens=1000, max_time=10s { ... }'
  },
  synthesise: {
    summary: "Combine inputs into a synthesized summary object.",
    syntax: 'synthesise [$page, $statusPage] as $summary'
  },
  expect: {
    summary: "Wrap a block with explicit fallback handling.",
    syntax: 'expect { ... } otherwise * { use default null }'
  },
  plan: {
    summary: "Group steps into a named execution plan.",
    syntax: 'plan "Research pricing changes" { step "Capture page" { ... } }'
  },
  step: {
    summary: "Define an ordered plan step.",
    syntax: 'step "Capture source page" { ... }'
  },
  "use.instead": {
    summary: "Run foreign-language content through the runtime executor bridge.",
    syntax: 'use.instead:python as $result { ... }'
  }
};

const SNIPPETS = [
  {
    label: "observe page",
    detail: "Fetch page into alias",
    snippet: 'observe page "${1:https://example.com}" as $${2:page}',
    documentation: "Fetch a page and bind the result to an alias."
  },
  {
    label: "extract schema",
    detail: "Extract typed fields",
    snippet: 'extract {\n  ${1:price}: ${2:number},\n  ${3:inStock}: ${4:boolean}\n} from $${5:page} as $${6:data}',
    documentation: "Extract structured fields from a page or source object."
  },
  {
    label: "watch url",
    detail: "Poll until condition",
    snippet: 'watch "${1:https://example.com/status}" for "${2:available}" until ${3:5m} as $${4:statusPage}',
    documentation: "Poll a URL until a target condition is observed."
  },
  {
    label: "budget block",
    detail: "Run block with constraints",
    snippet: 'budget max_cost=$${1:0.10}, max_tokens=${2:1000}, max_time=${3:10s} {\n  ${4:synthesise [$page] as $summary}\n}',
    documentation: "Constrain a block by cost, token, and time budgets."
  },
  {
    label: "expect recovery",
    detail: "Wrap block with fallback",
    snippet: 'expect {\n  ${1:observe page "https://example.com" as $page}\n} otherwise * {\n  use default ${2:null}\n}',
    documentation: "Wrap risky work with a fallback path."
  },
  {
    label: "plan step",
    detail: "Create plan with steps",
    snippet: 'plan "${1:Plan name}" {\n  step "${2:First step}" {\n    ${3:observe page "https://example.com" as $page}\n  }\n}',
    documentation: "Create a structured execution plan."
  }
];

function updateDiagnostics(document) {
  if (!document.fileName.endsWith(".rex")) return;
  const compilerDir = findCompilerDir();
  if (!compilerDir) {
    diagnosticCollection.delete(document.uri);
    return;
  }
  
  const filePath = document.uri.fsPath;
  cp.execFile(npmExecutable(), ["run", "rex:check", "--", filePath, "default", "--json"], { cwd: compilerDir }, (err, stdout) => {
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
                diag.code = item.code;
                diag.source = "rexscript";
                diagnostics.push(diag);
             }
          };

          processItems(result.errors, vscode.DiagnosticSeverity.Error);
          processItems(result.warnings, vscode.DiagnosticSeverity.Warning);

          diagnosticCollection.set(document.uri, diagnostics);
      } catch (e) {
          diagnosticCollection.delete(document.uri);
      }
  });
}

function scheduleDiagnostics(document) {
  if (!document || !document.fileName.endsWith(".rex")) return;
  const key = document.uri.toString();
  const existing = diagnosticTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    diagnosticTimers.delete(key);
    updateDiagnostics(document);
  }, 180);
  diagnosticTimers.set(key, timer);
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

function showCompilerUnavailableMessage(contextLabel = "This feature") {
  if (!compilerStatusNoticeShown) {
    compilerStatusNoticeShown = true;
    OUTPUT.appendLine("[rexscript] Standalone mode: syntax highlighting, snippets, hovers, and quick fixes are available.");
    OUTPUT.appendLine("[rexscript] Repo-backed features like diagnostics, check, compile, run, and trace need a workspace containing rexscript/compiler or compiler.");
  }

  vscode.window.showInformationMessage(
    `${contextLabel} needs a RexScript compiler workspace. Open a workspace containing 'rexscript/compiler' or 'compiler' to enable diagnostics and execution commands.`
  );
}

function loadReservedKeywords() {
  const compilerDir = findCompilerDir();
  if (compilerDir) {
    const filePath = path.join(compilerDir, "contracts", "reserved-keywords.txt");
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    }
  }

  const bundledPath = path.join(__dirname, "keywords.json");
  if (!fs.existsSync(bundledPath)) {
    return [];
  }

  try {
    const keywords = JSON.parse(fs.readFileSync(bundledPath, "utf8"));
    return Array.isArray(keywords) ? keywords : [];
  } catch {
    return [];
  }
}

function getKeywordRange(document, position) {
  return document.getWordRangeAtPosition(position, /[A-Za-z_.]+/);
}

function createKeywordCompletions() {
  return loadReservedKeywords().map((keyword) => {
    const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
    const doc = KEYWORD_DOCS[keyword];
    if (doc) {
      item.detail = doc.summary;
      item.documentation = new vscode.MarkdownString(`**${keyword}**\n\n${doc.summary}\n\n\`${doc.syntax}\``);
    }
    return item;
  });
}

function createSnippetCompletions() {
  return SNIPPETS.map((entry) => {
    const item = new vscode.CompletionItem(entry.label, vscode.CompletionItemKind.Snippet);
    item.insertText = new vscode.SnippetString(entry.snippet);
    item.detail = entry.detail;
    item.documentation = new vscode.MarkdownString(entry.documentation);
    item.sortText = `0_${entry.label}`;
    return item;
  });
}

function wrapLineWithRecovery(document, lineNumber) {
  const line = document.lineAt(lineNumber);
  const indent = line.text.match(/^\s*/)?.[0] || "";
  const innerIndent = `${indent}  `;
  const body = line.text.trim();
  return `${indent}expect {\n${innerIndent}${body}\n${indent}} otherwise * {\n${innerIndent}use default null\n${indent}}`;
}

function createAliasFix(document, diagnostic) {
  const line = document.lineAt(diagnostic.range.start.line);
  if (/\bas\s+\$[A-Za-z_][A-Za-z0-9_]*/.test(line.text)) {
    return null;
  }
  const action = new vscode.CodeAction("Add alias", vscode.CodeActionKind.QuickFix);
  action.diagnostics = [diagnostic];
  action.edit = new vscode.WorkspaceEdit();
  action.edit.insert(document.uri, line.range.end, " as $result");
  return action;
}

function createRecoveryWrapFix(document, diagnostic, title) {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  action.diagnostics = [diagnostic];
  action.edit = new vscode.WorkspaceEdit();
  const lineNumber = diagnostic.range.start.line;
  const line = document.lineAt(lineNumber);
  action.edit.replace(document.uri, line.range, wrapLineWithRecovery(document, lineNumber));
  return action;
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
    showCompilerUnavailableMessage(`RexScript ${scriptName}`);
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

  if (!findCompilerDir()) {
    OUTPUT.appendLine("[rexscript] Compiler workspace not detected. Running in standalone authoring mode.");
  }

  vscode.workspace.onDidSaveTextDocument(updateDiagnostics, null, context.subscriptions);
  vscode.workspace.onDidOpenTextDocument(scheduleDiagnostics, null, context.subscriptions);
  vscode.workspace.onDidChangeTextDocument((event) => scheduleDiagnostics(event.document), null, context.subscriptions);
  vscode.workspace.onDidCloseTextDocument((document) => {
    diagnosticCollection.delete(document.uri);
    const key = document.uri.toString();
    const timer = diagnosticTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      diagnosticTimers.delete(key);
    }
  }, null, context.subscriptions);

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "rexscript" },
      {
        provideCompletionItems() {
          return [
            ...createSnippetCompletions(),
            ...createKeywordCompletions()
          ];
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: "rexscript" }, {
      provideHover(document, position) {
        const range = getKeywordRange(document, position);
        if (!range) {
          return null;
        }
        const keyword = document.getText(range);
        const doc = KEYWORD_DOCS[keyword];
        if (!doc) {
          return null;
        }
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${keyword}**\n\n${doc.summary}\n\n`);
        md.appendCodeblock(doc.syntax, "rexscript");
        return new vscode.Hover(md, range);
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "rexscript" },
      {
        provideCodeActions(document, _range, context) {
          const actions = [];
          for (const diagnostic of context.diagnostics) {
            const code = String(diagnostic.code || "");
            if (code === "ERR004") {
              const action = createAliasFix(document, diagnostic);
              if (action) actions.push(action);
            }
            if (["WARN001", "WARN002", "WARN021", "WARN022"].includes(code)) {
              actions.push(createRecoveryWrapFix(document, diagnostic, "Wrap in expect/otherwise"));
            }
          }
          return actions;
        }
      },
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
      }
    )
  );

  // Run on all currently open files
  if (vscode.window.activeTextEditor) {
      scheduleDiagnostics(vscode.window.activeTextEditor.document);
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
