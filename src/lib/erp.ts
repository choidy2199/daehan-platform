// 경영박사 ERP SOAP API 공통 함수

const ERP_URL = process.env.ERP_URL || 'https://drws20.softcity.co.kr:1448/WS_shop.asmx';
const ERP_USER_KEY = process.env.ERP_USER_KEY || '';

/**
 * SOAP POST 요청을 보내고 XML 응답을 텍스트로 반환
 */
export async function soapCall(method: string, params: Record<string, string>): Promise<string> {
  if (!ERP_USER_KEY) {
    throw new Error('ERP_USER_KEY 환경변수가 설정되지 않았습니다');
  }

  // SOAP Body 파라미터 생성
  const paramXml = Object.entries(params)
    .map(([key, val]) => `<${key}>${escapeXml(val)}</${key}>`)
    .join('');

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${method} xmlns="http://tempuri.org/">
      <pUserKey>${escapeXml(ERP_USER_KEY)}</pUserKey>
      ${paramXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(ERP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `http://tempuri.org/${method}`,
    },
    body: soapEnvelope,
  });

  if (!response.ok) {
    throw new Error(`ERP SOAP 호출 실패: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

/**
 * XML 문자열에서 <Table> 요소들을 파싱하여 객체 배열로 변환
 * diffgram → DocumentElement → Table 구조
 */
export function parseTablesFromXml(xml: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];

  // <Table> ... </Table> 블록들 추출
  const tableRegex = /<Table[^>]*>([\s\S]*?)<\/Table>/gi;
  let match;

  while ((match = tableRegex.exec(xml)) !== null) {
    const tableContent = match[1];
    const row: Record<string, string> = {};

    // 각 필드 추출: <FieldName>value</FieldName>
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(tableContent)) !== null) {
      row[fieldMatch[1]] = fieldMatch[2].trim();
    }

    if (Object.keys(row).length > 0) {
      results.push(row);
    }
  }

  return results;
}

/**
 * SelectItemUrlEnc: 품목 재고/단가 조회
 * pSearch: 검색어 (품목코드, 품목명, 바코드 등)
 */
export async function selectItem(search: string): Promise<Record<string, string>[]> {
  const encoded = encodeURIComponent(search);
  const xml = await soapCall('SelectItemUrlEnc', { pSearch: encoded });
  return parseTablesFromXml(xml);
}

/**
 * NewOrderOut: 매출 전표 등록
 * WSDL 파라미터: cUserKey, info, items, ibgum
 * POST form-urlencoded 방식 (SOAP의 pUserKey/cUserKey 불일치 문제 회피)
 */
export async function callNewOrderOut(info: string, items: string, ibgum: string): Promise<string> {
  if (!ERP_USER_KEY) throw new Error('ERP_USER_KEY 환경변수가 설정되지 않았습니다');

  const formBody = [
    `cUserKey=${encodeURIComponent(ERP_USER_KEY)}`,
    `info=${encodeURIComponent(info)}`,
    `items=${encodeURIComponent(items)}`,
    `ibgum=${encodeURIComponent(ibgum)}`,
  ].join('&');

  console.log(`[callNewOrderOut] POST ${ERP_URL}/NewOrderOut, body길이: ${formBody.length}`);

  const response = await fetch(`${ERP_URL}/NewOrderOut`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
  });

  const text = await response.text();
  console.log(`[callNewOrderOut] HTTP ${response.status}, 응답길이: ${text.length}`);
  console.log(`[callNewOrderOut] 응답: ${text.substring(0, 300)}`);

  if (!response.ok) {
    throw new Error(`ERP HTTP ${response.status}: ${text.substring(0, 200)}`);
  }

  return text;
}

/**
 * XML 특수문자 이스케이프
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
