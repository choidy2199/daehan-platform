import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// 대분류 매핑: 페이지 제목 키워드 → category
const CATEGORY_MAP: Record<string, string> = {
  '파워툴': '파워툴',
  'POWER TOOL': '파워툴',
  '수공구': '수공구',
  'HAND TOOL': '수공구',
  '팩아웃': '팩아웃',
  'PACKOUT': '팩아웃',
  '액세서리': '악세사리',
  'ACCESSORY': '악세사리',
  'SDS': '악세사리',
  'MX FUEL': '파워툴',
  '엠파이어': '악세사리',
  'EMPIRE': '악세사리',
};

// 중분류 키워드 목록 (행 파싱 시 감지용)
const SUBCATEGORY_KEYWORDS = [
  '12V FUEL', '12V 브러쉬리스', '12V 브러쉬', '12V 기타',
  '18V FUEL', '18V 브러쉬리스', '18V 브러쉬', '18V 기타',
  'L4', 'IR', 'MX FUEL',
  '유선', '파워툴 전용 액세서리',
  '측정공구', '작업공구', '안전장비',
  '스토리지', '소프트 백', '툴박스', '벽걸이',
  '소켓', '비트', '블레이드', '엠파이어',
  '임팩 소켓', '래칫', '플라이어', '커터', '드릴비트',
  '홀소', '밴드소', '레시프로', '직소', '원형톱',
];

interface ParsedRow {
  ttiNum: string;
  orderNum: string;
  model: string;
  description: string;
  supplyPrice: number;
  category: string;
  subcategory: string;
  detail: string;
  code: string;
  manageCode: string;
  productDC: number;
  cost: number;
  priceA: number;
  priceRetail: number;
  priceNaver: number;
  priceOpen: number;
  discontinued: string;
  inDate: string;
  ttiStock: string;
  raisedPrice: number;
  raiseRate: number;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 });
    }

    // pdf-parse v1 — lib 직접 임포트 (index.js의 테스트 코드 우회)
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    console.log(`[PDF Parse] 텍스트 추출: ${text.length}자, ${pdfData.numpages}페이지`);

    const rows = parsePdfText(text);

    console.log(`[PDF Parse] 파싱 완료: ${rows.length}행`);

    return NextResponse.json({ rows, pageCount: pdfData.numpages, textLength: text.length });
  } catch (err: any) {
    console.error('[PDF Parse Error]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function parsePdfText(text: string): ParsedRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows: ParsedRow[] = [];
  let currentCategory = '';
  let currentSubcategory = '';
  let currentDetail = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 대분류 감지 (페이지 제목)
    for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
      if (line.toUpperCase().includes(keyword.toUpperCase()) && line.length < 50) {
        currentCategory = cat;
        break;
      }
    }

    // 중분류 감지 (섹션 헤더)
    for (const sub of SUBCATEGORY_KEYWORDS) {
      if (line.includes(sub) && line.length < 60) {
        currentSubcategory = sub;
        // 소분류는 중분류 뒤에 오는 텍스트
        const afterSub = line.replace(sub, '').trim();
        if (afterSub && afterSub.length < 30) currentDetail = afterSub;
        break;
      }
    }

    // 데이터 행 파싱: TTI# (8~10자리 숫자/영숫자) + 순번 (3~5자리 숫자) + 모델명 + 설명 + 공급가
    const parsed = parseDataLine(line);
    if (parsed) {
      rows.push({
        ...parsed,
        category: currentCategory,
        subcategory: currentSubcategory,
        detail: currentDetail,
        code: '',
        manageCode: '',
        productDC: 0,
        cost: 0,
        priceA: 0,
        priceRetail: 0,
        priceNaver: 0,
        priceOpen: 0,
        discontinued: '',
        inDate: '',
        ttiStock: '',
        raisedPrice: 0,
        raiseRate: 0,
      });
    }
  }

  return rows;
}

function parseDataLine(line: string): { ttiNum: string; orderNum: string; model: string; description: string; supplyPrice: number } | null {
  // 공급가 (맨 끝, 콤마 포함 숫자): 예 "139,000" 또는 "1,250,000"
  const priceMatch = line.match(/[\s]+([\d,]+)\s*$/);
  if (!priceMatch) return null;

  const priceStr = priceMatch[1].replace(/,/g, '');
  const supplyPrice = parseInt(priceStr);
  if (isNaN(supplyPrice) || supplyPrice < 1000) return null; // 1000원 미만은 무시

  const beforePrice = line.substring(0, line.lastIndexOf(priceMatch[1])).trim();

  // TTI# 감지: 8~10자리 숫자 또는 영숫자 (예: 018621019, DG912345)
  const ttiMatch = beforePrice.match(/\b([A-Z]{0,3}\d{7,10})\b/i);
  if (!ttiMatch) return null;

  const ttiNum = ttiMatch[1];
  const ttiIdx = beforePrice.indexOf(ttiNum);
  const afterTti = beforePrice.substring(ttiIdx + ttiNum.length).trim();

  // 순번 감지: TTI# 바로 뒤 3~5자리 숫자
  const orderMatch = afterTti.match(/^(\d{3,5})\b/);
  if (!orderMatch) return null;

  const orderNum = orderMatch[1];
  const afterOrder = afterTti.substring(afterTti.indexOf(orderNum) + orderNum.length).trim();

  // 나머지: 모델명 + 제품설명
  // 모델명: M12, M18, C12, C18 등으로 시작하거나 48- 등 숫자-숫자 패턴
  // 모델명과 설명 분리: 첫 번째 한글 또는 숫자V/Ah 뒤의 한글이 시작되면 설명
  let model = '';
  let description = '';

  // 모델명 추출: 영문+숫자+하이픈+공백 패턴이 끝나는 지점까지
  const modelMatch = afterOrder.match(/^([A-Z0-9][A-Z0-9\s\-\/().+]*?)(?=\s+[가-힣]|\s*$)/i);
  if (modelMatch) {
    model = modelMatch[1].trim();
    description = afterOrder.substring(model.length).trim();
  } else {
    // 모델명 패턴 안 맞으면 공백으로 분리
    const parts = afterOrder.split(/\s+/);
    if (parts.length >= 2) {
      model = parts[0];
      description = parts.slice(1).join(' ');
    } else {
      model = afterOrder;
    }
  }

  if (!model || model.length < 2) return null;

  return { ttiNum, orderNum, model, description, supplyPrice };
}
