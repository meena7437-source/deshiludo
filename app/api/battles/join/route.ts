import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function POST(req: Request) {
  try {
    const { battleId, uid, phone } = await req.json();

    if (!battleId || !uid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("join_battle_safe", {
      battle_id_input: Number(battleId),
      joiner_phone_input: phone || "Player",
      joiner_uid_input: uid,
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

    switch (data) {
      case "joined":
        return NextResponse.json({
          success: true,
          message: "Battle joined successfully",
        });

      case "battle_not_found":
        return NextResponse.json(
          {
            success: false,
            message: "Battle not found",
          },
          { status: 400 }
        );

      case "battle_not_open":
        return NextResponse.json(
          {
            success: false,
            message: "Battle is not open",
          },
          { status: 400 }
        );

      case "cannot_join_own_battle":
        return NextResponse.json(
          {
            success: false,
            message: "You cannot join your own battle",
          },
          { status: 400 }
        );

      case "already_joined":
        return NextResponse.json(
          {
            success: false,
            message: "Battle already joined",
          },
          { status: 400 }
        );

      case "insufficient_balance":
        return NextResponse.json(
          {
            success: false,
            message: "Insufficient balance",
          },
          { status: 400 }
        );

      default:
        return NextResponse.json({
          success: true,
          message: data,
        });
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}