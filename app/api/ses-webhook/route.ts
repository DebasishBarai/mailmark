import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.SES_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const {
      key,
      from,
      to,
      subject,
      date,
      messageId,
      hasAttachments,
    } = body;

    // Forward each recipient's email to the Convex HTTP endpoint
    for (const recipient of to as string[]) {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/ingestEmail`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": process.env.SES_WEBHOOK_SECRET!,
          },
          body: JSON.stringify({
            recipientAddress: recipient,
            from,
            to,
            subject: subject || "(no subject)",
            date: date ? new Date(date).getTime() : Date.now(),
            messageId: messageId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            hasAttachments: hasAttachments || false,
            s3Key: key,
          }),
        }
      );

      if (!response.ok) {
        console.error("Failed to ingest email:", await response.text());
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SES webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
