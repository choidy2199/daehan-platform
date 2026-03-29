# 경영박사 WS_Shop API 매뉴얼

## 📌 웹서비스 URL
| 구분 | URL |
|------|-----|
| 독립(기본) | https://drws.softcity.co.kr:1447/WS_Shop.asmx |
| LB(권장) | https://drws20.softcity.co.kr:1448/WS_Shop.asmx |
| 공식 문서 | https://www.softcity.co.kr/comm/board/dr_help_FAQcs.asp?autokey=2621 |

---

## 📌 공통 규칙
- **cUserKey(접속키)** : 모든 메소드의 첫 번째 파라미터에 항상 입력
- 리턴값이 `"Error:"` 로 시작 → 오류 / 그 외 → 정상
- **특수 구분자** : `|` (Vertical Bar), `$` (Dollar Sign)
- 조회 API는 **UTF-8 URL인코딩** 필수

---

## 📋 메소드 목록

### 1. CheckService — 접속키 확인
```
WS.CheckService(접속키)
```
- 접속키가 유효한지 확인하는 메소드

---

### 2. SqlExcute — 거래처/품목 등록·수정·삭제
```
WS.SqlExcute(접속키, 명령구분, 테이블명, 관리코드, Base64인코딩SQL)
```

| 파라미터 | 값 |
|----------|-----|
| 명령구분 | insert / update / delete |
| 테이블명 | gurae(거래처) / item(품목) |

**거래처 등록 예시:**
```javascript
const SQL = "(CODE2,NAME,KIND,SAUP,BIGO3) VALUES ('관리코드','거래처명','1','123-12-12345','비고')";
const base64SQL = btoa(unescape(encodeURIComponent(SQL)));
// WS.SqlExcute(접속키, "insert", "gurae", 관리코드, base64SQL)
```

**품목 등록 예시:**
```javascript
const SQL = "(CODE2,PARTCODE,ITEM,GYU,BIGO,dDATE,...) VALUES ('관리코드','대분류코드','품명','규격','비고','2015.11.26',...)";
const base64SQL = btoa(unescape(encodeURIComponent(SQL)));
// WS.SqlExcute(접속키, "insert", "item", 관리코드, base64SQL)
```

---

### 3. NewOrder — 주문등록 (입금포함)
```
NewOrder(사용자키, info, items, ibgum)
```

| 파라미터 | 형식 | 설명 |
|----------|------|------|
| info | `관리코드\|대표비고\|납품예정일(16.01.05)\|전표번호` | 거래처 정보 |
| items | `품목코드$수량$단가$금액$부가세$비고\|품목코드$...` | 품목 리스트 |
| ibgum | `입금액\|대체코드(통장/카드)\|관리코드\|입금비고` | 입금내역 |

**파생 메소드:**
| 메소드 | 추가시점 | 설명 |
|--------|----------|------|
| NewOrder_Insert_Gurae | 2016.07 | 거래처코드 없으면 자동 거래처등록 |
| NewOrderOut | 2021.05 | 매출 전표로 발생 |
| NewOrderIn | 2021.05 | 매입 전표로 발생 |
| NewOrderInPayment | 2023.09 | 매입전표 + 같은 전표번호로 출금생성 |
| NewOrderOutPayment | 2023.09 | 매출전표 + 같은 전표번호로 입금생성 |

---

### 4. NewOrderJejo — 제조전표 등록 (2022.10 추가)
```
NewOrderJejo(사용자키, info, items)
```

| 계정값 | 의미 |
|--------|------|
| 15 | 본사제조 |
| 99 | 본사소모 |
| 16 | 지점제조 |
| 98 | 지점소모 |

- info: `거래처관리코드|대표비고|납품예정일|전표번호`
- items: `계정$품목관리코드$수량$단가$금액$부가세$비고계정$...`

---

### 5. NewOrderLoss — 재고손익 전표등록 (2025.07 추가)
```
NewOrderLoss(사용자키, 품목리스트)
```
- info: `"대표비고1|대표비고2"`
- items: `품목코드$수량$단가$금액$부가세$비고`

**웹서비스 URL:**
- LB: https://drws20.softcity.co.kr:1448/WS_Shop.asmx
- 독립: https://drws.softcity.co.kr:1447/WS_Shop.asmx

---

### 6. StatusOrder — 주문조회
```
StatusOrder(사용자키, 주문번호)
```
**리턴값:** `주문번호|진행상태|수주수량|출고수량|미출고수량`

---

### 7. SelectGuraeUrlEnc — 거래처 목록 조회
```
GET https://drws.softcity.co.kr:1447/WS_shop.asmx?op=SelectGuraeUrlEnc
```

**파라미터 (3개, UTF-8 URL인코딩 필수):**
| 파라미터 | 설명 | 예시 |
|----------|------|------|
| cUserKey | 접속키 | - |
| UrlEnc_FIELD | 조회할 필드 | `*` 또는 `name,tel` |
| UrlEnc_WHERE | 조건절 | `name='홍길동'` |

**실제 작동 쿼리:** `select [FIELD] from gurae where [WHERE]`  
**리턴값:** XML 테이블 형식

---

### 8. SelectItemUrlEnc — 품목별 현재고 조회
```
GET https://drws.softcity.co.kr:1447/WS_shop.asmx?op=SelectItemUrlEnc
```

**파라미터:**
| 파라미터 | 설명 |
|----------|------|
| cUserKey | 접속키 |
| UrlEnc_WHERE | 품목관리코드 (복수 시 `'10001','10002','10003'`) |

- 홑따옴표(`'`) 사용, 복수 품목은 콤마(`,`)로 구분
- 파생: `SelectItemUrlEncBonsaOnly` — 본사재고만 조회 (2022.04 추가)

---

### 9. 품목별 적정재고 조회
- **8번 현재고 조회와 동일한 방법** 사용

---

## 🔧 JavaScript 연동 예시

### 거래처 조회
```javascript
async function getGurae(cUserKey, 상호명) {
  const field = encodeURIComponent('*');
  const where = encodeURIComponent(`name='${상호명}'`);
  const url = `https://drws.softcity.co.kr:1447/WS_shop.asmx?op=SelectGuraeUrlEnc&cUserKey=${cUserKey}&UrlEnc_FIELD=${field}&UrlEnc_WHERE=${where}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('네트워크 오류');
    return await res.text(); // XML 리턴
  } catch (error) {
    console.error('거래처 조회 실패:', error);
    throw error;
  }
}
```

### 품목 재고 조회
```javascript
async function getItemStock(cUserKey, 품목코드배열) {
  // 예: ['10001','10002','10003']
  const where = encodeURIComponent(
    품목코드배열.map(c => `'${c}'`).join(',')
  );
  const url = `https://drws.softcity.co.kr:1447/WS_shop.asmx?op=SelectItemUrlEnc&cUserKey=${cUserKey}&UrlEnc_WHERE=${where}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('네트워크 오류');
    return await res.text(); // XML 리턴
  } catch (error) {
    console.error('재고 조회 실패:', error);
    throw error;
  }
}
```

### 주문 등록
```javascript
async function createOrder(cUserKey, 거래처코드, 품목목록, 입금정보) {
  const info = `${거래처코드}|대표비고|2026.03.25|`;
  const items = 품목목록.map(p => 
    `${p.code}$${p.qty}$${p.price}$${p.amount}$${p.vat}$${p.memo}`
  ).join('|');
  const ibgum = `${입금정보.amount}|통장|${입금정보.code}|${입금정보.memo}`;
  
  // SOAP 방식으로 호출
  // WS.NewOrder(cUserKey, info, items, ibgum)
}
```

---

## 🔄 카카오톡 연동 시나리오

```
고객 카카오 채널 메시지 입력
        ↓
카카오 챗봇 서버 (webhook)
        ↓
경영박사 API 호출
├── "재고 확인" → SelectItemUrlEnc
├── "거래처 조회" → SelectGuraeUrlEnc
├── "주문하기" → NewOrder / NewOrderIn
└── "주문 상태" → StatusOrder
        ↓
결과를 카카오 응답 포맷으로 변환
        ↓
고객에게 메시지 전달
```

---

## ⚠️ 보안 주의사항
- cUserKey는 코드에 직접 하드코딩 금지
- 환경변수(.env) 또는 서버 설정에 별도 보관
- 클라이언트(브라우저)에 노출 금지 → 반드시 서버사이드에서 호출
