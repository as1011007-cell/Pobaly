import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listProducts,
  listApps,
  createProduct,
  listEntitlements,
  attachProductsToEntitlement,
  listOfferings,
  listPackages,
  attachProductsToPackage,
  detachProductsFromPackage,
  deleteProduct,
  type App,
  type Product,
} from "@replit/revenuecat-sdk";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;

async function updateAndroidProducts() {
  const client = await getUncachableRevenueCatClient();

  const { data: apps } = await listApps({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  const playStoreApp = apps.items.find((a: App) => a.type === "play_store");
  if (!playStoreApp) throw new Error("Play Store app not found");
  console.log(`Play Store app: ${playStoreApp.id}`);

  const { data: productsData } = await listProducts({ client, path: { project_id: PROJECT_ID }, query: { limit: 100 } });
  const allProducts: Product[] = productsData?.items ?? [];

  const oldMonthly = allProducts.find(p => p.store_identifier === "probaly_premium_monthly:monthly" && p.app_id === playStoreApp.id);
  const oldAnnual = allProducts.find(p => p.store_identifier === "probaly_premium_annual:annual" && p.app_id === playStoreApp.id);

  const existingMonthly = allProducts.find(p => p.store_identifier === "probaly_premium_monthly" && p.app_id === playStoreApp.id);
  const existingYearly = allProducts.find(p => p.store_identifier === "probaly_premium_yearly" && p.app_id === playStoreApp.id);

  console.log(`Old monthly: ${oldMonthly?.id ?? "not found"} (${oldMonthly?.store_identifier})`);
  console.log(`Old annual: ${oldAnnual?.id ?? "not found"} (${oldAnnual?.store_identifier})`);
  console.log(`Existing monthly with new ID: ${existingMonthly?.id ?? "not found"}`);
  console.log(`Existing yearly with new ID: ${existingYearly?.id ?? "not found"}`);

  let newMonthly: Product;
  if (existingMonthly) {
    console.log("Monthly product with correct identifier already exists");
    newMonthly = existingMonthly;
  } else {
    const { data, error } = await createProduct({
      client,
      path: { project_id: PROJECT_ID },
      body: {
        store_identifier: "probaly_premium_monthly",
        app_id: playStoreApp.id,
        type: "subscription",
        display_name: "Probaly Premium Monthly (Android)",
      },
    });
    if (error) throw new Error(`Failed to create new monthly: ${JSON.stringify(error)}`);
    newMonthly = data;
    console.log(`Created new monthly product: ${newMonthly.id}`);
  }

  let newYearly: Product;
  if (existingYearly) {
    console.log("Yearly product with correct identifier already exists");
    newYearly = existingYearly;
  } else {
    const { data, error } = await createProduct({
      client,
      path: { project_id: PROJECT_ID },
      body: {
        store_identifier: "probaly_premium_yearly",
        app_id: playStoreApp.id,
        type: "subscription",
        display_name: "Probaly Premium Yearly (Android)",
      },
    });
    if (error) throw new Error(`Failed to create new yearly: ${JSON.stringify(error)}`);
    newYearly = data;
    console.log(`Created new yearly product: ${newYearly.id}`);
  }

  const { data: entData } = await listEntitlements({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  const entitlement = entData?.items?.find(e => e.lookup_key === "premium");
  if (!entitlement) throw new Error("Premium entitlement not found");

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: PROJECT_ID, entitlement_id: entitlement.id },
    body: { product_ids: [newMonthly.id, newYearly.id] },
  });
  if (attachEntErr && attachEntErr.type !== "unprocessable_entity_error") {
    throw new Error(`Failed to attach to entitlement: ${JSON.stringify(attachEntErr)}`);
  }
  console.log("New products attached to premium entitlement");

  const { data: offeringsData } = await listOfferings({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  const offering = offeringsData?.items?.find(o => o.lookup_key === "default");
  if (!offering) throw new Error("Default offering not found");

  const { data: pkgsData } = await listPackages({ client, path: { project_id: PROJECT_ID, offering_id: offering.id }, query: { limit: 20 } });
  const monthlyPkg = pkgsData?.items?.find(p => p.lookup_key === "$rc_monthly");
  const annualPkg = pkgsData?.items?.find(p => p.lookup_key === "$rc_annual");

  if (!monthlyPkg || !annualPkg) throw new Error("Packages not found");

  if (oldMonthly) {
    const { error } = await detachProductsFromPackage({
      client,
      path: { project_id: PROJECT_ID, package_id: monthlyPkg.id },
      body: { product_ids: [oldMonthly.id] },
    });
    if (error) console.warn(`Detach old monthly warning: ${JSON.stringify(error)}`);
    else console.log("Detached old monthly from package");
  }

  if (oldAnnual) {
    const { error } = await detachProductsFromPackage({
      client,
      path: { project_id: PROJECT_ID, package_id: annualPkg.id },
      body: { product_ids: [oldAnnual.id] },
    });
    if (error) console.warn(`Detach old annual warning: ${JSON.stringify(error)}`);
    else console.log("Detached old annual from package");
  }

  const { error: attachMonthlyErr } = await attachProductsToPackage({
    client,
    path: { project_id: PROJECT_ID, package_id: monthlyPkg.id },
    body: { products: [{ product_id: newMonthly.id, eligibility_criteria: "all" }] },
  });
  if (attachMonthlyErr && !JSON.stringify(attachMonthlyErr).includes("Cannot attach")) {
    console.warn(`Attach monthly warning: ${JSON.stringify(attachMonthlyErr)}`);
  } else {
    console.log("New monthly attached to package");
  }

  const { error: attachAnnualErr } = await attachProductsToPackage({
    client,
    path: { project_id: PROJECT_ID, package_id: annualPkg.id },
    body: { products: [{ product_id: newYearly.id, eligibility_criteria: "all" }] },
  });
  if (attachAnnualErr && !JSON.stringify(attachAnnualErr).includes("Cannot attach")) {
    console.warn(`Attach annual warning: ${JSON.stringify(attachAnnualErr)}`);
  } else {
    console.log("New yearly attached to package");
  }

  if (oldMonthly) {
    const { error } = await deleteProduct({ client, path: { project_id: PROJECT_ID, product_id: oldMonthly.id } });
    if (error) console.warn(`Delete old monthly warning: ${JSON.stringify(error)}`);
    else console.log(`Deleted old monthly product: ${oldMonthly.id}`);
  }

  if (oldAnnual) {
    const { error } = await deleteProduct({ client, path: { project_id: PROJECT_ID, product_id: oldAnnual.id } });
    if (error) console.warn(`Delete old annual warning: ${JSON.stringify(error)}`);
    else console.log(`Deleted old annual product: ${oldAnnual.id}`);
  }

  console.log("\n========================================");
  console.log("Android product identifiers updated!");
  console.log(`Monthly: probaly_premium_monthly (${newMonthly.id})`);
  console.log(`Yearly: probaly_premium_yearly (${newYearly.id})`);
  console.log("========================================");
}

updateAndroidProducts().catch(console.error);
