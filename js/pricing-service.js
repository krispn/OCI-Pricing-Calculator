/**
 * Pricing Service — loads OCI pricing data from local snapshot files.
 *
 * Pricing data is fetched by running `bash update-prices.sh` which pulls
 * from Oracle's public APIs and saves to data/pricing-snapshot.json.
 * This avoids CORS issues with browser-side API calls.
 */
const PricingService = (() => {
    const SNAPSHOT_PATH = 'data/pricing-snapshot.json';
    const CACHE_KEY = 'oci-pricing-cache';

    let _prices = {};   // partNumber -> { model -> value }
    let _shapes = [];   // array of shape objects
    let _buildId = null;  // shapes.json buildId for Oracle export
    let _lastUpdated = null;  // when Oracle last published prices
    let _fetchedAt = null;    // when we fetched the snapshot
    let _fromCache = false;
    let _stale = false;

    /**
     * Look up the PAY_AS_YOU_GO USD price for a given part number.
     */
    function getPrice(partNumber) {
        const entry = _prices[partNumber];
        if (!entry) return 0;
        return entry['PAY_AS_YOU_GO'] || 0;
    }

    /**
     * Get all loaded shapes (compute).
     */
    function getShapes() {
        return _shapes;
    }

    /**
     * Get active VM/BM shapes suitable for the compute dropdown.
     */
    function getComputeShapes() {
        return _shapes.filter(s =>
            s.status === 'ACTIVE' &&
            !s.hidden &&
            (s.shapeType?.value === 'vm' || s.shapeType?.value === 'bm')
        );
    }

    function getLastUpdated() { return _lastUpdated; }
    function getFetchedAt() { return _fetchedAt; }
    function getBuildId() { return _buildId; }
    function isFromCache() { return _fromCache; }
    function isStale() { return _stale; }

    /**
     * Load pricing data from the local snapshot file.
     */
    async function loadPricing(forceRefresh = false) {
        // If not forcing refresh, try localStorage cache first
        if (!forceRefresh) {
            const cached = loadFromCache();
            if (cached) {
                _prices = cached.prices;
                _shapes = cached.shapes;
                _buildId = cached.buildId || null;
                _lastUpdated = new Date(cached.timestamp);
                _fetchedAt = cached.fetchedAt ? new Date(cached.fetchedAt) : null;
                _fromCache = true;
                _stale = false;
                return true;
            }
        }

        try {
            const resp = await fetch(SNAPSHOT_PATH);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            const data = await resp.json();

            if (!data.prices || Object.keys(data.prices).length === 0) {
                throw new Error('Snapshot has no pricing data. Run: bash update-prices.sh');
            }

            _prices = data.prices;
            _shapes = data.shapes || [];
            _buildId = data.buildId || null;
            _lastUpdated = new Date(data.timestamp || Date.now());
            _fetchedAt = data.fetchedAt ? new Date(data.fetchedAt) : null;
            _fromCache = false;
            _stale = false;

            // Save to localStorage for faster subsequent loads
            saveToCache(_prices, _shapes, _lastUpdated, _fetchedAt, _buildId);

            return true;
        } catch (err) {
            console.warn('Failed to load pricing snapshot:', err);

            // Try expired cache
            const cached = loadFromCache(true);
            if (cached) {
                _prices = cached.prices;
                _shapes = cached.shapes;
                _buildId = cached.buildId || null;
                _lastUpdated = new Date(cached.timestamp);
                _fetchedAt = cached.fetchedAt ? new Date(cached.fetchedAt) : null;
                _fromCache = true;
                _stale = true;
                return true;
            }

            return false;
        }
    }

    function saveToCache(prices, shapes, timestamp, fetchedAt, buildId) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: timestamp.toISOString(),
                fetchedAt: fetchedAt ? fetchedAt.toISOString() : null,
                prices,
                shapes,
                buildId,
            }));
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
    }

    function loadFromCache(ignoreExpiry = false) {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!ignoreExpiry) {
                const age = Date.now() - new Date(data.timestamp).getTime();
                const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
                if (age > TTL) return null;
            }
            return data;
        } catch (e) {
            return null;
        }
    }

    function clearCache() {
        localStorage.removeItem(CACHE_KEY);
    }

    return {
        loadPricing,
        getPrice,
        getShapes,
        getComputeShapes,
        getLastUpdated,
        getFetchedAt,
        getBuildId,
        isFromCache,
        isStale,
        clearCache,
    };
})();
