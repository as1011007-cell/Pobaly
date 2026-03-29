import { getStripeSync } from './stripeClient';
import { generatePremiumPredictionsForUser } from './services/predictionService';
import { storage } from './storage';
import { db } from './db';
import { affiliates, referrals, users } from '../shared/schema';
import { eq } from 'drizzle-orm';

export class WebhookHandlers {
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
    
    // Process the webhook through stripe-replit-sync
    await sync.processWebhook(payload, signature);
    
    // Parse the event to check for subscription events
    try {
      const event = JSON.parse(payload.toString());
      
      // When a subscription is created or updated to active, generate predictions
      if (event.type === 'customer.subscription.created' || 
          event.type === 'customer.subscription.updated') {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const user = await storage.getUserByStripeCustomerId(customerId);
        
        if (user) {
          if (subscription.status === 'active') {
            console.log(`Subscription activated for user ${user.id}, generating premium predictions...`);
            
            // Generate premium predictions for this user
            await generatePremiumPredictionsForUser(user.id);
            
            console.log(`Premium predictions generated for user ${user.id}`);
            
            // Process affiliate referral commission
            if (event.type === 'customer.subscription.created') {
              await this.processAffiliateReferral(user.id, subscription);
            }
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
      
      // Handle subscription deletion (cancelled and period ended)
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
