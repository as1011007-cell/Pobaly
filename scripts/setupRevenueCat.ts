import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const APP_STORE_APP_NAME = "Probaly iOS";
const APP_STORE_BUNDLE_ID = "com.probaly.app";
const PLAY_STORE_APP_NAME = "Probaly Android";
const PLAY_STORE_PACKAGE_NAME = "com.probaly.app";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Access";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function ensureProduct(
  client: any,
  projectId: string,
  existingProducts: Product[],
  targetApp: App,
  label: string,
  storeIdentifier: string,
  displayName: string,
  isTestStore: boolean,
  duration?: string,
): Promise<Product> {
  const existing = existingProducts.find(
    (p) => p.store_identifier === storeIdentifier && p.app_id === targetApp.id,
  );
  if (existing) {
    console.log(`${label} product already exists: ${existing.id}`);
    return existing;
  }

  const body: CreateProductData["body"] = {
    store_identifier: storeIdentifier,
    app_id: targetApp.id,
    type: "subscription",
    display_name: displayName,
  };

  if (isTestStore && duration) {
    body.subscription = { duration };
    body.title = displayName;
  }

  const { data, error } = await createProduct({
    client,
    path: { project_id: projectId },
    body,
  });

  if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
  console.log(`Created ${label} product: ${data.id}`);
  return data;
}

async function addTestStorePrices(
  client: any,
  projectId: string,
  product: Product,
  prices: { amount_micros: number; currency: string }[],
) {
  const { data, error } = await client.post<TestStorePricesResponse>({
    url: "/projects/{project_id}/products/{product_id}/test_store_prices",
    path: { project_id: projectId, product_id: product.id },
    body: { prices },
  });

  if (error) {
    if (typeof error === "object" && "type" in error && error.type === "resource_already_exists") {
      console.log(`Prices already exist for ${product.display_name}`);
    } else {
      console.warn(`Price warning for ${product.display_name}:`, JSON.stringify(error));
    }
  } else {
    console.log(`Added prices for ${product.display_name}`);
  }
}

async function setupRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // Get or create the "Probaly" project
  const { data: projects, error: projectsError } = await listProjects({ client, query: { limit: 20 } });
  if (projectsError) throw new Error("Failed to list projects");

  let project = projects?.items?.find((p) => p.name === "Probaly");
  if (!project) {
    const { data: newProject, error } = await createProject({ client, body: { name: "Probaly" } });
    if (error) throw new Error(`Failed to create project: ${JSON.stringify(error)}`);
    project = newProject;
    console.log(`Created project: ${project.name} (${project.id})`);
    // Give RevenueCat a moment to provision the test store
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    console.log(`Using existing project: ${project.name} (${project.id})`);
  }
  const projectId = project.id;

  // Get/create apps
  const { data: apps, error: appsError } = await listApps({ client, path: { project_id: projectId }, query: { limit: 20 } });
  if (appsError) throw new Error(`Failed to list apps: ${JSON.stringify(appsError)}`);

  let testStoreApp = apps.items.find((a: App) => a.type === "test_store");
  if (!testStoreApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: projectId },
      body: { name: "Probaly Test Store", type: "test_store" } as any,
    });
    if (error) throw new Error(`Failed to create Test Store app: ${JSON.stringify(error)}`);
    testStoreApp = data;
    console.log(`Created Test Store app: ${testStoreApp.id}`);
  } else {
    console.log(`Test Store app: ${testStoreApp.id}`);
  }

  let appStoreApp = apps.items.find((a) => a.type === "app_store");
  if (!appStoreApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: projectId },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error(`Failed to create App Store app: ${JSON.stringify(error)}`);
    appStoreApp = data;
    console.log(`Created App Store app: ${appStoreApp.id}`);
  } else {
    console.log(`App Store app found: ${appStoreApp.id}`);
  }

  let playStoreApp = apps.items.find((a) => a.type === "play_store");
  if (!playStoreApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: projectId },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error(`Failed to create Play Store app: ${JSON.stringify(error)}`);
    playStoreApp = data;
    console.log(`Created Play Store app: ${playStoreApp.id}`);
  } else {
    console.log(`Play Store app found: ${playStoreApp.id}`);
  }

  // List existing products
  const { data: existingProductsData, error: listProductsError } = await listProducts({
    client,
    path: { project_id: projectId },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");
  const existingProducts: Product[] = existingProductsData?.items ?? [];

  // Create monthly products (P1M = 1 month)
  console.log("\n--- Setting up MONTHLY products ($49.99/month) ---");
  const monthlyTestProduct = await ensureProduct(client, projectId, existingProducts, testStoreApp, "Monthly Test Store", "probaly_premium_monthly", "Probaly Premium Monthly", true, "P1M");
  const monthlyAppStoreProduct = await ensureProduct(client, projectId, existingProducts, appStoreApp, "Monthly App Store", "probaly_premium_monthly", "Probaly Premium Monthly", false);
  const monthlyPlayStoreProduct = await ensureProduct(client, projectId, existingProducts, playStoreApp, "Monthly Play Store", "probaly_premium_monthly:monthly", "Probaly Premium Monthly", false);

  await addTestStorePrices(client, projectId, monthlyTestProduct, [
    { amount_micros: 49990000, currency: "USD" },
    { amount_micros: 45990000, currency: "EUR" },
    { amount_micros: 39990000, currency: "GBP" },
  ]);

  // Create annual products (P1Y = 1 year)
  console.log("\n--- Setting up ANNUAL products ($149/year) ---");
  const annualTestProduct = await ensureProduct(client, projectId, existingProducts, testStoreApp, "Annual Test Store", "probaly_premium_annual", "Probaly Premium Annual", true, "P1Y");
  const annualAppStoreProduct = await ensureProduct(client, projectId, existingProducts, appStoreApp, "Annual App Store", "probaly_premium_annual", "Probaly Premium Annual", false);
  const annualPlayStoreProduct = await ensureProduct(client, projectId, existingProducts, playStoreApp, "Annual Play Store", "probaly_premium_annual:annual", "Probaly Premium Annual", false);

  await addTestStorePrices(client, projectId, annualTestProduct, [
    { amount_micros: 149000000, currency: "USD" },
    { amount_micros: 139000000, currency: "EUR" },
    { amount_micros: 129000000, currency: "GBP" },
  ]);

  // Entitlement
  console.log("\n--- Setting up entitlement ---");
  const { data: existingEntitlementsData } = await listEntitlements({ client, path: { project_id: projectId }, query: { limit: 20 } });
  let entitlement: Entitlement | undefined = existingEntitlementsData?.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);

  if (!entitlement) {
    const { data, error } = await createEntitlement({
      client,
      path: { project_id: projectId },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error(`Failed to create entitlement: ${JSON.stringify(error)}`);
    entitlement = data;
    console.log(`Created entitlement: ${entitlement.id}`);
  } else {
    console.log(`Entitlement found: ${entitlement.id}`);
  }

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: projectId, entitlement_id: entitlement.id },
    body: {
      product_ids: [
        monthlyTestProduct.id, monthlyAppStoreProduct.id, monthlyPlayStoreProduct.id,
        annualTestProduct.id, annualAppStoreProduct.id, annualPlayStoreProduct.id,
      ],
    },
  });
  if (attachEntErr && attachEntErr.type !== "unprocessable_entity_error") {
    throw new Error(`Failed to attach products to entitlement: ${JSON.stringify(attachEntErr)}`);
  }
  console.log("Products attached to entitlement");

  // Offering
  console.log("\n--- Setting up offering ---");
  const { data: existingOfferingsData } = await listOfferings({ client, path: { project_id: projectId }, query: { limit: 20 } });
  let offering: Offering | undefined = existingOfferingsData?.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);

  if (!offering) {
    const { data, error } = await createOffering({
      client,
      path: { project_id: projectId },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error(`Failed to create offering: ${JSON.stringify(error)}`);
    offering = data;
    console.log(`Created offering: ${offering.id}`);
  } else {
    console.log(`Offering found: ${offering.id}`);
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: projectId, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error(`Failed to set offering as current: ${JSON.stringify(error)}`);
    console.log("Set offering as current");
  }

  // Packages: monthly + annual
  console.log("\n--- Setting up packages ---");
  const { data: existingPkgsData } = await listPackages({ client, path: { project_id: projectId, offering_id: offering.id }, query: { limit: 20 } });
  const existingPkgs: Package[] = existingPkgsData?.items ?? [];

  const ensurePackage = async (lookupKey: string, displayName: string): Promise<Package> => {
    const existing = existingPkgs.find((p) => p.lookup_key === lookupKey);
    if (existing) {
      console.log(`Package ${lookupKey} found: ${existing.id}`);
      return existing;
    }
    const { data, error } = await createPackages({
      client,
      path: { project_id: projectId, offering_id: offering!.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error) throw new Error(`Failed to create package ${lookupKey}: ${JSON.stringify(error)}`);
    console.log(`Created package ${lookupKey}: ${data.id}`);
    return data;
  };

  const monthlyPkg = await ensurePackage("$rc_monthly", "Monthly");
  const annualPkg = await ensurePackage("$rc_annual", "Annual");

  const attachPkg = async (pkg: Package, products: Product[], label: string) => {
    const { error } = await attachProductsToPackage({
      client,
      path: { project_id: projectId, package_id: pkg.id },
      body: {
        products: products.map((p) => ({ product_id: p.id, eligibility_criteria: "all" })),
      },
    });
    if (error && !(error.type === "unprocessable_entity_error" && JSON.stringify(error).includes("Cannot attach"))) {
      throw new Error(`Failed to attach products to ${label} package: ${JSON.stringify(error)}`);
    }
    console.log(`${label} package products attached`);
  };

  await attachPkg(monthlyPkg, [monthlyTestProduct, monthlyAppStoreProduct, monthlyPlayStoreProduct], "Monthly");
  await attachPkg(annualPkg, [annualTestProduct, annualAppStoreProduct, annualPlayStoreProduct], "Annual");

  // Get API keys
  const getKeys = async (app: App) => {
    const { data } = await listAppPublicApiKeys({ client, path: { project_id: projectId, app_id: app.id } });
    return data?.items?.map((k) => k.key).join(", ") ?? "N/A";
  };

  const testKey = await getKeys(testStoreApp);
  const iosKey = await getKeys(appStoreApp);
  const androidKey = await getKeys(playStoreApp);

  console.log("\n========================================");
  console.log("RevenueCat setup complete!");
  console.log("========================================");
  console.log(`REVENUECAT_PROJECT_ID=${projectId}`);
  console.log(`REVENUECAT_TEST_STORE_APP_ID=${testStoreApp.id}`);
  console.log(`REVENUECAT_APPLE_APP_STORE_APP_ID=${appStoreApp.id}`);
  console.log(`REVENUECAT_GOOGLE_PLAY_STORE_APP_ID=${playStoreApp.id}`);
  console.log(`EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=${testKey}`);
  console.log(`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${iosKey}`);
  console.log(`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=${androidKey}`);
  console.log("========================================");
}

setupRevenueCat().catch(console.error);
