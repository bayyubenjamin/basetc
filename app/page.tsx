"use client";

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import Navigation, { TabName } from './components/Navigation';
import Monitoring from './components/Monitoring';
import Rakit from './components/Rakit';
import Market from './components/Market';
import Profil from './components/Profil';

/**
 * The main entrypoint for the BaseTC Mini App. This component handles
 * navigation between different sections (Monitoring, Rakit, Market, Profil)
 * and signals readiness to the Farcaster Mini App SDK on mount. It also
 * ensures that content is padded to avoid overlapping with the bottom
 * navigation bar on small screens.
 */
export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>('monitoring');

  useEffect(() => {
    // Notify Farcaster that the frame is ready
    sdk.actions.ready();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 pb-16">{/* leave space for nav */}
        {activeTab === 'monitoring' && <Monitoring />}
        {activeTab === 'rakit' && <Rakit />}
        {activeTab === 'market' && <Market />}
        {activeTab === 'profil' && <Profil />}
      </div>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}