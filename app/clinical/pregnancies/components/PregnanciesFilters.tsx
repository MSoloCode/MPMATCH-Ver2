'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Mother {
  id: number;
  fullName: string;
  phone: string;
}

interface PregnanciesFiltersProps {
  onMotherChange: (motherId: number | null) => void;
  isLoading?: boolean;
}

export function PregnanciesFilters({ onMotherChange, isLoading = false }: PregnanciesFiltersProps) {
  const { token } = useAuth();
  const [mothers, setMothers] = useState<Mother[]>([]);
  const [selectedMotherId, setSelectedMotherId] = useState<number | null>(null);
  const [mothersLoading, setMothersLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch all mothers on mount
  useEffect(() => {
    const fetchMothers = async () => {
      try {
        setMothersLoading(true);
        const params = new URLSearchParams();
        params.append('skip', '0');
        params.append('take', '1000'); // Get up to 1000 mothers

        const response = await fetch(`/api/mothers?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setMothers(data.data || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch mothers:', error);
      } finally {
        setMothersLoading(false);
      }
    };

    if (token) {
      fetchMothers();
    }
  }, [token]);

  const handleMotherSelect = (motherId: number | null) => {
    setSelectedMotherId(motherId);
    onMotherChange(motherId);
    setIsOpen(false);
  };

  const selectedMotherName =
    selectedMotherId && mothers.length > 0
      ? mothers.find((m) => m.id === selectedMotherId)?.fullName
      : null;

  return (
    <div className="flex items-center gap-4">
      {/* Mother Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={mothersLoading || isLoading}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 flex items-center gap-2"
        >
          {selectedMotherName ? `Mother: ${selectedMotherName}` : 'All mothers'}
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
            <button
              onClick={() => handleMotherSelect(null)}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                selectedMotherId === null ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-900'
              }`}
            >
              All mothers
            </button>
            {mothers.map((mother) => (
              <button
                key={mother.id}
                onClick={() => handleMotherSelect(mother.id)}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                  selectedMotherId === mother.id
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-900'
                }`}
              >
                {mother.fullName} · {mother.phone}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
