import { Router, Request, Response } from "express";
import { db } from "./db";
import { affiliates, referrals, users, payoutRequests } from "../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { getUncachableStripeClient } from "./stripeClient";

const router = Router();

function generateAffiliateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "PRO";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }
  return result;
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [existingAffiliate] = await db.select()
      .from(affiliates)
      .where(eq(affiliates.userId, userId));
    
    if (existingAffiliate) {
      return res.json({ 
        affiliate: existingAffiliate,
        message: "Already registered as affiliate" 
      });
    }

    let affiliateCode = generateAffiliateCode();
    let codeExists = true;
    let attempts = 0;
    
    while (codeExists && attempts < 10) {
      const [existing] = await db.select()
        .from(affiliates)
        .where(eq(affiliates.affiliateCode, affiliateCode));
      if (!existing) {
        codeExists = false;
      } else {
        affiliateCode = generateAffiliateCode();
        attempts++;
      }
    }

    const [newAffiliate] = await db.insert(affiliates)
      .values({
        userId,
        affiliateCode,
        commissionRate: 40,
      })
      .returning();

    res.json({ 
      affiliate: newAffiliate,
      message: "Successfully registered as affiliate" 
    });
  } catch (error) {
    console.error("Affiliate registration error:", error);
    res.status(500).json({ error: "Failed to register as affiliate" });
  }
});

router.get("/dashboard/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    const [affiliate] = await db.select()
      .from(affiliates)
      .where(eq(affiliates.userId, userId));

    if (!affiliate) {
      return res.status(404).json({ error: "Not registered as affiliate" });
    }

    const affiliateReferrals = await db.select()
      .from(referrals)
      .where(eq(referrals.affiliateId, affiliate.id))
      .orderBy(desc(referrals.createdAt))
      .limit(50);

    const now = new Date();
    const pendingReferrals = affiliateReferrals.filter(ref => ref.status === "pending");
    
    let clearedEarnings = 0;
    let processingEarnings = 0;
    
    for (const ref of pendingReferrals) {
      const createdAt = ref.createdAt || new Date();
      const clearanceDate = addBusinessDays(new Date(createdAt), 14);
      if (now >= clearanceDate) {
        clearedEarnings += ref.commissionAmount || 0;
      } else {
        processingEarnings += ref.commissionAmount || 0;
      }
    }

    const baseUrl = process.env.EXPO_PUBLIC_DOMAIN 
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` 
      : "https://probaly.app";
    
    res.json({
      affiliate: {
        ...affiliate,
        referralLink: `${baseUrl}/?ref=${affiliate.affiliateCode}`,
      },
      referrals: affiliateReferrals,
      stats: {
        totalEarnings: (affiliate.totalEarnings || 0) / 100,
        pendingEarnings: (affiliate.pendingEarnings || 0) / 100,
        clearedEarnings: clearedEarnings / 100,
        processingEarnings: processingEarnings / 100,
        paidEarnings: (affiliate.paidEarnings || 0) / 100,
        totalReferrals: affiliate.totalReferrals || 0,
        commissionRate: affiliate.commissionRate || 40,
      }
    });
  } catch (error) {
    console.error("Affiliate dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.post("/connect-stripe", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const stripe = await getUncachableStripeClient();

    const [affiliate] = await db.select()
      .from(affiliates)
      .where(eq(affiliates.userId, userId));

    if (!affiliate) {
      return res.status(404).json({ error: "Not registered as affiliate" });
    }

    let accountId = affiliate.stripeConnectAccountId;

    if (!accountId) {
      console.log("Creating new Stripe Connect account for affiliate:", affiliate.id);
      const account = await stripe.accounts.create({
        type: "express",
        metadata: {
          affiliateId: affiliate.id.toString(),
          userId: userId,
        },
      });
      accountId = account.id;
      console.log("Created Stripe Connect account:", accountId);

      await db.update(affiliates)
        .set({ stripeConnectAccountId: accountId })
        .where(eq(affiliates.id, affiliate.id));
    }

    const baseUrl = process.env.REPL_SLUG && process.env.REPL_OWNER
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : process.env.EXPO_PUBLIC_DOMAIN 
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN.replace(':5000', '')}`
        : "https://probaly.app";

    console.log("Creating account link with baseUrl:", baseUrl);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/affiliate?refresh=true`,
      return_url: `${baseUrl}/affiliate?success=true`,
      type: "account_onboarding",
    });

    console.log("Account link created:", accountLink.url);
    res.json({ url: accountLink.url });
  } catch (error: any) {
    console.error("Stripe Connect error:", error?.message || error);
    console.error("Full error:", JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: "Failed to create Stripe Connect link",
      details: error?.message || "Unknown error"
    });
  }
});

router.get("/connect-status/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const stripe = await getUncachableStripeClient();

    const [affiliate] = await db.select()
      .from(affiliates)
      .where(eq(affiliates.userId, userId));

    if (!affiliate || !affiliate.stripeConnectAccountId) {
      return res.json({ connected: false, onboarded: false });
    }

    const account = await stripe.accounts.retrieve(affiliate.stripeConnectAccountId);

    const isOnboarded = account.charges_enabled && account.payouts_enabled;

    if (isOnboarded && !affiliate.stripeConnectOnboarded) {
      await db.update(affiliates)
        .set({ stripeConnectOnboarded: true })
        .where(eq(affiliates.id, affiliate.id));
    }

    res.json({
      connected: true,
      onboarded: isOnboarded,
      accountId: affiliate.stripeConnectAccountId,
    });
  } catch (error) {
    console.error("Connect status error:", error);
    res.status(500).json({ error: "Failed to check connect status" });
  }
});

router.post("/request-payout", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    const [affiliate] = await db.select()
      .from(affiliates)
      .where(eq(affiliates.userId, userId));

    if (!affiliate) {
      return res.status(404).json({ error: "Not registered as affiliate" });
    }

    if (!affiliate.stripeConnectAccountId || !affiliate.stripeConnectOnboarded) {
      return res.status(400).json({ error: "Please complete Stripe Connect setup first" });
    }

    const existingRequest = await db.select()
      .from(payoutRequests)
      .where(
        and(
          eq(payoutRequests.affiliateId, affiliate.id),
          eq(payoutRequests.status, "pending")
        )
      );

    if (existingRequest.length > 0) {
      return res.status(400).json({ 
        error: "You already have a pending payout request. Please wait for it to be reviewed."
      });
    }

    const now = new Date();
    const affiliateReferrals = await db.select()
      .from(referrals)
      .where(
        and(
          eq(referrals.affiliateId, affiliate.id),
          eq(referrals.status, "pending")
        )
      );

    const clearedReferrals = affiliateReferrals.filter((ref) => {
      const createdAt = ref.createdAt || new Date();
      const clearanceDate = addBusinessDays(new Date(createdAt), 14);
      return now >= clearanceDate;
    });

    if (clearedReferrals.length === 0) {
      return res.status(400).json({ 
        error: "No cleared earnings available. Commissions are available for payout 14 business days after the payment clears."
      });
    }

    const clearedAmount = clearedReferrals.reduce((sum, ref) => sum + (ref.commissionAmount || 0), 0);
    
    if (clearedAmount < 1000) {
      return res.status(400).json({ error: "Minimum payout is $10. Cleared earnings: $" + (clearedAmount / 100).toFixed(2) });
    }

    const [payoutRequest] = await db.insert(payoutRequests)
      .values({
        affiliateId: affiliate.id,
        amount: clearedAmount,
        status: "pending",
      })
      .returning();

    res.json({
      success: true,
      amount: clearedAmount / 100,
      requestId: payoutRequest.id,
      message: `Payout request for $${(clearedAmount / 100).toFixed(2)} submitted for approval`,
    });
  } catch (error) {
    console.error("Payout error:", error);
    res.status(500).json({ error: "Failed to process payout" });
  }
});

router.get("/validate/:code", async (req: Request, res: Response) => {
  try {
    const code = (req.params.code as string).toUpperCase();

    const [affiliate] = await db.select()
      .from(affiliates)
      .where(eq(affiliates.affiliateCode, code));

    if (!affiliate || !affiliate.isActive) {
      return res.json({ valid: false });
    }

    res.json({ valid: true, code: affiliate.affiliateCode });
  } catch (error) {
    console.error("Validate affiliate error:", error);
    res.status(500).json({ error: "Failed to validate code" });
  }
});

router.get("/admin/payout-requests", async (req: Request, res: Response) => {
  try {
    const statusParam = req.query.status;
    const status = (typeof statusParam === "string" ? statusParam : "pending");
    
    const requests = await db.select({
      id: payoutRequests.id,
      amount: payoutRequests.amount,
      status: payoutRequests.status,
      requestedAt: payoutRequests.requestedAt,
      reviewedAt: payoutRequests.reviewedAt,
      rejectionReason: payoutRequests.rejectionReason,
      affiliateId: payoutRequests.affiliateId,
      affiliateCode: affiliates.affiliateCode,
      stripeConnectAccountId: affiliates.stripeConnectAccountId,
      userId: affiliates.userId,
    })
      .from(payoutRequests)
      .innerJoin(affiliates, eq(payoutRequests.affiliateId, affiliates.id))
      .where(eq(payoutRequests.status, status))
      .orderBy(desc(payoutRequests.requestedAt));

    res.json({ requests });
  } catch (error) {
    console.error("List payout requests error:", error);
    res.status(500).json({ error: "Failed to list payout requests" });
  }
});

router.post("/admin/approve-payout/:requestId", async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const stripe = await getUncachableStripeClient();

    const [payoutRequest] = await db.select()
      .from(payoutRequests)
      .where(eq(payoutRequests.id, requestId));

    if (!payoutRequest) {
      return res.status(404).json({ error: "Payout request not found" });
    }

    if (payoutRequest.status !== "pending") {
      return res.status(400).json({ error: "Payout request already processed" });
    }

    const [affiliate] = await db.select()
      .from(affiliates)
      .where(eq(affiliates.id, payoutRequest.affiliateId));

    if (!affiliate || !affiliate.stripeConnectAccountId) {
      return res.status(400).json({ error: "Affiliate not properly set up for payouts" });
    }

    const transfer = await stripe.transfers.create({
      amount: payoutRequest.amount,
      currency: "usd",
      destination: affiliate.stripeConnectAccountId,
      metadata: {
        affiliateId: affiliate.id.toString(),
        payoutRequestId: requestId.toString(),
        type: "affiliate_payout",
      },
    });

    await db.update(payoutRequests)
      .set({
        status: "paid",
        stripeTransferId: transfer.id,
        reviewedAt: new Date(),
        paidAt: new Date(),
      })
      .where(eq(payoutRequests.id, requestId));

    const affiliateReferrals = await db.select()
      .from(referrals)
      .where(
        and(
          eq(referrals.affiliateId, affiliate.id),
          eq(referrals.status, "pending")
        )
      );

    const now = new Date();
    const clearedReferrals = affiliateReferrals.filter((ref) => {
      const createdAt = ref.createdAt || new Date();
      const clearanceDate = addBusinessDays(new Date(createdAt), 14);
      return now >= clearanceDate;
    });

    for (const ref of clearedReferrals) {
      await db.update(referrals)
        .set({
          status: "paid",
          paidAt: new Date(),
        })
        .where(eq(referrals.id, ref.id));
    }

    const remainingPending = affiliateReferrals
      .filter((ref) => !clearedReferrals.find(cr => cr.id === ref.id))
      .reduce((sum, ref) => sum + (ref.commissionAmount || 0), 0);

    await db.update(affiliates)
      .set({
        pendingEarnings: remainingPending,
        paidEarnings: (affiliate.paidEarnings || 0) + payoutRequest.amount,
      })
      .where(eq(affiliates.id, affiliate.id));

    res.json({
      success: true,
      transferId: transfer.id,
      amount: payoutRequest.amount / 100,
      message: `Payout of $${(payoutRequest.amount / 100).toFixed(2)} approved and processed`,
    });
  } catch (error: any) {
    console.error("Approve payout error:", error);
    res.status(500).json({ error: "Failed to approve payout", details: error?.message });
  }
});

router.post("/admin/reject-payout/:requestId", async (req: Request, res: Response) => {
  try {
    const requestIdParam = req.params.requestId as string;
    const requestId = parseInt(requestIdParam);
    const { reason } = req.body;

    const [payoutRequest] = await db.select()
      .from(payoutRequests)
      .where(eq(payoutRequests.id, requestId));

    if (!payoutRequest) {
      return res.status(404).json({ error: "Payout request not found" });
    }

    if (payoutRequest.status !== "pending") {
      return res.status(400).json({ error: "Payout request already processed" });
    }

    await db.update(payoutRequests)
      .set({
        status: "rejected",
        reviewedAt: new Date(),
        rejectionReason: reason || "Request rejected by admin",
      })
      .where(eq(payoutRequests.id, requestId));

    res.json({
      success: true,
      message: "Payout request rejected",
    });
  } catch (error) {
    console.error("Reject payout error:", error);
    res.status(500).json({ error: "Failed to reject payout" });
  }
});

router.get("/payout-requests/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string;

    const [affiliate] = await db.select()
      .from(affiliates)
      .where(eq(affiliates.userId, userId));

    if (!affiliate) {
      return res.status(404).json({ error: "Not registered as affiliate" });
    }

    const requests = await db.select()
      .from(payoutRequests)
      .where(eq(payoutRequests.affiliateId, affiliate.id))
      .orderBy(desc(payoutRequests.requestedAt));

    res.json({ requests });
  } catch (error) {
    console.error("Get payout requests error:", error);
    res.status(500).json({ error: "Failed to get payout requests" });
  }
});

export default router;
