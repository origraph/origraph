export const partitionSets = <T>(a: Set<T>, b: Set<T>) => {
  const onlyA = new Set<T>();
  const onlyB = new Set<T>();
  const intersection = new Set<T>();
  const union = new Set<T>();
  a.forEach((aItem) => {
    if (b.has(aItem)) {
      intersection.add(aItem);
    } else {
      onlyA.add(aItem);
    }
    union.add(aItem);
  });
  b.forEach((bItem) => {
    if (!a.has(bItem)) {
      onlyB.add(bItem);
    }
    union.add(bItem);
  });
  return { onlyA, onlyB, intersection, union };
};
