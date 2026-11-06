// Encrypts private/employees.json into data/employees.enc.json for publishing.
// Run from the project root: node tools/encrypt.mjs
import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'private/employees.json';
const TARGET = 'data/employees.enc.json';
const ITERATIONS = 600000;
const MIN_LENGTH = 12;

/* Reads a line in raw mode, so the prompt stays on screen and the typed text is never shown. */
function askHidden(question) {
  if (!process.stdin.isTTY) throw new Error('Bu komutu terminalde çalıştır.');
  process.stdout.write(question);
  return new Promise((resolve) => {
    let answer = '';
    const stop = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') { stop(); process.exit(130); }
        if (ch === '\r' || ch === '\n') { stop(); resolve(answer); return; }
        if (ch === '\u007f' || ch === '\b') answer = [...answer].slice(0, -1).join('');
        else if (ch >= ' ') answer += ch;
      }
    };
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function readPassword() {
  if (process.env.ATTENDANCE_PASSWORD) return process.env.ATTENDANCE_PASSWORD;
  const first = await askHidden('Şifre: ');
  const second = await askHidden('Şifre (tekrar): ');
  if (first !== second) throw new Error('Şifreler aynı değil.');
  return first;
}

const base64 = (bytes) => Buffer.from(bytes).toString('base64');

try {
  const password = await readPassword();
  if (password.length < MIN_LENGTH) throw new Error(`Şifre en az ${MIN_LENGTH} karakter olmalı.`);

  const plain = await readFile(SOURCE);
  JSON.parse(plain.toString('utf8'));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);

  await writeFile(TARGET, JSON.stringify({ version: 1, iterations: ITERATIONS, salt: base64(salt), iv: base64(iv), data: base64(new Uint8Array(data)) }));
  console.log(`Hazır: ${TARGET}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
