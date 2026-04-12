import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  matchProduct,
  type Product, type MatchedProduct,
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

// ─── 대화 이력 관리 ───

interface ChatMessage {
  sender: string;
  text: string;
  ts: number;
}

interface ChatHistory {
  messages: ChatMessage[];
}

const MSG_TTL = 30 * 60 * 1000; // 30분
const MAX_MESSAGES = 20;

async function getHistory(room: string): Promise<ChatMessage[]> {
  const { data } = await supabase.from('bot_room_context').select('products').eq('room', room).single();
  if (!data?.products || typeof data.products !== 'object') return [];
  const hist = data.products as ChatHistory;
  if (!Array.isArray(hist.messages)) return [];
  const now = Date.now();
  return hist.messages.filter(m => now - m.ts < MSG_TTL);
}

async function appendMessage(room: string, sender: string, text: string): Promise<void> {
  const existing = await getHistory(room);
  existing.push({ sender, text, ts: Date.now() });
  // 최대 20개 유지
  const trimmed = existing.length > MAX_MESSAGES ? existing.slice(existing.length - MAX_MESSAGES) : existing;
  const payload: ChatHistory = { messages: trimmed };
  await supabase.from('bot_room_context').upsert(
    { room, products: payload, updated_at: new Date().toISOString() },
    { onConflict: 'room' }
  );
}

// ─── 톡방 정보 ───

async function getRoomInfo(room: string): Promise<{ customerName: string; manager: string }> {
  try {
    const { data } = await supabase.from('app_data').select('value').eq('key', 'mw_bot_rooms').single();
    if (data?.value && Array.isArray(data.value)) {
      const found = data.value.find((r: { room?: string }) => r.room === room);
      if (found) return { customerName: found.customerName || '', manager: found.manager || '' };
    }
  } catch (e) { console.error('[bot] 톡방 정보 조회 실패:', e); }
  return { customerName: '', manager: '' };
}

// ─── 제품 키워드 감지 (정규식) ───

function detectProductKeywords(message: string): string[] {
  const patterns = [
    /M18\s*[A-Z]{2,}/gi,
    /M12\s*[A-Z]{2,}/gi,
    /\d{4}-\d{2}-\d{4}/g,
    /DC\s*\d{3,4}/gi,
    /FID\d?/gi, /FPD\d?/gi, /FPP\d?/gi, /CAG\d?/gi, /CHX\d?/gi,
    /FHIW\d?/gi, /FCS\d?/gi, /FCVS\d?/gi,
    /PACKOUT/gi, /팩아웃/g,
    /임팩/g, /그라인더/g, /해머드릴/g, /콤프레샤/g, /원형톱/g,
  ];
  const found: string[] = [];
  for (const p of patterns) {
    const matches = message.match(p);
    if (matches) found.push(...matches);
  }
  return [...new Set(found)];
}

// ─── 제품 데이터 포맷 (시스템 프롬프트용) ───

function formatProductDataForPrompt(products: MatchedProduct[], allRaw: Product[]): string {
  return products.map(p => {
    // raw Product에서 outA, ttiStock 등 추가 정보 가져오기
    const raw = allRaw.find(r => r.code === p.code);
    const outA = raw?.outA ? Number(raw.outA) : 0;
    const ttiStock = raw?.ttiStock || '';
    const stock = raw?.stock ? Number(raw.stock) : 0;
    const supplyPrice = raw?.supplyPrice ? Number(raw.supplyPrice) : p.price;
    const priceStr = outA > 0 ? outA.toLocaleString('ko-KR') : supplyPrice.toLocaleString('ko-KR');
    return `${p.model} | 공급가: ${supplyPrice.toLocaleString('ko-KR')}원 | A단가: ${outA > 0 ? outA.toLocaleString('ko-KR') : '?'}원 | 자사재고: ${stock}개 | 밀워키재고: ${ttiStock || '?'}`;
  }).join('\n');
}

// ─── 시스템 프롬프트 ───

const SYSTEM_PROMPT = `너는 "최 팀장" (Leo Choi), 대한종합상사 영업지원 팀장이다.
거래처 카카오톡 단톡방에서 실제 직원으로 대화한다. 자연스럽게, 진짜 사람처럼 말해라.

[나는 누구인가]
- 이름: Leo Choi (레오 최), 직책: 영업지원 팀장
- "최과장", "최팀장", "레오", "팀장님", "과장님" 등으로 불리면 그건 나를 부르는 것이다
- "누구세요?" → "네, 최 팀장입니다! 말씀하세요~" 처럼 자연스럽게
- 나의 역할: 재고/단가 안내, 배송 안내, 공지 전달, 주문 접수 지원

[우리 회사]
- 회사명: 대한종합상사 (Milwaukee 공구 총판)
- 취급: 밀워키(Milwaukee) 전동공구, 콜라보 콤프레샤, 비트맨, 수공구/액세서리, 팩아웃(PACKOUT) 등
- 직원: 사장님(다연아빠), 혜원(won'S), 지영(지영), 나(Leo/봇) — 4명이 같은 톡방에 함께 있음
- 영업시간: 평일 09:00~18:00 (점심 12:00~13:00), 주말/공휴일 휴무
- 배송: 기본 당일출고, 주로 롯데택배, 지연 시 별도 공지
- 봇은 영업시간 외에도 24시간 응답

[말투 규칙]
- 항상 존댓말
- 이모지 절대 사용 안 함
- 짧고 자연스럽게 (1~3줄)
- 목록, 번호매기기(1. 2. 3.), 마크다운(**볼드** 등) 절대 금지
- 실제 직원이 카톡에서 빠르게 치는 것처럼 대화체로
- 모르는 건 솔직하게 "확인 후 답변드리겠습니다"
- 가격은 항상 콤마 포함 (예: 259,000원)

[응답 판단 — 매우 중요]
- 누군가 나에게 질문하거나 정보를 요청하면 → 답변
- 직원(다연아빠/won'S/지영)이 이미 정확하게 답변한 내용이면 → NO_REPLY
- 직원이 가격/재고를 틀리게 말했으면 → 정정 ("정확한 단가는 xxx원입니다" 등)
- 거래처 질문에 아무도 안 답했으면 → 내가 답변
- 직원끼리 업무 대화면 → NO_REPLY
- 단순 "ㅋㅋ", "ㅎㅎ", "사진", 의미없는 메시지 → NO_REPLY
- "감사합니다", "고마워요" 같은 인사 → 짧게 답 ("네, 감사합니다!" 등)
- 응답이 불필요하다고 판단되면 반드시 정확히 "NO_REPLY" 네 글자만 출력

[제품 문의 시]
- 아래 [조회된 제품 데이터]를 활용하여 답변
- 데이터가 제공되지 않았으면 "확인 후 답변드리겠습니다"
- 여러 후보가 있으면 "혹시 ~모델인지, ~모델인지 확인부탁드립니다" 식으로 자연스럽게
- 세트/베어 구분이 있으면 자연스럽게 안내

[제품 데이터 읽는 법]
- model: 모델명
- code: 관리코드
- 공급가: 공급가(부가세 별도)
- A단가: A단가(도매가, 부가세 별도) — 거래처에게는 A단가로 안내
- 자사재고: 자사 재고수량
- 밀워키재고: 밀워키 본사 재고 (●=재고있음, ▲=일부있음, X=재고없음)
- A단가가 있으면 A단가로 안내, 없으면(0 또는 ?) 공급가로 안내
- 자사 재고 있으면: "{모델명} {A단가}원 재고있습니다"
- 자사 재고 없고 밀워키 있으면(● 또는 ▲): "현재 재고는 없지만 발주 가능합니다. 주문시 익일 출고됩니다"
- 둘 다 없으면: "현재 품절입니다. 입고일정 확인후 말씀드리겠습니다"`;

// ─── reply 헬퍼 ───
function reply(r: string | null) { return NextResponse.json({ success: true, reply: r }); }

// ─── API Handler ───

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== BOT_API_KEY) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { room, sender, message } = body;
    if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

    console.log(`[bot] room=${room}, sender=${sender}, msg=${message}`);

    // 1. 대화 이력 로드 (30분 이내)
    const history = await getHistory(room);

    // 2. 새 메시지를 이력에 추가 저장
    await appendMessage(room, sender || '거래처', message);

    // 3. 제품 키워드 감지 → matchProduct로 재고/가격 조회
    const keywords = detectProductKeywords(message);
    const allProducts = await getAllProducts();
    let productDataStr = '';

    if (keywords.length > 0) {
      const matchedProducts: MatchedProduct[] = [];
      for (const kw of keywords) {
        const result = matchProduct(kw, allProducts);
        if (result.matched) matchedProducts.push(...result.products);
      }
      if (matchedProducts.length > 0) {
        // 중복 제거 (code 기준)
        const unique = [...new Map(matchedProducts.map(p => [p.code, p])).values()];
        productDataStr = formatProductDataForPrompt(unique, allProducts);
      }
    }

    // 4. 톡방 정보 로드
    const roomInfo = await getRoomInfo(room);

    // 5. 페르소나 로드
    const persona = await getPersona();

    // 6. 시스템 프롬프트 조합
    let systemPrompt = SYSTEM_PROMPT;

    // 페르소나 커스터마이징 반영
    if (persona.rules && persona.rules.length > 0) {
      systemPrompt += `\n\n[추가 규칙]\n${persona.rules.map(r => `- ${r}`).join('\n')}`;
    }

    systemPrompt += `\n\n[이 톡방 정보]\n- 톡방명: ${room}\n- 거래처: ${roomInfo.customerName || '미매핑'}`;

    if (productDataStr) {
      systemPrompt += `\n\n[조회된 제품 데이터]\n${productDataStr}`;
    }

    // 7. 대화 이력을 Anthropic messages 형식으로 변환
    const chatMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of history) {
      if (m.sender === 'bot') {
        chatMessages.push({ role: 'assistant', content: m.text });
      } else {
        chatMessages.push({ role: 'user', content: `[${m.sender}] ${m.text}` });
      }
    }
    // 새 메시지 추가
    chatMessages.push({ role: 'user', content: `[${sender || '거래처'}] ${message}` });

    // Anthropic API는 첫 메시지가 user여야 하고, user/assistant 교대 필요
    // 연속 동일 role 병합
    const mergedMessages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const msg of chatMessages) {
      if (mergedMessages.length > 0 && mergedMessages[mergedMessages.length - 1].role === msg.role) {
        mergedMessages[mergedMessages.length - 1].content += '\n' + msg.content;
      } else {
        mergedMessages.push({ ...msg });
      }
    }
    // 첫 메시지가 assistant면 앞에 더미 user 추가
    if (mergedMessages.length > 0 && mergedMessages[0].role === 'assistant') {
      mergedMessages.unshift({ role: 'user', content: '[시스템] 대화 시작' });
    }

    // 8. Sonnet 호출
    console.log(`[bot] Sonnet 호출: messages=${mergedMessages.length}, keywords=${keywords.join(',')}`);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: mergedMessages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[bot] Sonnet API ${res.status}: ${errText}`);
      return reply(null);
    }

    const data = await res.json();
    const aiReply = data.content?.[0]?.text?.trim() || '';

    console.log(`[bot] AI 응답: ${aiReply.substring(0, 100)}`);

    // 9. NO_REPLY 처리
    if (aiReply === 'NO_REPLY' || aiReply.includes('NO_REPLY')) {
      return reply(null);
    }

    // 10. 봇 응답을 이력에 저장
    await appendMessage(room, 'bot', aiReply);
    return reply(aiReply);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bot] 에러:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
