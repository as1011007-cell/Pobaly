import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { generatePremiumPredictionsForUser } from './services/predictionService';
import { storage } from './storage';
import { db } from './db';
import { affiliates, referrals, users } from '../shared/schema';
import { eq } from 'drizzle-orm';

export class WebhookHandlers {
  static async activatePremiumForUser(user: any, subscriptionId: string, periodEnd?: number): Promise<void> {
    const expiryDate = periodEnd
      ? new Date(periodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const premiumUpdate: any = {
      isPremium: true,
      stripeSubscriptionId: subscriptionId,
      subscriptionExpiry: expiryDate,
    };
    if (!user.isPremium) {
      premiumUpdate.premiumSince = new Date();
    }
    await storage.updateUserStripeInfo(user.id, premiumUpdate);
    console.log(`Premium activated for user ${user.id} until ${expiryDate.toISOString()}`);

    await generatePremiumPredictionsForUser(user.id);
    console.log(`Premium predictions generated for user ${user.id}`);
  }

  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    await sync.processWebhook(payload, signature);
    
    try {
      const event = JSON.parse(payload.toString());

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.customer && session.subscription) {
          const user = await storage.getUserByStripeCustomerId(session.customer);
          if (user && !user.isPremium) {
            console.log(`Checkout completed for user ${user.id}, activating premium...`);
            try {
              const stripe = await getUncachableStripeClient();
              const sub = await stripe.subscriptions.retrieve(session.subscription);
              await this.activatePremiumForUser(user, sub.id, (sub as any).current_period_end);
            } catch (subErr) {
              await this.activatePremiumForUser(user, session.subscription);
            }
          }
        }
      }
      
      if (event.type === 'customer.subscription.created' || 
          event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const user = await storage.getUserByStripeCustomerId(customerId);
        
        if (user) {
          if (subscription.status === 'active') {
            console.log(`Subscription ${event.type} (active) for user ${user.id}`);
            await this.activatePremiumForUser(user, subscription.id, subscription.current_period_end);
          } else if (['canceled', 'unpaid', 'past_due', 'incomplete_expired'].includes(subscription.status)) {
            // Subscription is no longer active - remove premium access
            console.log(`Subscription ${subscription.status} for user ${user.id}, removing premium access...`);
            
            await storage.updateUserStripeInfo(user.id, {
              isPremium: false,
              stripeSubscriptionId: undefined,
              subscriptionExpiry: undefined,
            });
            
            console.log(`Premium access removed for user ${user.id}`);
          }
        }
      }
      
      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          console.log(`Payment failed for user ${user.id} (invoice ${invoice.id}, attempt ${invoice.attempt_count})`);
          if (invoice.attempt_count >= 3) {
            await storage.updateUserStripeInfo(user.id, {
              isPremium: false,
            });
            console.log(`Premium revoked for user ${user.id} after ${invoice.attempt_count} failed payment attempts`);
          }
        }
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const user = await storage.getUserByStripeCustomerId(customerId);
        
        if (user) {
          console.log(`Subscription deleted for user ${user.id}, removing premium access...`);
          
          await storage.updateUserStripeInfo(user.id, {
            isPremium: false,
            stripeSubscriptionId: undefined,
            subscriptionExpiry: undefined,
          });
          
          console.log(`Premium access removed for user ${user.id}`);
        }
      }
    } catch (error) {
      console.error('Error processing subscription webhook for predictions:', error);
      // Don't throw - the main webhook processing already succeeded
    }
  }
  
  static async processAffiliateReferral(userId: string, subscription: any): Promise<void> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.referredByCode) return;

      const [affiliate] = await db.select()
        .from(affiliates)
        .where(eq(affiliates.affiliateCode, user.referredByCode));

      if (!affiliate || !affiliate.isActive) {
        console.log(`Affiliate not found or inactive for code: ${user.referredByCode}`);
        return;
      }

      // Dedup: one commission per referred user ever (check by user ID first, then subscription)
      const existingReferral = await db.select()
        .from(referrals)
        .where(eq(referrals.referredUserId, userId));
      if (existingReferral.length > 0) {
        console.log(`Referral already exists for user: ${userId}`);
        return;
      }

      const subscriptionAmount = subscription.items?.data?.[0]?.price?.unit_amount || 4900;
      const commissionRate = affiliate.commissionRate || 40;
      const commissionAmount = Math.floor(subscriptionAmount * (commissionRate / 100));

      await db.insert(referrals).values({
        affiliateId: affiliate.id,
        referredUserId: userId,
        subscriptionId: subscription.id,
        subscriptionAmount,
        commissionAmount,
        status: "pending",
      });

      await db.update(affiliates)
        .set({
          totalEarnings: (affiliate.totalEarnings || 0) + commissionAmount,
          pendingEarnings: (affiliate.pendingEarnings || 0) + commissionAmount,
          totalReferrals: (affiliate.totalReferrals || 0) + 1,
        })
        .where(eq(affiliates.id, affiliate.id));

      console.log(`Stripe affiliate referral: ${affiliate.affiliateCode} earned $${(commissionAmount / 100).toFixed(2)}`);
    } catch (error) {
      console.error('Error processing Stripe affiliate referral:', error);
    }
  }

  // Handles affiliate commission for RevenueCat (native iOS/Android) purchases.
  // Uses referredUserId as the dedup key — affiliates earn for the first subscription only.
  static async processAffiliateReferralForRevenueCat(userId: string, productId: string): Promise<void> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user || !user.referredByCode) return;

      const [affiliate] = await db.select()
        .from(affiliates)
        .where(eq(affiliates.affiliateCode, user.referredByCode));

      if (!affiliate || !affiliate.isActive) {
        console.log(`RevenueCat affiliate: not found or inactive for code ${user.referredByCode}`);
        return;
      }

      // One referral credit per referred user, ever — prevents double-crediting on renewals/restores
      const existingReferral = await db.select()
        .from(referrals)
        .where(eq(referrals.referredUserId, userId));
      if (existingReferral.length > 0) {
        console.log(`RevenueCat affiliate: referral already exists for user ${userId}`);
        return;
      }

      const isAnnual = String(productId || "").toLowerCase().includes("annual");
      const subscriptionAmount = isAnnual ? 14900 : 4999; // in cents
      const commissionRate = affiliate.commissionRate || 40;
      const commissionAmount = Math.floor(subscriptionAmount * (commissionRate / 100));

      await db.insert(referrals).values({
        affiliateId: affiliate.id,
        referredUserId: userId,
        subscriptionId: `rc_${userId}_${productId}`,
        subscriptionAmount,
        commissionAmount,
        status: "pending",
      });

      await db.update(affiliates)
        .set({
          totalEarnings: (affiliate.totalEarnings || 0) + commissionAmount,
          pendingEarnings: (affiliate.pendingEarnings || 0) + commissionAmount,
          totalReferrals: (affiliate.totalReferrals || 0) + 1,
        })
        .where(eq(affiliates.id, affiliate.id));

      console.log(`RevenueCat affiliate referral: ${affiliate.affiliateCode} earned $${(commissionAmount / 100).toFixed(2)} (${isAnnual ? "annual" : "monthly"}) for user ${userId}`);
    } catch (error) {
      console.error('Error processing RevenueCat affiliate referral:', error);
    }
  }
}
