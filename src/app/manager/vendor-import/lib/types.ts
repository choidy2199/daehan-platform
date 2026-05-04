// 거래처 (mw_clients localStorage)
// DevTools에서 확인된 실제 스키마 (2026-05-05)
export interface Client {
  code: string;              // 내부 seq (예: "4")
  name: string;              // 거래처명
  ceo: string;               // 대표자
  bizNo: string;             // 사업자번호
  phone: string;
  mobile: string;
  fax: string;
  email: string;
  address: string;
  zip: string;
  bizType: string;           // 업태 (예: "제조,도매")
  bizItem: string;           // 종목 (예: "기계공구")
  manager: string;           // 담당자
  manageCode: string;        // 경영박사 CODE2
  kind: number;              // 거래처 유형 (1/2/3)
  priceGrade: number;        // 가격 등급 (현 단계 미사용)
  balance: number;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  createdDate: string;
}

// 일반제품 (mw_gen_products localStorage)
// 코드 grep + addGenProduct/엑셀 import에서 확정된 19필드
// imageUrl: Phase 5-d에서 신규 추가 예정 (현재는 optional)
export interface GenProduct {
  code: string;              // 내부 코드
  manageCode: string;        // 관리코드(바코드) — 경영박사 CODE2
  category: string;          // 대분류 (예: "HPT-전동공구(디월트)")
  model: string;             // 모델명 (= "품명")
  description: string;       // 제품설명 (= "규격")
  supplyPrice: number;       // 항상 0 (사실상 미사용)
  cost: number;              // 원가
  priceA: number;            // 판매가
  priceNaver: number;        // 스토어팜
  priceOpen: number;         // 오픈마켓
  inQty: number;             // IN 기준 수량
  inPrice: number;           // IN 단가
  outQty: number;            // OUT 기준 수량
  outPrice: number;          // OUT 단가
  palletQty: number;         // 파레트 기준 수량
  palletPrice: number;       // 파레트 단가
  memo: string;
  inDate: string;
  importPrice: number | null; // 수입가 USD
  source: 'general';
  imageUrl?: string;         // Phase 5-d 신규 (없으면 placeholder 표시)
}

// 가격 등급 (자동 단가 적용)
export type PriceTier = 'in' | 'out' | 'pallet';

// 장바구니 아이템
export interface CartItem {
  productCode: string;       // GenProduct.code 참조
  quantity: number;
  appliedTier: PriceTier;    // 자동 결정 (palletQty 이상 → pallet, outQty 이상 → out, 그 외 → in)
  unitPrice: number;         // appliedTier에 따른 단가
}

// 발주 이력 (mw_vendor_imports localStorage, Phase 6 확정 시 push)
export interface VendorOrder {
  id: string;                // uuid
  date: string;              // ISO date
  clientCode: string;        // Client.code
  clientName: string;        // 스냅샷
  brand: string;             // 발주 시 브랜드 (sub-tab 선택값)
  items: CartItem[];
  totalAmount: number;       // 합계 (KRW)
  memo?: string;
}
