export type ColumnId =
  | 'photo' | 'code' | 'manageCode' | 'category' | 'name'
  | 'spec' | 'stock' | 'cost' | 'priceA' | 'priceB' | 'priceC'
  | 'storefarm' | 'coupang' | 'openmarket' | 'ssg'
  | 'inStock' | 'outStock' | 'pallet';

export interface ColumnDef {
  id: ColumnId;
  header: string;
  width: number;
  required: boolean;
  sticky?: 'photo' | 'code' | 'manageCode';
  sep?: boolean;
  channel?: 'naver' | 'coupang_mp' | 'gmarket' | 'ssg';
}

export const COLUMNS: ColumnDef[] = [
  { id: 'photo',      header: '사진',     width: 44,  required: true,  sticky: 'photo' },
  { id: 'code',       header: '코드',     width: 60,  required: true,  sticky: 'code' },
  { id: 'manageCode', header: '관리코드', width: 70,  required: true,  sticky: 'manageCode' },
  { id: 'category',   header: '대분류',   width: 64,  required: true },
  { id: 'name',       header: '품명',     width: 80,  required: true },
  { id: 'spec',       header: '규격',     width: 120, required: false },
  { id: 'stock',      header: '재고',     width: 44,  required: false },
  { id: 'cost',       header: '원가',     width: 80,  required: false, sep: true },
  { id: 'priceA',     header: 'A',        width: 90,  required: false },
  { id: 'priceB',     header: 'B',        width: 90,  required: false },
  { id: 'priceC',     header: 'C',        width: 90,  required: false },
  { id: 'storefarm',  header: '스토어팜', width: 200, required: false, sep: true, channel: 'naver' },
  { id: 'coupang',    header: '쿠팡',     width: 200, required: false, channel: 'coupang_mp' },
  { id: 'openmarket', header: '오픈마켓', width: 200, required: false, channel: 'gmarket' },
  { id: 'ssg',        header: 'SSG',      width: 200, required: false, channel: 'ssg' },
  { id: 'inStock',    header: 'IN',       width: 42,  required: false, sep: true },
  { id: 'outStock',   header: 'OUT',      width: 42,  required: false },
  { id: 'pallet',     header: '파레트',   width: 50,  required: false },
];

export const DEFAULT_VISIBLE: ColumnId[] = COLUMNS.map(c => c.id);
