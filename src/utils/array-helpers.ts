/**
 * ThreadTS Universal - Array Helper Utilities
 *
 * Gemeinsame Array-Operationen, die an mehreren Stellen in der Bibliothek
 * wiederverwendet werden. Folgt dem DRY-Prinzip (Don't Repeat Yourself).
 *
 * @module utils/array-helpers
 * @author ThreadTS Universal Team
 */

/**
 * Fisher-Yates (Knuth) Shuffle Algorithmus.
 *
 * Mischt ein Array in-place mit gleichmäßiger Zufallsverteilung.
 * Zeit-Komplexität: O(n), Speicher-Komplexität: O(1)
 *
 * @template T - Der Typ der Array-Elemente
 * @param array - Das zu mischende Array (wird modifiziert)
 * @returns Das gleiche Array, gemischt
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * fisherYatesShuffle(arr);
 * console.log(arr); // z.B. [3, 1, 5, 2, 4]
 * ```
 */
export function fisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Erstellt eine gemischte Kopie eines Arrays.
 *
 * Im Gegensatz zu {@link fisherYatesShuffle} modifiziert diese Funktion
 * das Original-Array nicht.
 *
 * @template T - Der Typ der Array-Elemente
 * @param array - Das zu mischende Array (wird nicht modifiziert)
 * @returns Ein neues, gemischtes Array
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * const shuffled = shuffleCopy(arr);
 * console.log(arr);      // [1, 2, 3, 4, 5] - unverändert
 * console.log(shuffled); // z.B. [3, 1, 5, 2, 4]
 * ```
 */
export function shuffleCopy<T>(array: T[]): T[] {
  return fisherYatesShuffle([...array]);
}

/**
 * Nimmt eine zufällige Stichprobe von n Elementen aus einem Array.
 *
 * Verwendet Fisher-Yates Shuffle für effiziente Zufallsauswahl.
 * Gibt höchstens array.length Elemente zurück.
 *
 * @template T - Der Typ der Array-Elemente
 * @param array - Das Array, aus dem Stichproben genommen werden
 * @param count - Anzahl der zu entnehmenden Elemente
 * @returns Array mit zufällig ausgewählten Elementen
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * const sample = randomSample(arr, 3);
 * console.log(sample); // z.B. [7, 2, 9]
 * ```
 */
export function randomSample<T>(array: T[], count: number): T[] {
  const sampleSize = Math.min(Math.max(0, count), array.length);
  if (sampleSize === 0) {
    return [];
  }
  return shuffleCopy(array).slice(0, sampleSize);
}

/**
 * Teilt ein Array in Chunks (Teilarrays) der angegebenen Größe.
 *
 * @template T - Der Typ der Array-Elemente
 * @param array - Das zu teilende Array
 * @param size - Größe jedes Chunks (muss > 0 sein)
 * @returns Array von Chunks
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * const chunks = chunkArray(arr, 2);
 * console.log(chunks); // [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    return [];
  }
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Erstellt gleitende Fenster über ein Array.
 *
 * @template T - Der Typ der Array-Elemente
 * @param array - Das Array, über das Fenster erstellt werden
 * @param size - Größe jedes Fensters
 * @param step - Schrittweite zwischen Fenstern (Standard: 1)
 * @returns Array von Fenstern
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * const windows = slidingWindow(arr, 3);
 * console.log(windows); // [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
 *
 * const steppedWindows = slidingWindow(arr, 2, 2);
 * console.log(steppedWindows); // [[1, 2], [3, 4]]
 * ```
 */
export function slidingWindow<T>(array: T[], size: number, step = 1): T[][] {
  if (size <= 0 || step <= 0 || array.length < size) {
    return size <= 0 || step <= 0 ? [] : [];
  }
  const result: T[][] = [];
  for (let i = 0; i <= array.length - size; i += step) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Interleaved (verschränkt) zwei Arrays.
 *
 * @template T - Der Typ der Array-Elemente
 * @param array1 - Erstes Array
 * @param array2 - Zweites Array
 * @returns Verschränktes Array
 *
 * @example
 * ```typescript
 * const a = [1, 3, 5];
 * const b = [2, 4, 6];
 * console.log(interleaveArrays(a, b)); // [1, 2, 3, 4, 5, 6]
 * ```
 */
export function interleaveArrays<T>(array1: T[], array2: T[]): T[] {
  const result: T[] = [];
  const maxLen = Math.max(array1.length, array2.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < array1.length) result.push(array1[i]);
    if (i < array2.length) result.push(array2[i]);
  }
  return result;
}

/**
 * Rotiert ein Array um n Positionen.
 *
 * Positive n rotiert nach rechts (Ende -> Anfang),
 * negative n rotiert nach links (Anfang -> Ende).
 *
 * @template T - Der Typ der Array-Elemente
 * @param array - Das zu rotierende Array
 * @param positions - Anzahl der Positionen (positiv = rechts, negativ = links)
 * @returns Neues rotiertes Array
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * console.log(rotateArray(arr, 2));  // [4, 5, 1, 2, 3]
 * console.log(rotateArray(arr, -2)); // [3, 4, 5, 1, 2]
 * ```
 */
export function rotateArray<T>(array: T[], positions: number): T[] {
  if (array.length === 0 || positions === 0) {
    return [...array];
  }
  const n = ((positions % array.length) + array.length) % array.length;
  return [...array.slice(-n), ...array.slice(0, -n)];
}

/**
 * Findet eindeutige Elemente basierend auf einer Schlüsselfunktion.
 *
 * @template T - Der Typ der Array-Elemente
 * @template K - Der Typ des Schlüssels
 * @param array - Das zu durchsuchende Array
 * @param keyFn - Funktion zur Extraktion des Vergleichsschlüssels
 * @returns Array mit eindeutigen Elementen (erstes Vorkommen wird behalten)
 *
 * @example
 * ```typescript
 * const users = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' },
 *   { id: 1, name: 'Alice Clone' }
 * ];
 * const unique = uniqueBy(users, u => u.id);
 * // [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
 * ```
 */
export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Findet eindeutige Elemente mit JSON-Stringifizierung als Schlüssel.
 *
 * @template T - Der Typ der Array-Elemente
 * @param array - Das zu durchsuchende Array
 * @param keyFn - Optionale Funktion zur Extraktion des zu stringifizierenden Werts
 * @returns Array mit eindeutigen Elementen
 */
export function uniqueByJson<T>(array: T[], keyFn?: (item: T) => unknown): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of array) {
    const key = JSON.stringify(keyFn ? keyFn(item) : item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
