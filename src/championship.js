export const CHAMPIONSHIP_RACES = 5;

export function rankRace(player, racers, playerTime) {
  const field = [
    { ...player, finishTime: playerTime, progress: 1 },
    ...racers.map((racer) => ({ ...racer })),
  ];
  field.sort((a, b) => {
    const aFinished = a.finishTime !== null && a.finishTime !== undefined;
    const bFinished = b.finishTime !== null && b.finishTime !== undefined;
    if (aFinished && bFinished) return a.finishTime - b.finishTime || a.id.localeCompare(b.id);
    if (aFinished !== bFinished) return aFinished ? -1 : 1;
    return (b.progress || 0) - (a.progress || 0) || a.id.localeCompare(b.id);
  });
  return field.map((racer, index) => ({
    id: racer.id,
    name: racer.name,
    characterId: racer.characterId,
    place: index + 1,
  }));
}

export function championshipStandings(rounds) {
  const table = new Map();
  rounds.forEach((round) => {
    const fieldSize = round.finishOrder.length;
    round.finishOrder.forEach((racer) => {
      const entry = table.get(racer.id) || { id: racer.id, name: racer.name, characterId: racer.characterId, points: 0, wins: 0, podiums: 0, races: 0 };
      entry.name = racer.name;
      entry.characterId = racer.characterId;
      entry.points += fieldSize - racer.place + 1;
      entry.wins += racer.place === 1 ? 1 : 0;
      entry.podiums += racer.place <= 3 ? 1 : 0;
      entry.races += 1;
      table.set(racer.id, entry);
    });
  });
  return [...table.values()].sort((a, b) =>
    b.points - a.points ||
    b.wins - a.wins ||
    b.podiums - a.podiums ||
    a.name.localeCompare(b.name)
  );
}
