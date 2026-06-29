import { registerRail } from './registry';
import { mockPullRail, mockPushRail } from './mock';

export * from './types';
export * from './registry';
export * from './mock';

/** Register the mock rails at import. Delete with the example slice; register
 * your real adapters here (or wherever you boot the API). */
registerRail(mockPullRail);
registerRail(mockPushRail);
