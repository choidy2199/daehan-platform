import { getUserPreference, setUserPreference } from '@/lib/userPreferences';

export interface TemplateItem {
  gen_product_id: number | null;
  custom_model: string | null;
  custom_description: string | null;
  cost: number | null;
  price_storefarm: number | null;
  price_coupang: number | null;
  price_openmarket: number | null;
  price_ssg: number | null;
  override_category: string | null;
}

export interface Template {
  id: string;
  name: string;
  created_at: string;
  items: TemplateItem[];
}

export const TEMPLATES_KEY = 'import_pricing:templates';

export async function loadTemplates(userId: string): Promise<Template[]> {
  const result = await getUserPreference<Template[]>(userId, TEMPLATES_KEY);
  return result ?? [];
}

export async function saveTemplates(userId: string, templates: Template[]): Promise<boolean> {
  return setUserPreference(userId, TEMPLATES_KEY, templates);
}
