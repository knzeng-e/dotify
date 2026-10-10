import { randomBytes, randomUUID } from 'node:crypto';

// Ephemeral social state. No drafts, wallet addresses or durable listener log.
export function createRoomLife({ io, rooms, historyLimit = 50, graceMs = 8000, now = Date.now }) {
  const timers = new Set();
  function later(callback, delay) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timer.unref?.();
    timers.add(timer);
    return timer;
  }
  function cancel(timer) {
    clearTimeout(timer);
    timers.delete(timer);
  }
  function activity(roomId, kind, text, artist) {
    const room = rooms.get(roomId);
    if (!room) return;
    const event = { id: randomUUID(), kind, text, ts: now(), ...(artist ? { artist } : {}) };
    room.activity ??= [];
    room.activity.push(event);
    room.activity = room.activity.slice(-historyLimit);
    io.to(roomId).emit('room:activity', event);
  }
  function resumable(room, token) {
    if (typeof token !== 'string' || token.length !== 64) return null;
    const member = room.lifeMembers?.get(token);
    return member && !member.socketId && member.expiresAt > now() ? member : null;
  }
  function joined(roomId, socket, name, artist, resumeToken) {
    const room = rooms.get(roomId);
    room.lifeMembers ??= new Map();
    const resumed = resumable(room, resumeToken);
    if (resumed) cancel(resumed.timer);
    const token = resumed ? resumeToken : randomBytes(32).toString('hex');
    const member = resumed ?? { name, artist, announced: false };
    member.socketId = socket.id;
    member.name = name;
    member.expiresAt = Infinity;
    room.lifeMembers.set(token, member);
    socket.data.lifeToken = token;
    socket.data.artist = member.artist;
    if (!member.announced) {
      member.timer = later(() => {
        if (!member.socketId || rooms.get(roomId) !== room) return;
        member.announced = true;
        member.announcedArtist = member.artist;
        activity(
          roomId,
          member.artist ? 'artist-joined' : 'joined',
          member.artist ? `${member.artist.name} is here — the artist behind “${member.artist.title}”.` : `${member.name} joined.`,
          member.artist
        );
      }, 1200);
    }
    return token;
  }
  function leaving(socket, disconnected = false) {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    typing(socket, false);
    const token = socket.data.lifeToken;
    const member = room?.lifeMembers?.get(token);
    delete socket.data.lifeToken;
    delete socket.data.artist;
    if (!member) return;
    cancel(member.timer);
    member.socketId = null;
    member.expiresAt = now() + (disconnected ? graceMs : 0);
    const finish = () => {
      room.lifeMembers.delete(token);
      if (member.announced && rooms.get(roomId) === room)
        activity(roomId, member.announcedArtist ? 'artist-left' : 'left', `${member.announcedArtist?.name ?? member.name} left.`, member.announcedArtist);
    };
    if (disconnected) member.timer = later(finish, graceMs);
    else finish();
  }
  function typing(socket, active, name) {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    room.typing ??= new Map();
    const previous = room.typing.get(socket.id);
    if (previous) cancel(previous.timer);
    room.typing.delete(socket.id);
    if (active) room.typing.set(socket.id, { id: socket.id, name, expiresAt: now() + 4500, timer: later(() => typing(socket, false), 4500) });
    if (active || previous)
      io.to(roomId).emit(
        'room:typing',
        [...room.typing.values()].map(({ timer: _timer, ...entry }) => entry)
      );
  }
  function snapshot(room) {
    return { activity: room.activity ?? [], pinnedMessage: room.pinnedMessage ?? null };
  }
  function pin(roomId, message) {
    const room = rooms.get(roomId);
    if (!room) return;
    cancel(room.pinTimer);
    room.pinnedMessage = message;
    io.to(roomId).emit('room:pin', message);
    if (message)
      room.pinTimer = later(
        () => {
          if (rooms.get(roomId) === room) pin(roomId, null);
        },
        10 * 60 * 1000
      );
  }
  function closeRoom(room) {
    cancel(room.pinTimer);
    for (const member of room.lifeMembers?.values() ?? []) cancel(member.timer);
    for (const entry of room.typing?.values() ?? []) cancel(entry.timer);
  }
  return {
    activity,
    joined,
    leaving,
    resumable,
    typing,
    snapshot,
    pin,
    closeRoom,
    close() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    }
  };
}
