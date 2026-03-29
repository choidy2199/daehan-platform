# 네이버 커머스 API 가이드

## 기본 정보
- API 기본 URL: https://api.commerce.naver.com/external
- 인증 방식: OAuth 2.0 (Access Token)
- 토큰 발급: Client ID + Client Secret → Access Token 발급
- 토큰 위치: .env 파일 → NAVER_CLIENT_ID, NAVER_CLIENT_SECRET

---

## 인증 방식

```javascript
// Access Token 발급
async function getNaverToken() {
  const timestamp = Date.now();
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  // HMAC-SHA256 서명
  const crypto = await import('crypto');
  const signature = crypto.default
    .createHmac('sha256', clientSecret)
    .update(`${clientId}_${timestamp}`)
    .digest('base64');

  const res = await fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      timestamp: timestamp,
      client_secret_sign: signature,
      grant_type: 'client_credentials',
      type: 'SELF',
    }),
  });

  const data = await res.json();
  return data.access_token; // 1시간 유효
}

// API 호출 공통 함수
async function naverApi(method, path, body = null) {
  const token = await getNaverToken();
  const res = await fetch(`https://api.commerce.naver.com/external${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : null,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`네이버 API 오류: ${res.status}`);
  return await res.json();
}
```

---

## 1. 상품 관리

### 상품 조회
```javascript
// 상품 목록 조회
const products = await naverApi('POST', '/v1/products/search', {
  page: 1,
  size: 100,
  statusTypes: ['SALE'], // SALE, SUSPENSION, OUTOFSTOCK
});

// 특정 상품 조회
const product = await naverApi('GET', `/v2/products/origin-products/${originProductNo}`);
```

### 상품 등록
```javascript
const newProduct = await naverApi('POST', '/v2/products', {
  originProduct: {
    statusType: 'SALE',
    saleType: 'NEW',
    leafCategoryId: '카테고리ID',
    name: '상품명',
    detailContent: '상세설명 HTML',
    images: {
      representativeImage: { url: '대표이미지URL' },
      optionalImages: [{ url: '추가이미지URL' }],
    },
    salePrice: 50000,       // 판매가
    stockQuantity: 100,     // 재고
    deliveryInfo: {
      deliveryType: 'DELIVERY',
      deliveryAttributeType: 'NORMAL',
      deliveryFee: {
        deliveryFeeType: 'FREE', // FREE, CHARGE
      },
    },
  },
});
```

### 가격 수정 (단일)
```javascript
await naverApi('PUT', `/v2/products/origin-products/${originProductNo}`, {
  originProduct: {
    salePrice: 55000, // 새 판매가
  },
});
```

### 가격 일괄 수정
```javascript
await naverApi('PUT', '/v1/products/origin-products/bulk-update', {
  originProductNos: ['12345', '67890'],
  salePrice: 55000,
});
```

### 재고 수정
```javascript
await naverApi('PUT', `/v1/products/origin-products/${originProductNo}/option-stock`, {
  optionStocks: [
    { optionId: '옵션ID', stockQuantity: 50 },
  ],
});
```

### 상품 상태 변경
```javascript
// 판매중지
await naverApi('PUT', `/v1/products/origin-products/${originProductNo}/change-status`, {
  statusType: 'SUSPENSION', // SALE, SUSPENSION, OUTOFSTOCK
});
```

### 이미지 업로드
```javascript
// FormData로 이미지 업로드
const formData = new FormData();
formData.append('imageFiles', imageFile);

const token = await getNaverToken();
const res = await fetch('https://api.commerce.naver.com/external/v1/product-images/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});
const { images } = await res.json();
// images[0].url → 업로드된 이미지 URL
```

---

## 2. 주문 관리

### 신규 주문 조회
```javascript
// 변경된 주문 상태 조회 (최근 변경분)
const changedOrders = await naverApi(
  'GET',
  '/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=2026-03-27T00:00:00.000Z'
);

// 주문 상세 조회
const orders = await naverApi('POST', '/v1/pay-order/seller/product-orders/query', {
  productOrderIds: ['주문상품번호1', '주문상품번호2'],
});
```

### 발주 확인
```javascript
await naverApi('POST', '/v1/pay-order/seller/product-orders/confirm', {
  productOrderIds: ['주문상품번호'],
});
```

### 발송 처리
```javascript
await naverApi('POST', '/v1/pay-order/seller/product-orders/dispatch', {
  dispatchProductOrders: [{
    productOrderId: '주문상품번호',
    deliveryMethod: 'DELIVERY',
    deliveryCompanyCode: 'CJGLS', // 택배사 코드
    trackingNumber: '운송장번호',
    dispatchDate: '2026-03-27T10:00:00.0',
  }],
});
```

### 취소/반품/교환 처리
```javascript
// 취소 요청
await naverApi('POST', `/v1/pay-order/seller/product-orders/${productOrderId}/claim/cancel/request`, {
  cancelReason: 'SELLER_REASON',
  cancelReasonContent: '취소 사유',
});

// 반품 승인
await naverApi('POST', `/v1/pay-order/seller/product-orders/${productOrderId}/claim/return/approve`);

// 교환 발송 처리
await naverApi('POST', `/v1/pay-order/seller/product-orders/${productOrderId}/claim/exchange/dispatch`, {
  deliveryCompanyCode: 'CJGLS',
  trackingNumber: '운송장번호',
});
```

---

## 3. 문의 관리

### 문의 목록 조회
```javascript
const qnas = await naverApi('GET', '/v1/contents/qnas?page=1&size=20&answered=false');
// answered: false → 미답변 문의만
```

### 문의 답변 등록
```javascript
await naverApi('PUT', `/v1/contents/qnas/${questionId}`, {
  answer: '안녕하세요. 문의 주셔서 감사합니다...',
});
```

---

## 4. 정산 조회

```javascript
// 일별 정산 조회
const settle = await naverApi('GET',
  '/v1/pay-settle/settle/daily?startDate=2026-03-01&endDate=2026-03-27'
);

// 부가세 신고 내역
const vat = await naverApi('GET',
  '/v1/pay-settle/vat/daily?startDate=2026-03-01&endDate=2026-03-27'
);
```

---

## 5. 판매자 정보

```javascript
// 판매자 계정 정보
const account = await naverApi('GET', '/v1/seller/account');

// 채널 정보 (스마트스토어 URL 등)
const channels = await naverApi('GET', '/v1/seller/channels');
```

---

## 6. 경영박사 ↔ 네이버 연동 시나리오

### A. 네이버 주문 → 경영박사 전표 자동 생성
```
1. GET /v1/pay-order/seller/product-orders/last-changed-statuses
2. 신규 주문 필터링 (상태: PAY_DONE)
3. SelectGuraeUrlEnc → 거래처 코드 확인
4. NewOrderOut → 매출 전표 자동 생성
5. POST confirm → 발주 확인 처리
```

### B. 경영박사 단가 수정 → 네이버 가격 자동 반영
```
1. 관리자 화면에서 단가 수정
2. SqlExcute (update item) → 경영박사 OUTA 수정
3. PUT /v2/products/origin-products/{no} → 네이버 판매가 수정
```

### C. 경영박사 재고 → 네이버 재고 자동 동기화
```
1. SelectItemUrlEnc → 경영박사 JEGO (현재고) 조회
2. PUT /v1/products/origin-products/{no}/option-stock → 네이버 재고 반영
```

### D. 상품 신규 등록 (경영박사 + 네이버 동시)
```
1. 관리자 화면에서 상품 정보 입력
2. POST /v1/product-images/upload → 이미지 업로드
3. POST /v2/products → 네이버 상품 등록
4. SqlExcute (insert item) → 경영박사 품목 등록
```

---

## 환경변수 (.env 추가 항목)
```
NAVER_CLIENT_ID=네이버_클라이언트_ID
NAVER_CLIENT_SECRET=네이버_클라이언트_시크릿
NAVER_STORE_ID=스마트스토어_ID
```

## 주요 상태 코드
| 주문 상태 | 의미 |
|---------|------|
| PAY_DONE | 결제 완료 (신규 주문) |
| PAYED | 발주 확인 완료 |
| DELIVERING | 배송 중 |
| DELIVERED | 배송 완료 |
| PURCHASE_DECIDED | 구매 확정 |
| CANCELED | 취소 완료 |
| RETURNED | 반품 완료 |

## 주요 택배사 코드
| 코드 | 택배사 |
|------|------|
| CJGLS | CJ대한통운 |
| EPOST | 우체국택배 |
| HANJIN | 한진택배 |
| LOTTE | 롯데택배 |
| LOGEN | 로젠택배 |
