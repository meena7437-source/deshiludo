import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("kyc")
      .select("id, uid, phone, aadhaar_path, pan_path, status, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      users: data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "KYC load failed" },
      { status: 500 }
    );
  }
}