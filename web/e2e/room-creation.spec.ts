import { expect, test } from '@playwright/test';
import { io } from 'socket.io-client';

test('a superseded creation ACK cannot replace the new room or publish its old visibility choice', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 0.392, longitude: 9.454, accuracy: 100 });
  let upgraded = false;
  let firstAckPrefix = '';
  let oldRoomId = '';
  let releaseOldAck: (() => void) | undefined;
  const wire: string[] = [];
  const publications: string[] = [];

  await page.routeWebSocket(/\/socket\.io\//, socket => {
    const server = socket.connectToServer();
    socket.onMessage(message => {
      const frame = String(message);
      if (frame === '5') upgraded = true;
      if (frame.includes('"room:create"')) {
        wire.push('create');
        const id = /^42(\d+)\[/.exec(frame)?.[1];
        if (!firstAckPrefix && id) firstAckPrefix = `43${id}[`;
      }
      if (frame.includes('"room:leave"')) wire.push('leave');
      if (frame.includes('"nearby:publish"')) publications.push(frame);
      server.send(message);
    });
    server.onMessage(message => {
      const frame = String(message);
      if (firstAckPrefix && frame.startsWith(firstAckPrefix) && !releaseOldAck) {
        const [response] = JSON.parse(frame.slice(frame.indexOf('['))) as [{ roomId: string }];
        oldRoomId = response.roomId;
        releaseOldAck = () => socket.send(message);
        return;
      }
      socket.send(message);
    });
  });

  await page.goto('/?e2eRoom=public');
  await expect.poll(() => upgraded).toBe(true);
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Open a room' });
  await dialog.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await dialog.getByLabel('Your name in the room').fill('First host');
  await dialog.getByRole('radio', { name: 'Nearby', exact: true }).check();
  await dialog.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect.poll(() => oldRoomId).toMatch(/[A-Z2-9]{6}/);

  // The server has created the room, but its ACK is still in flight. Reopening
  // Create supersedes that intent, including its request to publish location.
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Open a room' });
  await expect(dialog.getByRole('radio', { name: 'Nearby', exact: true })).not.toBeChecked();
  await dialog.getByLabel('Your name in the room').fill('Replacement host');
  await dialog.getByRole('button', { name: 'Open the room', exact: true }).click();
  const roomCode = page.getByTestId('room-code');
  await expect(roomCode).toHaveText(/[A-Z2-9]{6}/);
  const newRoomId = (await roomCode.innerText()).trim();
  expect(newRoomId).not.toBe(oldRoomId);
  expect(wire).toEqual(['create', 'leave', 'create']);

  releaseOldAck!();
  // Exercise another render after delivery: the obsolete ACK must not install
  // room state or hand its visibility intent to the new Nearby session.
  await page.getByRole('tab', { name: /People/ }).click();
  await expect(page.getByRole('region', { name: 'Who can find this room?', exact: true })).toContainText('Only people with your link or room code can join.');
  await expect(roomCode).toHaveText(newRoomId);
  expect(publications).toEqual([]);

  // Cancellation also retires the server-side room instead of merely hiding
  // the stale response and leaving an unreachable host room behind.
  const probe = io('http://127.0.0.1:8789', { transports: ['websocket'] });
  try {
    const response = await new Promise<{ ok: boolean }>((resolve, reject) => {
      probe.timeout(5000).emit('room:join', { roomId: oldRoomId, displayName: 'Probe' }, (error: Error | null, result: { ok: boolean }) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    expect(response.ok).toBe(false);
  } finally {
    probe.disconnect();
  }
});
