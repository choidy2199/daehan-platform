import { NextResponse } from 'next/server';
import { extractKeywords } from '@/lib/extractKeywords';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReqProduct {
  id: string | number;
  product_name: string;
  category: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { products?: ReqProduct[] };
  const products = body.products ?? [];

  const brand = new Set<string>();
  const product = new Set<string>();
  const category = new Set<string>();

  for (const p of products) {
    const k = extractKeywords(p.product_name ?? '', p.category ?? '');
    k.brand.forEach(b => brand.add(b));
    k.product.forEach(pr => product.add(pr));
    k.category.forEach(c => category.add(c));
  }

  return NextResponse.json({
    keywords: {
      brand: [...brand],
      product: [...product],
      category: [...category],
    },
  });
}
