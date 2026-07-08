import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "UID missing" },
        { status: 400 }
      );
    }

    const { error: kycError } = await supabase
      .from("kyc")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("uid", uid);

    if (kycError) {
      return NextResponse.json(
        { success: false, message: kycError.message },
        { status: 500 }
      );
    }

    const { error: userError } = await supabase
      .from("users")
      .update({
        kyc_status: "approved",
      })
      .eq("firebase_uid", uid);

    if (userError) {
      return NextResponse.json(
        { success: false, message: userError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "KYC approved",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || "Approve failed" },
      { status: 500 }
    );
  }
}