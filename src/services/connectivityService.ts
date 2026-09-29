import { onValue, ref, Unsubscribe } from 'firebase/database';
import { rtdb } from './firebase';

/**
 * Observa a conexão com o Firebase usando o nó especial `.info/connected`
 * do Realtime Database (não precisa de biblioteca extra).
 */
export function listenConnectionState(callback: (connected: boolean) => void): Unsubscribe {
  return onValue(ref(rtdb, '.info/connected'), (snapshot) => {
    callback(snapshot.val() === true);
  });
}
