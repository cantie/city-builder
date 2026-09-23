import { execSync } from 'node:child_process';

const port = process.argv[2] ?? '3001';

function listeningPids(p) {
  if (process.platform === 'win32') {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    const ids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${p}`) || !/LISTENING/i.test(line)) continue;
      const pid = Number(line.trim().split(/\s+/).pop());
      if (pid && pid !== process.pid) ids.add(pid);
    }
    return [...ids];
  }
  try {
    const out = execSync(`lsof -ti tcp:${p} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out
      .split(/\s+/)
      .map(Number)
      .filter((pid) => pid && pid !== process.pid);
  } catch {
    return [];
  }
}

for (const pid of listeningPids(port)) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    console.log(`[free-port] killed ${pid} on :${port}`);
  } catch {
    /* already gone */
  }
}
