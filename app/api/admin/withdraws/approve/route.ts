import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminLoggedIn } from "../../../../../lib/adminAuth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  try {
    const admin = await isAdminLoggedIn();

    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Unauthorized admin" },
        { status: 401 }
      );
    }

    const { withdrawId } = await req.json();

    if (!withdrawId) {
      return NextResponse.json(
        { success: false, message: "Withdraw ID missing" },
        { status: 400 }
      );
    }

    const { data: withdraw, error: withdrawError } = await supabaseAdmin
      .from("withdraws")
      .select("id, uid, amount, status")
      .eq("id", Number(withdrawId))
      .maybeSingle();

    if (withdrawError) {
      return NextResponse.json(
        { success: false, message: withdrawError.message },
        { status: 500 }
      );
    }

    if (!withdraw) {
      return NextResponse.json(
        { success: false, message: "Withdraw not found" },
        { status: 404 }
      );
    }

    if (withdraw.status !== "pending") {
      return NextResponse.json(
        { success: false, message: "Withdraw already processed" },
        { status: 409 }
      );
    }

    if (Number(withdraw.amount) < 100) {
      return NextResponse.json(
        { success: false, message: "Minimum withdraw amount ₹100 hai" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("withdraws")
      .update({
        status: "approved",
        wallet_type: "winning",
      })
      .eq("id", Number(withdrawId))
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Withdraw already processed or not found" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Withdraw approved successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Server error" },
      { status: 500 }
    );
  }
}