#!/bin/bash

set -e

BASE_DIR="seed-data/canon-items"
mkdir -p "$BASE_DIR"

# -------------------------------
# Template JSON blocks
# -------------------------------

fresh_produce_template='{
  "aisleId": "__ID__",
  "templateType": "fresh-produce",
  "defaults": {
    "unit": {
      "canonical_unit_type": "mass",
      "canonical_unit": "g",
      "density_g_per_ml": null,
      "count_equivalents": {
        "small": null,
        "medium": null,
        "large": null,
        "default_each_weight": null
      }
    },
    "shopping": {
      "shopping_unit": "g",
      "pack_sizes": [],
      "loose": true
    }
  },
  "items": []
}'

core_pantry_template='{
  "aisleId": "__ID__",
  "templateType": "core-pantry",
  "defaults": {
    "unit": {
      "canonical_unit_type": "mass",
      "canonical_unit": "g",
      "density_g_per_ml": null,
      "volume_equivalents": {
        "tsp": 5,
        "tbsp": 15,
        "cup": 240
      }
    },
    "shopping": {
      "shopping_unit": "g",
      "pack_sizes": [],
      "loose": false
    }
  },
  "items": []
}'

meat_fish_dairy_template='{
  "aisleId": "__ID__",
  "templateType": "meat-fish-dairy",
  "defaults": {
    "unit": {
      "canonical_unit_type": "mass",
      "canonical_unit": "g",
      "density_g_per_ml": null
    },
    "shopping": {
      "shopping_unit": "g",
      "pack_sizes": [],
      "loose": false
    }
  },
  "items": []
}'

frozen_ingredients_template='{
  "aisleId": "__ID__",
  "templateType": "frozen-ingredients",
  "defaults": {
    "unit": {
      "canonical_unit_type": "mass",
      "canonical_unit": "g",
      "density_g_per_ml": null
    },
    "shopping": {
      "shopping_unit": "g",
      "pack_sizes": [],
      "loose": false
    }
  },
  "items": []
}'

product_only_template='{
  "aisleId": "__ID__",
  "templateType": "product-only",
  "defaults": {
    "unit": {
      "canonical_unit_type": "count",
      "canonical_unit": "each"
    },
    "shopping": {
      "shopping_unit": "each",
      "pack_sizes": [],
      "loose": false
    }
  },
  "items": []
}'

# -------------------------------
# Aisle → Template Type mapping
# -------------------------------

declare -A TEMPLATE_MAP

# Template 1 — Fresh Produce
for a in \
  "fresh-vegetables" "fresh-fruit" "fresh-salad" \
  "fresh-herbs" "fresh-prepared-produce"
do TEMPLATE_MAP[$a]="fresh_produce_template"; done

# Template 2 — Core Pantry
for a in \
  "pasta" "rice-grains" "cooking-oils" "spices-seasonings" \
  "stock-cubes-gravy" "flour" "sugar" "baking-ingredients" \
  "cooking-sauces" "table-sauces" \
  "tinned-tomatoes" "tinned-vegetables" "tinned-beans-pulses" \
  "tinned-fish" "tinned-meat" "pickles-chutneys"
do TEMPLATE_MAP[$a]="core_pantry_template"; done

# Template 3 — Meat/Fish/Dairy
for a in \
  "beef" "pork" "lamb" "chicken" "turkey" "sausages-bacon" \
  "fresh-fish" "fresh-seafood" \
  "milk" "cheese" "yoghurt" "butter-spreads" "cream"
do TEMPLATE_MAP[$a]="meat_fish_dairy_template"; done

# Template 4 — Frozen Ingredients
for a in \
  "frozen-vegetables" "frozen-chips-potatoes" \
  "frozen-meat" "frozen-fish" "frozen-bakery"
do TEMPLATE_MAP[$a]="frozen_ingredients_template"; done

# Template 5 — Product Only
for a in \
  "chilled-ready-meals" "chilled-soups" "dips-houmous" \
  "chilled-pizza" "chilled-pasta-gnocchi" \
  "frozen-ready-meals" "frozen-pizza" "ice-cream-desserts" \
  "bread-loaves" "rolls-baps" "pastries" "cakes" \
  "tortillas-flatbreads" \
  "crisps" "nuts-seeds" "chocolate" "sweets" "biscuits" \
  "fizzy-drinks" "juices" "squash-cordials" "bottled-water" \
  "beer-cider" "wine" "spirits"
do TEMPLATE_MAP[$a]="product_only_template"; done

# -------------------------------
# Generate folders + templates
# -------------------------------

for aisle in "${!TEMPLATE_MAP[@]}"; do
  dir="$BASE_DIR/$aisle"
  mkdir -p "$dir"

  template_name="${TEMPLATE_MAP[$aisle]}"
  template="${!template_name}"

  # Replace placeholder
  template="${template/__ID__/$aisle}"

  echo "$template" > "$dir/template.json"
  echo "Created: $dir/template.json"
done

echo "All aisle templates generated."