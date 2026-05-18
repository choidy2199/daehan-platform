'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Campaign {
  id: string;     // ncc_campaign_id
  name: string;
}

interface UseCampaignsResult {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
}

export function useCampaigns(): UseCampaignsResult {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCampaigns() {
      try {
        const { data, error: dbError } = await supabase
          .from('ad_campaigns')
          .select('ncc_campaign_id, name')
          .order('name', { ascending: true });

        if (cancelled) return;

        if (dbError) {
          setError(dbError.message);
          setLoading(false);
          return;
        }

        const list: Campaign[] = (data ?? []).map((row) => ({
          id: row.ncc_campaign_id,
          name: row.name ?? row.ncc_campaign_id,
        }));
        setCampaigns(list);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown error');
        setLoading(false);
      }
    }

    fetchCampaigns();
    return () => { cancelled = true; };
  }, []);

  return { campaigns, loading, error };
}
