import { supabase } from "@/lib/supabase";

/**
 * 사용자별 UI 설정 저장소.
 *
 * 데이터 구조:
 * user_preferences 테이블의 preferences JSONB 컬럼에 namespace 키로 저장.
 *
 * 예시:
 * preferences = {
 *   "import_pricing:visible_cols": ["photo", "code", ...],
 *   "import_pricing:col_widths": { "code": 80, "model": 100 }
 * }
 */

const TABLE = "user_preferences";

/**
 * 특정 사용자의 특정 설정 키 값을 조회.
 * 키가 없으면 null 반환.
 */
export async function getUserPreference<T = unknown>(
  userId: string,
  key: string
): Promise<T | null> {
  if (!userId || !key) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getUserPreference error:", error);
    return null;
  }

  if (!data || !data.preferences) return null;

  const prefs = data.preferences as Record<string, unknown>;
  return (prefs[key] as T) ?? null;
}

/**
 * 특정 사용자의 특정 설정 키 값을 저장.
 * 행이 없으면 INSERT, 있으면 UPDATE (upsert).
 */
export async function setUserPreference<T = unknown>(
  userId: string,
  key: string,
  value: T
): Promise<boolean> {
  if (!userId || !key) return false;

  // 기존 preferences 조회
  const { data: existing, error: getError } = await supabase
    .from(TABLE)
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (getError) {
    console.error("setUserPreference get error:", getError);
    return false;
  }

  const currentPrefs = (existing?.preferences ?? {}) as Record<string, unknown>;
  const nextPrefs = { ...currentPrefs, [key]: value };

  const { error: upsertError } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, preferences: nextPrefs },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("setUserPreference upsert error:", upsertError);
    return false;
  }

  return true;
}

/**
 * 특정 사용자의 특정 설정 키를 삭제.
 */
export async function deleteUserPreference(
  userId: string,
  key: string
): Promise<boolean> {
  if (!userId || !key) return false;

  const { data: existing, error: getError } = await supabase
    .from(TABLE)
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();

  if (getError) {
    console.error("deleteUserPreference get error:", getError);
    return false;
  }

  if (!existing || !existing.preferences) return true;

  const currentPrefs = existing.preferences as Record<string, unknown>;
  if (!(key in currentPrefs)) return true;

  const { [key]: _, ...rest } = currentPrefs;

  const { error: updateError } = await supabase
    .from(TABLE)
    .update({ preferences: rest })
    .eq("user_id", userId);

  if (updateError) {
    console.error("deleteUserPreference update error:", updateError);
    return false;
  }

  return true;
}
