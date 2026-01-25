import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  console.log('Creating Probaly Premium subscription products...');
  
  const stripe = await getUncachableStripeClient();

  // Check if product already exists
  const existingProducts = await stripe.products.search({ 
    query: "name:'Probaly Premium'" 
  });

  let product;
  if (existingProducts.data.length > 0) {
    console.log('Probaly Premium product already exists:', existingProducts.data[0].id);
    product = existingProducts.data[0];
    
    // Deactivate old prices
    const oldPrices = await stripe.prices.list({ 
      product: product.id,
      active: true 
    });
    
    for (const price of oldPrices.data) {
      await stripe.prices.update(price.id, { active: false });
      console.log('Deactivated old price:', price.id);
    }
  } else {
    // Create product
    product = await stripe.products.create({
      name: 'Probaly Premium',
      description: 'Premium subscription for unlimited AI-powered sports predictions, live updates, and full prediction history.',
      metadata: {
        app: 'probaly',
        tier: 'premium',
      },
    });
    console.log('Created product:', product.id);
  }

  // Create monthly price ($49/month, original $99)
  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 4900, // $49.00
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      plan: 'monthly',
      original_price: '9900', // $99.00 original price
    },
  });

  console.log('Created monthly price:', monthlyPrice.id);
  console.log('Monthly Price: $49.00/month (was $99/month)');

  // Create annual price ($149/year, original $399)
  const annualPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 14900, // $149.00
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      plan: 'annual',
      original_price: '39900', // $399.00 original price
    },
  });

  console.log('Created annual price:', annualPrice.id);
  console.log('Annual Price: $149.00/year (was $399/year)');

  console.log('\n✅ Product setup complete!');
  console.log('Product ID:', product.id);
  console.log('Monthly Price ID:', monthlyPrice.id);
  console.log('Annual Price ID:', annualPrice.id);
}

createProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error creating products:', error);
    process.exit(1);
  });
