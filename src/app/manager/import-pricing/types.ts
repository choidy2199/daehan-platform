export type TabId = 'pricing' | 'promotion';

export type DraftMeta = {
  draft_no: string;
  draft_name: string | null;
  tab_type: TabId;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export const TAB_LABELS: Record<TabId, string> = {
  pricing: '제품금액 책정',
  promotion: '제품 프로모션 책정',
};
