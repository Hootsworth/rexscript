import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import http from "http";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// In memory workspace for the playground
const WORKSPACE_DIR = path.join(__dirname, "workspace");
if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR);

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'RUN_SCRIPT') {
            const tempFile = path.join(WORKSPACE_DIR, 'playground.rex');
            fs.writeFileSync(tempFile, data.code);
            
            // Spawn rex:run
            const compilerDir = path.join(__dirname, "../../compiler");
            const child = spawn("npm", ["run", "rex:run", "--", tempFile], { cwd: compilerDir });

            child.stdout.on('data', (chunk) => {
                ws.send(JSON.stringify({ type: 'output', data: chunk.toString() }));
            });

            child.stderr.on('data', (chunk) => {
                ws.send(JSON.stringify({ type: 'error', data: chunk.toString() }));
            });

            child.on('close', (code) => {
                ws.send(JSON.stringify({ type: 'exit', code }));
            });
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`RexScript Web Playground running at http://localhost:${PORT}`);
});
