#!/bin/bash
# Fetches latest OCI pricing data from Oracle's public APIs
# Run this periodically (e.g., weekly) to update local pricing data.
#
# Usage: bash update-prices.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"

echo "Fetching OCI pricing data..."

# Fetch products (all SKUs with USD pricing)
echo "  -> Products API..."
curl -s "https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/?currencyCode=USD" \
  -o "$DATA_DIR/products-raw.json"

# Fetch compute shape definitions
echo "  -> Shapes API..."
curl -s "https://www.oracle.com/a/ocom/docs/cloudestimator2/data/shapes.json" \
  -o "$DATA_DIR/shapes.json"

# Build the combined pricing snapshot used by the app
echo "  -> Building pricing snapshot..."
python3 - "$DATA_DIR" <<'PYEOF'
import json, sys, os
from datetime import datetime

data_dir = sys.argv[1]

# Load products
with open(os.path.join(data_dir, "products-raw.json"), "r") as f:
    products_data = json.load(f)

# Normalize to { partNumber: { model: value } }
prices = {}
for item in products_data.get("items", []):
    for curr in item.get("currencyCodeLocalizations", []):
        if curr["currencyCode"] == "USD":
            price_map = {}
            for p in curr.get("prices", []):
                price_map[p["model"]] = float(p.get("value", 0))
            prices[item["partNumber"]] = price_map

# Load shapes (nested under "items" key)
with open(os.path.join(data_dir, "shapes.json"), "r") as f:
    shapes_data = json.load(f)
shapes = shapes_data.get("items", shapes_data) if isinstance(shapes_data, dict) else shapes_data

# Extract buildId for Oracle Cost Estimator compatibility
build_id = shapes_data.get("buildId") if isinstance(shapes_data, dict) else None

# Build snapshot
snapshot = {
    "timestamp": products_data.get("lastUpdated", datetime.utcnow().isoformat() + "Z"),
    "fetchedAt": datetime.utcnow().isoformat() + "Z",
    "prices": prices,
    "shapes": shapes,
    "buildId": build_id,
}

out_path = os.path.join(data_dir, "pricing-snapshot.json")
with open(out_path, "w") as f:
    json.dump(snapshot, f)

# Print summary
print(f"  -> {len(prices)} SKUs, {len(shapes)} shapes")
print(f"  -> Last updated: {snapshot['timestamp']}")
print(f"  -> Saved to {out_path}")

# Cleanup raw files
os.remove(os.path.join(data_dir, "products-raw.json"))
os.remove(os.path.join(data_dir, "shapes.json"))
PYEOF

echo "Done! Pricing data updated."
