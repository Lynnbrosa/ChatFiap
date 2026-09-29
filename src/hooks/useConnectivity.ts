import { useEffect, useMemo, useState } from 'react';
import { listenConnectionState } from '../services/connectivityService';

/** Tempo de tolerância na abertura do app antes de considerar que está offline. */
const STARTUP_GRACE_MS = 5000;

export function useConnectivity(): { isOnline: boolean; showOfflineBanner: boolean } {
  const [connected, setConnected] = useState<boolean>(false);
  const [graceOver, setGraceOver] = useState<boolean>(false);
  const [everConnected, setEverConnected] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = listenConnectionState((isConnected) => {
      setConnected(isConnected);
      if (isConnected) setEverConnected(true);
    });
    const timer = setTimeout(() => setGraceOver(true), STARTUP_GRACE_MS);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const showOfflineBanner = useMemo(
    () => !connected && (everConnected || graceOver),
    [connected, everConnected, graceOver]
  );

  return { isOnline: connected, showOfflineBanner };
}
