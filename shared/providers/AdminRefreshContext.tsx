/**
 * Admin Module — Shared Contexts
 *
 * Contexts for admin functionality that can be used by admin tools
 * without creating circular dependencies.
 */

import { createContext, useContext } from 'react';

/**
 * Context for coordinating refreshes across admin tools.
 * Tools can subscribe to this to refresh when requested.
 */
export type RefreshContextValue = {
  refreshTrigger: number;
  requestRefresh: () => void;
};

export const RefreshContext = createContext<RefreshContextValue>({
  refreshTrigger: 0,
  requestRefresh: () => {},
});

/**
 * Hook for admin tools to subscribe to dashboard refresh events.
 * Returns the current refresh trigger number - when this changes, tools should reload their data.
 */
export const useAdminRefresh = () => useContext(RefreshContext);
