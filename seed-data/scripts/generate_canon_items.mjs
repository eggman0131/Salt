#!/usr/bin/env node

/**
 * Generate Canon Items - 3-Stage Pipeline
 *
 * Stage 1: Item list grouped by sub-category (Flash Lite, ~0.7 temp)
 * Stage 2: Enrichment - synonyms, isStaple, allergens (Flash Lite, ~0.5 temp)
 * Stage 3: Conversions & pack sizes (Flash, ~0.2 temp for factual accuracy)
 *
 * Checkpoints stored per-aisle so any stage can be resumed without re-running.
 * Product-only aisles run stages 1 & 2 only (no conversions needed).
 *
 * Usage:
 *   GOOGLE_API_KEY=xxx node generate_canon_items.mjs                         # all aisles, all stages
 *   GOOGLE_API_KEY=xxx node generate_canon_items.mjs fresh-vegetables        # single aisle, all stages
 *   GOOGLE_API_KEY=xxx node generate_canon_items.mjs --stage 1               # all aisles, stage 1 only
 *   GOOGLE_API_KEY=xxx node generate_canon_items.mjs fresh-vegetables --stage 3  # single aisle, stage 3 only
 *   GOOGLE_API_KEY=xxx node generate_canon_items.mjs --rebuild               # ignore all checkpoints
 *   GOOGLE_API_KEY=xxx node generate_canon_items.mjs --merge                 # merge checkpoints into template files only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ITEMS_DIR = path.join(__dirname, '..', 'canon-items');

// ============================================================================
// Models
// ============================================================================

const MODELS = {
  fast: 'gemini-3.1-flash-lite-preview',  // All stages — flash doesn't improve pack size accuracy
};

// ============================================================================
// Aisle configuration
// ============================================================================

const AISLE_PRIORITY = [
  'fresh-vegetables', 'fresh-fruit', 'fresh-salad', 'fresh-herbs', 'fresh-prepared-produce',
  'beef', 'pork', 'lamb', 'chicken', 'turkey', 'sausages-bacon', 'fresh-fish', 'fresh-seafood',
  'milk', 'cheese', 'yoghurt', 'butter-spreads', 'cream',
  'pasta', 'rice-grains', 'cooking-oils', 'spices-seasonings', 'stock-cubes-gravy',
  'flour', 'sugar', 'baking-ingredients', 'cooking-sauces', 'table-sauces',
  'tinned-tomatoes', 'tinned-vegetables', 'tinned-beans-pulses', 'tinned-fish', 'tinned-meat',
  'pickles-chutneys', 'frozen-vegetables', 'frozen-chips-potatoes', 'frozen-meat',
  'frozen-fish', 'frozen-bakery',
  'chilled-ready-meals', 'chilled-soups', 'dips-houmous', 'chilled-pizza',
  'chilled-pasta-gnocchi', 'frozen-ready-meals', 'frozen-pizza', 'ice-cream-desserts',
  'bread-loaves', 'rolls-baps', 'pastries', 'cakes', 'tortillas-flatbreads',
  'crisps', 'nuts-seeds', 'chocolate', 'sweets', 'biscuits',
  'fizzy-drinks', 'juices', 'squash-cordials', 'bottled-water', 'beer-cider', 'wine', 'spirits',
];

// Product-only aisles skip Stage 3 (no density or count weights needed)
const PRODUCT_ONLY_AISLES = new Set([
  'chilled-ready-meals', 'chilled-soups', 'dips-houmous', 'chilled-pizza',
  'chilled-pasta-gnocchi', 'frozen-ready-meals', 'frozen-pizza', 'ice-cream-desserts',
  'bread-loaves', 'rolls-baps', 'pastries', 'cakes', 'tortillas-flatbreads',
  'crisps', 'chocolate', 'sweets', 'biscuits',
  'fizzy-drinks', 'juices', 'squash-cordials', 'bottled-water', 'beer-cider', 'wine', 'spirits',
]);

// Aisle scope descriptions — prevent cross-aisle contamination in Stage 1.
// Where aisles overlap, the more specific aisle "wins" and the broader aisle
// explicitly excludes those items. This mirrors how real UK supermarkets are laid out.
// Deduplication in the merge step provides a safety net for anything that slips through.
const AISLE_SCOPE = {
  // Fresh produce — tightly scoped to prevent lettuce/herbs/prepared veg crossover
  'fresh-vegetables':
    'Whole unprocessed vegetables ONLY. Do NOT include: salad leaves, rocket, watercress, baby spinach, mixed leaves (those belong in fresh-salad). Do NOT include: parsley, coriander, basil, mint, thyme, or any cut herbs (those belong in fresh-herbs). Do NOT include: pre-washed, pre-cut, or stir-fry mixes (those belong in fresh-prepared-produce). Examples of what IS here: carrot, potato, onion, broccoli, courgette, aubergine, pepper, leek, cauliflower, cabbage, sweetcorn, celery, fennel, asparagus, squash, mushroom.',
  'fresh-salad':
    'Salad leaves and salad-specific items ONLY: lettuce varieties (iceberg, romaine, little gem, butterhead), mixed salad leaves, rocket, watercress, baby spinach, lamb\'s lettuce, prepared salad bags, and salad dressings. Do NOT include general vegetables like cucumber, tomato, or pepper (those are in fresh-vegetables).',
  'fresh-herbs':
    'Fresh cut herbs and herb plants ONLY: parsley, coriander, basil, mint, rosemary, thyme, chives, dill, tarragon, oregano, sage, bay leaves. Do NOT include vegetables or salad items.',
  'fresh-prepared-produce':
    'Pre-prepared fruit and vegetables ONLY: stir-fry mixes, pre-cut vegetable packs, soup veg mixes, stew packs, spiralised veg, pre-washed baby veg, trimmed green beans, sliced mushrooms. Do NOT include whole unprocessed vegetables.',

  // Meat — strictly one animal per aisle
  'beef':
    'Beef products ONLY: mince, steaks (ribeye, sirloin, rump, fillet), roasting joints, stewing steak, diced beef, brisket, short ribs, offal (liver, kidney). Do NOT include chicken, pork, lamb, fish, or any other meat.',
  'pork':
    'Pork products ONLY: chops, loin steaks, belly pork, shoulder joints, tenderloin, leg joints, mince, diced pork, ribs, crackling. Do NOT include sausages or bacon (separate aisle). Do NOT include beef, chicken, or lamb.',
  'lamb':
    'Lamb and mutton products ONLY: chops, leg, shoulder, rack of lamb, shanks, mince, diced lamb, rumps. Do NOT include beef, pork, or chicken.',
  'chicken':
    'Chicken products ONLY: whole birds, breasts, thighs, drumsticks, wings, legs, mince, diced chicken, crown. Do NOT include turkey, duck, or other poultry.',
  'turkey':
    'Turkey products ONLY: whole birds, breast joints, mince, steaks, drumsticks, crown. Do NOT include chicken or other poultry.',
  'sausages-bacon':
    'Sausages, bacon, and cured pork products ONLY: pork sausages, beef sausages, chipolatas, cocktail sausages, streaky bacon, back bacon, smoked bacon, lardons, pancetta, black pudding, white pudding, chorizo. Do NOT include fresh unprocessed pork (separate aisle).',
  'fresh-fish':
    'Fresh fin fish ONLY: cod, haddock, salmon, sea bass, sea bream, trout, tuna, mackerel, plaice, sole, halibut, tilapia, pollock, coley. Do NOT include shellfish, prawns, squid, or any other seafood.',
  'fresh-seafood':
    'Fresh shellfish and seafood ONLY: prawns, king prawns, tiger prawns, scallops, mussels, clams, squid, cuttlefish, crab, lobster, oysters, langoustines. Do NOT include fin fish.',

  // Dairy — each sub-type in its own aisle
  'milk':
    'Milk and milk alternatives ONLY: whole milk, semi-skimmed, skimmed, 1% milk, oat milk, almond milk, soy milk, rice milk, coconut milk drink, lactose-free milk. Do NOT include cream, cheese, yoghurt, or butter.',
  'cheese':
    'Cheese ONLY: cheddar, brie, camembert, stilton, mozzarella, feta, halloumi, cream cheese, gouda, edam, parmesan, ricotta, goat\'s cheese, cottage cheese, red leicester, wensleydale, gruyere. Do NOT include yoghurt, cream, butter, or milk.',
  'yoghurt':
    'Yoghurt and fermented dairy ONLY: natural yoghurt, Greek yoghurt, fruit yoghurts, low-fat yoghurt, bio yoghurt, fromage frais, quark. Do NOT include cream, cheese, or milk.',
  'butter-spreads':
    'Butter and spreads ONLY: salted butter, unsalted butter, spreadable butter, margarine, olive spread, sunflower spread, dairy-free spread, ghee. Do NOT include cream, cheese, or cooking oils.',
  'cream':
    'Cream products ONLY: double cream, single cream, whipping cream, clotted cream, soured cream, half-fat cream, aerosol cream, UHT cream. Do NOT include milk, butter, or yoghurt.',

  // Tinned — keep tomatoes, veg, beans, fish, and meat separate
  'tinned-tomatoes':
    'Tinned tomato products ONLY: chopped tomatoes, whole plum tomatoes, passata, tomato puree, cherry tomatoes in juice, sun-dried tomatoes in oil. Do NOT include tinned vegetables, beans, or pulses.',
  'tinned-vegetables':
    'Tinned vegetables ONLY: sweetcorn, mushy peas, processed peas, carrots, potatoes, artichoke hearts, asparagus, beetroot, mixed vegetables, spinach. Do NOT include tinned tomatoes, beans, pulses, fish, or meat.',
  'tinned-beans-pulses':
    'Tinned beans and pulses ONLY: baked beans, kidney beans, chickpeas, lentils, butter beans, cannellini beans, black beans, borlotti beans, mixed beans, marrowfat peas. Do NOT include tinned vegetables or tinned tomatoes.',
  'tinned-fish':
    'Tinned fish and seafood ONLY: tuna, sardines, salmon, mackerel, anchovies, pilchards, crab, prawns, mussels, oysters. Do NOT include tinned meat.',
  'tinned-meat':
    'Tinned meat ONLY: corned beef, spam, chicken in brine, ham, pulled pork, minced beef, stewed steak, hot dogs. Do NOT include tinned fish.',

  // Frozen — chips/potatoes separate from general veg
  'frozen-vegetables':
    'Frozen vegetables ONLY: peas, sweet corn, broccoli, spinach, green beans, mixed veg, cauliflower, carrots, Brussels sprouts, edamame, broad beans, kale. Do NOT include frozen chips or potato products (separate aisle). Do NOT include frozen fish or meat.',
  'frozen-chips-potatoes':
    'Frozen potato products ONLY: chips (straight cut, crinkle cut, thin, thick), oven chips, sweet potato fries, potato waffles, hash browns, potato croquettes, jacket potatoes. Do NOT include general frozen vegetables.',
  'frozen-meat':
    'Frozen meat and poultry ONLY: beef mince, chicken breasts, chicken thighs, burgers, meatballs, diced lamb, pork chops. Do NOT include frozen fish, sausages, or frozen ready meals.',
  'frozen-fish':
    'Frozen fish and seafood ONLY: cod fillets, haddock fillets, salmon fillets, fish fingers, breaded fish, prawns, scampi. Do NOT include frozen meat or frozen vegetables.',

  // Pantry cross-exclusions
  'baking-ingredients':
    'Baking-specific ingredients ONLY: baking powder, bicarbonate of soda, cream of tartar, dried yeast, vanilla extract, vanilla pods, cocoa powder, chocolate chips, glacé cherries, marzipan, royal icing, food colouring, edible decorations, dried fruit (raisins, sultanas, currants, mixed peel). Do NOT include flour (separate aisle), sugar (separate aisle), or nuts/seeds (separate aisle).',
  'flour':
    'Flour and flour alternatives ONLY: plain flour, self-raising flour, strong bread flour, wholemeal flour, spelt flour, rye flour, cornflour, rice flour, chickpea flour, almond flour. Do NOT include other baking ingredients, sugar, or dried yeast.',
  'sugar':
    'Sugar and sweeteners ONLY: caster sugar, granulated sugar, icing sugar, demerara sugar, brown sugar, muscovado sugar, golden syrup, treacle, honey, maple syrup, agave syrup, stevia, sweetener tablets. Do NOT include flour or other baking ingredients.',
  'nuts-seeds':
    'Nuts and seeds ONLY: whole almonds, cashews, walnuts, peanuts, hazelnuts, Brazil nuts, pecans, pistachios, pine nuts, sunflower seeds, pumpkin seeds, sesame seeds, chia seeds, flaxseeds, poppy seeds. Do NOT include nut butters (table sauces) or baking items like cocoa or dried fruit.',
};

// ============================================================================
// Checkpoint helpers
// ============================================================================

function checkpointPath(aisleId, stage) {
  return path.join(ITEMS_DIR, aisleId, `stage${stage}.json`);
}

function hasCheckpoint(aisleId, stage) {
  return fs.existsSync(checkpointPath(aisleId, stage));
}

function loadCheckpoint(aisleId, stage) {
  return JSON.parse(fs.readFileSync(checkpointPath(aisleId, stage), 'utf8'));
}

function saveCheckpoint(aisleId, stage, data) {
  fs.writeFileSync(checkpointPath(aisleId, stage), JSON.stringify(data, null, 2) + '\n');
}

// ============================================================================
// File helpers
// ============================================================================

function loadTemplate(aisleId) {
  const p = path.join(ITEMS_DIR, aisleId, 'template.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveTemplate(aisleId, template) {
  const p = path.join(ITEMS_DIR, aisleId, 'template.json');
  fs.writeFileSync(p, JSON.stringify(template, null, 2) + '\n');
}

function loadAisles() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'canon-aisles.json'), 'utf8'));
}

function findAisleSnapshot(aisles, aisleId) {
  return aisles.find(a => a.tier1.toLowerCase().replace(/\s+/g, '-') === aisleId)
    || { tier3: 'food', tier2: 'unknown', tier1: 'Unknown' };
}

function toSlug(name) {
  return name.toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
}

function normaliseName(name) {
  return name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ');
}

// ============================================================================
// Gemini helper
// ============================================================================

async function callGemini(client, model, prompt, temperature = 0.7) {
  const response = await client.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 8000 },
  });

  const raw = response.candidates[0].content.parts[0].text;
  // Strip markdown code fences if model adds them
  const text = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON parse failed. Raw response:\n${raw.slice(0, 500)}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Stage 1: Item list by sub-category
// ============================================================================

async function runStage1(client, aisleId, aisleSnapshot) {
  const { tier1 } = aisleSnapshot;
  const scopeNote = AISLE_SCOPE[aisleId] ? `\n\nSCOPE: ${AISLE_SCOPE[aisleId]}` : '';

  const prompt = `List all items you would typically find in the "${tier1}" aisle of a UK supermarket (Tesco, Sainsbury's, Asda, Morrisons).${scopeNote}

Rules:
- UK English names only (courgette not zucchini, aubergine not eggplant, sweetcorn not corn, swede not rutabaga, pak choi not bok choy, rocket not arugula, coriander not cilantro, chilli not chili)
- Only items genuinely stocked in mainstream UK supermarkets
- Group by sub-category; only list items that truly belong in each sub-category
- Do not pad — stop when you have listed all realistic items
- Item names should be singular (Carrot, not Carrots)

Return ONLY valid JSON — no markdown, no explanation:
{
  "subcategories": [
    {
      "name": "Root vegetables",
      "items": ["Carrot", "Parsnip", "Turnip", "Swede", "Beetroot"]
    }
  ]
}`;

  return await callGemini(client, MODELS.fast, prompt, 0.7);
}

function flattenSubcategories(stage1Result) {
  return stage1Result.subcategories.flatMap(sc => sc.items.map(name => ({
    name: name.trim(),
    subcategory: sc.name,
  })));
}

// ============================================================================
// Stage 2: Enrichment
// Stage 3: Conversions & pack sizes
//
// These two functions are intentionally reusable by the matching pipeline.
// When a new raw ingredient name arrives that has no canon match, the pipeline
// can call runStage2 + runStage3 for a single-item flat array to generate a
// fully-populated CanonicalItem on-the-fly, without re-running Stage 1.
// ============================================================================

async function runStage2(client, flatItems, aisleSnapshot) {
  const { tier1 } = aisleSnapshot;
  const itemList = flatItems.map(i => i.name).join('\n');

  const prompt = `For each item in the "${tier1}" aisle of a UK supermarket, provide enrichment data.

Items:
${itemList}

For each item return:
- name: exact name as listed above
- synonyms: 1-3 common UK alternative names or spellings (e.g. "Minced beef" for "Beef mince")
- isStaple: true if this is a basic everyday ingredient most households will have in stock
- allergens: array from [milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy, celery, mustard, sesame] — only include if the item itself naturally contains the allergen
- itemType: "ingredient" for raw or minimally processed foods, "product" for prepared or branded items

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "name": "Carrot",
    "synonyms": ["Carrots"],
    "isStaple": true,
    "allergens": [],
    "itemType": "ingredient"
  }
]`;

  return await callGemini(client, MODELS.fast, prompt, 0.5);
}

// ============================================================================
// Stage 3: Conversions & pack sizes
// ============================================================================

async function runStage3(client, flatItems, template, aisleSnapshot) {
  const { tier1 } = aisleSnapshot;
  const templateType = template.templateType;
  const itemList = flatItems.map(i => i.name).join('\n');

  let conversionInstructions = '';
  let packSizeExamples = '';

  if (templateType === 'fresh-produce') {
    conversionInstructions = `For each item provide:
- count_equivalents: realistic individual weights in grams — {small_g, medium_g, large_g}
  (e.g. Carrot: small=70, medium=130, large=190 | Apple: small=150, medium=182, large=225 | Onion: small=120, medium=200, large=300)
- pack_sizes: 2-3 sizes as sold in UK supermarkets (Tesco, Sainsbury's, Asda, Morrisons)

CRITICAL pack size rules:
- These are RETAIL supermarket sizes only — NOT wholesale, NOT market stall, NOT catering
- Maximum pack size is 2kg for most items (loose-weight exceptions: potato up to 2.5kg, apple up to 2kg)
- Potatoes: 750g, 1kg, 1.5kg, or 2kg bags — NOT 5kg or 10kg
- Carrots: 250g, 500g, 1kg — NOT 2kg
- Fresh herbs: 25g or 30g packet — NOT 100g
- Tomatoes: 250g, 500g punnet, or loose per kg — NOT 2kg
- Salad leaves: 80g, 120g, 200g bag — NOT 500g`;
    packSizeExamples = `UK supermarket pack size reference:
Carrot=500g bag,1kg bag | Parsnip=500g bag | Onion=600g net,1kg net | Red onion=500g net | Potato=750g,1.5kg,2kg | Sweet potato=500g,1kg | Broccoli=400g head | Cauliflower=single head ~600g | Courgette=loose ~200g each,3-pack | Aubergine=single ~350g | Pepper=3-pack ~450g | Leek=500g pack | Celery=single head ~500g | Cucumber=single ~300g | Tomato=loose,500g punnet,400g vine | Cherry tomato=250g,400g punnet | Mushroom=250g,500g | Spinach=200g,400g bag | Spring onion=bunch ~100g | Garlic=loose bulb,4-bulb net | Ginger=loose per 100g`;
  } else if (templateType === 'meat-fish-dairy') {
    conversionInstructions = `For each item provide:
- density_g_per_ml: ONLY for liquids — milk=1.03, cream=0.99-1.01, others=null
- pack_sizes: 2-3 sizes as sold in UK supermarkets`;
    packSizeExamples = `Pack size examples: Beef mince=400g,500g,750g | Steak=approx 200-350g single | Whole chicken=1.2-1.8kg | Salmon fillet=120-180g single | Milk=500ml,1L,2L | Cheese=150g,200g,250g block | Yoghurt=150g,200g,500g tub | Butter=250g block`;
  } else if (templateType === 'core-pantry') {
    conversionInstructions = `For each item provide:
- density_g_per_ml: for liquids and oils only (olive oil=0.91, sunflower oil=0.92, milk=1.03, vinegar=1.01, water-based sauces=~1.05) — null for solids
- volume_equivalents: for dry goods used in cooking — {tsp_g, tbsp_g, cup_g} (e.g. flour: tsp=3, tbsp=9, cup=120 | sugar: tsp=4, tbsp=13, cup=200) — null for items not measured this way
- pack_sizes: 2-3 realistic UK supermarket sizes`;
    packSizeExamples = `Pack size examples: Pasta=500g box | Rice=500g,1kg bag | Flour=1kg,1.5kg bag | Sugar=500g,1kg bag | Spice=40g,100g jar | Olive oil=250ml,500ml,1L bottle | Stock cube=8-pack | Tinned tomatoes=400g tin`;
  } else if (templateType === 'frozen-ingredients') {
    conversionInstructions = `For each item provide:
- pack_sizes: 2-3 realistic UK supermarket sizes`;
    packSizeExamples = `Pack size examples: Frozen peas=400g,900g bag | Frozen chips=700g,1kg bag | Frozen fish fillet=300g,450g pack | Frozen berries=300g,500g bag | Frozen mince=400g,500g bag`;
  }

  const prompt = `For each item in the "${tier1}" aisle of a UK supermarket, provide accurate conversion and pack size data.

${conversionInstructions}

${packSizeExamples}

Items:
${itemList}

Return ONLY a valid JSON array — no markdown, no explanation. Pack sizes must use unit "g" or "ml":
[
  {
    "name": "Carrot",
    "count_equivalents": { "small_g": 70, "medium_g": 130, "large_g": 190 },
    "pack_sizes": [
      { "unit": "g", "size": 250, "description": "250g loose" },
      { "unit": "g", "size": 500, "description": "500g bag" }
    ]
  }
]`;

  return await callGemini(client, MODELS.fast, prompt, 0.2);
}

// ============================================================================
// Merge all stages into CanonicalItem objects
// ============================================================================

function mergeIntoCanonicalItems(aisleId, flatItems, stage2, stage3, template, aisleSnapshot) {
  const templateType = template.templateType;
  const s2Map = new Map(stage2.map(i => [i.name, i]));
  const s3Map = stage3 ? new Map(stage3.map(i => [i.name, i])) : new Map();

  return flatItems.map(({ name, subcategory }) => {
    const s2 = s2Map.get(name) || {};
    const s3 = s3Map.get(name) || {};

    const slug = toSlug(name);
    const id = `${aisleId}-${slug}`;

    // Build unit from template defaults
    const unit = { ...template.defaults.unit };

    if (s3.density_g_per_ml !== undefined && s3.density_g_per_ml !== null) {
      unit.density_g_per_ml = s3.density_g_per_ml;
    }

    if (templateType === 'fresh-produce' && s3.count_equivalents) {
      unit.count_equivalents = {
        small: s3.count_equivalents.small_g || null,
        medium: s3.count_equivalents.medium_g || null,
        large: s3.count_equivalents.large_g || null,
        default_each_weight: s3.count_equivalents.medium_g || null,
      };
    }

    if (templateType === 'core-pantry' && s3.volume_equivalents) {
      unit.volume_equivalents = {
        tsp: s3.volume_equivalents.tsp_g || template.defaults.unit.volume_equivalents?.tsp || null,
        tbsp: s3.volume_equivalents.tbsp_g || template.defaults.unit.volume_equivalents?.tbsp || null,
        cup: s3.volume_equivalents.cup_g || template.defaults.unit.volume_equivalents?.cup || null,
      };
    }

    // Build shopping from template defaults
    const shopping = { ...template.defaults.shopping };
    if (s3.pack_sizes && Array.isArray(s3.pack_sizes) && s3.pack_sizes.length > 0) {
      shopping.pack_sizes = s3.pack_sizes.map(ps => {
        const unit = ps.unit || shopping.shopping_unit;
        const description = ps.description || (
          ps.size >= 1000
            ? `${ps.size / 1000}${unit === 'ml' ? 'L' : 'kg'}`
            : `${ps.size}${unit}`
        );
        return { unit, size: ps.size, description };
      });
    }

    return {
      id,
      name,
      normalisedName: normaliseName(name),
      aisleId,
      aisle: aisleSnapshot,
      unit,
      shopping,
      synonyms: s2.synonyms || [],
      isStaple: s2.isStaple || false,
      itemType: s2.itemType || 'ingredient',
      allergens: s2.allergens || [],
      subcategory,
      barcodes: [],
      externalSources: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      approved: true,
    };
  });
}

// ============================================================================
// Process a single aisle through all required stages
// ============================================================================

async function processAisle(client, aisleId, aisles, { targetStage, rebuild }) {
  const template = loadTemplate(aisleId);
  const aisleSnapshot = findAisleSnapshot(aisles, aisleId);
  const isProductOnly = PRODUCT_ONLY_AISLES.has(aisleId);
  const maxStage = isProductOnly ? 2 : 3;

  let flatItems;

  // ---- Stage 1 ----
  if (targetStage === null || targetStage === 1) {
    if (!rebuild && hasCheckpoint(aisleId, 1)) {
      process.stdout.write('  Stage 1: cached  ');
    } else {
      process.stdout.write('  Stage 1: running ');
      const result = await runStage1(client, aisleId, aisleSnapshot);
      saveCheckpoint(aisleId, 1, result);
      const count = result.subcategories?.reduce((n, sc) => n + sc.items.length, 0) || 0;
      process.stdout.write(`-> ${count} items (${result.subcategories?.length || 0} sub-categories)\n`);
      await sleep(1000);
    }
  }

  // ---- Stage 2 ----
  if (targetStage === null || targetStage === 2) {
    if (!hasCheckpoint(aisleId, 1)) {
      console.log('  Stage 2: skipped (no Stage 1 checkpoint)');
    } else if (!rebuild && hasCheckpoint(aisleId, 2)) {
      process.stdout.write('  Stage 2: cached  ');
    } else {
      flatItems = flatItems || flattenSubcategories(loadCheckpoint(aisleId, 1));
      process.stdout.write(`  Stage 2: running (${flatItems.length} items) `);
      const result = await runStage2(client, flatItems, aisleSnapshot);
      saveCheckpoint(aisleId, 2, result);
      process.stdout.write(`-> enriched\n`);
      await sleep(1000);
    }
  }

  // ---- Stage 3 (ingredient aisles only) ----
  if (!isProductOnly && (targetStage === null || targetStage === 3)) {
    if (!hasCheckpoint(aisleId, 1) || !hasCheckpoint(aisleId, 2)) {
      console.log('  Stage 3: skipped (missing earlier checkpoints)');
    } else if (!rebuild && hasCheckpoint(aisleId, 3)) {
      process.stdout.write('  Stage 3: cached  ');
    } else {
      flatItems = flatItems || flattenSubcategories(loadCheckpoint(aisleId, 1));
      process.stdout.write(`  Stage 3: running (${flatItems.length} items) `);
      const result = await runStage3(client, flatItems, template, aisleSnapshot);
      saveCheckpoint(aisleId, 3, result);
      process.stdout.write(`-> conversions done\n`);
      await sleep(1500);
    }
  }

  // ---- Merge into template.json ----
  if (targetStage === null || targetStage === maxStage) {
    if (!hasCheckpoint(aisleId, 1) || !hasCheckpoint(aisleId, 2)) {
      return [];
    }

    flatItems = flattenSubcategories(loadCheckpoint(aisleId, 1));
    const stage2 = loadCheckpoint(aisleId, 2);
    const stage3 = !isProductOnly && hasCheckpoint(aisleId, 3) ? loadCheckpoint(aisleId, 3) : null;

    const canonicalItems = mergeIntoCanonicalItems(
      aisleId, flatItems, stage2, stage3, template, aisleSnapshot
    );

    template.items = canonicalItems;
    saveTemplate(aisleId, template);
    console.log(`  Merged: ${canonicalItems.length} items written to template.json`);
    return canonicalItems;
  }

  return [];
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_API_KEY environment variable not set');
    process.exit(1);
  }

  // Parse CLI args
  const args = process.argv.slice(2);
  const mergeOnly = args.includes('--merge');
  const rebuild = args.includes('--rebuild');
  const stageArg = args.find(a => a === '--stage');
  const targetStage = stageArg ? parseInt(args[args.indexOf('--stage') + 1], 10) : null;
  const requestedAisle = args.find(a => !a.startsWith('--') && a !== String(targetStage));

  if (requestedAisle && !AISLE_PRIORITY.includes(requestedAisle)) {
    console.error(`Unknown aisle: ${requestedAisle}`);
    console.error(`Valid aisles:\n  ${AISLE_PRIORITY.join('\n  ')}`);
    process.exit(1);
  }

  const aislesToProcess = requestedAisle ? [requestedAisle] : AISLE_PRIORITY;

  const client = new GoogleGenAI({ apiKey });
  const aisles = loadAisles();
  const allItems = [];

  const modeLabel = mergeOnly ? 'merge only'
    : rebuild ? 'full rebuild'
    : targetStage ? `stage ${targetStage} only`
    : 'resume (skipping completed stages)';

  console.log('Canon Items Generator — 3-Stage Pipeline');
  console.log('='.repeat(60));
  console.log(`Mode:   ${modeLabel}`);
  console.log(`Aisles: ${aislesToProcess.length}`);
  console.log('='.repeat(60) + '\n');

  for (const aisleId of aislesToProcess) {
    console.log(`\n[${aisleId}]`);

    try {
      if (mergeOnly) {
        // Merge-only: rebuild template.json from existing checkpoints
        const template = loadTemplate(aisleId);
        const aisleSnapshot = findAisleSnapshot(aisles, aisleId);
        const isProductOnly = PRODUCT_ONLY_AISLES.has(aisleId);

        if (!hasCheckpoint(aisleId, 1) || !hasCheckpoint(aisleId, 2)) {
          console.log('  Skipped (missing checkpoints)');
          continue;
        }

        const flatItems = flattenSubcategories(loadCheckpoint(aisleId, 1));
        const stage2 = loadCheckpoint(aisleId, 2);
        const stage3 = !isProductOnly && hasCheckpoint(aisleId, 3) ? loadCheckpoint(aisleId, 3) : null;
        const canonicalItems = mergeIntoCanonicalItems(
          aisleId, flatItems, stage2, stage3, template, aisleSnapshot
        );
        template.items = canonicalItems;
        saveTemplate(aisleId, template);
        allItems.push(...canonicalItems);
        console.log(`  Merged: ${canonicalItems.length} items`);
      } else {
        const items = await processAisle(client, aisleId, aisles, { targetStage, rebuild });
        allItems.push(...items);
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  // Write combined output
  if (!targetStage || targetStage === 3) {
    // Deduplicate by normalisedName — AISLE_PRIORITY order means the last
    // occurrence (more specific aisle) wins, e.g. "lettuce" from fresh-salad
    // wins over "lettuce" from fresh-vegetables if it slips through AISLE_SCOPE.
    const seen = new Map();
    for (const item of allItems) {
      seen.set(item.normalisedName, item);
    }
    const deduped = Array.from(seen.values());
    const dedupedCount = allItems.length - deduped.length;

    const combinedPath = path.join(__dirname, '..', 'canon-items-combined.json');
    fs.writeFileSync(combinedPath, JSON.stringify(deduped, null, 2) + '\n');
    console.log('\n' + '='.repeat(60));
    console.log(`Done. Total items: ${deduped.length} (${dedupedCount > 0 ? `${dedupedCount} duplicates removed` : 'no duplicates'})`);
    console.log(`Combined: ${combinedPath}`);
    console.log('='.repeat(60));
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
