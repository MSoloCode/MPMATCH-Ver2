'use client';

import { useState, useCallback, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface District {
  id: number;
  name: string;
}

interface Facility {
  id: number;
  name: string;
  districtId: number;
}

interface MothersFiltersProps {
  onSearchChange: (search: string) => void;
  onDistrictChange: (districtId: number | null) => void;
  onFacilityChange: (facilityId: number | null) => void;
  onClearFilters: () => void;
  isLoading?: boolean;
}

export function MothersFilters({
  onSearchChange,
  onDistrictChange,
  onFacilityChange,
  onClearFilters,
  isLoading = false,
}: MothersFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<number | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearchChange]);

  // Fetch districts on mount
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        setDistrictsLoading(true);
        const response = await fetch('/api/districts');
        const data = await response.json();
        if (data.success) {
          setDistricts(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch districts:', error);
      } finally {
        setDistrictsLoading(false);
      }
    };

    fetchDistricts();
  }, []);

  // Fetch facilities when district changes
  useEffect(() => {
    const fetchFacilities = async () => {
      if (!selectedDistrict) {
        setFacilities([]);
        setSelectedFacility(null);
        onFacilityChange(null);
        return;
      }

      try {
        setFacilitiesLoading(true);
        const response = await fetch(`/api/facilities?districtId=${selectedDistrict}`);
        const data = await response.json();
        if (data.success) {
          setFacilities(data.data || []);
          setSelectedFacility(null);
          onFacilityChange(null);
        }
      } catch (error) {
        console.error('Failed to fetch facilities:', error);
      } finally {
        setFacilitiesLoading(false);
      }
    };

    fetchFacilities();
  }, [selectedDistrict, onFacilityChange]);

  const handleDistrictChange = (districtId: number | null) => {
    setSelectedDistrict(districtId);
    onDistrictChange(districtId);
  };

  const handleFacilityChange = (facilityId: number | null) => {
    setSelectedFacility(facilityId);
    onFacilityChange(facilityId);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDistrict(null);
    setSelectedFacility(null);
    setFacilities([]);
    onClearFilters();
  };

  const hasActiveFilters = searchQuery.trim() !== '' || selectedDistrict !== null || selectedFacility !== null;

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by name or phone"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={isLoading}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:bg-gray-100 flex items-center gap-2 text-sm font-medium"
        >
          Filters
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Collapsible Filter Panel */}
      {isExpanded && (
        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* District Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
              <select
                value={selectedDistrict || ''}
                onChange={(e) => handleDistrictChange(e.target.value ? Number(e.target.value) : null)}
                disabled={districtsLoading || isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">All Districts</option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Facility Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility</label>
              <select
                value={selectedFacility || ''}
                onChange={(e) => handleFacilityChange(e.target.value ? Number(e.target.value) : null)}
                disabled={!selectedDistrict || facilitiesLoading || isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">All Facilities</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              disabled={isLoading}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
