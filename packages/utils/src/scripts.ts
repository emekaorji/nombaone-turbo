/**
 * Runs a script with timing logs and process exit codes for CLI workflows.
 */
export async function runScript(
  runnableScript: (() => Promise<unknown>) | (() => unknown)
): Promise<void> {
  const startTime = Date.now();

  try {
    // eslint-disable-next-line no-console
    console.log('Running script...');

    await runnableScript();

    // eslint-disable-next-line no-console
    console.log(`Done in: ${(Date.now() - startTime) / 1000} seconds`);
    // eslint-disable-next-line no-console
    console.log('Exiting successfully.');
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('An error occurred:', error);
    // eslint-disable-next-line no-console
    console.log(`Ran for: ${(Date.now() - startTime) / 1000} seconds`);
    process.exit(1);
  }
}
