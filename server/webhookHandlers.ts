import { getStripeSync } from './stripeClient';
import { generatePremiumPredictionsForUser } from './services/predictionService';
import { storage } from './storage';

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
}
