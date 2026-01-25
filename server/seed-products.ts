import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  console.log('Creating BetRight Premium subscription product...');
  
  const stripe = await getUncachableStripeClient();

  // Check if product already exists
  const existingProducts = await stripe.products.search({ 
    query: "name:'BetRight Premium'" 
  });

  if (existingProducts.data.length > 0) {
    console.log('BetRight Premium product already exists:', existingProducts.data[0].id);
    
    // Check for existing price
    const prices = await stripe.prices.list({ 
      product: existingProducts.data[0].id,
      active: true 
    });
    
    if (prices.data.length > 0) {
      console.log('Annual price already exists:', prices.data[0].id);
      console.log('Price:', prices.data[0].unit_amount! / 100, prices.data[0].currency.toUpperCase());
      return;
    }
  }

  // Create product
  const product = await stripe.products.create({
    name: 'BetRight Premium',
    description: 'Annual subscription for unlimited AI-powered sports predictions, live updates, and full prediction history.',
    metadata: {
      app: 'betright',
      tier: 'premium',
    },
  });

  console.log('Created product:', product.id);

  // Create annual price ($49/year)
  const annualPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 4900, // $49.00
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      plan: 'annual',
    },
  });

  console.log('Created annual price:', annualPrice.id);
  console.log('Price: $49.00/year');

  console.log('\n✅ Product setup complete!');
  console.log('Product ID:', product.id);
  console.log('Price ID:', annualPrice.id);
}

createProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error creating products:', error);
    process.exit(1);
  });
