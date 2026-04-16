'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

interface Facility {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type: string;
  district: string;
  emergencyPhone: string;
}

interface HighRiskMother {
  motherId: number;
  motherName: string;
  lat: number;
  lng: number;
  lastAncDate: string | null;
  riskFactors: string[];
  facilityName: string;
}

interface OpenAlert {
  alertId: number;
  type: string;
  status: string;
  lat: number;
  lng: number;
  motherId: number;
  initiatedAt: string;
}

interface MapContainerProps {
  showFacilities: boolean;
  showHighRiskMothers: boolean;
  showOpenAlerts: boolean;
}

export function MapContainer({
  showFacilities,
  showHighRiskMothers,
  showOpenAlerts,
}: MapContainerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const facilitiesLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const mothersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const alertsLayerRef = useRef<L.MarkerClusterGroup | null>(null);

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [mothers, setMothers] = useState<HighRiskMother[]>([]);
  const [alerts, setAlerts] = useState<OpenAlert[]>([]);

  // =========================================================================
  // INITIALIZE MAP
  // =========================================================================
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapDivRef.current).setView([1.3733, 32.2903], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Fix Leaflet's default marker icons for webpack
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    return () => {
      // Don't destroy on unmount - keep map instance
    };
  }, []);

  // =========================================================================
  // FETCH FACILITIES DATA
  // =========================================================================
  useEffect(() => {
    if (!showFacilities) {
      return;
    }

    const fetchFacilities = async () => {
      try {
        const response = await fetch('/api/facilities/geo');
        if (!response.ok) {
          throw new Error('Failed to fetch facilities');
        }
        const data = await response.json();
        if (data.success) {
          setFacilities(data.data);
        }
      } catch (error) {
        console.error('Error fetching facilities:', error);
      }
    };

    fetchFacilities();
  }, [showFacilities]);

  // =========================================================================
  // FETCH HIGH-RISK MOTHERS DATA
  // =========================================================================
  useEffect(() => {
    if (!showHighRiskMothers) {
      return;
    }

    const fetchMothers = async () => {
      try {
        const response = await fetch('/api/mothers/high-risk/geo');
        if (!response.ok) {
          throw new Error('Failed to fetch high-risk mothers');
        }
        const data = await response.json();
        if (data.success) {
          setMothers(data.data);
        }
      } catch (error) {
        console.error('Error fetching high-risk mothers:', error);
      }
    };

    fetchMothers();
  }, [showHighRiskMothers]);

  // =========================================================================
  // FETCH OPEN ALERTS DATA
  // =========================================================================
  useEffect(() => {
    if (!showOpenAlerts) {
      return;
    }

    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/alerts/open/geo');
        if (!response.ok) {
          throw new Error('Failed to fetch open alerts');
        }
        const data = await response.json();
        if (data.success) {
          setAlerts(data.data);
        }
      } catch (error) {
        console.error('Error fetching open alerts:', error);
      }
    };

    fetchAlerts();
  }, [showOpenAlerts]);

  // =========================================================================
  // UPDATE FACILITIES LAYER
  // =========================================================================
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    // Remove old layer
    if (facilitiesLayerRef.current) {
      mapRef.current.removeLayer(facilitiesLayerRef.current);
      facilitiesLayerRef.current = null;
    }

    if (!showFacilities) {
      return;
    }

    // Create new cluster group
    const cluster = new (L as any).markerClusterGroup({
      maxClusterRadius: 80,
      disableClusteringAtZoom: 16,
    });

    // Add facility markers
    facilities.forEach((facility) => {
      const marker = L.marker([facility.lat, facility.lng], {
        icon: L.icon({
          iconUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      });

      const popupContent = `
        <div class="font-semibold text-sm">
          <p class="font-bold">${facility.name}</p>
          <p class="text-xs text-gray-600">District: ${facility.district}</p>
          <p class="text-xs text-gray-600">Type: ${facility.type}</p>
          <p class="text-xs text-gray-600">Emergency: ${facility.emergencyPhone}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      cluster.addLayer(marker);
    });

    mapRef.current.addLayer(cluster);
    facilitiesLayerRef.current = cluster;
  }, [showFacilities, facilities]);

  // =========================================================================
  // UPDATE HIGH-RISK MOTHERS LAYER
  // =========================================================================
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    // Remove old layer
    if (mothersLayerRef.current) {
      mapRef.current.removeLayer(mothersLayerRef.current);
      mothersLayerRef.current = null;
    }

    if (!showHighRiskMothers) {
      return;
    }

    // Create new cluster group
    const cluster = new (L as any).markerClusterGroup({
      maxClusterRadius: 80,
      disableClusteringAtZoom: 16,
    });

    // Add mother markers
    mothers.forEach((mother) => {
      const marker = L.circleMarker([mother.lat, mother.lng], {
        radius: 8,
        fillColor: '#ff9800',
        color: '#f57c00',
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0.7,
      });

      // Add white exclamation icon
      const icon = document.createElement('div');
      icon.innerHTML = '!';
      icon.style.position = 'absolute';
      icon.style.color = 'white';
      icon.style.fontSize = '12px';
      icon.style.fontWeight = 'bold';
      icon.style.textAlign = 'center';

      const lastAncDate = mother.lastAncDate
        ? new Date(mother.lastAncDate).toLocaleDateString()
        : 'N/A';

      const riskFactorsText = mother.riskFactors
        .map((rf) => `<li class="text-xs">${rf}</li>`)
        .join('');

      const popupContent = `
        <div class="font-semibold text-sm">
          <p class="font-bold">${mother.motherName}</p>
          <p class="text-xs text-gray-600">Last ANC: ${lastAncDate}</p>
          <p class="text-xs text-gray-600 font-semibold">Risk Factors:</p>
          <ul class="text-xs text-gray-600">${riskFactorsText || '<li>None</li>'}</ul>
          <a href="/clinical/doctor/mothers/${mother.motherId}" class="text-blue-600 text-xs hover:underline">
            View profile
          </a>
        </div>
      `;

      marker.bindPopup(popupContent);
      cluster.addLayer(marker);
    });

    mapRef.current.addLayer(cluster);
    mothersLayerRef.current = cluster;
  }, [showHighRiskMothers, mothers]);

  // =========================================================================
  // UPDATE OPEN ALERTS LAYER
  // =========================================================================
  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    // Remove old layer
    if (alertsLayerRef.current) {
      mapRef.current.removeLayer(alertsLayerRef.current);
      alertsLayerRef.current = null;
    }

    if (!showOpenAlerts) {
      return;
    }

    // Create new cluster group
    const cluster = new (L as any).markerClusterGroup({
      maxClusterRadius: 80,
      disableClusteringAtZoom: 16,
    });

    // Add alert markers
    alerts.forEach((alert) => {
      const marker = L.circleMarker([alert.lat, alert.lng], {
        radius: 8,
        fillColor: '#f44336',
        color: '#d32f2f',
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0.7,
        className: 'pulsing-alert-marker',
      });

      const initiatedDate = new Date(alert.initiatedAt).toLocaleDateString();

      const popupContent = `
        <div class="font-semibold text-sm">
          <p class="font-bold">${alert.type}</p>
          <p class="text-xs text-gray-600">Status: ${alert.status}</p>
          <p class="text-xs text-gray-600">Initiated: ${initiatedDate}</p>
          <a href="/clinical/doctor/alerts/${alert.alertId}" class="text-blue-600 text-xs hover:underline">
            Review alert
          </a>
        </div>
      `;

      marker.bindPopup(popupContent);
      cluster.addLayer(marker);
    });

    mapRef.current.addLayer(cluster);
    alertsLayerRef.current = cluster;
  }, [showOpenAlerts, alerts]);

  return <div ref={mapDivRef} className="w-full h-full" />;
}
