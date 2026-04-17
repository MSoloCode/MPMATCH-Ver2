'use client';

export const dynamic = 'force-dynamic';

import dynamicImport from 'next/dynamic';
import { useState } from 'react';

const MapContainer = dynamicImport(() => import('@/components/Map/MapContainer'), { ssr: false });
const FilterPanel = dynamicImport(() => import('@/components/Map/FilterPanel'), { ssr: false });

export default function MapPage() {
  const [showFacilities, setShowFacilities] = useState(true);
  const [showHighRiskMothers, setShowHighRiskMothers] = useState(false);
  const [showOpenAlerts, setShowOpenAlerts] = useState(false);

  return (
    <div className="h-screen w-full flex flex-col relative">
      <div className="flex-1 relative">
        <MapContainer
          showFacilities={showFacilities}
          showHighRiskMothers={showHighRiskMothers}
          showOpenAlerts={showOpenAlerts}
        />
        <FilterPanel
          showFacilities={showFacilities}
          onFacilitiesToggle={setShowFacilities}
          showHighRiskMothers={showHighRiskMothers}
          onHighRiskMothersToggle={setShowHighRiskMothers}
          showOpenAlerts={showOpenAlerts}
          onOpenAlertsToggle={setShowOpenAlerts}
        />
      </div>
      <style jsx>{`
        @keyframes pulse-alert {
          0%, 100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
        }

        :global(.pulsing-alert-marker) {
          animation: pulse-alert 1.5s infinite;
        }

        :global(.pulsing-alert-dot) {
          animation: pulse-alert 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
