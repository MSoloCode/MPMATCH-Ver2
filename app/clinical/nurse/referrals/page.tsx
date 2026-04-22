'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NurseReferralsPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/clinical/referrals');
  }, [router]);

  return null;
}
