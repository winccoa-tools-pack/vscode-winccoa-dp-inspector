import { useEffect, useRef } from 'react';
import { useWs } from '../context/WsContext';

/**
 * Subscribe to a set of datapoints via the WebSocket.
 *
 * Automatically subscribes when the connection is established and the DP list
 * is non-empty. Unsubscribes when the group is removed or the component unmounts.
 *
 * @param subscriptionId  Stable ID for this subscription (usually the group ID)
 * @param dps             Array of DP element names to subscribe to
 */
export function useWsSubscription(subscriptionId: string, dps: string[]): void {
  const { status, subscribe, unsubscribe } = useWs();
  const prevDpsRef = useRef<string[]>([]);

  useEffect(() => {
    if (status !== 'connected' || dps.length === 0) return;

    const prev = prevDpsRef.current;
    const sameAsBefore =
      prev.length === dps.length && dps.every((dp, i) => dp === prev[i]);

    if (!sameAsBefore) {
      // Re-subscribe with the new DP list (server replaces the session)
      subscribe(subscriptionId, dps);
      prevDpsRef.current = dps;
    }

    return () => {
      unsubscribe(subscriptionId);
      prevDpsRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, subscriptionId, JSON.stringify(dps)]);
}
