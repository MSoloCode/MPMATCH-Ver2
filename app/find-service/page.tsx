'use client';

import { useEffect, useState } from 'react';
import { TextInput, SelectDropdown } from '@/components/FormInputs';
import Button from '@/components/Button';

interface District {
  id: number;
  name: string;
}

interface ServiceProvider {
  id: number;
  name: string;
  services: string[];
  distance?: number;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
}

interface LocationMessage {
  type: 'success' | 'error';
  text: string;
}

export default function FindServicePage() {
  const [service, setService] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState<LocationMessage | null>(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ServiceProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch districts on mount
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const response = await fetch('/api/districts');
        const result = await response.json();
        if (result.success) {
          setDistricts(result.data);
        }
      } catch (err) {
        console.error('Error fetching districts:', err);
      } finally {
        setDistrictsLoading(false);
      }
    };

    fetchDistricts();
  }, []);

  // Handle get location button
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage({
        type: 'error',
        text: 'Geolocation is not supported by your browser',
      });
      return;
    }

    setGettingLocation(true);
    setLocationMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLat(latitude);
        setUserLng(longitude);
        setGettingLocation(false);
        setLocationMessage({
          type: 'success',
          text: `Location found: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        });
      },
      (error) => {
        setGettingLocation(false);
        setLocationMessage({
          type: 'error',
          text: 'Unable to get location. You can search without distance filtering.',
        });
        console.error('Geolocation error:', error);
      }
    );
  };

  // Handle search
  const handleSearch = async () => {
    if (!service.trim()) {
      setError('Please enter a service name');
      return;
    }

    setSearching(true);
    setError(null);
    setResults(null);
    setHasSearched(true);

    try {
      const queryParams = new URLSearchParams({
        service: service.trim(),
      });

      if (districtId) {
        queryParams.append('districtId', districtId);
      }

      if (userLat !== null && userLng !== null) {
        queryParams.append('lat', userLat.toString());
        queryParams.append('lng', userLng.toString());
      }

      const response = await fetch(`/api/services/search?${queryParams.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to search services');
        setResults([]);
        return;
      }

      setResults(data.data);
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred during search. Please try again.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Handle Enter key in service input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Build district options for dropdown
  const districtOptions = [
    { value: '', label: 'All Districts' },
    ...districts.map((d) => ({ value: d.id.toString(), label: d.name })),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-primary to-indigo-600 text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Help me find a service</h1>
          <p className="text-lg md:text-xl text-indigo-100">
            Locate the nearest provider for ultrasound, imaging, lab tests, and more.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">Search for Services</h2>

          <div className="space-y-6">
            {/* Service Input */}
            <TextInput
              label="Service"
              placeholder="e.g. Ultrasound, lab test, imaging..."
              value={service}
              onChange={(e) => setService(e.target.value)}
              onKeyPress={handleKeyPress}
              required
            />

            {/* District Dropdown */}
            <SelectDropdown
              label="District (optional)"
              options={districtOptions}
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              disabled={districtsLoading}
            />

            {/* Location Message */}
            {locationMessage && (
              <div
                className={`p-4 rounded-lg text-sm font-medium ${
                  locationMessage.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {locationMessage.text}
              </div>
            )}

            {/* Error Message */}
            {error && !hasSearched && (
              <div className="p-4 rounded-lg text-sm font-medium bg-red-50 text-red-800 border border-red-200">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleGetLocation}
                disabled={gettingLocation}
                variant="outline"
                className="flex-1"
              >
                {gettingLocation ? 'Getting location...' : 'Use my location (GPS)'}
              </Button>
              <Button onClick={handleSearch} disabled={searching} className="flex-1">
                {searching ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">Results</h2>

          {/* Before Search */}
          {!hasSearched && (
            <p className="text-neutral-600 text-center py-12">
              Search results will appear here
            </p>
          )}

          {/* Loading State */}
          {searching && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
              <p className="text-neutral-600 font-medium">Loading results...</p>
            </div>
          )}

          {/* Results Grid */}
          {hasSearched && !searching && results && results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((provider) => (
                <div
                  key={provider.id}
                  className="border border-neutral-200 rounded-lg p-6 hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  {/* Provider Name */}
                  <h3 className="text-lg font-bold text-neutral-900 mb-2">{provider.name}</h3>

                  {/* Services */}
                  <p className="text-sm text-neutral-600 mb-3">
                    {provider.services.length > 0
                      ? provider.services.join(', ')
                      : 'No services listed'}
                  </p>

                  {/* Distance */}
                  {provider.distance !== undefined && (
                    <p className="text-sm font-semibold text-primary mb-3">
                      {provider.distance} km away
                    </p>
                  )}

                  {/* Address */}
                  <p className="text-sm text-neutral-700 mb-3">
                    <span className="font-medium">Address:</span> {provider.address}
                  </p>

                  {/* Phone */}
                  <p className="text-sm mb-4">
                    <a
                      href={`tel:${provider.phone}`}
                      className="text-primary font-semibold hover:underline"
                    >
                      {provider.phone}
                    </a>
                  </p>

                  {/* Get Directions Link */}
                  {provider.lat && provider.lng && (
                    <a
                      href={`https://maps.google.com?q=${provider.lat},${provider.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sm text-accent font-semibold bg-primary px-4 py-2 rounded hover:opacity-90 transition-opacity"
                    >
                      Get directions
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {hasSearched && !searching && results && results.length === 0 && (
            <p className="text-neutral-600 text-center py-12">
              No providers found. Try different search terms.
            </p>
          )}

          {/* Error State */}
          {hasSearched && !searching && error && (
            <div className="p-6 rounded-lg bg-red-50 border border-red-200 text-red-800">
              <p className="font-medium">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
