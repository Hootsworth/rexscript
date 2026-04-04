#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const traceFile = process.argv[2];

if (!traceFile) {
  console.error("Usage: rex-replay <trace-file.json>");
  process.exit(1);
}

const tracePath = path.resolve(process.cwd(), traceFile);

if (!fs.existsSync(tracePath)) {
  console.error(`Trace file not found: ${tracePath}`);
  process.exit(1);
}

try {
  const content = fs.readFileSync(tracePath, 'utf8');
  const trace = JSON.parse(content);
  
  console.log("\n▶ Starting Trace Replay\n");
  
  if (!Array.isArray(trace)) {
    console.error("Invalid trace format. Expected JSON array.");
    process.exit(1);
  }

  let i = 0;
  
  function playNext() {
    if (i >= trace.length) {
      console.log("\n◼ End of Trace\n");
      return;
    }
    
    const event = trace[i];
    const delay = i > 0 ? (new Date(event.timestamp) - new Date(trace[i-1].timestamp)) || 500 : 500;
    
    // Cap delay so replay isn't too slow
    const playDelay = Math.min(Math.max(delay, 100), 2000); 

    setTimeout(() => {
      displayEvent(event);
      i++;
      playNext();
    }, playDelay);
  }
  
  function displayEvent(e) {
    const time = new Date(e.timestamp).toLocaleTimeString();
    if (e.type === "rationale") {
      console.log(`\x1b[35m[${time}] RATIONALE:\x1b[0m ${e.message}`);
    } else if (e.type === "goal_start") {
      console.log(`\n\x1b[36m[${time}] 🎯 GOAL:\x1b[0m ${e.description} \x1b[2m(constraints: ${JSON.stringify(e.constraints)})\x1b[0m`);
    } else if (e.type === "goal_end") {
      console.log(`\x1b[36m[${time}] 🏁 GOAL COMPLETED\x1b[0m\n`);
    } else if (e.action) {
      console.log(`\x1b[33m[${time}] ⚡ ACTION:\x1b[0m ${e.action} \x1b[2m(${e.riskLevel || 'INFO'})\x1b[0m`);
    } else {
      console.log(`\x1b[2m[${time}] SYSTEM:\x1b[0m ${JSON.stringify(e)}`);
    }
  }

  playNext();

} catch (err) {
  console.error("Failed to parse or play trace:", err);
  process.exit(1);
}
