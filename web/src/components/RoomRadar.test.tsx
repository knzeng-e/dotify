import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { RoomRadar } from './RoomRadar';
import { DotifyMark } from './DotifyMark';
import type { DiscoveredRoom, useRoomDiscovery } from '../features/rooms/useRoomDiscovery';
import type { NearbyState } from '../features/rooms/nearbySession';

const room = {
  roomId: 'ABC234',
  discoveryId: '00000000-0000-4000-8000-000000000001',
  expiresInMs: 90_000,
  hostName: 'Awa',
  title: 'Same song',
  artist: 'Artist',
  presence: '4–9',
  listenerCount: 4,
  imageRef: null,
  isFull: false,
  distanceBand: null,
  scope: 'worldwide',
  owner: {}
} as DiscoveredRoom;

function discovery(phase: NearbyState['phase'], rooms: DiscoveredRoom[] = [room], worldwidePhase: NearbyState['phase'] = 'off') {
  return {
    nearby: { session: {}, state: { phase, results: rooms } },
    worldwide: { session: {}, state: { phase: worldwidePhase, results: [] } },
    rooms,
    radius: 5,
    paused: false,
    locationDenied: phase === 'denied',
    rangePending: false,
    retry: vi.fn()
  } as unknown as ReturnType<typeof useRoomDiscovery>;
}

it('restores exact presence and one point per connected person, including the host', () => {
  const html = renderToStaticMarkup(<RoomRadar discovery={discovery('active')} onJoin={vi.fn()} joining={false} ownRoomId={room.roomId} />);
  expect(html).toContain('5 listening');
  expect(html).not.toContain('4–9');
  expect(html.match(/<i style=/g)).toHaveLength(5);
  expect(html).toContain('data-own="true"');
  expect(html).toContain('Your room');
  expect(html).toContain('radar-room-core');
  expect(html).toContain('cover-image');
  expect(html).not.toContain('Options for Same song');
});

it('keeps the sweep alive between fast responses and uses the real shared brand mark', () => {
  const html = renderToStaticMarkup(<RoomRadar discovery={discovery('empty', [])} onJoin={vi.fn()} joining={false} />);
  expect(html).toContain('data-scanning="false" data-live="true"');
  expect(html).toContain(renderToStaticMarkup(<DotifyMark />));
});

it('stops the sweep with no active discovery but keeps worldwide live through a location refusal', () => {
  const render = (phase: NearbyState['phase'], world: NearbyState['phase']) =>
    renderToStaticMarkup(<RoomRadar discovery={discovery(phase, [], world)} onJoin={vi.fn()} joining={false} />);
  expect(render('disconnected', 'disconnected')).toContain('data-live="false"');
  expect(render('denied', 'active')).toContain('data-live="true"');
});

it('does not invent exact people or orbit points from a legacy presence band', () => {
  const legacy = { ...room, listenerCount: undefined, distanceBand: undefined };
  const html = renderToStaticMarkup(<RoomRadar discovery={discovery('active', [legacy])} onJoin={vi.fn()} joining={false} />);
  expect(html).toContain('4-9 here');
  expect(html).not.toContain('<i style=');
  expect(html).not.toContain('Your room');
  expect(html).toContain('class="discovery-distance">Worldwide');
});

it('keeps my own room on the radar when other invitations fill every slot', () => {
  const otherRooms = Array.from({ length: 8 }, (_, index) => ({ ...room, roomId: `OTHER${index}`, discoveryId: `other-${index}` }));
  const html = renderToStaticMarkup(
    <RoomRadar discovery={discovery('active', [...otherRooms, room])} onJoin={vi.fn()} joining={false} ownRoomId={room.roomId} />
  );
  expect(html.match(/class="radar-room-dot"/g)).toHaveLength(8);
  expect(html).toContain('Inspect your room: Same song');
});

it('bounds decoration for unusually large operator capacities without rounding the displayed total', () => {
  const html = renderToStaticMarkup(<RoomRadar discovery={discovery('active', [{ ...room, listenerCount: 500 }])} onJoin={vi.fn()} joining={false} />);
  expect(html).toContain('501 listening');
  expect(html.match(/<i style=/g)).toHaveLength(128);
});

it('shows a verified artist seal without hovering and a stable room name alongside the current track', () => {
  const named = { ...room, roomName: 'Escale à Libreville', introduction: 'Découvertes et discussion', artistPresent: true };
  const html = renderToStaticMarkup(<RoomRadar discovery={discovery('active', [named])} onJoin={vi.fn()} joining={false} />);
  expect(html).toContain('room-artist-seal');
  expect(html).toContain('Artist here');
  expect(html).toContain('Escale à Libreville');
  expect(html).toContain('Same song');
  expect(html).toContain('Découvertes et discussion');
  const discreet = renderToStaticMarkup(<RoomRadar discovery={discovery('active')} onJoin={vi.fn()} joining={false} />);
  expect(discreet).not.toContain('room-artist-seal');
});
