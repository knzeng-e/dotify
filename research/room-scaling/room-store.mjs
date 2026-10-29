import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { loopbackUrl } from './boundary.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
// Every mutation is one Redis transaction. This reduced protocol deliberately
// excludes chat history, discovery, tips, TURN and the production resume protocol.
const LUA = `
local room, lease, members = KEYS[1], KEYS[2], KEYS[3]
local op, node, socket, epoch, token, limit = ARGV[1], ARGV[2], ARGV[3], ARGV[4], ARGV[5], tonumber(ARGV[6])
local ttl, duration = tonumber(ARGV[7]), tonumber(ARGV[8])
if op == 'create' then
  if redis.call('EXISTS', room) == 1 then return {'CONFLICT'} end
  redis.call('HSET', room, 'owner', node, 'socket', socket, 'epoch', 1, 'token', token, 'seq', 0)
  redis.call('PEXPIRE', room, duration)
  redis.call('SET', lease, node, 'PX', ttl)
  return {'OK', '1'}
end
if redis.call('EXISTS', room) == 0 then return {'MISSING'} end
if op == 'resume' then
  if redis.call('HGET', room, 'token') ~= token then return {'DENIED'} end
  if redis.call('EXISTS', lease) == 1 then return {'BUSY'} end
  local nextEpoch = redis.call('HINCRBY', room, 'epoch', 1)
  redis.call('HSET', room, 'owner', node, 'socket', socket, 'token', ARGV[9])
  redis.call('SET', lease, node, 'PX', ttl)
  return {'OK', tostring(nextEpoch)}
end
if op == 'join' then
  if redis.call('EXISTS', lease) == 0 then return {'RECONNECTING'} end
  if redis.call('HLEN', members) >= limit then return {'FULL'} end
  redis.call('HSET', members, socket, node)
  redis.call('PEXPIRE', members, redis.call('PTTL', room))
  return {'OK', tostring(redis.call('HLEN', members))}
end
if op == 'leave' then
  redis.call('HDEL', members, socket)
  return {'OK'}
end
if redis.call('HGET', room, 'owner') ~= node or redis.call('HGET', room, 'socket') ~= socket
 or redis.call('HGET', room, 'epoch') ~= epoch or redis.call('GET', lease) ~= node then return {'FENCED'} end
if op == 'heartbeat' then redis.call('PEXPIRE', lease, ttl) return {'OK'} end
if op == 'drain' then
  redis.call('DEL', lease)
  redis.call('HSET', room, 'socket', '')
  return {'OK'}
end
if op == 'publish' then return {'OK', tostring(redis.call('HINCRBY', room, 'seq', 1))} end
return {'DENIED'}
`;
export function createStore({ redisUrl, prefix, nodeId, leaseMs = 1500, roomMs = 60000, maxListeners = 24 }) {
  loopbackUrl(redisUrl, ['redis:']);
  if (!/^w39-[a-z0-9-]+$/.test(prefix)) throw new Error('Research namespace required');
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 0, commandTimeout: 500, enableOfflineQueue: false, lazyConnect: true, retryStrategy: null });
  redis.on('error', () => {});
  return {
    redis,
    async connect() {
      await redis.connect();
    },
    async mutate(op, roomId, socketId, epoch = '', token = '', nextToken = '') {
      if (!/^[a-f0-9]{16}$/.test(roomId)) return ['DENIED'];
      return redis.eval(
        LUA,
        3,
        `${prefix}:${roomId}`,
        `${prefix}:${roomId}:lease`,
        `${prefix}:${roomId}:members`,
        op,
        nodeId,
        socketId,
        String(epoch),
        token ? hash(token) : '',
        String(maxListeners),
        String(leaseMs),
        String(roomMs),
        nextToken ? hash(nextToken) : ''
      );
    },
    close() {
      redis.disconnect();
    }
  };
}
