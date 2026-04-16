'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface Pregnancy {
  id: number;
  motherId: number;
  lmpDate: string | null;
  edd: string | null;
  gravida: number | null;
  parity: number | null;
  multiplePregnancy: string | null; // NONE | TWINS | TRIPLETS_PLUS
  riskFactors: Record<string, any> | null;
  isHighRisk: boolean;
  antenatalStatus: string | null; // YET_TO_START | ACTIVE | COMPLETED
  status: string; // ACTIVE | CLOSED | DELIVERED
  deliveryDate: string | null;
  deliveryOutcome: string | null;
  deliveryMode: string | null; // SVD | C_SECTION | ASSISTED
  babyWeightKg: number | null;
  complications: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  openedBy?: number | null;
  mother?: {
    id: number;
    fullName: string;
    phone: string;
    [key: string]: any;
  };
}

export interface PregnanciesListResponse {
  success: boolean;
  data: Pregnancy[];
  pagination: {
    total: number;
    returned: number;
    skip: number;
    take: number;
  };
}

export interface UsePregnanciesListOptions {
  motherId?: number | null;
  status?: string | null;
  isHighRisk?: boolean | null;
}

export function usePregnanciesList(options?: UsePregnanciesListOptions) {
  const { token } = useAuth();
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const rowsPerPage = 20;

  const fetchPregnancies = useCallback(
    async (page: number, filterOptions?: UsePregnanciesListOptions) => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        const skip = (page - 1) * rowsPerPage;
        params.append('skip', skip.toString());
        params.append('take', rowsPerPage.toString());

        // Add mother filter if specified
        if (filterOptions?.motherId !== null && filterOptions?.motherId !== undefined) {
          params.append('motherId', filterOptions.motherId.toString());
        }

        // Add status filter if specified
        if (filterOptions?.status !== null && filterOptions?.status !== undefined) {
          params.append('status', filterOptions.status);
        }

        // Add high risk filter if specified
        if (filterOptions?.isHighRisk !== null && filterOptions?.isHighRisk !== undefined) {
          params.append('isHighRisk', filterOptions.isHighRisk.toString());
        }

        const url = `/api/pregnancies?${params.toString()}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch pregnancies: ${response.statusText}`);
        }

        const data: PregnanciesListResponse = await response.json();

        if (data.success) {
          setPregnancies(data.data);
          setTotalCount(data.pagination.total);
        } else {
          setError('Failed to load pregnancies list');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        setPregnancies([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  // Fetch on mount and when filter options change
  useEffect(() => {
    fetchPregnancies(1, options);
  }, [options, fetchPregnancies]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= Math.ceil(totalCount / rowsPerPage)) {
        setCurrentPage(page);
        fetchPregnancies(page, options);
      }
    },
    [totalCount, options, fetchPregnancies],
  );

  const nextPage = useCallback(() => {
    const maxPage = Math.ceil(totalCount / rowsPerPage);
    if (currentPage < maxPage) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchPregnancies(newPage, options);
    }
  }, [currentPage, totalCount, options, fetchPregnancies]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchPregnancies(newPage, options);
    }
  }, [currentPage, options, fetchPregnancies]);

  const refetch = useCallback(() => {
    fetchPregnancies(currentPage, options);
  }, [currentPage, options, fetchPregnancies]);

  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;

  return {
    pregnancies,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    rowsPerPage,
    goToPage,
    nextPage,
    previousPage,
    refetch,
  };
}
