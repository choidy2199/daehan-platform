import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// 대분류 매핑
const CATEGORY_KEYWORDS: [string, string][] = [
  ['파워툴', '파워툴'], ['POWER TOOL', '파워툴'],
  ['수공구', '수공구'], ['HAND TOOL', '수공구'],
  ['팩아웃', '팩아웃'], ['PACKOUT', '팩아웃'],
  ['액세서리', '악세사리'], ['ACCESSORY', '악세사리'],
  ['SDS 드릴비트', '드릴비트'], ['드릴비트', '드릴비트'], ['MX FUEL', '파워툴'],
  ['엠파이어', '악세사리'], ['EMPIRE', '악세사리'],
];

// 중분류 키워드 (길이 긴 것부터 매칭)
const SUBCATEGORY_LIST = [
  '파워툴 전용 액세서리',
  '12V 브러쉬리스', '18V 브러쉬리스',
  '12V 브러쉬', '18V 브러쉬',
  '12V FUEL', '18V FUEL',
  '12V 기타', '18V 기타',
  'MX FUEL', 'SDS MAX', 'SDS +',
  '임팩 소켓', '소프트 백', '툴박스 액세서리',
  '측정공구', '작업공구', '안전장비', '스토리지',
  '툴박스', '벽걸이', '소켓', '비트', '블레이드',
  '홀소', '밴드소', '레시프로', '직소', '원형톱',
  '래칫', '플라이어', '커터', '드릴비트', '엠파이어',
  'L4', 'IR', '유선', '기타',
];

interface ParsedRow {
  ttiNum: string; orderNum: string; model: string; description: string;
  supplyPrice: number; category: string; subcategory: string; detail: string;
  code: string; manageCode: string; productDC: number; cost: number;
  priceA: number; priceRetail: number; priceNaver: number; priceOpen: number;
  discontinued: string; inDate: string; ttiStock: string; raisedPrice: number; raiseRate: number;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 });

    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    const text: string = pdfData.text;

    console.log(`[PDF Parse] 텍스트: ${text.length}자, ${pdfData.numpages}페이지`);

    const rows = parsePdfText(text);
    console.log(`[PDF Parse] 파싱: ${rows.length}행`);

    // 50행 미만이면 디버그 정보 포함
    if (rows.length < 50) {
      return NextResponse.json({
        rows,
        pageCount: pdfData.numpages,
        debug: {
          totalTextLength: text.length,
          rawTextSample: text.substring(0, 5000),
          lineCount: text.split('\n').length,
        }
      });
    }

    return NextResponse.json({ rows, pageCount: pdfData.numpages });
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

  // 헤더/제목 건너뛰기 패턴
  const skipPatterns = [
    /^중분류\s+소분류/, /^TTI#/, /^순번/, /^모델명/, /^제품\s*설명/, /^대리점/,
    /^공급가/, /^\d{4}년/, /^밀워키/, /^가격\s*안내/, /^페이지/, /^Page\s+\d/i,
    /^Milwaukee/i, /^TTI Korea/i, /^본\s*가격/, /^가격표/,
  ];

  for (const line of lines) {
    // 헤더/제목 건너뛰기
    if (skipPatterns.some(p => p.test(line))) continue;
    if (line.length < 10) continue;

    // 대분류 감지 (짧은 줄에서 키워드)
    if (line.length < 40) {
      for (const [kw, cat] of CATEGORY_KEYWORDS) {
        if (line.toUpperCase().includes(kw.toUpperCase())) {
          currentCategory = cat;
          break;
        }
      }
    }

    // 데이터 행 파싱 시도
    const parsed = parseDataLine(line);
    if (parsed) {
      // TTI# 앞 텍스트에서 중분류/소분류 추출
      const prefix = extractPrefix(line, parsed.ttiNum);
      if (prefix.subcategory) currentSubcategory = prefix.subcategory;
      if (prefix.detail) currentDetail = prefix.detail;

      rows.push({
        ...parsed,
        category: currentCategory,
        subcategory: currentSubcategory,
        detail: currentDetail,
        code: '', manageCode: '', productDC: 0, cost: 0,
        priceA: 0, priceRetail: 0, priceNaver: 0, priceOpen: 0,
        discontinued: '', inDate: '', ttiStock: '', raisedPrice: 0, raiseRate: 0,
      });
    }
  }

  return rows;
}

function parseDataLine(line: string): { ttiNum: string; orderNum: string; model: string; description: string; supplyPrice: number } | null {
  // 1. 공급가 추출 (맨 끝 콤마 포함 숫자)
  const priceMatch = line.match(/([\d,]+)\s*$/);
  if (!priceMatch) return null;
  const priceStr = priceMatch[1].replace(/,/g, '');
  const supplyPrice = parseInt(priceStr);
  if (isNaN(supplyPrice) || supplyPrice < 1000) return null;

  const beforePrice = line.substring(0, line.lastIndexOf(priceMatch[1])).trim();

  // 2. TTI# 추출: 6~12자리 숫자, 또는 숫자+영문 조합 (예: 018621019, 001998878DG9, 129306262)
  const ttiMatch = beforePrice.match(/\b(\d{6,12}[A-Z]{0,3}\d{0,3})\b/i);
  if (!ttiMatch) return null;

  const ttiNum = ttiMatch[1];
  const ttiIdx = beforePrice.indexOf(ttiNum);
  const afterTti = beforePrice.substring(ttiIdx + ttiNum.length).trim();

  // 3. 순번 추출: TTI# 바로 뒤 1~5자리 숫자
  const orderMatch = afterTti.match(/^(\d{1,5})\b/);
  if (!orderMatch) return null;

  const orderNum = orderMatch[1];
  const afterOrder = afterTti.substring(orderMatch[0].length).trim();

  // 4. 모델명 + 제품설명 분리
  const { model, description } = splitModelDescription(afterOrder);
  if (!model || model.length < 2) return null;

  return { ttiNum, orderNum, model, description, supplyPrice };
}

function splitModelDescription(text: string): { model: string; description: string } {
  if (!text) return { model: '', description: '' };

  // 패턴1: M12, M18, C12, C18, L4, IR, MXF 등으로 시작
  const milwaukeeMatch = text.match(/^((?:M|C)(?:12|18)\s+[A-Z0-9][A-Z0-9\-\/().+\s]*?)(?=\s+[가-힣\d])/i);
  if (milwaukeeMatch) {
    return { model: milwaukeeMatch[1].trim(), description: text.substring(milwaukeeMatch[0].length).trim() };
  }

  // 패턴2: 숫자-숫자 패턴 (48-22-5507 등)
  const codeMatch = text.match(/^(\d{2}-\d{2}-\d{3,5}[A-Z]*)/);
  if (codeMatch) {
    return { model: codeMatch[1].trim(), description: text.substring(codeMatch[0].length).trim() };
  }

  // 패턴3: L4, IR, MXF 등
  const prefixMatch = text.match(/^((?:L4|IR|MXF|MXFC|MX)\s+[A-Z0-9][A-Z0-9\-\/().+\s]*?)(?=\s+[가-힣\d])/i);
  if (prefixMatch) {
    return { model: prefixMatch[1].trim(), description: text.substring(prefixMatch[0].length).trim() };
  }

  // 패턴4: 영문으로 시작하고 한글이 나오기 전까지
  const genericMatch = text.match(/^([A-Z0-9][A-Z0-9\s\-\/().+]*?)(?=\s+[가-힣])/i);
  if (genericMatch && genericMatch[1].trim().length >= 2) {
    return { model: genericMatch[1].trim(), description: text.substring(genericMatch[0].length).trim() };
  }

  // 폴백: 첫 공백 기준 분리
  const spaceIdx = text.indexOf(' ');
  if (spaceIdx > 1) {
    return { model: text.substring(0, spaceIdx), description: text.substring(spaceIdx + 1) };
  }

  return { model: text, description: '' };
}

function extractPrefix(line: string, ttiNum: string): { subcategory: string; detail: string } {
  const ttiIdx = line.indexOf(ttiNum);
  if (ttiIdx <= 0) return { subcategory: '', detail: '' };

  const prefix = line.substring(0, ttiIdx).trim();
  if (!prefix) return { subcategory: '', detail: '' };

  // 중분류 키워드 매칭 (긴 것부터)
  let subcategory = '';
  let detail = '';
  for (const sub of SUBCATEGORY_LIST) {
    if (prefix.includes(sub)) {
      subcategory = sub;
      detail = prefix.replace(sub, '').trim();
      break;
    }
  }

  if (!subcategory && prefix.length < 30) {
    detail = prefix;
  }

  return { subcategory, detail };
}
