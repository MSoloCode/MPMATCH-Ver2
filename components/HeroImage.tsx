'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface HeroImageProps {
  src?: string;
}

const HeroImage: React.FC<HeroImageProps> = ({ src }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapContainer.current && !map.current) {
      // Initialize map centered on Africa
      map.current = L.map(mapContainer.current).setView([0, 20], 3);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map.current);
    }

    return () => {
      // Cleanup on unmount - don't destroy map, just handle re-renders
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{
        width: '100%',
        height: '400px',
        borderRadius: '0.5rem',
        overflow: 'hidden',
      }}
      className="shadow-lg"
    />
  );
};

export default HeroImage;
