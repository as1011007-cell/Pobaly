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
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Probaly";

const MONTHLY_PRODUCT_IDENTIFIER = "probaly_premium_monthly";
const YEARLY_PRODUCT_IDENTIFIER = "probaly_premium_yearly";
const PLAY_STORE_MONTHLY_IDENTIFIER = "probaly_premium_monthly:monthly";
const PLAY_STORE_YEARLY_IDENTIFIER = "probaly_premium_yearly:yearly";

const APP_STORE_APP_NAME = "Probaly iOS";
const APP_STORE_BUNDLE_ID = "com.probaly.app";
const PLAY_STORE_APP_NAME = "Probaly Android";
const PLAY_STORE_PACKAGE_NAME = "com.probaly.app";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Access";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

const MONTHLY_PRICES = [
  { amount_micros: 49990000, currency: "USD" }, // $49.99/month
];
const YEARLY_PRICES = [
  { amount_micros: 149000000, currency: "USD" }, // $149/year
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({ client, body: { name: PROJECT_NAME } });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) throw new Error("No apps found");

  let testStoreApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testStoreApp) throw new Error("No test store app found");
  console.log("Test store app found:", testStoreApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    identifier: string,
    duration: string,
    title: string,
    isTestStore: boolean
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === identifier && p.app_id === targetApp.id
    );
    if (existing) {
      console.log(`${label} product already exists:`, existing.id);
      return existing;
    }
    const body: CreateProductData["body"] = {
      store_identifier: identifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: title,
    };
    if (isTestStore) {
      body.subscription = { duration };
      body.title = title;
    }
    const { data: created, error } = await createProduct({ client, path: { project_id: project.id }, body });
    if (error) throw new Error(`Failed to create ${label} product`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  const testMonthly = await ensureProduct(testStoreApp, "Test Monthly", MONTHLY_PRODUCT_IDENTIFIER, "P1M", "Probaly Premium Monthly", true);
  const testYearly = await ensureProduct(testStoreApp, "Test Yearly", YEARLY_PRODUCT_IDENTIFIER, "P1Y", "Probaly Premium Yearly", true);
  const appStoreMonthly = await ensureProduct(appStoreApp, "AppStore Monthly", MONTHLY_PRODUCT_IDENTIFIER, "P1M", "Probaly Premium Monthly", false);
  const appStoreYearly = await ensureProduct(appStoreApp, "AppStore Yearly", YEARLY_PRODUCT_IDENTIFIER, "P1Y", "Probaly Premium Yearly", false);
  const playStoreMonthly = await ensureProduct(playStoreApp, "PlayStore Monthly", PLAY_STORE_MONTHLY_IDENTIFIER, "P1M", "Probaly Premium Monthly", false);
  const playStoreYearly = await ensureProduct(playStoreApp, "PlayStore Yearly", PLAY_STORE_YEARLY_IDENTIFIER, "P1Y", "Probaly Premium Yearly", false);

  const addTestPrices = async (product: Product, prices: { amount_micros: number; currency: string }[], label: string) => {
    const { data, error } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: product.id },
      body: { prices },
    });
    if (error) {
      if (error && typeof error === "object" && "type" in error && (error as any).type === "resource_already_exists") {
        console.log(`${label} prices already exist`);
      } else {
        throw new Error(`Failed to add ${label} prices`);
      }
    } else {
      console.log(`Added ${label} prices`);
    }
  };

  await addTestPrices(testMonthly, MONTHLY_PRICES, "monthly test store");
  await addTestPrices(testYearly, YEARLY_PRICES, "yearly test store");

  let entitlement: Entitlement | undefined;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEnt = existingEntitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);
  if (existingEnt) {
    console.log("Entitlement already exists:", existingEnt.id);
    entitlement = existingEnt;
  } else {
    const { data: newEnt, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", newEnt.id);
    entitlement = newEnt;
  }

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: {
      product_ids: [testMonthly.id, testYearly.id, appStoreMonthly.id, appStoreYearly.id, playStoreMonthly.id, playStoreYearly.id],
    },
  });
  if (attachEntErr && (attachEntErr as any).type !== "unprocessable_entity_error") {
    throw new Error("Failed to attach products to entitlement");
  }
  console.log("Products attached to entitlement");

  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPackagesError) throw new Error("Failed to list packages");

  const ensurePackage = async (lookupKey: string, displayName: string): Promise<Package> => {
    const existing = existingPackages.items?.find((p) => p.lookup_key === lookupKey);
    if (existing) {
      console.log(`Package ${lookupKey} already exists:`, existing.id);
      return existing;
    }
    const { data: pkg, error } = await createPackages({
      client,
      path: { project_id: project.id, offering_id: offering!.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error) throw new Error(`Failed to create package ${lookupKey}`);
    console.log(`Created package ${lookupKey}:`, pkg.id);
    return pkg;
  };

  const monthlyPkg = await ensurePackage("$rc_monthly", "Monthly");
  const yearlyPkg = await ensurePackage("$rc_annual", "Annual");

  const attachPkg = async (pkg: Package, products: { product_id: string; eligibility_criteria: "all" }[]) => {
    const { error } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: { products },
    });
    if (error && !((error as any).type === "unprocessable_entity_error" && (error as any).message?.includes("Cannot attach"))) {
      throw new Error(`Failed to attach products to package ${pkg.lookup_key}`);
    }
    console.log(`Products attached to package ${pkg.lookup_key}`);
  };

  await attachPkg(monthlyPkg, [
    { product_id: testMonthly.id, eligibility_criteria: "all" },
    { product_id: appStoreMonthly.id, eligibility_criteria: "all" },
    { product_id: playStoreMonthly.id, eligibility_criteria: "all" },
  ]);

  await attachPkg(yearlyPkg, [
    { product_id: testYearly.id, eligibility_criteria: "all" },
    { product_id: appStoreYearly.id, eligibility_criteria: "all" },
    { product_id: playStoreYearly.id, eligibility_criteria: "all" },
  ]);

  const { data: testKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testStoreApp.id } });
  const { data: iosKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: appStoreApp.id } });
  const { data: androidKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: playStoreApp.id } });

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("Test Store App ID:", testStoreApp.id);
  console.log("App Store App ID:", appStoreApp.id);
  console.log("Play Store App ID:", playStoreApp.id);
  console.log("Entitlement Identifier:", ENTITLEMENT_IDENTIFIER);
  console.log("Public API Keys - Test Store:", testKeys?.items.map((k) => k.key).join(", ") ?? "N/A");
  console.log("Public API Keys - App Store:", iosKeys?.items.map((k) => k.key).join(", ") ?? "N/A");
  console.log("Public API Keys - Play Store:", androidKeys?.items.map((k) => k.key).join(", ") ?? "N/A");
  console.log("\nSave these as environment variables:");
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=", testKeys?.items[0]?.key);
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=", iosKeys?.items[0]?.key);
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=", androidKeys?.items[0]?.key);
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
