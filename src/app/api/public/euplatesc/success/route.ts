import { NextResponse } from "next/server";

function target(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("order_id");
  return `${url.origin}/checkout/success${orderId ? `?order_id=${orderId}` : ""}`;
}

export async function POST(req: Request) {
  return NextResponse.redirect(target(req), 303);
}

export async function GET(req: Request) {
  return NextResponse.redirect(target(req), 303);
}
