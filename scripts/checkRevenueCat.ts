import { getUncachableRevenueCatClient } from "./revenueCatClient";
import { listOfferings, listProducts, listPackages, listEntitlements } from "@replit/revenuecat-sdk";

const PROJECT_ID = "projdf936295";

async function check() {
  const client = await getUncachableRevenueCatClient();

  // Fetch all products once
  const { data: allProducts } = await listProducts({ client, path: { project_id: PROJECT_ID }, query: { limit: 50 } });
  const productMap = new Map((allProducts?.items ?? []).map((p) => [p.id, p]));

  console.log("=== OFFERINGS & PACKAGES ===");
  const { data: offerings } = await listOfferings({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  for (const o of offerings?.items ?? []) {
    console.log(`\nOffering: [${o.lookup_key}] is_current=${o.is_current}`);
    const { data: pkgs } = await listPackages({
      client,
      path: { project_id: PROJECT_ID, offering_id: o.id },
      query: { limit: 20 },
    });
    for (const pkg of pkgs?.items ?? []) {
      console.log(`  Package: ${pkg.lookup_key} (${pkg.id})`);
      const productIds: string[] = (pkg as any).products?.map((p: any) => p.product_id) ?? [];
      for (const pid of productIds) {
        const prod = productMap.get(pid);
        if (prod) {
          console.log(`    -> ${prod.display_name} | identifier: ${prod.store_identifier} | app: ${prod.app_id}`);
        } else {
          console.log(`    -> product_id: ${pid} (not found in product list)`);
        }
      }
    }
  }

  console.log("\n=== ENTITLEMENTS ===");
  const { data: entitlements } = await listEntitlements({ client, path: { project_id: PROJECT_ID }, query: { limit: 20 } });
  for (const ent of entitlements?.items ?? []) {
    console.log(`Entitlement: ${ent.lookup_key} (${ent.id})`);
    const productIds: string[] = (ent as any).products?.map((p: any) => p.product_id) ?? [];
    console.log(`  Attached products: ${productIds.length}`);
    for (const pid of productIds) {
      const prod = productMap.get(pid);
      if (prod) {
        console.log(`    -> ${prod.display_name} | ${prod.store_identifier} | app: ${prod.app_id}`);
      }
    }
  }
}

check().catch(console.error);
