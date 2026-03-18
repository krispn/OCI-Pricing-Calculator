/**
 * OCI SKU Catalog — Maps Oracle part numbers to service types.
 * Compute shape part numbers come dynamically from shapes.json.
 * Storage and Database part numbers are maintained here.
 *
 * To update: find part numbers on https://www.oracle.com/cloud/price-list/
 * or query https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/
 */
const SKU_CATALOG = {

    // ── Compute OS Licensing ──────────────────────────────────────
    compute: {
        windowsLicense: { partNumber: 'B88162', label: 'Windows OS License', metric: 'OCPU Per Hour' },
    },

    // ── Block & Boot Volumes ──────────────────────────────────────
    storage: {
        blockVolume: {
            // Base storage cost per GB/month
            storage: { partNumber: 'B91961', label: 'Block Volume Storage', metric: 'GB/month' },
            // Performance units — price is per "Performance Unit per GB per Month"
            // VPU tiers: Balanced=10, Higher=20, UHP=30-120
            // Cost = volumeGB × VPUs × performanceUnitPrice
            performanceUnits: { partNumber: 'B91962', label: 'Block Volume Performance Units', metric: 'PU per GB/month' },
        },
        objectStorage: {
            standard:         { partNumber: 'B91628', label: 'Object Storage - Standard', metric: 'GB/month' },
            infrequentAccess: { partNumber: 'B93000', label: 'Object Storage - Infrequent Access', metric: 'GB/month' },
            archive:          { partNumber: 'B91633', label: 'Archive Storage', metric: 'GB/month' },
            requests:         { partNumber: 'B91627', label: 'Object Storage - Requests', metric: '10K requests/month' },
            iaRetrieval:      { partNumber: 'B93001', label: 'Infrequent Access - Data Retrieval', metric: 'GB retrieved/month' },
        },
        fileStorage: {
            storage: { partNumber: 'B89057', label: 'File Storage', metric: 'GB/month' },
        },
    },

    // ── Database Services ─────────────────────────────────────────
    database: {
        // Base Database Service (VM) — OCPU-based
        baseDbOcpu: {
            standard:         { partNumber: 'B90569', label: 'Base DB - Standard Edition', metric: 'OCPU/hour' },
            enterprise:       { partNumber: 'B90570', label: 'Base DB - Enterprise Edition', metric: 'OCPU/hour' },
            highPerformance:  { partNumber: 'B90571', label: 'Base DB - High Performance', metric: 'OCPU/hour' },
            extremePerformance: { partNumber: 'B90572', label: 'Base DB - Extreme Performance', metric: 'OCPU/hour' },
            byol:             { partNumber: 'B90573', label: 'Base DB - BYOL', metric: 'OCPU/hour' },
        },
        // Base Database Service (VM) — ECPU-based (newer)
        baseDbEcpu: {
            standard:         { partNumber: 'B111585', label: 'Base DB - Standard (ECPU)', metric: 'ECPU/hour' },
            enterprise:       { partNumber: 'B111586', label: 'Base DB - Enterprise (ECPU)', metric: 'ECPU/hour' },
            highPerformance:  { partNumber: 'B111587', label: 'Base DB - High Perf (ECPU)', metric: 'ECPU/hour' },
            byol:             { partNumber: 'B111588', label: 'Base DB - BYOL (ECPU)', metric: 'ECPU/hour' },
        },
        // Base DB storage
        baseDbStorage: { partNumber: 'B111584', label: 'Base DB - Storage', metric: 'GB/month' },

        // Autonomous AI Database — Serverless (shared)
        autonomous: {
            lakehouseEcpu:      { partNumber: 'B95701', label: 'Autonomous Lakehouse - ECPU', metric: 'ECPU/hour' },
            lakehouseEcpuByol:  { partNumber: 'B95703', label: 'Autonomous Lakehouse - ECPU BYOL', metric: 'ECPU/hour' },
            atpEcpu:            { partNumber: 'B95702', label: 'Autonomous ATP - ECPU', metric: 'ECPU/hour' },
            atpEcpuByol:        { partNumber: 'B95704', label: 'Autonomous ATP - ECPU BYOL', metric: 'ECPU/hour' },
            jsonEcpu:           { partNumber: 'B99708', label: 'Autonomous JSON - ECPU', metric: 'ECPU/hour' },
            developer:          { partNumber: 'B110316', label: 'Autonomous AI DB - Developer', metric: 'Instance/hour' },
            storage:            { partNumber: 'B95754', label: 'Autonomous DB Storage', metric: 'GB/month' },
            atpStorage:         { partNumber: 'B95706', label: 'Autonomous ATP Storage', metric: 'GB/month' },
            backupStorage:      { partNumber: 'B111127', label: 'Autonomous Dedicated Backup Storage', metric: 'GB/month' },
        },

        // Exadata Database Service
        exadata: {
            // Exascale infrastructure
            exascaleEcpu:         { partNumber: 'B109355', label: 'Exascale Infrastructure ECPU', metric: 'ECPU/hour' },
            exascaleVmFs:         { partNumber: 'B107951', label: 'Exascale VM Filesystem Storage', metric: 'GB/month' },
            exascaleSmartStorage: { partNumber: 'B107952', label: 'Exascale Smart DB Storage', metric: 'GB/month' },
            exascaleFlashCache:   { partNumber: 'B109375', label: 'Exascale Flash Cache', metric: 'GB/month' },
            // DB service ECPUs
            dbEcpu:      { partNumber: 'B109356', label: 'Exadata DB - ECPU', metric: 'ECPU/hour' },
            dbEcpuByol:  { partNumber: 'B109357', label: 'Exadata DB - ECPU BYOL', metric: 'ECPU/hour' },
        },

        // Legacy alias for export-service compatibility
        exadataEcpu: {
            included:  { partNumber: 'B109356', label: 'Exadata DB - ECPU', metric: 'ECPU/hour' },
            byol:      { partNumber: 'B109357', label: 'Exadata DB - ECPU BYOL', metric: 'ECPU/hour' },
        },

        // MySQL
        mysql: {
            ecpu:          { partNumber: 'B108030', label: 'MySQL - ECPU', metric: 'ECPU/hour' },
            storage:       { partNumber: 'B92426',  label: 'MySQL - Storage', metric: 'GB/month' },
            backupStorage: { partNumber: 'B92483',  label: 'MySQL - Backup Storage', metric: 'GB/month' },
        },
    },

    // ── Reserved / Committed Pricing Discounts ────────────────────
    // Oracle doesn't expose these via public API; these are approximate
    // discount percentages off PAY_AS_YOU_GO rates.
    reservedDiscounts: {
        '1yr': 0.42,   // ~42% discount for 1-year commitment
        '3yr': 0.60,   // ~60% discount for 3-year commitment
    },

    // ── Oracle Cost Estimator Export IDs ──────────────────────────
    oracleExport: {
        serviceIds: {
            computeVm: 822,
            blockVolumes: 881,
            objectStorage: 882,
            fileStorage: 862,
            baseDb: 1101,
            autonomousDb: 1661,
            autonomousJson: 825,
            mysql: 581,
            exadataInfra: 2861,
            exadataEcpu: 2862,
        },
        presetIds: {
            blockVolumes: 74,
            objectStorage: 61,
            exadata: 462,
        },
        freeBlockVolumeSku: 'B91445',
    },

    // ── VPU Tier Definitions ──────────────────────────────────────
    vpuTiers: [
        { value: 0,   label: 'Lower Cost (0 VPU)' },
        { value: 10,  label: 'Balanced (10 VPU)' },
        { value: 20,  label: 'Higher Performance (20 VPU)' },
        { value: 30,  label: 'Ultra High (30 VPU)' },
        { value: 40,  label: 'Ultra High (40 VPU)' },
        { value: 50,  label: 'Ultra High (50 VPU)' },
        { value: 60,  label: 'Ultra High (60 VPU)' },
        { value: 80,  label: 'Ultra High (80 VPU)' },
        { value: 100, label: 'Ultra High (100 VPU)' },
        { value: 120, label: 'Ultra High (120 VPU)' },
    ],
};
