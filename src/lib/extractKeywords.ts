export interface ExtractedKeywords {
  brand: string[];
  product: string[];
  category: string[];
}

const CATEGORY_SUPPLEMENT: Record<string, string[]> = {
  '파워툴': ['전동공구'],
  '수공구': ['툴세트'],
  '팩아웃': ['수납공구'],
  '드릴비트': ['홀쏘'],
  '전동공구': ['컷팅휠'],
  '액세서리': ['공구액세서리'],
};

export function extractKeywords(
  productName: string,
  category: string,
): ExtractedKeywords {
  const brand = new Set<string>();
  const product = new Set<string>();
  const cat = new Set<string>();

  const words = (productName ?? '').trim().split(/\s+/).filter(w => w.length > 0);
  const brandWord = words[0];
  if (brandWord) brand.add(brandWord);

  if (brandWord && words[1]) {
    product.add(`${brandWord} ${words[1]}`);
    product.add(words[1]);
  }

  const modelWord = words.slice(1).find(w => /\d/.test(w));
  if (modelWord && brandWord) {
    product.add(`${brandWord} ${modelWord}`);
    product.add(modelWord);
  }

  const catTrim = (category ?? '').trim();
  if (catTrim) {
    cat.add(catTrim);
    const supp = CATEGORY_SUPPLEMENT[catTrim];
    if (supp) for (const s of supp) cat.add(s);
  }

  return {
    brand: [...brand].map(s => s.trim()).filter(Boolean),
    product: [...product].map(s => s.trim()).filter(Boolean),
    category: [...cat].map(s => s.trim()).filter(Boolean),
  };
}
