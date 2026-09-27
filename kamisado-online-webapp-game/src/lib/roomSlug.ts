const ADJECTIVES = ['swift', 'silent', 'golden', 'crimson', 'jade', 'shadow', 'lucky', 'iron', 'azure', 'ember'];
const ANIMALS = ['tiger', 'crane', 'koi', 'dragon', 'fox', 'heron', 'wolf', 'falcon', 'otter', 'lynx'];

export function generateRoomSlug(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adjective}-${animal}-${num}`;
}
