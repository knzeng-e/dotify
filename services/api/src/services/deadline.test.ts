import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { createDeadline, withDeadline } from './deadline.js';

test('a deadline survives repeated collection of an otherwise unreachable parent timeout', () => {
  const module = new URL('./deadline.ts', import.meta.url).href;
  const code = `import { createDeadline } from ${JSON.stringify(module)};
    const deadline = createDeadline(new AbortController().signal, 100);
    const collecting = setInterval(() => global.gc(), 5);
    const watchdog = setTimeout(() => { throw new Error('Deadline was lost during GC'); }, 3000);
    await new Promise(resolve => deadline.signal.addEventListener('abort', resolve, { once: true }));
    clearInterval(collecting); clearTimeout(watchdog); deadline.dispose();
    if (deadline.signal.reason.name !== 'TimeoutError') throw new Error('Wrong deadline reason');
    console.log('deadline survived');`;
  assert.equal(
    execFileSync(process.execPath, ['--expose-gc', '--import', 'tsx', '--input-type=module', '-e', code], { timeout: 5000, encoding: 'utf8' }).trim(),
    'deadline survived'
  );
});

test('completion clears the timer, while owner cancellation preserves its reason', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let completed!: AbortSignal;
  assert.equal(
    await withDeadline(new AbortController().signal, 50, async signal => {
      completed = signal;
      return 'done';
    }),
    'done'
  );
  t.mock.timers.tick(100);
  assert.equal(completed.aborted, false);
  const owner = new AbortController();
  const deadline = createDeadline(owner.signal, 50);
  const reason = new Error('shutdown');
  owner.abort(reason);
  assert.equal(deadline.signal.reason, reason);
  deadline.dispose();
  await assert.rejects(
    withDeadline(owner.signal, 50, async () => {
      throw new Error('Must not start');
    }),
    reason
  );
});
