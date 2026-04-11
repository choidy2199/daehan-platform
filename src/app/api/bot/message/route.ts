import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  matchProduct, filterByHint, labelProduct,
  formatProductResponse, formatConfirmationQuestion, formatPriceResponse, formatStockResponse, formatCandidateList,
  type Product, type MatchResult, type MatchedProduct,
} from '../../../../lib/botMatcher';

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
const CACHE_TTL = 5 * 60 * 1000;

async function getPersona(): Promise<Persona> {
  if (_personaCache && Date.now() - _personaCache.ts < CACHE_TTL) return _personaCache.data;
  try {
    const { data } = await supabase.from('app_data').select('value').eq('key', 'mw_bot_persona').single();
    if (data?.value && typeof data.value === 'object') {
      const p = { ...DEFAULT_PERSONA, ...data.value } as Persona;
      _personaCache = { data: p, ts: Date.now() };
      return p;
    }
  } catch (e) { console.error('[bot] 페르소나 조회 실패:', e); }
  _personaCache = { data: DEFAULT_PERSONA, ts: Date.now() };
  return DEFAULT_PERSONA;
}

// ─── 제품 데이터 캐시 ───

let _productsCache: { data: Product[]; ts: number } | null = null;

async function getAllProducts(): Promise<Product[]> {
  if (_productsCache && Date.now() - _productsCache.ts < CACHE_TTL) return _productsCache.data;
  const [mwRes, genRes] = await Promise.all([
    supabase.from('app_data').select('value').eq('key', 'mw_products').single(),
    supabase.from('app_data').select('value').eq('key', 'mw_gen_products').single(),
  ]);
  const all = [
    ...(Array.isArray(mwRes.data?.value) ? mwRes.data.value : []),
    ...(Array.isArray(genRes.data?.value) ? genRes.data.value : []),
  ] as Product[];
  _productsCache = { data: all, ts: Date.now() };
  return all;
}

// ─── AI 메시지 분석 ───

interface ProductHint { keyword: string; hint: string; }
interface AnalysisResult {
  intent: string;
  products: ProductHint[];
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
- 한 메시지에 제품 여러 개면 모두 추출
- 제품별 힌트 추출: "세트"/"풀세트"/"세트로" → hint:"set", "베어"/"본체"/"본체만"/"알몸" → hint:"bare", 없으면 hint:""
- 전체에 동일 힌트면 각 제품에 적용 ("m12 fid2 m12 fpd2 세트" → 둘 다 hint:"set")
- 가격/단가/재고/견적/얼마 → "product_inquiry"
- 인사("안녕하세요","수고하세요","좋은아침") → "greeting"
- 감사("감사합니다","고맙습니다","ㄱㅅ") → "thanks"
- 퇴장("수고하세요","들어갑니다") → "bye"
- 자기소개 질문("누구세요?","누구야") → "self_intro"
- AS/반품/교환/수리 → "as_return"
- 가격협상/할인/네고 → "price_negotiation"
- 직송 요청(이름+전화+주소+제품) → "direct_ship"
- "부탁드립니다"/"주문할게요"/"보내주세요"/"넣어주세요"/"이걸로"/"발주" → "order_request"
- "네"/"맞아요"/"ㅇㅇ"/"넵"/"맞습니다" → "confirm_yes"
- "아니요"/"아닌데"/"다른거"/"아닙니다" → "confirm_no"
- 의미 파악 어려우면 needsClarification=true
- "???" 같은 의미없는 메시지 → "unknown", directReply:""
- 개인적 질문 → "unknown", directReply:"업무 관련 문의사항 있으시면 말씀해주세요!"

응답 JSON:
{"intent":"product_inquiry","products":[{"keyword":"M12 FID2","hint":"set"},{"keyword":"M12 FPD2","hint":"set"}],"needsClarification":false,"clarificationMessage":"","directReply":""}`;

async function analyzeMessage(message: string): Promise<AnalysisResult | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, system: ANALYSIS_SYSTEM, messages: [{ role: 'user', content: message }] }),
    });
    if (!res.ok) { console.error(`[bot] AI 분석 ${res.status}`); return null; }
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';
    const jsonStr = text.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    // 하위 호환: products가 문자열 배열이면 객체로 변환
    if (Array.isArray(parsed.products) && parsed.products.length > 0 && typeof parsed.products[0] === 'string') {
      parsed.products = parsed.products.map((kw: string) => ({ keyword: kw, hint: '' }));
    }
    return parsed as AnalysisResult;
  } catch (err) { console.error('[bot] AI 분석 에러:', err); return null; }
}

// ─── AI 선택 판별 ───

async function askClaudeForSelection(products: string[], message: string): Promise<number> {
  if (!ANTHROPIC_API_KEY) return 0;
  const productList = products.map((code, i) => { const l = labelProduct(code); return `${i + 1}. ${code}${l ? ` — ${l}` : ''}`; }).join('\n');
  const prompt = `전동공구 유통업체 카카오톡 대화입니다.\n봇이 아래 제품 목록을 보여줬고, 고객이 답장했습니다.\n\n제품 목록:\n${productList}\n\n고객 답장: "${message}"\n\n고객이 몇 번 제품을 원하는지 번호만 답하세요. 판단 불가능하면 0.\n숫자 하나만 답하세요.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const num = parseInt(data.content?.[0]?.text?.trim() || '0', 10);
    return isNaN(num) ? 0 : num;
  } catch { return 0; }
}

// ─── 맥락 관리 (확장: status + confirmedProducts) ───

interface ContextData {
  room: string;
  products: unknown; // JSONB — 유연한 구조
  updated_at: string;
}

interface BotContext {
  status?: string; // "awaiting_confirmation" | "price_given" | undefined (선택 대기)
  confirmedProducts?: MatchedProduct[];
  candidates?: string[]; // 기존 호환: 선택 대기 후보 모델명
}

async function getContext(room: string): Promise<BotContext | null> {
  const { data } = await supabase.from('bot_room_context').select('*').eq('room', room).single();
  if (!data) return null;
  if (Date.now() - new Date(data.updated_at).getTime() > 5 * 60 * 1000) return null;
  // products가 배열이면 기존 형식 (선택 대기), 객체면 새 형식
  const p = (data as ContextData).products;
  if (Array.isArray(p)) return { candidates: p as string[] };
  if (p && typeof p === 'object') return p as BotContext;
  return null;
}

async function saveCtx(room: string, ctx: BotContext): Promise<void> {
  await supabase.from('bot_room_context').upsert(
    { room, products: ctx, updated_at: new Date().toISOString() },
    { onConflict: 'room' }
  );
}

async function deleteCtx(room: string): Promise<void> {
  await supabase.from('bot_room_context').delete().eq('room', room);
}

// ─── 시간대별 인사 ───

function getGreeting(persona: Persona): string {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
  return hour < 12 ? (persona.morningGreeting || persona.greetingReply) : (persona.eveningGreeting || persona.greetingReply);
}

// ─── reply 헬퍼 ───
function reply(r: string | null) { return NextResponse.json({ success: true, reply: r }); }

// ─── API Handler ───

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== BOT_API_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { room, sender, message, isGroupChat } = body;
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

    console.log(`[bot] room=${room}, sender=${sender}, msg=${message}, group=${isGroupChat}`);
    const persona = await getPersona();

    // ─── Step 0: 맥락 확인 ───
    const ctx = await getContext(room);

    if (ctx) {
      // 먼저 새 메시지의 의도 파악 (맥락 처리를 위해)
      const ctxAnalysis = await analyzeMessage(message);
      const ctxIntent = ctxAnalysis?.intent || '';

      // 새 제품 문의가 들어오면 기존 맥락 삭제 후 새로 시작
      if (ctxIntent === 'product_inquiry' && ctxAnalysis?.products && ctxAnalysis.products.length > 0) {
        await deleteCtx(room);
        // 아래 Step 1로 계속 (analysis를 재사용)
        return await handleProductInquiry(room, ctxAnalysis, persona);
      }

      // --- awaiting_confirmation 상태 ---
      if (ctx.status === 'awaiting_confirmation' && ctx.confirmedProducts) {
        if (ctxIntent === 'confirm_yes' || ctxIntent === 'order_request') {
          // 네 → 가격 응답
          const priceReply = formatPriceResponse(ctx.confirmedProducts);
          await saveCtx(room, { status: 'price_given', confirmedProducts: ctx.confirmedProducts });
          return reply(priceReply);
        }
        if (ctxIntent === 'confirm_no') {
          await deleteCtx(room);
          return reply('어떤 제품 확인해드릴까요?');
        }
      }

      // --- price_given 상태 ---
      if (ctx.status === 'price_given' && ctx.confirmedProducts) {
        if (ctxIntent === 'order_request' || ctxIntent === 'confirm_yes') {
          const stockReply = formatStockResponse(ctx.confirmedProducts);
          await deleteCtx(room);
          return reply(stockReply);
        }
      }

      // --- 기존 선택 대기 (candidates) ---
      if (ctx.candidates && ctx.candidates.length > 0 && message.length <= 30) {
        let selectedIdx = 0;
        const numMatch = message.trim().match(/^(\d+)/);
        if (numMatch && message.trim().length <= 10) selectedIdx = parseInt(numMatch[1], 10);
        if (selectedIdx === 0) selectedIdx = await askClaudeForSelection(ctx.candidates, message);

        if (selectedIdx >= 1 && selectedIdx <= ctx.candidates.length) {
          const selectedKeyword = ctx.candidates[selectedIdx - 1];
          console.log(`[bot] 선택: ${selectedIdx}번 → ${selectedKeyword}`);
          const allProducts = await getAllProducts();
          const result = matchProduct(selectedKeyword, allProducts);
          if (result.matched && result.count === 1) {
            // 1건 확정 → 바로 가격 (확인 생략)
            const priceReply = formatPriceResponse(result.products);
            await saveCtx(room, { status: 'price_given', confirmedProducts: result.products });
            return reply(priceReply);
          }
          // 여전히 다건 → 전체 응답
          const r = formatProductResponse([result]);
          return reply(r || null);
        }
        // 선택 판별 실패 → 새 분석으로 계속
      }

      // 맥락은 있지만 해당 상태와 무관한 intent → 일반 처리
      if (ctxAnalysis) {
        return await handleByIntent(room, ctxAnalysis, persona);
      }
    }

    // ─── Step 1: AI 메시지 분석 ───
    const analysis = await analyzeMessage(message);
    console.log(`[bot] AI 분석:`, JSON.stringify(analysis));

    if (!analysis) {
      // AI 분석 실패 → 폴백
      const allProducts = await getAllProducts();
      const result = matchProduct(message, allProducts);
      if (result.matched) {
        const r = formatProductResponse([result]);
        if (result.count >= 2) await saveCtx(room, { candidates: result.products.map(p => p.model) });
        return reply(r);
      }
      return reply(null);
    }

    // ─── Step 2: intent별 분기 ───
    return await handleByIntent(room, analysis, persona);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bot] 에러:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── intent 분기 핸들러 ───

async function handleByIntent(room: string, analysis: AnalysisResult, persona: Persona): Promise<NextResponse> {
  const { intent, needsClarification, clarificationMessage, directReply } = analysis;

  switch (intent) {
    case 'greeting': return reply(getGreeting(persona));
    case 'thanks': return reply(persona.thanksReply);
    case 'bye': return reply(persona.byeReply);
    case 'self_intro': return reply(persona.intro);
    case 'direct_ship': return reply('접수되었습니다. 송장번호는 나오는대로 전달드리겠습니다.');
    case 'as_return': case 'price_negotiation': return reply(persona.unknownReply);
    case 'order_request': case 'confirm_yes': case 'confirm_no':
      // 맥락 없이 단독으로 온 경우
      return reply(null);
    case 'product_inquiry':
      return await handleProductInquiry(room, analysis, persona);
    default:
      if (needsClarification && clarificationMessage) return reply(clarificationMessage);
      if (directReply) return reply(directReply);
      return reply(null);
  }
}

// ─── 제품 문의 핸들러 ───

async function handleProductInquiry(room: string, analysis: AnalysisResult, persona: Persona): Promise<NextResponse> {
  const { products: productHints } = analysis;

  if (!productHints || productHints.length === 0) {
    return reply('어떤 제품 확인해드릴까요?');
  }

  const allProducts = await getAllProducts();

  // 각 제품 매칭 + 힌트 필터
  const matchResults: { keyword: string; hint: string; result: MatchResult }[] = [];
  for (const ph of productHints) {
    const raw = matchProduct(ph.keyword, allProducts);
    if (raw.matched && ph.hint) {
      const filtered = filterByHint(raw.products, ph.hint);
      matchResults.push({
        keyword: ph.keyword,
        hint: ph.hint,
        result: { ...raw, products: filtered, count: filtered.length },
      });
    } else {
      matchResults.push({ keyword: ph.keyword, hint: ph.hint, result: raw });
    }
  }

  // 모든 제품 확정(각 1건)인지 확인
  const allConfirmed = matchResults.every(m => m.result.matched && m.result.count === 1);
  const confirmedProducts = allConfirmed ? matchResults.map(m => m.result.products[0]) : [];

  // 일부/전체 후보 다건인 결과
  const hasCandidates = matchResults.some(m => m.result.matched && m.result.count >= 2);
  const hasUnmatched = matchResults.some(m => !m.result.matched);

  if (allConfirmed) {
    if (confirmedProducts.length === 1) {
      // 단건 1개 확정 → 확인 생략, 바로 가격
      const priceReply = formatPriceResponse(confirmedProducts);
      await saveCtx(room, { status: 'price_given', confirmedProducts });
      return reply(priceReply);
    } else {
      // 복수 확정 → 확인 질문
      const confirmReply = formatConfirmationQuestion(confirmedProducts);
      await saveCtx(room, { status: 'awaiting_confirmation', confirmedProducts });
      return reply(confirmReply);
    }
  }

  if (hasCandidates || hasUnmatched) {
    // 후보 나열 + 맥락 저장
    const candidateResults = matchResults.map(m => m.result);
    const listReply = formatCandidateList(candidateResults);
    const allCandidateModels: string[] = [];
    for (const m of matchResults) {
      if (m.result.count >= 2) m.result.products.forEach(p => allCandidateModels.push(p.model));
    }
    if (allCandidateModels.length > 0) {
      await saveCtx(room, { candidates: allCandidateModels });
    }
    return reply(listReply);
  }

  // 전부 매칭 실패
  return reply('정확한 모델명 확인부탁드립니다.');
}
