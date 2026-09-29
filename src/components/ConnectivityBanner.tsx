import React from 'react';
import { useConnectivity } from '../hooks/useConnectivity';
import { NoticeBanner } from './NoticeBanner';

/** Mostra um aviso quando o app perde a conexão com o Firebase. */
export const ConnectivityBanner: React.FC = () => {
  const { showOfflineBanner } = useConnectivity();

  return (
    <NoticeBanner
      message={
        showOfflineBanner
          ? 'Sem conexão. As mensagens serão sincronizadas quando a internet voltar.'
          : null
      }
      tone="warning"
      icon="cloud-offline-outline"
    />
  );
};
