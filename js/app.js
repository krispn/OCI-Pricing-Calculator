/**
 * App — bootstrap, tab navigation, summary, and global controls.
 */
(async function () {
    'use strict';

    // ── Pricing Load ──────────────────────────────────────────────
    const statusEl = document.getElementById('pricing-status');

    function formatDate(d) {
        return d ? d.toLocaleDateString() + ' ' + d.toLocaleTimeString() : 'Unknown';
    }

    function updatePricingStatus() {
        const lastUpdated = PricingService.getLastUpdated();
        const fetchedAt = PricingService.getFetchedAt();

        const oracleDate = formatDate(lastUpdated);
        const fetchDate = formatDate(fetchedAt);

        statusEl.textContent = `Oracle published: ${oracleDate} | Fetched: ${fetchDate}`;
        statusEl.className = 'pricing-status ' + (PricingService.isStale() ? 'stale' : 'fresh');
    }

    statusEl.textContent = 'Loading pricing data...';

    const loaded = await PricingService.loadPricing();
    if (!loaded) {
        statusEl.textContent = 'No pricing data — run: bash update-prices.sh';
        statusEl.className = 'pricing-status stale';
    } else {
        updatePricingStatus();
    }

    // ── Initialize Grids ──────────────────────────────────────────
    ComputeGrid.init('compute-grid', updateSummary);
    ObjectStorageGrid.init('object-storage-grid', updateSummary);
    FileStorageGrid.init('file-storage-grid', updateSummary);
    DatabaseGrid.init('database-grid', updateSummary);
    ExadataGrid.init('exadata-grid', updateSummary);
    AutonomousDbGrid.init('autonomous-db-grid', updateSummary);
    NetworkGrid.init('network-grid', updateSummary);

    // ── Tab Navigation ────────────────────────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + tabId).classList.add('active');

            if (tabId === 'summary') updateSummary();
        });
    });

    // ── Summary ───────────────────────────────────────────────────
    function updateSummary() {
        // Get raw totals (which include FSDR costs embedded within)
        const fsdrCompute = ComputeGrid.getFsdrMonthly();
        const fsdrDatabase = DatabaseGrid.getFsdrMonthly();
        const fsdrAutonomous = AutonomousDbGrid.getFsdrMonthly();
        const fsdrTotal = fsdrCompute + fsdrDatabase + fsdrAutonomous;

        // Subtract FSDR from each grid's total to show it separately
        const computeTotal = ComputeGrid.getMonthlyTotal() - fsdrCompute;
        const objectStorageTotal = ObjectStorageGrid.getMonthlyTotal();
        const fileStorageTotal = FileStorageGrid.getMonthlyTotal();
        const databaseTotal = DatabaseGrid.getMonthlyTotal() - fsdrDatabase;
        const exadataTotal = ExadataGrid.getMonthlyTotal();
        const autonomousTotal = AutonomousDbGrid.getMonthlyTotal() - fsdrAutonomous;
        const networkTotal = NetworkGrid.getMonthlyTotal();
        const drStorageTotal = ComputeGrid.getDrStorageMonthly() + DatabaseGrid.getDrStorageMonthly() + AutonomousDbGrid.getDrStorageMonthly();
        const grandTotal = computeTotal + objectStorageTotal + fileStorageTotal + databaseTotal + exadataTotal + autonomousTotal + networkTotal + fsdrTotal + drStorageTotal;

        const body = document.getElementById('summary-body');
        const categories = [
            { name: 'Compute', total: computeTotal, color: '#4285f4' },
            { name: 'Object Storage', total: objectStorageTotal, color: '#34a853' },
            { name: 'File Storage', total: fileStorageTotal, color: '#fbbc04' },
            { name: 'Base DB', total: databaseTotal, color: '#ea4335' },
            { name: 'Exadata', total: exadataTotal, color: '#9c27b0' },
            { name: 'Autonomous DB', total: autonomousTotal, color: '#ff6d00' },
            { name: 'Network', total: networkTotal, color: '#00bcd4' },
            { name: 'FSDR', total: fsdrTotal, color: '#795548' },
            { name: 'DR Storage', total: drStorageTotal, color: '#607d8b' },
        ];

        body.innerHTML = categories.map(cat => {
            const pct = grandTotal > 0 ? ((cat.total / grandTotal) * 100).toFixed(1) : '0.0';
            return `<tr>
                <td>${cat.name}</td>
                <td>$${cat.total.toFixed(2)}</td>
                <td>${pct}%</td>
            </tr>`;
        }).join('');

        document.getElementById('summary-grand-total').textContent = '$' + grandTotal.toFixed(2);

        // Bar chart
        const chartEl = document.getElementById('summary-chart');
        const maxVal = Math.max(...categories.map(c => c.total), 1);
        chartEl.innerHTML = categories.map(cat => {
            const barWidth = Math.max((cat.total / maxVal) * 100, 1);
            return `<div class="chart-row">
                <span class="chart-label">${cat.name}</span>
                <div class="chart-bar-bg">
                    <div class="chart-bar" style="width: ${barWidth}%; background: ${cat.color};"></div>
                </div>
                <span class="chart-value">$${cat.total.toFixed(2)}</span>
            </div>`;
        }).join('');
    }

    // ── Global Controls ───────────────────────────────────────────

    // Refresh prices — reloads from local snapshot file
    document.getElementById('btn-refresh-prices').addEventListener('click', async () => {
        statusEl.textContent = 'Reloading prices from snapshot...';
        PricingService.clearCache();
        const ok = await PricingService.loadPricing(true);
        if (ok) {
            updatePricingStatus();
            ComputeGrid.recalcAll();
            ObjectStorageGrid.recalcAll();
            FileStorageGrid.recalcAll();
            DatabaseGrid.recalcAll();
            ExadataGrid.recalcAll();
            AutonomousDbGrid.recalcAll();
            NetworkGrid.recalcAll();
            updateSummary();
        } else {
            statusEl.textContent = 'No pricing data — run: bash update-prices.sh';
            statusEl.className = 'pricing-status stale';
        }
    });

    // Hours/month change triggers recalc
    document.getElementById('hours-month').addEventListener('change', () => {
        ComputeGrid.recalcAll();
        DatabaseGrid.recalcAll();
        ExadataGrid.recalcAll();
        AutonomousDbGrid.recalcAll();
        NetworkGrid.recalcAll();
        updateSummary();
    });

    // Export all to Excel
    document.getElementById('btn-export-excel').addEventListener('click', () => {
        ExportService.exportToExcel();
    });

    // Export to Oracle Cost Estimator format
    document.getElementById('btn-export-oracle').addEventListener('click', () => {
        ExportService.exportToOracleFormat();
    });

    // Save estimate
    document.getElementById('btn-save-estimate').addEventListener('click', () => {
        ExportService.saveEstimate();
    });

    // Load estimate
    const fileInput = document.getElementById('file-load-estimate');
    document.getElementById('btn-load-estimate').addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            ExportService.loadEstimate(e.target.files[0]);
            e.target.value = '';
        }
    });

})();
