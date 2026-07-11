import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get("deshiludo_admin")?.value;

    if (isAdmin !== "yes") {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized admin access",
        },
        {
          status: 401,
        }
      );
    }

    const [usersResult, walletsResult, transactionsResult] =
      await Promise.all([
        supabaseAdmin
          .from("users")
          .select(
            "id,firebase_uid,phone,name,username,referral_code,referred_by,kyc_status,total_battles,total_wins,created_at"
          )
          .order("created_at", { ascending: false }),

        supabaseAdmin
          .from("wallets")
          .select(
            "uid,balance,first_deposit_bonus_given,referral_bonus_given,referral_code,referred_by,updated_at"
          ),

        supabaseAdmin
          .from("wallet_transactions")
          .select(
            "id,uid,type,title,description,amount,balance_after,status,battle_id,deposit_id,withdraw_id,created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

    if (usersResult.error) {
      throw usersResult.error;
    }

    if (walletsResult.error) {
      throw walletsResult.error;
    }

    if (transactionsResult.error) {
      throw transactionsResult.error;
    }

    const walletMap = new Map(
      (walletsResult.data || []).map((wallet) => [wallet.uid, wallet])
    );

    const users = (usersResult.data || []).map((user) => ({
      ...user,
      wallet: walletMap.get(user.firebase_uid) || null,
    }));

    return NextResponse.json(
      {
        success: true,
        users,
        transactions: transactionsResult.data || [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Secure admin users API error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Admin users data load failed";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 500,
      }
    );
  }
}