import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminLoggedIn } from "../../../../../lib/adminAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const admin = await isAdminLoggedIn();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized admin" },
        { status: 401 }
      );
    }

    const { uid } = await req.json();

    if (!uid) {
      return NextResponse.json(
        { success: false, message: "UID missing" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("reject_kyc_safe", {
      uid_input: uid,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (data === "already_processed") {
      return NextResponse.json(
        { success: false, message: "KYC already processed" },
        { status: 409 }
      );
    }

    if (data === "not_found") {
      return NextResponse.json(
        { success: false, message: "KYC not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "KYC rejected",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Reject failed" },
      { status: 500 }
    );
  }
}