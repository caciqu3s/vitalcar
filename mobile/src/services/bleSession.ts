/**
 * Module-scope registry for the active BLE disconnect Subscription.
 *
 * Keeping it here (rather than in a React ref) ensures the subscription
 * survives ConnectModal unmount/remount and is accessible from anywhere
 * that needs to cancel it before a voluntary disconnect.
 */

import type { Subscription } from 'react-native-ble-plx';

let _sub: Subscription | null = null;

export function setDisconnectSubscription(sub: Subscription | null): void {
  _sub?.remove();  // prevent leak if handleConnect is retried
  _sub = sub;
}

export function removeDisconnectSubscription(): void {
  _sub?.remove();
  _sub = null;
}
