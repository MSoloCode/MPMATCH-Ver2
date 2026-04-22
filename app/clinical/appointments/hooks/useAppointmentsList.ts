'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface Appointment {
  id: number;
  motherId: number;
  pregnancyId: number | null;
  ancVisitId: number | null;
  appointmentDateTime: string;
  purpose: string; // ROUTINE | SCANNING | REVIEW | OTHER
  purposeOther: string | null;
  status: string; // SCHEDULED | CONFIRMED | ATTENDED | MISSED | LIKELY_MISSED | CANCELLED
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  mother?: {
    id: number;
    fullName: string;
    phone: string;
  };
  pregnancy?: {
    id: number;
    status: string;
  };
  assignedCHW?: {
    id: number;
    name: string;
    role: string;
  };
  createdBy?: {
    id: number;
    name: string;
    role: string;
  };
}

export interface AppointmentsListResponse {
  success: boolean;
  data: Appointment[];
  pagination: {
    total: number;
    returned: number;
    skip: number;
    take: number;
  };
}

export interface UseAppointmentsListOptions {
  upcoming?: boolean | null;
  status?: string | null;
  motherId?: number | null;
  pregnancyId?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  assignedCHWId?: number | null;
}

export function useAppointmentsList(options?: UseAppointmentsListOptions) {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const rowsPerPage = 20;

  const fetchAppointments = useCallback(
    async (page: number, filterOptions?: UseAppointmentsListOptions) => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        const skip = (page - 1) * rowsPerPage;
        params.append('skip', skip.toString());
        params.append('take', rowsPerPage.toString());

        // Add upcoming filter if specified
        if (filterOptions?.upcoming !== null && filterOptions?.upcoming !== undefined) {
          params.append('upcoming', filterOptions.upcoming.toString());
        }

        // Add status filter if specified
        if (filterOptions?.status !== null && filterOptions?.status !== undefined) {
          params.append('status', filterOptions.status);
        }

        // Add mother filter if specified
        if (filterOptions?.motherId !== null && filterOptions?.motherId !== undefined) {
          params.append('motherId', filterOptions.motherId.toString());
        }

        // Add pregnancy filter if specified
        if (filterOptions?.pregnancyId !== null && filterOptions?.pregnancyId !== undefined) {
          params.append('pregnancyId', filterOptions.pregnancyId.toString());
        }

        // Add date range filters if specified
        if (filterOptions?.startDate !== null && filterOptions?.startDate !== undefined) {
          params.append('startDate', filterOptions.startDate);
        }

        if (filterOptions?.endDate !== null && filterOptions?.endDate !== undefined) {
          params.append('endDate', filterOptions.endDate);
        }

        // Add assigned CHW filter if specified
        if (filterOptions?.assignedCHWId !== null && filterOptions?.assignedCHWId !== undefined) {
          params.append('assignedCHWId', filterOptions.assignedCHWId.toString());
        }

        const url = `/api/appointments?${params.toString()}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch appointments: ${response.statusText}`);
        }

        const data: AppointmentsListResponse = await response.json();

        if (data.success) {
          setAppointments(data.data);
          setTotalCount(data.pagination.total);
        } else {
          setError('Failed to load appointments list');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        setAppointments([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  // Fetch on mount and when filter options change
  useEffect(() => {
    fetchAppointments(1, options);
  }, [options, fetchAppointments]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= Math.ceil(totalCount / rowsPerPage)) {
        setCurrentPage(page);
        fetchAppointments(page, options);
      }
    },
    [totalCount, options, fetchAppointments],
  );

  const nextPage = useCallback(() => {
    const maxPage = Math.ceil(totalCount / rowsPerPage);
    if (currentPage < maxPage) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchAppointments(newPage, options);
    }
  }, [currentPage, totalCount, options, fetchAppointments]);

  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchAppointments(newPage, options);
    }
  }, [currentPage, options, fetchAppointments]);

  const refetch = useCallback(() => {
    fetchAppointments(currentPage, options);
  }, [currentPage, options, fetchAppointments]);

  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;

  return {
    appointments,
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
