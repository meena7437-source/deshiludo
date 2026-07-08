import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const { battleId, uid, phone } = await req.json();

    if (!battleId || !uid) {
      return NextResponse.json(
        {
          success: false,
          message: "Battle ID aur user ID required hai",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("join_battle_safe", {
      battle_id_input: Number(battleId),
      joiner_uid_input: uid,
      joiner_name_input: phone || "Player",
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: 400 }
      );
    }

    if (
      data === "battle_not_found" ||
      data === "battle_not_open" ||
      data === "already_joined" ||
      data === "cannot_join_own_battle" ||
      data === "insufficient_balance" ||
      data === "invalid_amount"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            data === "battle_not_found"
              ? "Battle nahi mili"
              : data === "battle_not_open"
              ? "Ye battle ab open nahi hai"
              : data === "already_joined"
              ? "Battle already joined hai"
              : data === "cannot_join_own_battle"
              ? "Apni battle khud join nahi kar sakte"
              : data === "insufficient_balance"
              ? "Wallet balance kam hai"
              : "Invalid battle amount",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Battle joined successfully",
      result: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Join battle failed",
      },
      { status: 500 }
    );
  }
}