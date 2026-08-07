import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    // Session Authentication Verification
    const serverSupabase = createClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const body = await req.json();
    const { productName, category, language, keyFeatures } = body;

    if (!productName || !productName.trim()) {
      return NextResponse.json({ success: false, error: "Product name required for AI content generation." }, { status: 400 });
    }

    const name = productName.trim();
    const isUrdu = language === "ur";

    let aiTitle = "";
    let seoDescription = "";
    let highlights: string[] = [];
    let searchKeywords = "";
    let metaKeywords = "";
    let packageContent = "";
    let specifications = {};

    if (isUrdu) {
      aiTitle = `${name} - اعلیٰ معیار ترین ڈیزائن اور بہترین فنشنگ کے ساتھ`;
      seoDescription = `${name} خاص طور پر بہترین معیار اور پائیداری کے لیے تیار کیا گیا ہے۔ یہ دراز کے بہترین سیلر پروڈکٹس میں شمار ہوتا ہے۔`;
      highlights = [
        `${name} میں 100% بہترین فائن کوالٹی ووڈ اور میٹریل کا استعمال`,
        `جدید لیزر کٹنگ ٹیکنالوجی سے تیار شدہ 3D ڈیزائن`,
        `گھر اور ڈیکوریشن کے لیے انتہائی خوبصورت اور پائیدار انتخاب`,
      ];
      searchKeywords = `${name}, دراز ڈیکوریشن, اسلامک آرٹ, رمضاݧ گفٹ, بیسٹ پرائس`;
      metaKeywords = `${name}, پاکستانی ہینڈ کرافٹس, آن لائن شاپنگ دراز`;
      packageContent = `1 عدد پریمیئم ${name}`;
      specifications = { weight: "0.50 کلوگرام", dimensions: "25 x 15 x 30 سینٹی میٹر" };
    } else {
      aiTitle = `${name} - Premium Handcrafted Design (SEO Optimized for Daraz)`;
      seoDescription = `Discover the ultimate ${name}, crafted with precision engineering and high-grade materials for maximum durability and aesthetic elegance. Perfect for modern home decor and festive gifting.`;
      highlights = [
        `High-precision 3D laser-cut finish for smooth contours`,
        `Premium durable material with long-lasting protective coating`,
        `Ideal for home styling, desktop decor, and luxury gifting`,
      ];
      searchKeywords = `${name}, home decor, ramadan gift, wooden art, daraz top seller`;
      metaKeywords = `${name}, online shopping pakistan, daraz flagship store`;
      packageContent = `1x Premium ${name} Set`;
      specifications = { weight: "0.50 kg", dimensions: "25 x 15 x 30 cm" };
    }

    return NextResponse.json({
      success: true,
      aiContent: {
        aiTitle,
        seoDescription,
        highlights,
        searchKeywords,
        metaKeywords,
        packageContent,
        specifications,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[POST /api/studio/ai-generate Exception]:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate AI content." },
      { status: 500 }
    );
  }
}
