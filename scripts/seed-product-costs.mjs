/**
 * One-time script to seed product costs from the JJ Flooring spreadsheet.
 * Fetches GHL products via the API, matches by variant name, upserts costs.
 *
 * Usage: node scripts/seed-product-costs.mjs
 */
import { createDecipheriv } from "crypto";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// Cost data from JJ_Flooring_Job_Calculator.xlsx → Pricing sheet
const COSTS = {
  "Jaguar - Carpet":   { install: 2.02, material: 1.11 },
  "Harvest - Carpet":  { install: 2.02, material: 1.44 },
  "Resolve - Carpet":  { install: 2.02, material: 1.78 },
  "Faculty - Carpet":  { install: 2.02, material: 2.00 },
  "Alpine - Vinyl":    { install: 2.96, material: 1.59 },
  "Montclair - Vinyl": { install: 2.96, material: 1.69 },
  "Citadel - Vinyl":   { install: 2.96, material: 2.09 },
};

function decryptSecret(packed) {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY not set in .env");
  const key = Buffer.from(raw, "base64");
  const buffer = Buffer.from(packed, "base64");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function main() {
  // Get the GHL connection from the database
  const cred = await prisma.integrationCredential.findUnique({
    where: { provider: "gohighlevel" },
  });
  if (!cred || !cred.locationId) {
    console.error("No GHL connection found. Connect GHL in Admin -> Sync & Settings first.");
    process.exit(1);
  }

  const token = decryptSecret(cred.encryptedToken);
  const locationId = cred.locationId;

  const headers = {
    Authorization: `Bearer ${token}`,
    Version: "2021-07-28",
    Accept: "application/json",
  };

  // Fetch products from GHL
  const productsRes = await fetch(
    `https://services.leadconnectorhq.com/products/?locationId=${locationId}`,
    { headers },
  );
  const productsData = await productsRes.json();
  const products = (productsData.products || []).filter((p) => (p.status ?? "active") === "active");

  console.log(`Found ${products.length} GHL products.`);

  let seeded = 0;
  for (const product of products) {
    console.log(`\nProduct: "${product.name}" (${product._id})`);

    // Fetch prices for this product
    const pricesRes = await fetch(
      `https://services.leadconnectorhq.com/products/${product._id}/price?locationId=${locationId}`,
      { headers },
    );
    const pricesData = await pricesRes.json();
    const prices = (pricesData.prices || []).filter(
      (p) => !p.deleted && (p.type ?? "one_time") === "one_time",
    );

    for (const price of prices) {
      const label = prices.length > 1 && price.name ? price.name : product.name;
      const match =
        COSTS[label] ??
        Object.entries(COSTS).find(([k]) => norm(k) === norm(label))?.[1];

      if (!match) {
        console.log(`  Skip: "${label}" (no spreadsheet match)`);
        continue;
      }

      await prisma.productCost.upsert({
        where: {
          ghlProductId_ghlPriceId: {
            ghlProductId: product._id,
            ghlPriceId: price._id,
          },
        },
        create: {
          ghlProductId: product._id,
          ghlPriceId: price._id,
          installCost: match.install,
          materialCost: match.material,
        },
        update: {
          installCost: match.install,
          materialCost: match.material,
        },
      });
      console.log(
        `  ✓ ${label}: install=$${match.install}, material=$${match.material}`,
      );
      seeded++;
    }
  }

  console.log(`\nDone. Seeded ${seeded} product costs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
