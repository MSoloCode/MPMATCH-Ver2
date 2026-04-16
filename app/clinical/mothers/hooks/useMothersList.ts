'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface Mother {
  id: number;
  fullName: string;
  phone: string;
  dob: string | null;
  village: string | null;
  districtId: number;
  facilityId: number | null;
  consentAccepted: boolean;
  consentDate: string | null;
  registeredById: number;
  createdAt: string;
  deletedAt: string | null;
  district?: {
    id: number;
    name: string;
  };
  facility?: {
    id: number;
    name: string;
  };
  registeredBy?: {
    id: number;
    username: string;
    name: string;
  };
  chw?: {
    id: number;
    username: string;
    name: string;
  } | null;
  _count?: {
    pregnancies: number;
    alerts: number;
  };
}

export interface MothersListResponse {
  success: boolean;
  data: Mother[];
  pagination: {
    total: number;
    returned: number;
    skip: number;
    take: number;
  };
}

export interface UseMotthersListOptions {
  consentFilter?: boolean | null;
  districtFilter?: number | null;
  facilityFilter?: number | null;
  searchQuery?: string;
}

export function useMothersList(options?: UseMotthersListOptions) {
  const { token } = useAuth();
  const [mothers, setMothers] = useState<Mother[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const rowsPerPage = 20;

  const fetchMothers = useCallback(
    async (page: number, filterOptions?: UseMotthersListOptions) => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        const skip = (page - 1) * rowsPerPage;
        params.append('skip', skip.toString());
        params.append('take', rowsPerPage.toString());

        // Add search filter
        if (filterOptions?.searchQuery && filterOptions.searchQuery.trim()) {
          params.append('search', filterOptions.searchQuery.trim());
        }

        // Add consent filter if specified
        if (filterOptions?.consentFilter !== null && filterOptions?.consentFilter !== undefined) {
          params.append('consentAccepted', filterOptions.consentFilter.toString());
        }

        const url = `/api/mothers/list?${params.toString()}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch mothers: ${response.statusText}`);
        }

        const data: MothersListResponse = await response.json();

        if (data.success) {
          setMothers(data.data);
          setTotalCount(data.pagination.total);
        } else {
          setError('Failed to load mothers list');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        setMothers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  // Fetch on component mount and when dependencies change
  useEffect(() => {
    if (token) {
      fetchMothers(1, options);
      setCurrentPage(1);
    }
  }, [token, options, fetchMothers]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
        fetchMothers(page, options);
      }
    },
    [fetchMothers, options, totalCount]
  );

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, goToPage, totalCount]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  return {
    mothers,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    rowsPerPage,
    goToPage,
    nextPage,
    previousPage,
    refetch: () => fetchMothers(currentPage, options),
  };
}
