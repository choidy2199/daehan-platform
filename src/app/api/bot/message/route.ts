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

  if (mwRes.error) console.error('[bot] mw_products 로드 실패:', mwRes.error.message);
  if (genRes.error) console.error('[bot] mw_gen_products 로드 실패:', genRes.error.message);

  const mwProducts = Array.isArray(mwRes.data?.value) ? mwRes.data.value : [];
  const genProducts = Array.isArray(genRes.data?.value) ? genRes.data.value : [];

  console.log(`[bot] 제품 로드: 밀워키 ${mwProducts.length}건, 일반 ${genProducts.length}건`);

  const all = [
    ...mwProducts,
    ...genProducts,
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
    /임팩/g, /드릴/g, /그라인더/g, /해머/g, /렌치/g, /원형톱/g,
    /청소기/g, /콤프레샤/g, /컴프레셔/g, /배터리/g, /충전기/g,
    /써큘러쏘/g, /블로워/g, /랜턴/g, /라디오/g, /밴드쏘/g,
    /멀티툴/g, /로터리/g, /직소/g,
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
  return products.slice(0, 10).map(p => {
    const raw = allRaw.find(r => r.code === p.code);
    const outA = raw?.outA ? Number(raw.outA) : 0;
    const ttiStock = raw?.ttiStock || '';
    const stock = raw?.stock ? Number(raw.stock) : 0;
    const supplyPrice = raw?.supplyPrice ? Number(raw.supplyPrice) : p.price;
    // 일반제품: model과 description이 다르면 "브랜드 규격" 형태로 표시
    let displayName = p.model;
    if (raw?.model && raw?.description && raw.model !== raw.description && !raw.description.includes(raw.model)) {
      displayName = `${raw.model} ${raw.description}`;
    }
    return `${displayName} | A단가: ${outA > 0 ? outA.toLocaleString('ko-KR') : '?'}원 | 공급가: ${supplyPrice.toLocaleString('ko-KR')}원 | 재고: ${stock}개 | 본사: ${ttiStock || '?'}`;
  }).join('\n');
}

// ─── 시스템 프롬프트 ───

const SYSTEM_PROMPT = `너는 "Leo 팀장" (Leo Choi, 레오), 대한종합상사 영업지원팀 팀장이다.
거래처 카카오톡 단톡방에서 실제 직원으로 대화한다. 자연스럽게, 진짜 사람처럼 말해라.

[나는 누구인가]
- 이름: Leo Choi (레오 최)
- 직책: 영업지원팀 팀장
- "최과장", "최팀장", "레오", "팀장님", "과장님", "Leo", "레오팀장", "Leo팀장" 등으로 불리면 그건 나를 부르는 것이다
- 자기소개 요청 시 아래 문구를 줄바꿈 포함 그대로 사용:
"안녕하세요!!
대한종합상사
영업지원팀 팀장 Leo Choi입니다.
편하게,
Leo팀장 또는 레오팀장이라고
불러주세요!
앞으로 잘부탁드립니다."
- 자기소개 시 업무 내용이나 취급 제품을 나열하지 말 것. 위 문구만 사용.
- 나의 역할: 재고/단가 안내, 배송 안내, 공지 전달, 주문 접수 지원
- 업무/역할을 물어보면 ("너의 업무는?", "뭐하는 사람이야?", "무슨 일 해?") 아래 문구를 그대로 사용:
"✅제품단가,재고 안내
✅배송 안내
✅공지사항 전달
✅주문 접수 지원
업무를 담당하고 있습니다.
대표님들!!
문의사항 있으시면 언제든 말씀해 주세요!"
- 이 문구를 임의로 변경하거나 항목을 추가하지 말 것. 그대로 출력.

[우리 회사]
- 회사명: 대한종합상사
- 종합 공구 유통회사 (밀워키 전동공구, 콜라보 콤프레샤, 비트맨, 수공구, 액세서리, 팩아웃 등)
- 직원: 사장님(다연아빠), 혜원(won'S), 지영(지영), 나(Leo/봇) — 4명이 같은 톡방에 함께 있음
- 영업시간: 평일 09:00~18:00 (점심 12:00~13:00), 주말/공휴일 휴무
- 배송: 기본 당일출고, 주로 롯데택배, 지연 시 별도 공지
- 봇은 영업시간 외에도 24시간 응답

[말투 규칙]
- 항상 존댓말
- 짧고 자연스럽게 (1~3줄)
- 목록, 번호매기기(1. 2. 3.), 마크다운(**볼드** 등) 절대 금지
- 실제 직원이 카톡에서 빠르게 치는 것처럼 대화체로
- 가격은 항상 콤마 포함 (예: 259,000원)
- 모르는 건 솔직하게 "확인 후 연락드리겠습니다"
- 일상 대화에서는 이모지 사용 안 함 (제품/가격/상태 안내 시에만 허용)

[줄바꿈 규칙]
- 제품/가격 안내 시 반드시 줄바꿈(\\n)을 활용하여 가독성 있게 작성
- 문맥이 바뀌는 단위로 줄바꿈 (인사 → 제품명 → 가격 → 마무리)
- 짧은 일상 대화("네, 말씀하세요!")는 줄바꿈 불필요

[이모지 규칙]
- 일상 대화, 인사, 확인 질문에서는 이모지 사용하지 않음
- 제품/가격 확정 안내 시에만 아래 이모지 사용:
  🔵 — 제품명, 가격 앞에 사용
  🟢 — 재고있음 표시
  🔴 — 품절/재고없음 표시
  📦 — 배송/송장 안내
  ✅ — 주문확인, 접수완료
  ⚠️ — 재고부족, 확인필요

1건 안내 예시:
"문의 주신 가격안내입니다.
🔵 M18 FID3-502X
🔵 340,000원입니다."

여러건 나열 예시:
"M18 임팩 관련 제품 안내드립니다.

🔵 FID3-502X 세트 - 340,000원
🔵 FID3-0X0 베어 - 195,000원
🔵 FHIW-502X 세트 - 380,000원

어떤 모델인지 확인부탁드립니다"

재고없음 예시:
"🔵 M18 FID3-502X
🔴 현재 품절입니다. 입고일정 확인후 말씀드리겠습니다."

발주가능 예시:
"🔵 M18 FID3-502X
🔵 340,000원입니다.
⚠️ 주문시 익일 출고됩니다."

송장 안내 예시:
"📦 송장안내드립니다.
롯데택배 2607-6599-6175
김준학님 / M18 FID3-502X"

[응답 판단 — 매우 중요]
- 누군가 나에게 질문하거나 정보를 요청하면 → 답변
- 직원(다연아빠/won'S/지영)이 이미 정확하게 답변한 내용이면 → NO_REPLY
- 직원이 가격/재고를 틀리게 말했으면 → 정정
- 거래처 질문에 아무도 안 답했으면 → 내가 답변
- 직원끼리 업무 대화면 → NO_REPLY
- 단순 "ㅋㅋ", "ㅎㅎ", 의미없는 메시지 → NO_REPLY
- "감사합니다", "고마워요" → 짧게 답
- 응답이 불필요하면 반드시 정확히 "NO_REPLY" 네 글자만 출력

[재고 답변 규칙 — 매우 중요]
거래처(직원이 아닌 사람)에게는 정확한 재고 수량을 절대 알려주지 않는다. "자사 재고"라는 내부 용어도 사용 금지.
직원(다연아빠/won'S/지영)에게는 정확한 수량을 알려준다.

거래처가 "재고 있어?" 라고 물어볼 때:
- 자사 재고 1개 이상 → "🟢 재고있습니다"
- 자사 재고 0 → "확인 후 연락드리겠습니다" (직송 가능성이 있으므로 직원이 판단해야 함. 이 경우 반드시 ##NEED_STAFF## 태그 추가)

거래처가 수량을 지정하여 주문할 때 (예: "20대 보내주세요"):
- 자사 재고 >= 요청 수량 → "주문시 오늘 출고 가능합니다"
- 자사 재고 < 요청 수량, 밀워키 본사 재고 있음(ttiStock='a') → "⚠️ 발주 후 내일 일괄 출고 가능합니다" + ##NEED_STAFF##
- 자사 재고 < 요청 수량, 밀워키 본사 재고 없음 → "확인 후 연락드리겠습니다" + ##NEED_STAFF##
- 자사 재고 0, 재고 관련 답변 불가 → "확인 후 연락드리겠습니다" + ##NEED_STAFF##

직원이 "재고 몇 개?" 라고 물어볼 때:
- "현재 10개 있습니다" 처럼 정확한 수량

##NEED_STAFF## 태그 규칙:
- 봇이 직접 판단하기 어려운 건(재고 부족, 품절, 직송, AS, 반품, 가격 협상 등)에 응답 맨 끝에 추가
- 이 태그는 시스템이 자동 제거하여 거래처에게는 보이지 않음
- 직원 알림 트리거로만 사용

[제품 문의 vs 주문 구분 — 중요]

가격/단가 문의 ("얼마야?", "가격이요?", "단가 알려줘"):
→ 가격만 안내. 재고 상태 언급하지 않음.
"🔵 M18 FID3-502X
🔵 340,000원입니다."

주문 요청 ("보내주세요", "주문할게요", "넣어주세요", "발주", "몇 대"):
→ 재고 상태 + 출고 가능 여부 안내.
"✅ M18 FID3-502X
🟢 오늘 출고 가능합니다."

재고 문의 ("재고 있어?", "있나요?", "재고 확인"):
→ 재고 상태만 안내. 가격 언급하지 않음.
"🟢 재고있습니다."

[제품 문의 시]
- 아래 [조회된 제품 데이터]가 있으면 반드시 해당 데이터의 실제 모델명과 가격으로 답변할 것
- "확인 후 안내드리겠습니다"는 제품 데이터가 정말 제공되지 않았을 때만 사용
- 후보가 2~5개면 모델명을 나열하고 (품명/설명은 생략) 확인 요청
- 후보가 1개면 바로 가격/재고 안내 (이모지 포함)
- 후보가 6개 이상이면 종류를 좁혀달라고 요청
- 모델명은 [조회된 제품 데이터]에 있는 그대로 사용 (임의로 만들지 말 것)
- 세트/베어 구분이 있으면 함께 안내

[제품 데이터 읽는 법]
- model: 모델명
- name: 제품명 (예: "18V FUEL 임팩트 드라이버(GEN4)")
- code: 관리코드
- supplyPrice: 공급가(부가세 별도)
- outA: A단가(도매가, 부가세 별도)
- stock: 자사 재고수량
- ttiStock: 밀워키 본사 재고 (a=재고있음, b=일부있음, c=재고없음)
- 가격 안내 시 outA 사용 (outA가 0이면 supplyPrice 사용)`;

const STAFF_ROOM = '대한 사무실';

// ─── 회사 내부 톡방 블랙리스트 (절대 응답 안 함) ───
const BLOCKED_ROOMS = [
  '대한 전체톡방',
  '대한 사무실',
  '대한 전동공구 분해/조립',
  '대한 영진',
  '대한 대신화물',
];

// ─── 직원 판별 ───
const STAFF_SENDERS = ['다연아빠', "won'S", '지영', '찌리찌리', '뱅', '❤️봉봉❤️'];
function isStaff(sender: string): boolean {
  return STAFF_SENDERS.includes(sender);
}

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

    // 0-1. 블랙리스트 톡방 → 즉시 무시
    if (BLOCKED_ROOMS.includes(room)) {
      console.log(`[bot] 블랙리스트 톡방 — 무시: ${room}`);
      return reply(null);
    }

    // 0-2. mw_bot_rooms에 등록된 톡방만 응답
    const { data: roomData } = await supabase.from('app_data').select('value').eq('key', 'mw_bot_rooms').single();
    const registeredRooms: string[] = [];
    if (roomData?.value) {
      const rooms = Array.isArray(roomData.value) ? roomData.value : (roomData.value as { rooms?: { roomName?: string }[] }).rooms || [];
      for (const r of rooms) {
        if (r && typeof r === 'object' && 'roomName' in r && r.roomName) registeredRooms.push(r.roomName);
      }
    }
    if (!registeredRooms.includes(room)) {
      console.log(`[bot] 미등록 톡방 — 무시: ${room} (등록: ${registeredRooms.length}개)`);
      return reply(null);
    }

    // 1. 대화 이력 로드 (30분 이내)
    const history = await getHistory(room);

    // 2. 새 메시지를 이력에 추가 저장
    await appendMessage(room, sender || '거래처', message);

    // 3. 제품 키워드 감지 → matchProduct로 재고/가격 조회
    const keywords = detectProductKeywords(message);
    const allProducts = await getAllProducts();
    let productDataStr = '';

    console.log(`[bot] 키워드 감지:`, keywords);

    const matchedProducts: MatchedProduct[] = [];

    // 개별 키워드 매칭
    if (keywords.length > 0) {
      for (const kw of keywords) {
        const result = matchProduct(kw, allProducts);
        if (result.matched) matchedProducts.push(...result.products);
      }
    }

    // 메시지 전체 매칭 (키워드와 별개로 전체 문장도 시도)
    let fullMatchResult = matchProduct(message, allProducts);

    // 매칭 실패 시 → 점진적 토큰 축소 재시도
    if (!fullMatchResult.matched || fullMatchResult.count === 0) {
      const retryStopwords = ['재고','있나요','있어','얼마','가격','단가','주문','보내','있습니까','알려주세요','확인','해주세요','부탁','합니다','주세요','몇개','몇대','문의','드립니다','요','좀','개','원','넣어','보내주세요','주세요','있어요','없나요','세트','베어','본체','세트로','알몸','인치'];
      const words = message.match(/[A-Za-z0-9][\w-]*|[가-힣]{2,}/g) || [];
      const filtered = words.filter((w: string) => !retryStopwords.includes(w) && w.length >= 2);

      // 토큰을 하나씩 줄여가며 재시도 (뒤에서부터 제거)
      for (let len = filtered.length - 1; len >= 1; len--) {
        const partial = filtered.slice(0, len).join(' ');
        const result = matchProduct(partial, allProducts);
        if (result.matched && result.count > 0) {
          fullMatchResult = result;
          console.log(`[bot] 토큰 축소 매칭 성공: "${partial}" → ${result.count}건`);
          break;
        }
      }

      // 그래도 실패하면 개별 토큰으로 각각 시도
      if (!fullMatchResult.matched || fullMatchResult.count === 0) {
        for (const word of filtered) {
          const result = matchProduct(word, allProducts);
          if (result.matched && result.count > 0) {
            fullMatchResult = result;
            console.log(`[bot] 단일 토큰 매칭 성공: "${word}" → ${result.count}건`);
            break;
          }
        }
      }
    }

    if (fullMatchResult.matched) matchedProducts.push(...fullMatchResult.products);

    if (matchedProducts.length > 0) {
      // 중복 제거 (model 기준)
      const unique = [...new Map(matchedProducts.map(p => [p.model, p])).values()];
      console.log(`[bot] 매칭 결과: ${unique.length}건`, unique.slice(0, 5).map(p => p.model));
      productDataStr = formatProductDataForPrompt(unique, allProducts);
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
        max_tokens: 500,
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
    let aiReply = data.content?.[0]?.text?.trim() || '';
    const usage = data.usage as { input_tokens: number; output_tokens: number } | undefined;

    console.log(`[bot] AI 응답: ${aiReply.substring(0, 100)}`);
    if (usage) console.log(`[bot] 토큰: in=${usage.input_tokens}, out=${usage.output_tokens}`);

    // 비용 계산 (메시지 로그에서도 사용)
    let msgCost = 0;
    if (usage) {
      const INPUT_PRICE_PER_M = 3;
      const OUTPUT_PRICE_PER_M = 15;
      msgCost = (usage.input_tokens / 1_000_000) * INPUT_PRICE_PER_M +
                (usage.output_tokens / 1_000_000) * OUTPUT_PRICE_PER_M;
    }

    // 비용 기록 (NO_REPLY 포함 모든 API 호출)
    try {
      if (usage) {

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const { data: usageData } = await supabase
          .from('app_data').select('value').eq('key', 'mw_bot_usage').single();

        const current = (usageData?.value as Record<string, unknown>) || { daily: {} };
        if (!current.daily || typeof current.daily !== 'object') current.daily = {};
        const daily = current.daily as Record<string, { inputTokens: number; outputTokens: number; cost: number; count: number }>;

        if (!daily[today]) daily[today] = { inputTokens: 0, outputTokens: 0, cost: 0, count: 0 };
        daily[today].inputTokens += usage.input_tokens;
        daily[today].outputTokens += usage.output_tokens;
        daily[today].cost += msgCost;
        daily[today].count += 1;

        // 365일 이전 데이터 정리
        const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        for (const key of Object.keys(daily)) {
          if (key < cutoff) delete daily[key];
        }

        await supabase.from('app_data').upsert(
          { key: 'mw_bot_usage', value: current, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      }
    } catch (e) {
      console.error('[bot] 비용 기록 실패:', e);
    }

    // 9. NO_REPLY / NEED_STAFF 판정
    const isNoReply = aiReply === 'NO_REPLY' || aiReply.includes('NO_REPLY');
    const needsStaff = aiReply.includes('##NEED_STAFF##');
    const cleanReply = isNoReply ? null : aiReply.replace(/##NEED_STAFF##/g, '').trim();

    // 10. 메시지 로그 저장 (mw_bot_messages)
    try {
      // 매칭된 제품 모델명 수집 (중복 제거)
      const uniqueMatched = [...new Map(matchedProducts.map(p => [p.model, p])).values()];

      const msgLog = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 3)}`,
        room: room || '',
        sender: sender || '거래처',
        message: message || '',
        timestamp: new Date().toISOString(),
        type: isStaff(sender || '') ? 'staff' : 'incoming',
        status: isNoReply ? 'no_reply' : (needsStaff ? 'need_staff' : 'bot_reply'),
        botReply: cleanReply,
        needStaff: needsStaff,
        matchedProducts: uniqueMatched.map(p => p.model).slice(0, 5),
        cost: Math.round(msgCost * 1_000_000) / 1_000_000, // 소수점 6자리
      };

      const { data: msgData } = await supabase
        .from('app_data').select('value').eq('key', 'mw_bot_messages').single();

      const current = (msgData?.value && typeof msgData.value === 'object')
        ? msgData.value as { messages: Record<string, unknown>[] }
        : { messages: [] };

      if (!Array.isArray(current.messages)) current.messages = [];

      // 최신이 앞
      current.messages.unshift(msgLog);

      // 30일 이전 메시지 정리
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      current.messages = current.messages.filter((m: Record<string, unknown>) =>
        typeof m.timestamp === 'string' && m.timestamp > cutoff
      );

      // 최대 5000건 유지
      if (current.messages.length > 5000) {
        current.messages = current.messages.slice(0, 5000);
      }

      await supabase.from('app_data').upsert(
        { key: 'mw_bot_messages', value: current, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    } catch (e) {
      console.error('[bot] 메시지 로그 저장 실패:', e);
    }

    // 11. NO_REPLY → 응답 없음
    if (isNoReply) {
      return reply(null);
    }

    // 12. ##NEED_STAFF## 태그 제거 후 aiReply 갱신
    aiReply = cleanReply || '';

    // 13. 봇 응답을 이력에 저장
    await appendMessage(room, 'bot', aiReply);

    // 14. 회사 단톡방 알림 발송
    if (needsStaff) {
      const staffAlert = `⚠️ 확인 필요\n${roomInfo.customerName || room}\n${sender}: ${message}\n\n봇 응답: ${aiReply}`;
      try {
        await fetch('http://115.136.19.83:3081/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': BOT_API_KEY },
          body: JSON.stringify({ room: STAFF_ROOM, message: staffAlert }),
        });
        console.log(`[bot] 직원 알림 발송: ${staffAlert.substring(0, 80)}...`);
      } catch (e) {
        console.error('[bot] 직원 알림 발송 실패:', e);
      }
    }

    return reply(aiReply);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[bot] 에러:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
