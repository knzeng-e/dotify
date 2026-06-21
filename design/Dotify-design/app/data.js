/* Dotify seed data — original content. Album "covers" are generated gradients
   (the cover IS the light source for the aura), so no copyrighted artwork. */
(function () {
  // Each track carries an "aura": the two-stop gradient that paints its generated
  // cover AND the ambient light it casts into the room. accent = the single pull color.
  const tracks = [
    {
      id: 'harp-concrete',
      title: 'Harp & Concrete',
      artist: 'Thoth Art Studio',
      handle: 'thoth.dot',
      mode: 'classic', price: '0.42', duration: 214,
      aura: { a: '#ffc05c', b: '#ff5e3a', accent: '#ff9a4d', deg: 145 },
      tags: ['Gabon', 'Harp', 'Hip-Hop'],
      desc: 'Traditional Gabonese harp folded into modern hip-hop. Where the forest meets the street.',
      verified: true, nowListening: 128, year: 2025,
    },
    {
      id: 'notre-dame',
      title: 'Notre Dame de la Harpe',
      artist: 'Thoth Art Studio',
      handle: 'thoth.dot',
      mode: 'human-free', price: '0', duration: 247,
      aura: { a: '#c264ff', b: '#e6007a', accent: '#d36aff', deg: 160 },
      tags: ['Gabon', 'Ngombi', 'Ritual'],
      desc: 'Gabonese traditional harp by Lord Ékomy. Free to every verified human — no payment, no profile.',
      verified: true, nowListening: 64, year: 2025,
    },
    {
      id: 'kora-sunrise',
      title: 'Kora Sunrise',
      artist: 'Mansa Collective',
      handle: 'mansa.dot',
      mode: 'classic', price: '0.30', duration: 198,
      aura: { a: '#ff9e57', b: '#ffd166', accent: '#ff9e6b', deg: 130 },
      tags: ['Mali', 'Kora', 'Sunrise'],
      desc: 'Twenty-one strings catching the first light over Bamako.',
      verified: true, nowListening: 211, year: 2024,
    },
    {
      id: 'blue-highlife',
      title: 'Blue Highlife',
      artist: 'Awa & the Tide',
      handle: 'awatide.dot',
      mode: 'classic', price: '0.25', duration: 233,
      aura: { a: '#2bd3e8', b: '#1f8a8f', accent: '#2bd3e8', deg: 150 },
      tags: ['Ghana', 'Highlife', 'Guitar'],
      desc: 'Coastal highlife guitar, salt air and a tide that never quite leaves.',
      verified: true, nowListening: 87, year: 2025,
    },
    {
      id: 'saudade',
      title: 'Saudade Lo-Fi',
      artist: 'Ilha',
      handle: 'ilha.dot',
      mode: 'human-free', price: '0', duration: 176,
      aura: { a: '#6a7bff', b: '#9b6aff', accent: '#7d8bff', deg: 165 },
      tags: ['Cabo Verde', 'Lo-Fi', 'Morna'],
      desc: 'Morna melted into lo-fi. The ache of being far from a place you love.',
      verified: false, nowListening: 42, year: 2025,
    },
    {
      id: 'saharan',
      title: 'Saharan Telegraph',
      artist: 'Saharan Echo',
      handle: 'echo.dot',
      mode: 'classic', price: '0.50', duration: 265,
      aura: { a: '#ff7a4d', b: '#c8341f', accent: '#ff7a5c', deg: 140 },
      tags: ['Desert', 'Blues', 'Guitar'],
      desc: 'Hypnotic desert blues sent across the dunes like a message in the heat.',
      verified: true, nowListening: 156, year: 2024,
    },
    {
      id: 'midnight-mbira',
      title: 'Midnight Mbira',
      artist: 'Kesi',
      handle: 'kesi.dot',
      mode: 'human-free', price: '0', duration: 209,
      aura: { a: '#29e87a', b: '#1f9e8f', accent: '#29e87a', deg: 155 },
      tags: ['Zimbabwe', 'Mbira', 'Trance'],
      desc: 'Thumb-piano patterns that loop until the night turns transparent.',
      verified: true, nowListening: 73, year: 2025,
    },
    {
      id: 'velvet',
      title: 'Velvet Frequencies',
      artist: 'Velvet',
      handle: 'velvet.dot',
      mode: 'classic', price: '0.35', duration: 188,
      aura: { a: '#ff6a9a', b: '#ff9ec4', accent: '#ff6a9a', deg: 135 },
      tags: ['Soul', 'Neo', 'R&B'],
      desc: 'Slow soul with a pink-lit pulse. For the last hour before sleep.',
      verified: true, nowListening: 99, year: 2025,
    },
  ];

  // People for presence clusters. hue → placeholder portrait gradient.
  const people = [
    { id: 'p1', name: 'Amara', hue: 18,  initials: 'AM' },
    { id: 'p2', name: 'Tobias', hue: 205, initials: 'TO' },
    { id: 'p3', name: 'Lena', hue: 320, initials: 'LE' },
    { id: 'p4', name: 'Kwame', hue: 145, initials: 'KW' },
    { id: 'p5', name: 'Sofia', hue: 270, initials: 'SO' },
    { id: 'p6', name: 'Noor', hue: 35,  initials: 'NO' },
    { id: 'p7', name: 'Diego', hue: 190, initials: 'DI' },
    { id: 'p8', name: 'Mei', hue: 350, initials: 'ME' },
    { id: 'p9', name: 'Yara', hue: 90,  initials: 'YA' },
    { id: 'p10', name: 'Idris', hue: 250, initials: 'ID' },
    { id: 'p11', name: 'Faye', hue: 300, initials: 'FA' },
    { id: 'p12', name: 'Ravi', hue: 160, initials: 'RA' },
  ];

  const byId = (id) => tracks.find((t) => t.id === id);

  // Live rooms happening "now".
  const rooms = [
    {
      code: 'GABON1', host: people[0], track: byId('harp-concrete'),
      listenerIds: ['p2', 'p3', 'p4', 'p6', 'p9'], started: '12 min', mood: 'Late night',
    },
    {
      code: 'KORA22', host: people[3], track: byId('kora-sunrise'),
      listenerIds: ['p5', 'p7', 'p8', 'p10', 'p11', 'p12', 'p1'], started: '4 min', mood: 'Morning',
    },
    {
      code: 'TIDE07', host: people[6], track: byId('blue-highlife'),
      listenerIds: ['p8', 'p2'], started: '28 min', mood: 'Focus',
    },
    {
      code: 'DUNES9', host: people[5], track: byId('saharan'),
      listenerIds: ['p1', 'p4', 'p9', 'p11'], started: '7 min', mood: 'Drive',
    },
  ];

  // The signed-in artist (you, in the studio) + recent direct payments.
  const artistSelf = {
    name: 'Thoth Art Studio', handle: 'thoth.dot', verified: true,
    runtime: '0x74ba…cae3c', joined: 'May 2025',
    trackIds: ['harp-concrete', 'notre-dame'],
  };
  const royalties = [
    { id: 'r1', who: people[1], track: byId('harp-concrete'), amount: '0.42', when: '2h ago' },
    { id: 'r2', who: people[4], track: byId('harp-concrete'), amount: '0.42', when: '5h ago' },
    { id: 'r3', who: people[7], track: byId('harp-concrete'), amount: '0.42', when: 'Yesterday' },
    { id: 'r4', who: people[2], track: byId('harp-concrete'), amount: '0.42', when: 'Yesterday' },
    { id: 'r5', who: people[9], track: byId('harp-concrete'), amount: '0.42', when: '2 days ago' },
  ];

  const bios = {
    'Thoth Art Studio': 'Gabonese harp folded into modern production. We make the ngombi speak to the street — old strings, new rooms.',
    'Mansa Collective': 'A Bamako kora circle turning sunrise into sound. Twenty-one strings, one long morning.',
    'Awa & the Tide': 'Coastal highlife from Accra — guitar lines that smell of salt and move like water.',
    'Ilha': 'Morna melted into lo-fi from Cabo Verde. Songs for missing a place you can still taste.',
    'Saharan Echo': 'Desert blues sent across the dunes. Hypnotic, patient, built for the long drive.',
    'Kesi': 'Mbira trance from Harare. Thumb-piano loops that keep going until the night turns clear.',
    'Velvet': 'Slow neo-soul with a pink-lit pulse. For the last hour before sleep.',
  };
  function getArtist(name) {
    const list = tracks.filter(t => t.artist === name);
    const first = list[0] || tracks[0];
    return {
      name,
      handle: first.handle,
      verified: list.some(t => t.verified),
      aura: first.aura,
      bio: bios[name] || 'An artist publishing on Dotify, on their own terms.',
      tracks: list,
      nowListening: list.reduce((n, t) => n + t.nowListening, 0),
      followers: 1200 + list.length * 4300 + name.length * 137,
    };
  }

  window.DOTIFY_DATA = { tracks, people, rooms, byId, artistSelf, royalties, bios, getArtist };
})();
