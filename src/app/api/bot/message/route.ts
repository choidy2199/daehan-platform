import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_KEY = process.env.BOT_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const SELF_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://daehantool.dev';

// ─── 라벨링 ───

/** 모델코드에 세트/베어/액세서리 라벨 붙이기 */
function labelProduct(modelCode: string): string {
  // 숫자-숫자-숫자 패턴 (예: 49-16-2953) → 액세서리
  if (/^\d+-\d+-\d+/.test(modelCode.trim())) return '액세서리';

  // 마지막 하이픈 뒤 분석
  const lastHyphen = modelCode.lastIndexOf('-');
  if (lastHyphen > 0 && lastHyphen < modelCode.length - 1) {
    const afterHyphen = modelCode.substring(lastHyphen + 1).trim();
    if (afterHyphen.startsWith('0')) return '베어툴(본체만)';
    if (/^\d/.test(afterHyphen)) return '세트(배터리포함)';
  }

  return '';
}

// ─── 맥락 관리 ───

interface RoomContext {
  room: string;
  products: string[];
  updated_at: string;
}

async function getContext(room: string): Promise<RoomContext | null> {
  const { data } = await supabase
    .from('bot_room_context')
    .select('*')
    .eq('room', room)
    .single();

  if (!data) return null;

  // 5분 이내 유효
  const updatedAt = new Date(data.updated_at).getTime();
  const now = Date.now();
  if (now - updatedAt > 5 * 60 * 1000) return null;

  return data as RoomContext;
}

async function saveContext(room: string, products: string[]): Promise<void> {
  await supabase
    .from('bot_room_context')
    .upsert({ room, products, updated_at: new Date().toISOString() }, { onConflict: 'room' });
}

async function deleteContext(room: string): Promise<void> {
  await supabase.from('bot_room_context').delete().eq('room', room);
}

// ─── Leo Choi 페르소나 ───

const LEO_CHOI_PERSONA = `당신은 대한종합상사의 AI 영업지원 직원 "Leo Choi (레오 최)" 과장입니다.

[신상]
- 직책: 영업지원 과장
- 생년월일: 2026.04.11 / 말띠 / 양자리 / ENFJ
- 대한종합상사 첫 AI 출신 직원 (2026년 입사)

[성격]
- 거래처를 가족처럼 존중, 밝고 쾌활, 긍정적
- 웃어른을 공경하고 예의 바름
- 꼼꼼하고 정확한 답변 추구
- 모르는 건 솔직히 "담당자 확인 후 답변드리겠습니다."

[말투 규칙]
- 항상 존댓말
- 이모지 사용 안 함
- 프로페셔널 톤 유지

[자기소개 응답]
- "누구세요?" / "누구야?" / "이름이 뭐야?" 등 신원 질문 시에만:
  "안녕하세요, 대한종합상사 영업지원 Leo Choi 과장입니다."
- 생일/MBTI/별자리 등 물어보면 해당 정보만 간단히 답변
- 자기소개를 먼저 꺼내지 않음 (물어볼 때만)

[응답 규칙 — 매우 중요]
- 카카오톡 대화이므로 응답은 반드시 1~3줄 이내로 짧게
- 절대 목록(1. 2. 3.)이나 볼드(**) 마크다운 사용 금지
- 제품명 없이 "단가 알려주세요" → "어떤 제품 단가 확인해드릴까요?"
- 재고 문의인데 제품명 없으면 → "어떤 제품 확인해드릴까요?"
- 모르는 질문 → "담당자 확인 후 답변드리겠습니다."
- 인사("안녕하세요", "안녕") → 정확히 "무응답" 이라고만 답하세요
- "감사합니다" / "고맙습니다" / "ㄳ" / "ㄱㅅ" → 정확히 "무응답" 이라고만 답하세요
- 일상 대화나 잡담 → 정확히 "무응답" 이라고만 답하세요`;

async function askClaudeChat(message: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: LEO_CHOI_PERSONA,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!res.ok) {
      console.error(`[bot/message] Claude Chat API ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch (err) {
    console.error('[bot/message] Claude Chat 에러:', err);
    return null;
  }
}

// ─── AI 선택 판별 ───

async function askClaudeForSelection(products: string[], message: string): Promise<number> {
  if (!ANTHROPIC_API_KEY) return 0;

  const productList = products
    .map((code, i) => {
      const label = labelProduct(code);
      return `${i + 1}. ${code}${label ? ` — ${label}` : ''}`;
    })
    .join('\n');

  const prompt = `전동공구 유통업체 카카오톡 대화입니다.
봇이 아래 제품 목록을 보여줬고, 고객이 답장했습니다.

제품 목록:
${productList}

고객 답장: "${message}"

고객이 몇 번 제품을 원하는지 번호만 답하세요. 판단 불가능하면 0.
숫자 하나만 답하세요.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error(`[bot/message] Claude API ${res.status}`);
      return 0;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '0';
    const num = parseInt(text, 10);
    return isNaN(num) ? 0 : num;
  } catch (err) {
    console.error('[bot/message] Claude API 에러:', err);
    return 0;
  }
}

// ─── /api/bot/stock 호출 ───

async function callStockApi(message: string, room: string, sender: string): Promise<{
  success: boolean;
  reply: string | null;
  matched: number;
  products?: string[];
}> {
  try {
    const res = await fetch(`${SELF_URL}/api/bot/stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BOT_API_KEY,
      },
      body: JSON.stringify({ message, room, sender }),
    });
    return await res.json();
  } catch (err) {
    console.error('[bot/message] stock API 호출 실패:', err);
    return { success: false, reply: null, matched: 0 };
  }
}

// ─── API Handler ───

export async function POST(request: NextRequest) {
  try {
    // 인증
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== BOT_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { room, sender, message, isGroupChat } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    console.log(`[bot/message] room=${room}, sender=${sender}, msg=${message}, group=${isGroupChat}`);

    // ─── Step 1: 맥락 확인 ───
    const ctx = await getContext(room);

    if (ctx && ctx.products.length > 0 && message.length <= 30) {
      // ─── Step 2: 선택 판별 ───
      let selectedIdx = 0;

      // 2-1. 빠른 패턴: 숫자로 시작 + 10글자 이하
      const numMatch = message.trim().match(/^(\d+)/);
      if (numMatch && message.trim().length <= 10) {
        selectedIdx = parseInt(numMatch[1], 10);
      }

      // 2-2. 패턴 실패 → Claude API
      if (selectedIdx === 0) {
        selectedIdx = await askClaudeForSelection(ctx.products, message);
      }

      // 유효한 번호 선택됨
      if (selectedIdx >= 1 && selectedIdx <= ctx.products.length) {
        const selectedModelCode = ctx.products[selectedIdx - 1];
        console.log(`[bot/message] 선택: ${selectedIdx}번 → ${selectedModelCode}`);

        // 선택된 모델코드로 stock API 호출 (1건 매칭 기대, 맥락은 유지 — 5분 TTL 자연 만료)
        const stockResult = await callStockApi(selectedModelCode, room, sender);
        return NextResponse.json({ success: true, reply: stockResult.reply });
      }

      // 선택 판별 실패(0) → 맥락 유지한 채 새 검색으로 (5분 TTL 자연 만료)
    }

    // ─── Step 3: 제품 검색 ───
    const stockResult = await callStockApi(message, room, sender);

    // ─── Step 4: 맥락 저장 (다건 매칭 시 교체, 그 외는 유지) ───
    if (stockResult.matched >= 2 && stockResult.products) {
      await saveContext(room, stockResult.products);
    }

    // ─── Step 5: 응답 ───
    // 제품 매칭 성공 → 그대로 반환
    if (stockResult.reply) {
      return NextResponse.json({ success: true, reply: stockResult.reply });
    }

    // 제품 매칭 실패 → Leo Choi 페르소나로 일반 대화 응답
    const chatReply = await askClaudeChat(message);
    // "무응답" 또는 빈 문자열이면 카톡에 메시지 보내지 않음
    const finalReply = (chatReply && chatReply !== '무응답') ? chatReply : null;
    return NextResponse.json({ success: true, reply: finalReply });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bot/message] 에러:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
