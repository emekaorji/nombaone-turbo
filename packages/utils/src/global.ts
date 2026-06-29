/**
 * Async sleep helper for timing control in async flows.
 */
export async function wait(durationInSeconds = 2) {
  return new Promise((resolve) => setTimeout(resolve, durationInSeconds * 1000));
}

/**
 * Delays and then returns the provided response payload.
 */
export async function mockCall<T>(durationInSeconds = 2, response: T): Promise<T> {
  await wait(durationInSeconds);
  return response;
}

/**
 * Splits an array into fixed-size chunks.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Returns the ISO string representation of the date that is a specified number of days ago from today.
 *
 * @param {string} daysAgo - The number of days to count back from today. This should be a string that can be parsed into an integer.
 * @returns {string} The ISO string representation of the date that is the specified number of days ago.
 */
export const getISOStringSinceDaysAgo = (daysAgo: string): string => {
  const date = new Date();
  date.setDate(date.getDate() - parseInt(daysAgo));
  return date.toISOString();
};
