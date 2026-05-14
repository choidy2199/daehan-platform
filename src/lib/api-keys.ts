import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface ApiKeys {
  erp: { userKey: string; url: string };
  naver: { clientId: string; clientSecret: string };
  coupang: { accessKey: string; secretKey: string };
  ssg: { apiKey: string };
  gmarket: { apiKey: string };
  kakao: { apiKey: string };
}

// Supabase에서 읽기 → .env fallback
export async function getApiKeys(): Promise<ApiKeys> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', 'api_keys')
      .single();

    if (data?.value) {
      const s = data.value as Partial<ApiKeys>;
      return {
        erp: {
          userKey: s.erp?.userKey || process.env.ERP_USER_KEY || '',
          url: s.erp?.url || process.env.ERP_URL || '',
        },
        naver: {
          clientId: s.naver?.clientId || process.env.NAVER_CLIENT_ID || '',
          clientSecret: s.naver?.clientSecret || process.env.NAVER_CLIENT_SECRET || '',
        },
        coupang: {
          accessKey: s.coupang?.accessKey || process.env.COUPANG_ACCESS_KEY || '',
          secretKey: s.coupang?.secretKey || process.env.COUPANG_SECRET_KEY || '',
        },
        ssg: { apiKey: s.ssg?.apiKey || process.env.SSG_API_KEY || '' },
        gmarket: { apiKey: s.gmarket?.apiKey || process.env.GMARKET_API_KEY || '' },
        kakao: { apiKey: s.kakao?.apiKey || process.env.KAKAO_REST_API_KEY || '' },
      };
    }
  } catch (e) { /* fallback to env */ }

  return {
    erp: { userKey: process.env.ERP_USER_KEY || '', url: process.env.ERP_URL || '' },
    naver: { clientId: process.env.NAVER_CLIENT_ID || '', clientSecret: process.env.NAVER_CLIENT_SECRET || '' },
    coupang: { accessKey: process.env.COUPANG_ACCESS_KEY || '', secretKey: process.env.COUPANG_SECRET_KEY || '' },
    ssg: { apiKey: process.env.SSG_API_KEY || '' },
    gmarket: { apiKey: process.env.GMARKET_API_KEY || '' },
    kakao: { apiKey: process.env.KAKAO_REST_API_KEY || '' },
  };
}

// Supabase에 저장
export async function saveApiKeys(keys: ApiKeys): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('app_data')
      .upsert({ key: 'api_keys', value: keys, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    return !error;
  } catch (e) { return false; }
}
