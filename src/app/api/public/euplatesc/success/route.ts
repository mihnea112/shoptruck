import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(url.origin + "/checkout/success", 303);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(url.origin + "/checkout/success", 303);
}
