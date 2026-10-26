export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const created = create();
  map.set(key, created);
  return created;
}

export function sumOf<T>(values: Iterable<T>, pick: (value: T) => number): number {
  let total = 0;
  for (const value of values) total += pick(value);
  return total;
}

export function countWhere<T>(values: Iterable<T>, predicate: (value: T) => boolean): number {
  let total = 0;
  for (const value of values) if (predicate(value)) total += 1;
  return total;
}
