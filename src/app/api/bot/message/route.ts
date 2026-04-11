import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { matchProduct, formatProductResponse, labelProduct, type Product, type MatchResult } from '../../../../lib/botMatcher';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOT_API_KEY = process.env.BOT_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ─── 페르소나 캐시 (5분 TTL) ───

interface Persona {
  name: string; nameKo: string; title: string; company: string; intro: string;
  birthday: string; zodiac: string; mbti: string; personality: string;
  rules: string[];
  greetingReply: string; thanksReply: string; unknownReply: string; byeReply: string;
  morningGreeting: string; eveningGreeting: string;
}

const DEFAULT_PERSONA: Persona = {
  name: 'Leo Choi', nameKo: '레오 최', title: '영업지원 과장', company: '대한종합상사',
  intro: '안녕하세요, 대한종합상사 영업지원 Leo Choi 과장입니다.',
  birthday: '2026.04.11', zodiac: '양자리', mbti: 'ENFJ',
  personality: '거래처를 가족처럼 존중, 밝고 쾌활, 긍정적, 예의 바름, 꼼꼼하고 정확한 답변 추구, 프로페셔널',
  rules: ['항상 존댓말', '이모지 사용 안 함', '1~3줄 이내 짧은 응답', '목록이나 번호매기기(1. 2. 3.) 금지', '마크다운(**볼드** 등) 금지', '개인적인 질문(정치, 종교, 연애 등)은 정중히 회피'],
  greetingReply: '네, 안녕하세요! 필요하신 게 있으시면 말씀해주세요!',
  thanksReply: '감사합니다. 추가 문의사항 있으시면 편하게 말씀해주세요!',
  unknownReply: '담당자 확인 후 답변드리겠습니다.',
  byeReply: '네, 감사합니다! 좋은 하루 보내세요!',
  morningGreeting: '네, 안녕하세요! 좋은 아침입니다. 필요하신 게 있으시면 말씀해주세요!',
  eveningGreeting: '네, 안녕하세요! 필요하신 게 있으시면 말씀해주세요!',
};

let _personaCache: { data: Persona; ts: number } | null = null;
const PERSONA_TTL = 5 * 60 * 1000;

async function getPersona(): Promise<Persona> {
  if (_personaCache && Date.now() - _personaCache.ts < PERSONA_TTL) return _personaCache.data;

  try {
    const { data } = await supabase.from('app_data').select('value').eq('key', 'mw_bot_persona').single();
    if (data?.value && typeof data.value === 'object') {
      const p = { ...DEFAULT_PERSONA, ...data.value } as Persona;
      _personaCache = { data: p, ts: Date.now() };
      return p;
    }
  } catch (e) {
    console.error('[bot/message] 페르소나 조회 실패:', e);
  }

  _personaCache = { data: DEFAULT_PERSONA, ts: Date.now() };
  return DEFAULT_PERSONA;
}

function buildPersonaPrompt(p: Persona): string {
  return `당신은 ${p.company}의 AI 영업지원 직원 "${p.name} (${p.nameKo})" ${p.title}입니다.

[신상]
- 직책: ${p.title}
- 생년월일: ${p.birthday} / ${p.zodiac} / ${p.mbti}
- ${p.company} 첫 AI 출신 직원

[성격] ${p.personality}

[말투/응답 규칙]
${p.rules.map(r => '- ' + r).join('\n')}

[자기소개] 신원 질문 시에만: "${p.intro}"
생일/MBTI/별자리 등 물어보면 해당 정보만 간단히 답변. 자기소개를 먼저 꺼내지 않음.`;
}

// ─── 제품 데이터 캐시 (5분 TTL) ───

let _productsCache: { data: Product[]; ts: number } | null = null;

async function getAllProducts(): Promise<Product[]> {
  if (_productsCache && Date.now() - _productsCache.ts < PERSONA_TTL) return _productsCache.data;

  const [mwRes, genRes] = await Promise.all([
    supabase.from('app_data').select('value').eq('key', 'mw_products').single(),
    supabase.from('app_data').select('value').eq('key', 'mw_gen_products').single(),
  ]);
  const mw: Product[] = Array.isArray(mwRes.data?.value) ? mwRes.data.value : [];
  const gen: Product[] = Array.isArray(genRes.data?.value) ? genRes.data.value : [];
  const all = [...mw, ...gen];
  _productsCache = { data: all, ts: Date.now() };
  return all;
}

// ─── AI 메시지 분석 ───

interface AnalysisResult {
  intent: string;
  products: string[];
  needsClarification: boolean;
  clarificationMessage: string;
  directReply: string;
}

const ANALYSIS_SYSTEM = `당신은 공구 유통회사 "대한종합상사"의 카카오톡 메시지 분석기입니다.
거래처에서 온 메시지를 분석하여 반드시 JSON만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

[취급 제품]
- 밀워키(Milwaukee) 전동공구: M18, M12 시리즈 (FID=임팩트드라이버, FPD=해머드릴, CAG=그라인더, CHX=해머, FHIW=임팩트렌치, FCS=원형톱, FCVS=진공청소기 등)
- 콜라보 콤프레샤: DC661, DC886, DC998 등
- 비트맨 공구
- 각종 수공구, 액세서리, 팩아웃(PACKOUT)

[분석 규칙]
- 제품 모델명이 불완전해도 추출 (예: "m12 fid" → "M12 FID", "콤프레샤 4마력" → "콤프레샤 4마력")
- 한 메시지에 제품 여러 개면 모두 추출 (예: "m12 fid m12 fpd 가격" → ["M12 FID", "M12 FPD"])
- 제품 4~5개도 모두 추출 — 개수 제한 없음
- 가격/단가/재고/견적/얼마 문의는 모두 "product_inquiry"
- 인사("안녕하세요", "수고하세요", "좋은아침") → "greeting"
- 감사("감사합니다", "고맙습니다", "ㄱㅅ") → "thanks"
- 퇴장("수고하세요", "들어갑니다", "먼저 가보겠습니다") → "bye"
- 자기소개 질문("누구세요?", "누구야", "이름이 뭐야") → "self_intro"
- AS/반품/교환/수리 → "as_return"
- 가격협상/할인요청/네고 → "price_negotiation"
- 직송 요청(이름+전화+주소+제품 포함) → "direct_ship"
- 의미 파악 어려우면 needsClarification=true, clarificationMessage에 짧은 확인 질문
- "???" 같은 의미없는 메시지 → "unknown", directReply 빈 문자열
- 개인적 질문(정치/종교/연애 등) → "unknown", directReply: "업무 관련 문의사항 있으시면 말씀해주세요!"

응답 JSON 형식:
{"intent":"product_inquiry","products":["M12 FID","M12 FPD"],"needsClarification":false,"clarificationMessage":"","directReply":""}`;

async function analyzeMessage(message: string): Promise<AnalysisResult | null> {
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
        max_tokens: 200,
        system: ANALYSIS_SYSTEM,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!res.ok) {
      console.error(`[bot/message] AI 분석 API ${res.status}`);
      return null;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';
    // JSON 파싱 (코드블록 감싸진 경우도 처리)
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(jsonStr) as AnalysisResult;
  } catch (err) {
    console.error('[bot/message] AI 분석 에러:', err);
    return null;
  }
}

// ─── AI 선택 판별 (기존 로직 유지) ───

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

    if (!res.ok) return 0;
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '0';
    const num = parseInt(text, 10);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0;
  }
}

// ─── 맥락 관리 ───

interface RoomContext {
  room: string;
  products: string[];  // 하위 호환: 단순 문자열 배열
  updated_at: string;
}

async function getContext(room: string): Promise<RoomContext | null> {
  const { data } = await supabase.from('bot_room_context').select('*').eq('room', room).single();
  if (!data) return null;
  const updatedAt = new Date(data.updated_at).getTime();
  if (Date.now() - updatedAt > 5 * 60 * 1000) return null;
  return data as RoomContext;
}

async function saveContext(room: string, products: string[]): Promise<void> {
  await supabase
    .from('bot_room_context')
    .upsert({ room, products, updated_at: new Date().toISOString() }, { onConflict: 'room' });
}

// ─── 시간대별 인사 ───

function getTimeBasedGreeting(persona: Persona): string {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
  if (hour < 12) return persona.morningGreeting || persona.greetingReply;
  return persona.eveningGreeting || persona.greetingReply;
}

// ─── API Handler ───

export async function POST(request: NextRequest) {
  try {
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

    const persona = await getPersona();

    // ─── Step 0: 맥락 확인 (선택 판별) ───
    const ctx = await getContext(room);

    if (ctx && ctx.products.length > 0 && message.length <= 30) {
      let selectedIdx = 0;

      // 빠른 패턴: 숫자로 시작 + 10글자 이하
      const numMatch = message.trim().match(/^(\d+)/);
      if (numMatch && message.trim().length <= 10) {
        selectedIdx = parseInt(numMatch[1], 10);
      }

      // 패턴 실패 → Claude API
      if (selectedIdx === 0) {
        selectedIdx = await askClaudeForSelection(ctx.products, message);
      }

      // 유효한 번호 선택됨 → 해당 모델코드로 재검색
      if (selectedIdx >= 1 && selectedIdx <= ctx.products.length) {
        const selectedKeyword = ctx.products[selectedIdx - 1];
        console.log(`[bot/message] 선택: ${selectedIdx}번 → ${selectedKeyword}`);

        const allProducts = await getAllProducts();
        const result = matchProduct(selectedKeyword, allProducts);
        const reply = formatProductResponse([result]);
        return NextResponse.json({ success: true, reply: reply || null });
      }
    }

    // ─── Step 1: AI 메시지 분석 ───
    const analysis = await analyzeMessage(message);
    console.log(`[bot/message] AI 분석:`, JSON.stringify(analysis));

    if (!analysis) {
      // AI 분석 실패 → 폴백: 기존 stock API 패턴
      const allProducts = await getAllProducts();
      const result = matchProduct(message, allProducts);
      if (result.matched) {
        const reply = formatProductResponse([result]);
        if (result.count >= 2) {
          await saveContext(room, result.products.map(p => p.model));
        }
        return NextResponse.json({ success: true, reply });
      }
      return NextResponse.json({ success: true, reply: null });
    }

    // ─── Step 2: intent별 분기 ───
    const { intent, products: productKeywords, needsClarification, clarificationMessage, directReply } = analysis;

    switch (intent) {
      case 'greeting':
        return NextResponse.json({ success: true, reply: getTimeBasedGreeting(persona) });

      case 'thanks':
        return NextResponse.json({ success: true, reply: persona.thanksReply });

      case 'bye':
        return NextResponse.json({ success: true, reply: persona.byeReply });

      case 'self_intro':
        return NextResponse.json({ success: true, reply: persona.intro });

      case 'direct_ship':
        return NextResponse.json({ success: true, reply: '접수되었습니다. 송장번호는 나오는대로 전달드리겠습니다.' });

      case 'as_return':
      case 'price_negotiation':
        return NextResponse.json({ success: true, reply: persona.unknownReply });

      case 'product_inquiry':
        // Step 3으로
        break;

      case 'unknown':
      default:
        if (needsClarification && clarificationMessage) {
          return NextResponse.json({ success: true, reply: clarificationMessage });
        }
        if (directReply) {
          return NextResponse.json({ success: true, reply: directReply });
        }
        // 빈 directReply → 무응답
        return NextResponse.json({ success: true, reply: null });
    }

    // ─── Step 3: 제품별 매칭 ───
    if (!productKeywords || productKeywords.length === 0) {
      // 제품명 없는 product_inquiry
      return NextResponse.json({ success: true, reply: '어떤 제품 확인해드릴까요?' });
    }

    const allProducts = await getAllProducts();
    const results: MatchResult[] = productKeywords.map(kw => matchProduct(kw, allProducts));

    // ─── Step 4: 응답 포맷 ───
    const reply = formatProductResponse(results);

    // ─── Step 5: 맥락 저장 (다건 후보 있는 제품) ───
    const allCandidates: string[] = [];
    for (const r of results) {
      if (r.count >= 2) {
        r.products.forEach(p => allCandidates.push(p.model));
      }
    }
    if (allCandidates.length > 0) {
      await saveContext(room, allCandidates);
    }

    return NextResponse.json({ success: true, reply: reply || null });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bot/message] 에러:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
