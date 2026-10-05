// Quick CDP inspector: attaches to an ALREADY-RUNNING debug Chrome and reports live page state.
import { setTimeout as delay } from "node:timers/promises";

const PORT = 9333;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
if (!page) { console.error("no page target"); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
};
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = (nextId += 1); pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;

await send("Runtime.enable");
const state = await evaluate(`(() => {
  const audios = [...document.querySelectorAll('audio')].map(a => ({ src: (a.src||'').slice(0,60), paused: a.paused, ended: a.ended, currentTime: Math.round(a.currentTime*10)/10, duration: a.duration }));
  return {
    voiceError: document.querySelector('.voice-error')?.textContent ?? null,
    teachingError: document.querySelector('.teaching-error')?.textContent ?? null,
    speech: (document.querySelector('.speech-card')?.textContent ?? '').slice(0, 120),
    lessonComplete: !!document.querySelector('.status-note.is-complete'),
    continuing: !!document.querySelector('.continue-action'),
    diagramTexts: [...document.querySelectorAll('.diagram-canvas text')].map(t => t.textContent),
    audios,
  };
})()`);
console.log(JSON.stringify(state, null, 2));
ws.close();
process.exit(0);
