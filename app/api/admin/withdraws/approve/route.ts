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

    const { data, error } = await supabaseAdmin.rpc("approve_withdraw_safe", {
      withdraw_id_input: Number(withdrawId),
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    if (data === "already_processed") {
      return NextResponse.json(
        { success: false, message: "Withdraw already processed" },
        { status: 409 }
      );
    }

    if (data === "not_found") {
      return NextResponse.json(
        { success: false, message: "Withdraw not found" },
        { status: 404 }
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