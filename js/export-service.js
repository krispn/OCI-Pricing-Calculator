/**
 * Export Service — handles CSV and Excel export of estimate data.
 */
const ExportService = (() => {

    /**
     * Export all tabs to a multi-sheet Excel workbook.
     */
    function exportToExcel() {
        const wb = XLSX.utils.book_new();

        // Compute sheet
        const computeData = ComputeGrid.getAllData().map(row => ({
            'Description': row.description,
            'Shape': row.shape,
            'OS': row.os,
            'OCPUs': row.ocpus,
            'Memory (GB)': row.memoryGb,
            'Boot Vol (GB)': row.bootVolumeGb,
            'Boot Vol Perf': row.bootVolumePerf,
            'Block Vol (GB)': row.blockVolumeGb,
            'Block Vol Perf': row.blockVolumePerf,
            'Capacity Type': row.capacityType,
            'FSDR': row.fsdr ? 'Yes' : 'No',
            'Qty': row.quantity,
            '$/Hour': row.hourlyRate,
            '$/Month': row.monthlyRate,
            'Notes': row.notes,
        }));
        if (computeData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(computeData);
            formatCurrencyColumns(ws, computeData.length, [12, 13]);
            XLSX.utils.book_append_sheet(wb, ws, 'Compute');
        }

        // Object Storage sheet
        const objStorageData = ObjectStorageGrid.getAllData().map(row => ({
            'Description': row.description,
            'Tier': row.tier,
            'Size (GB)': row.sizeGb,
            'Requests (10K/mo)': row.requestsPerMonth10k,
            'Retrieval (GB/mo)': row.retrievalGb,
            'Qty': row.quantity,
            '$/Month': row.monthlyRate,
            'Notes': row.notes,
        }));
        if (objStorageData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(objStorageData);
            formatCurrencyColumns(ws, objStorageData.length, [6]);
            XLSX.utils.book_append_sheet(wb, ws, 'Object Storage');
        }

        // File Storage sheet
        const fileStorageData = FileStorageGrid.getAllData().map(row => ({
            'Description': row.description,
            'Size (GB)': row.sizeGb,
            'Qty': row.quantity,
            '$/Month': row.monthlyRate,
            'Notes': row.notes,
        }));
        if (fileStorageData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(fileStorageData);
            formatCurrencyColumns(ws, fileStorageData.length, [3]);
            XLSX.utils.book_append_sheet(wb, ws, 'File Storage');
        }

        // Base DB sheet
        const databaseData = DatabaseGrid.getAllData().map(row => ({
            'Description': row.description,
            'Edition': row.service,
            'OCPUs/ECPUs': row.cpuCount,
            'Storage (GB)': row.storageGb,
            'FSDR': row.fsdr ? 'Yes' : 'No',
            'Qty': row.quantity,
            '$/Hour': row.hourlyRate,
            '$/Month': row.monthlyRate,
            'Notes': row.notes,
        }));
        if (databaseData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(databaseData);
            formatCurrencyColumns(ws, databaseData.length, [6, 7]);
            XLSX.utils.book_append_sheet(wb, ws, 'Base DB');
        }

        // Exadata sheet
        const exadataData = ExadataGrid.getAllData().map(row => ({
            'Description': row.description,
            'Service': row.service,
            'ECPUs/VM': row.ecpuCount,
            'VMs': row.vmCount,
            'VM FS (GB)': row.vmFsStorageGb,
            'Smart DB (GB)': row.smartStorageGb,
            'Flash Cache (GB)': row.flashCacheGb,
            'Qty': row.quantity,
            '$/Hour': row.hourlyRate,
            '$/Month': row.monthlyRate,
            'Notes': row.notes,
        }));
        if (exadataData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(exadataData);
            formatCurrencyColumns(ws, exadataData.length, [8, 9]);
            XLSX.utils.book_append_sheet(wb, ws, 'Exadata');
        }

        // Autonomous DB sheet
        const autonomousData = AutonomousDbGrid.getAllData().map(row => ({
            'Description': row.description,
            'Service': row.service,
            'ECPUs': row.ecpuCount,
            'Storage (GB)': row.storageGb,
            'FSDR': row.fsdr ? 'Yes' : 'No',
            'Qty': row.quantity,
            '$/Hour': row.hourlyRate,
            '$/Month': row.monthlyRate,
            'Notes': row.notes,
        }));
        if (autonomousData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(autonomousData);
            formatCurrencyColumns(ws, autonomousData.length, [6, 7]);
            XLSX.utils.book_append_sheet(wb, ws, 'Autonomous DB');
        }

        // Network sheet
        const networkData = NetworkGrid.getAllData().map(row => ({
            'Description': row.description,
            'Service': row.service,
            'Bandwidth (Mbps)': row.lbBandwidthMbps,
            'Qty': row.quantity,
            '$/Hour': row.hourlyRate,
            '$/Month': row.monthlyRate,
            'Notes': row.notes,
        }));
        if (networkData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(networkData);
            formatCurrencyColumns(ws, networkData.length, [4, 5]);
            XLSX.utils.book_append_sheet(wb, ws, 'Network');
        }

        // Summary sheet
        const fsdrCompute = ComputeGrid.getFsdrMonthly();
        const fsdrDatabase = DatabaseGrid.getFsdrMonthly();
        const fsdrAutonomous = AutonomousDbGrid.getFsdrMonthly();
        const fsdrTotal = fsdrCompute + fsdrDatabase + fsdrAutonomous;

        const computeTotal = ComputeGrid.getMonthlyTotal() - fsdrCompute;
        const objStorageTotal = ObjectStorageGrid.getMonthlyTotal();
        const fileStorageTotal = FileStorageGrid.getMonthlyTotal();
        const databaseTotal = DatabaseGrid.getMonthlyTotal() - fsdrDatabase;
        const exadataTotal = ExadataGrid.getMonthlyTotal();
        const autonomousTotal = AutonomousDbGrid.getMonthlyTotal() - fsdrAutonomous;
        const networkTotal = NetworkGrid.getMonthlyTotal();
        const drStorageTotal = ComputeGrid.getDrStorageMonthly() + DatabaseGrid.getDrStorageMonthly() + AutonomousDbGrid.getDrStorageMonthly();
        const grandTotal = computeTotal + objStorageTotal + fileStorageTotal + databaseTotal + exadataTotal + autonomousTotal + networkTotal + fsdrTotal + drStorageTotal;

        const summaryData = [
            { Category: 'Compute', 'Monthly Cost': computeTotal },
            { Category: 'Object Storage', 'Monthly Cost': objStorageTotal },
            { Category: 'File Storage', 'Monthly Cost': fileStorageTotal },
            { Category: 'Base DB', 'Monthly Cost': databaseTotal },
            { Category: 'Exadata', 'Monthly Cost': exadataTotal },
            { Category: 'Autonomous DB', 'Monthly Cost': autonomousTotal },
            { Category: 'Network', 'Monthly Cost': networkTotal },
            { Category: 'FSDR', 'Monthly Cost': fsdrTotal },
            { Category: 'DR Storage', 'Monthly Cost': drStorageTotal },
            { Category: 'GRAND TOTAL', 'Monthly Cost': grandTotal },
        ];
        const summaryWs = XLSX.utils.json_to_sheet(summaryData);
        formatCurrencyColumns(summaryWs, summaryData.length, [1]);
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

        // Add metadata
        const metaData = [
            { Field: 'Generated', Value: new Date().toISOString() },
            { Field: 'Pricing Source', Value: 'Oracle Cloud Infrastructure Pricing API' },
            { Field: 'Prices Last Updated', Value: PricingService.getLastUpdated()?.toISOString() || 'Unknown' },
            { Field: 'Hours/Month', Value: document.getElementById('hours-month')?.value || 744 },
        ];
        const metaWs = XLSX.utils.json_to_sheet(metaData);
        XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

        XLSX.writeFile(wb, `oci-estimate-${formatDate()}.xlsx`);
    }

    function formatCurrencyColumns(ws, rowCount, colIndices) {
        for (const col of colIndices) {
            for (let row = 1; row <= rowCount; row++) {
                const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
                if (cell) cell.z = '$#,##0.00';
            }
        }
    }

    function formatDate() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * Save the current estimate as a JSON file for later re-import.
     */
    function saveEstimate() {
        const estimate = {
            version: 3,
            timestamp: new Date().toISOString(),
            hoursPerMonth: parseInt(document.getElementById('hours-month')?.value) || 744,
            compute: ComputeGrid.getAllData(),
            objectStorage: ObjectStorageGrid.getAllData(),
            fileStorage: FileStorageGrid.getAllData(),
            database: DatabaseGrid.getAllData(),
            exadata: ExadataGrid.getAllData(),
            autonomousDb: AutonomousDbGrid.getAllData(),
            network: NetworkGrid.getAllData(),
        };

        const blob = new Blob([JSON.stringify(estimate, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oci-estimate-${formatDate()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Load an estimate from a JSON file.
     */
    function loadEstimate(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const estimate = JSON.parse(e.target.result);
                if (estimate.hoursPerMonth) {
                    document.getElementById('hours-month').value = estimate.hoursPerMonth;
                }
                if (estimate.compute) ComputeGrid.loadData(estimate.compute);
                if (estimate.objectStorage) ObjectStorageGrid.loadData(estimate.objectStorage);
                if (estimate.fileStorage) FileStorageGrid.loadData(estimate.fileStorage);
                if (estimate.database) DatabaseGrid.loadData(estimate.database);
                if (estimate.exadata) ExadataGrid.loadData(estimate.exadata);
                if (estimate.autonomousDb) AutonomousDbGrid.loadData(estimate.autonomousDb);
                if (estimate.network) NetworkGrid.loadData(estimate.network);
            } catch (err) {
                alert('Failed to load estimate file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    // ── Oracle Cost Estimator Export ───────────────────────────────

    function buildUtilization(hoursPerMonth) {
        return {
            instances: 1,
            hours: 24,
            days: 31,
            hoursPerMonth,
            foreignInstanceMultiplier: { value: 1, description: '' },
            localInstanceMultiplier: { value: 1, description: '' },
        };
    }

    function buildItem(sku, quantity, unitPrice, monthlyCost, opts) {
        const item = {
            sku,
            quantity,
            minQuantity: 0,
            unitPrice,
            monthlyCost: Math.round(monthlyCost * 100) / 100,
        };
        if (opts?.inPreset !== undefined) item.inPreset = opts.inPreset;
        return item;
    }

    function getOsExtendedValue(shapeName, osLabel) {
        const shape = PricingService.getComputeShapes().find(s => s.name === shapeName);
        if (!shape?.supportedOSImages) return 'autolinux';
        const match = shape.supportedOSImages.find(os => os.label === osLabel);
        return match?.value || 'autolinux';
    }

    function getVpuValue(vpuLabel) {
        const tier = SKU_CATALOG.vpuTiers.find(t => t.label === vpuLabel);
        return tier ? tier.value : 10;
    }

    function buildComputeConfigs(hoursPerMonth) {
        const rows = ComputeGrid.getAllData();
        const shapes = PricingService.getComputeShapes();
        const configs = [];
        const ids = SKU_CATALOG.oracleExport.serviceIds;

        for (const row of rows) {
            const shape = shapes.find(s => s.name === row.shape);
            if (!shape) continue;

            const services = [];
            const computeUuid = crypto.randomUUID();

            // Main compute service
            const ocpuProduct = shape.products?.find(p => p.type?.value === 'ocpu');
            const memProduct = shape.products?.find(p => p.type?.value === 'memory');
            const isGpu = ocpuProduct?.presetNames?.includes('OCI_COMPUTE_GPU');

            const items = [];
            if (ocpuProduct) {
                const unitPrice = PricingService.getPrice(ocpuProduct.partNumber);
                const qty = isGpu ? 1 : (row.ocpus || 1);
                items.push(buildItem(ocpuProduct.partNumber, qty, unitPrice,
                    qty * unitPrice * hoursPerMonth));
            }
            if (memProduct && !isGpu) {
                const unitPrice = PricingService.getPrice(memProduct.partNumber);
                items.push(buildItem(memProduct.partNumber, row.memoryGb || 0, unitPrice,
                    (row.memoryGb || 0) * unitPrice * hoursPerMonth));
            }
            if (row.os === 'Windows') {
                const winSku = SKU_CATALOG.compute.windowsLicense.partNumber;
                const unitPrice = PricingService.getPrice(winSku);
                items.push(buildItem(winSku, row.ocpus || 1, unitPrice,
                    (row.ocpus || 1) * unitPrice * hoursPerMonth));
            }

            const reservedPct = row.capacityType === 'Reserved 1Y' ? 42
                : row.capacityType === 'Reserved 3Y' ? 60 : 0;

            const computeService = {
                id: ids.computeVm,
                label: 'Compute - Virtual Machine',
                utilization: buildUtilization(hoursPerMonth),
                items,
                uiState: {
                    selectedOSExtended: getOsExtendedValue(row.shape, row.os),
                    shapeInstancesQuantity: row.quantity || 1,
                    useReservedCapacity: true,
                    reservedCapacityPercentage: reservedPct,
                    hideOs: false,
                    shapeID: shape.id,
                    hideOcpu: false,
                    hideDisk: false,
                    hideProcessor: false,
                    hideShape: false,
                    hideMemory: false,
                    hidePricingOptions: false,
                },
                shapeName: row.shape,
                shapeID: shape.id,
                isFromShape: true,
            };

            // Only add uuid if we need to link boot/block volumes
            if ((row.bootVolumeGb || 0) > 0 || (row.blockVolumeGb || 0) > 0) {
                computeService.uuid = computeUuid;
            }

            services.push(computeService);

            // Boot volume service
            if ((row.bootVolumeGb || 0) > 0) {
                const vpuQty = getVpuValue(row.bootVolumePerf);
                const storagePrice = PricingService.getPrice(SKU_CATALOG.storage.blockVolume.storage.partNumber);
                const perfPrice = PricingService.getPrice(SKU_CATALOG.storage.blockVolume.performanceUnits.partNumber);
                const bootGb = row.bootVolumeGb;
                const perfUnits = bootGb * vpuQty;

                services.push({
                    id: ids.blockVolumes,
                    label: 'Storage - Block Volumes',
                    utilization: buildUtilization(hoursPerMonth),
                    items: [
                        buildItem(SKU_CATALOG.oracleExport.freeBlockVolumeSku, 0, 0, 0),
                        buildItem('B91961', bootGb, storagePrice, bootGb * storagePrice),
                        buildItem('B91962', perfUnits, perfPrice, perfUnits * perfPrice),
                    ],
                    uiState: {
                        hidePerformance: false,
                        hidePerformanceAndStorage: false,
                        forceFreeTier: false,
                        hideFreeTier: false,
                        freeTierApplied: false,
                        blockVolumesQty: bootGb,
                        vpuQty,
                    },
                    presetID: SKU_CATALOG.oracleExport.presetIds.blockVolumes,
                    customLabel: 'Boot Volume',
                    serviceRef: computeUuid,
                    isFromShape: false,
                });
            }

            // Block volume service
            if ((row.blockVolumeGb || 0) > 0) {
                const vpuQty = getVpuValue(row.blockVolumePerf);
                const storagePrice = PricingService.getPrice(SKU_CATALOG.storage.blockVolume.storage.partNumber);
                const perfPrice = PricingService.getPrice(SKU_CATALOG.storage.blockVolume.performanceUnits.partNumber);
                const blockGb = row.blockVolumeGb;
                const perfUnits = blockGb * vpuQty;

                services.push({
                    id: ids.blockVolumes,
                    label: 'Storage - Block Volumes',
                    utilization: buildUtilization(hoursPerMonth),
                    items: [
                        buildItem(SKU_CATALOG.oracleExport.freeBlockVolumeSku, 0, 0, 0),
                        buildItem('B91961', blockGb, storagePrice, blockGb * storagePrice),
                        buildItem('B91962', perfUnits, perfPrice, perfUnits * perfPrice),
                    ],
                    uiState: {
                        hidePerformance: false,
                        hidePerformanceAndStorage: false,
                        forceFreeTier: false,
                        hideFreeTier: false,
                        freeTierApplied: false,
                        blockVolumesQty: blockGb,
                        vpuQty,
                    },
                    presetID: SKU_CATALOG.oracleExport.presetIds.blockVolumes,
                    customLabel: 'Block Volume',
                    serviceRef: computeUuid,
                    isFromShape: false,
                });
            }

            configs.push({
                label: 'Virtual Machine',
                services,
                addBySearch: false,
            });
        }
        return configs;
    }

    function buildObjectStorageConfigs(hoursPerMonth) {
        const rows = ObjectStorageGrid.getAllData();
        const configs = [];
        const ids = SKU_CATALOG.oracleExport.serviceIds;
        const skus = SKU_CATALOG.storage.objectStorage;

        for (const row of rows) {
            const isStd = row.tier === 'Standard';
            const isIA = row.tier === 'Infrequent Access';
            const isArch = row.tier === 'Archive';

            const stdPrice = PricingService.getPrice(skus.standard.partNumber);
            const reqPrice = PricingService.getPrice(skus.requests.partNumber);
            const iaPrice = PricingService.getPrice(skus.infrequentAccess.partNumber);
            const iaRetPrice = PricingService.getPrice(skus.iaRetrieval.partNumber);
            const archPrice = PricingService.getPrice(skus.archive.partNumber);

            const sizeGb = row.sizeGb || 0;
            const requests = row.requestsPerMonth10k || 0;
            const retrieval = row.retrievalGb || 0;

            const items = [
                buildItem('B91628', isStd ? sizeGb : 0, stdPrice,
                    isStd ? sizeGb * stdPrice : 0, { inPreset: true }),
                buildItem('B91627', requests, reqPrice,
                    requests * reqPrice, { inPreset: true }),
                buildItem('B93000', isIA ? sizeGb : 0, isIA ? iaPrice : 0,
                    isIA ? sizeGb * iaPrice : 0, { inPreset: true }),
                buildItem('B93001', isIA ? retrieval : 0, isIA ? iaRetPrice : 0,
                    isIA ? retrieval * iaRetPrice : 0, { inPreset: true }),
                buildItem('B91633', isArch ? sizeGb : 0, isArch ? archPrice : 0,
                    isArch ? sizeGb * archPrice : 0, { inPreset: true }),
            ];

            const selectedType = isStd ? [1] : isIA ? [2] : [3];

            const util = buildUtilization(hoursPerMonth);
            util.instances = row.quantity || 1;

            configs.push({
                label: 'Object Storage',
                services: [{
                    id: ids.objectStorage,
                    label: 'Storage - Object Storage',
                    utilization: util,
                    items,
                    uiState: { selectedStorageType: selectedType },
                    presetID: SKU_CATALOG.oracleExport.presetIds.objectStorage,
                    isFromShape: false,
                }],
                addBySearch: false,
            });
        }
        return configs;
    }

    function buildFileStorageConfigs(hoursPerMonth) {
        const rows = FileStorageGrid.getAllData();
        const configs = [];
        const ids = SKU_CATALOG.oracleExport.serviceIds;

        for (const row of rows) {
            const sizeGb = row.sizeGb || 0;
            const unitPrice = PricingService.getPrice(SKU_CATALOG.storage.fileStorage.storage.partNumber);

            const util = buildUtilization(hoursPerMonth);
            util.instances = row.quantity || 1;

            configs.push({
                label: 'File Storage',
                services: [{
                    id: ids.fileStorage,
                    label: 'Storage - File Storage',
                    utilization: util,
                    items: [
                        buildItem('B89057', sizeGb, unitPrice, sizeGb * unitPrice),
                    ],
                    uiState: {},
                    presetID: null,
                    isFromShape: false,
                }],
                addBySearch: true,
            });
        }
        return configs;
    }

    function buildDatabaseConfigs(hoursPerMonth) {
        const rows = DatabaseGrid.getAllData();
        const configs = [];

        // All Base DB SKUs Oracle expects in the preset
        const allDbSkus = [
            { sku: 'B109635', type: 'ecpu' },   // Base DB ECPU (generic)
            { sku: 'B111584', type: 'storage' }, // Storage
            { sku: 'B111585', type: 'ecpu' },    // Standard (ECPU)
            { sku: 'B111586', type: 'ecpu' },    // Enterprise (ECPU)
            { sku: 'B111587', type: 'ecpu' },    // High Perf (ECPU)
            { sku: 'B111588', type: 'ecpu' },    // BYOL (ECPU)
            { sku: 'B90569',  type: 'ocpu' },    // Standard (OCPU)
            { sku: 'B90570',  type: 'ocpu' },    // Enterprise (OCPU)
            { sku: 'B90571',  type: 'ocpu' },    // High Perf (OCPU)
            { sku: 'B90572',  type: 'ocpu' },    // Extreme Perf (OCPU)
            { sku: 'B90573',  type: 'ocpu' },    // BYOL (OCPU)
            { sku: 'B97197',  type: 'ocpu' },    // Standard - Ampere (OCPU)
            { sku: 'B97198',  type: 'ocpu' },    // Enterprise - Ampere (OCPU)
            { sku: 'B97199',  type: 'ocpu' },    // High Perf - Ampere (OCPU)
            { sku: 'B97200',  type: 'ocpu' },    // BYOL - Ampere (OCPU)
        ];

        const svcMap = {
            'Standard (OCPU)': 'B90569', 'Enterprise (OCPU)': 'B90570',
            'High Performance (OCPU)': 'B90571', 'Extreme Performance (OCPU)': 'B90572',
            'BYOL (OCPU)': 'B90573', 'Standard (ECPU)': 'B111585',
            'Enterprise (ECPU)': 'B111586', 'High Perf (ECPU)': 'B111587',
            'BYOL (ECPU)': 'B111588',
        };

        for (const row of rows) {
            const selectedSku = svcMap[row.service] || '';
            if (!selectedSku) continue;

            const cpuCount = row.cpuCount || 0;
            const storageGb = row.storageGb || 0;

            const items = allDbSkus.map(entry => {
                const price = PricingService.getPrice(entry.sku);
                if (entry.sku === selectedSku) {
                    return buildItem(entry.sku, cpuCount, price, cpuCount * price * hoursPerMonth);
                } else if (entry.sku === 'B111584') {
                    return buildItem(entry.sku, storageGb, price, storageGb * price);
                } else {
                    return buildItem(entry.sku, 0, price, 0, { inPreset: false });
                }
            });

            const util = buildUtilization(hoursPerMonth);
            util.instances = row.quantity || 1;

            configs.push({
                label: row.service,
                services: [{
                    id: SKU_CATALOG.oracleExport.serviceIds.baseDb,
                    label: 'Database - Base Database Service - Virtual Machine',
                    utilization: util,
                    items,
                    uiState: {},
                    presetID: null,
                    isFromShape: false,
                }],
                addBySearch: false,
            });
        }
        return configs;
    }

    function buildExadataConfigs(hoursPerMonth) {
        const rows = ExadataGrid.getAllData();
        const configs = [];
        const ids = SKU_CATALOG.oracleExport.serviceIds;

        for (const row of rows) {
            const svcMap = {
                'Exadata DB (ECPU)': 'B109356',
                'Exadata DB - BYOL (ECPU)': 'B109357',
            };
            const computeSku = svcMap[row.service];
            if (!computeSku) continue;

            const totalEcpus = (row.ecpuCount || 0) * (row.vmCount || 1);
            const vmFsGb = (row.vmFsStorageGb || 0) * (row.vmCount || 1);

            const infraEcpuPrice = PricingService.getPrice('B109355');
            const computePrice = PricingService.getPrice(computeSku);
            const vmFsPrice = PricingService.getPrice('B107951');
            const smartStPrice = PricingService.getPrice('B107952');
            const flashPrice = PricingService.getPrice('B109375');

            const infraUuid = crypto.randomUUID();
            const util = buildUtilization(hoursPerMonth);
            util.instances = row.quantity || 1;

            const services = [];

            // Exascale Infrastructure service
            services.push({
                id: ids.exadataInfra,
                label: 'Exadata Exascale Infrastructure',
                utilization: util,
                items: [
                    buildItem('B109375', row.flashCacheGb || 0, flashPrice, (row.flashCacheGb || 0) * flashPrice),
                    buildItem('B107952', row.smartStorageGb || 0, smartStPrice, (row.smartStorageGb || 0) * smartStPrice),
                    buildItem('B107951', vmFsGb, vmFsPrice, vmFsGb * vmFsPrice),
                    buildItem('B109355', totalEcpus, infraEcpuPrice, totalEcpus * infraEcpuPrice * hoursPerMonth),
                ],
                uiState: {
                    selectedISType: 'exascale',
                    selectedNumberOfVMs: row.vmCount || 2,
                    selectedNumberOfECPUsPerVM: row.ecpuCount || 8,
                    selectedFSStoragePerVM: row.vmFsStorageGb || 280,
                    selectedSmartDBStorageTotal: row.smartStorageGb || 300,
                    selectedFlashCacheTotal: row.flashCacheGb || 0,
                },
                presetID: SKU_CATALOG.oracleExport.presetIds.exadata,
                uuid: infraUuid,
                isFromShape: false,
            });

            // Exadata DB ECPU service — all edition SKUs
            const exaEcpuSkus = [
                { sku: 'B109357', label: 'BYOL' },
                { sku: 'B109356', label: 'Included' },
                { sku: 'B110990', label: 'HP BYOL' },
                { sku: 'B110989', label: 'HP Included' },
                { sku: 'B110632', label: 'EE BYOL' },
                { sku: 'B110631', label: 'EE Included' },
                { sku: 'B111564', label: 'SE' },
            ];
            services.push({
                id: ids.exadataEcpu,
                label: 'Exadata Database Service ECPUs',
                utilization: util,
                items: exaEcpuSkus.map(entry => {
                    const price = PricingService.getPrice(entry.sku);
                    if (entry.sku === computeSku) {
                        return buildItem(entry.sku, totalEcpus, price, totalEcpus * price * hoursPerMonth, { inPreset: true });
                    }
                    return buildItem(entry.sku, 0, price, 0, { inPreset: entry.sku === 'B109357' || entry.sku === 'B109356' ? true : false });
                }),
                uiState: {},
                presetID: SKU_CATALOG.oracleExport.presetIds.exadata,
                serviceRef: infraUuid,
                isFromShape: false,
            });

            configs.push({
                label: 'Exadata Database Service',
                services,
                addBySearch: false,
            });
        }
        return configs;
    }

    function buildAutonomousDbConfigs(hoursPerMonth) {
        const rows = AutonomousDbGrid.getAllData();
        const configs = [];

        // All Autonomous DB SKUs Oracle expects in the preset
        const allAutoSkus = [
            { sku: 'B110316', type: 'developer' },  // Developer
            { sku: 'B111127', type: 'storage' },     // Dedicated Backup Storage
            { sku: 'B95701',  type: 'compute' },     // Lakehouse ECPU
            { sku: 'B95702',  type: 'compute' },     // ATP ECPU
            { sku: 'B95703',  type: 'compute' },     // Lakehouse BYOL
            { sku: 'B95704',  type: 'compute' },     // ATP BYOL
            { sku: 'B95706',  type: 'storage' },     // ATP Storage
            { sku: 'B95712',  type: 'compute' },     // Lakehouse OCPU
            { sku: 'B95713',  type: 'compute' },     // ATP OCPU
            { sku: 'B95714',  type: 'compute' },     // Lakehouse OCPU BYOL
            { sku: 'B95715',  type: 'compute' },     // ATP OCPU BYOL
            { sku: 'B95754',  type: 'storage' },     // Lakehouse/JSON Storage
            { sku: 'B98279',  type: 'other' },       // Free tier
            { sku: 'B98280',  type: 'other' },       // Free tier
            { sku: 'B99593',  type: 'compute' },     // Lakehouse Dedicated
            { sku: 'B99594',  type: 'compute' },     // Lakehouse Dedicated BYOL
            { sku: 'B99595',  type: 'compute' },     // ATP Dedicated
            { sku: 'B99596',  type: 'compute' },     // ATP Dedicated BYOL
        ];

        const svcMap = {
            'Lakehouse (ECPU)': 'B95701', 'Lakehouse - BYOL (ECPU)': 'B95703',
            'ATP (ECPU)': 'B95702', 'ATP - BYOL (ECPU)': 'B95704',
            'JSON (ECPU)': 'B99708', 'Developer': 'B110316',
        };
        const storageSvcMap = {
            'Lakehouse (ECPU)': 'B95754', 'Lakehouse - BYOL (ECPU)': 'B95754',
            'ATP (ECPU)': 'B95706', 'ATP - BYOL (ECPU)': 'B95706',
            'JSON (ECPU)': 'B95754',
        };

        for (const row of rows) {
            const selectedComputeSku = svcMap[row.service];
            if (!selectedComputeSku) continue;

            const isDevTier = row.service === 'Developer';
            const cpuQty = isDevTier ? 1 : (row.ecpuCount || 0);
            const storageGb = row.storageGb || 0;
            const selectedStorageSku = storageSvcMap[row.service];

            const items = allAutoSkus.map(entry => {
                const price = PricingService.getPrice(entry.sku);
                if (entry.sku === selectedComputeSku) {
                    return buildItem(entry.sku, cpuQty, price, cpuQty * price * hoursPerMonth);
                } else if (entry.sku === selectedStorageSku && storageGb > 0) {
                    return buildItem(entry.sku, storageGb, price, storageGb * price);
                } else {
                    return buildItem(entry.sku, 0, price, 0);
                }
            });

            const util = buildUtilization(hoursPerMonth);
            util.instances = row.quantity || 1;

            const isJson = row.service.startsWith('JSON');
            const svcId = isJson
                ? SKU_CATALOG.oracleExport.serviceIds.autonomousJson
                : SKU_CATALOG.oracleExport.serviceIds.autonomousDb;

            configs.push({
                label: row.service,
                services: [{
                    id: svcId,
                    label: isJson ? 'Database – Autonomous AI JSON Database' : 'Database - Autonomous AI Database',
                    utilization: util,
                    items,
                    uiState: {},
                    presetID: null,
                    isFromShape: false,
                }],
                addBySearch: false,
            });
        }
        return configs;
    }

    function buildFsdrConfigs(hoursPerMonth) {
        const configs = [];
        const ids = SKU_CATALOG.oracleExport.serviceIds;

        // Count FSDR-protected resources across compute and database
        let computeOcpus = 0;
        let dbOcpus = 0;
        let dbEcpus = 0;

        ComputeGrid.getAllData().forEach(row => {
            if (!row.fsdr) return;
            // Moving compute: primary region only
            computeOcpus += (row.ocpus || 1) * (row.quantity || 1);
        });

        DatabaseGrid.getAllData().forEach(row => {
            if (!row.fsdr) return;
            const svcDef = { 'Standard (OCPU)': 'OCPU', 'Enterprise (OCPU)': 'OCPU',
                'High Performance (OCPU)': 'OCPU', 'Extreme Performance (OCPU)': 'OCPU',
                'BYOL (OCPU)': 'OCPU', 'Standard (ECPU)': 'ECPU',
                'Enterprise (ECPU)': 'ECPU', 'High Perf (ECPU)': 'ECPU', 'BYOL (ECPU)': 'ECPU' };
            const unit = svcDef[row.service] || 'OCPU';
            const cpus = (row.cpuCount || 0) * (row.quantity || 1);
            // Databases: both primary + standby
            if (unit === 'ECPU') dbEcpus += cpus * 2;
            else dbOcpus += cpus * 2;
        });

        AutonomousDbGrid.getAllData().forEach(row => {
            if (!row.fsdr) return;
            // Autonomous DB is ECPU-based, charged in both regions
            const ecpus = (row.ecpuCount || 0) * (row.quantity || 1);
            dbEcpus += ecpus * 2;
        });

        const totalOcpus = computeOcpus + dbOcpus;
        if (totalOcpus === 0 && dbEcpus === 0) return configs;

        const ocpuPrice = PricingService.getPrice(SKU_CATALOG.fsdr.ocpu.partNumber);
        const ecpuPrice = PricingService.getPrice(SKU_CATALOG.fsdr.ecpu.partNumber);
        const oicPrice = PricingService.getPrice(SKU_CATALOG.fsdr.oicMessagePacks.partNumber);

        const util = buildUtilization(hoursPerMonth);
        const items = [
            buildItem(SKU_CATALOG.fsdr.ecpu.partNumber, dbEcpus, ecpuPrice,
                dbEcpus * ecpuPrice * hoursPerMonth, { inPreset: true }),
            buildItem(SKU_CATALOG.fsdr.oicMessagePacks.partNumber, 0, oicPrice, 0, { inPreset: true }),
            buildItem(SKU_CATALOG.fsdr.ocpu.partNumber, totalOcpus, ocpuPrice,
                totalOcpus * ocpuPrice * hoursPerMonth, { inPreset: true }),
        ];

        configs.push({
            label: 'Full Stack Disaster Recovery',
            services: [{
                id: ids.fsdr,
                label: 'Full Stack Disaster Recovery',
                utilization: util,
                items,
                uiState: {
                    primaryComputeQty: computeOcpus,
                    primaryDatabaseQty: dbOcpus,
                    primaryEcpuDatabaseQty: dbEcpus / 2,
                    secondaryComputeQty: 0,
                    primaryTotalMessagePacks: 0,
                    secondaryTotalMessagePacks: 0,
                },
                presetID: SKU_CATALOG.oracleExport.presetIds.fsdr,
                isFromShape: false,
            }],
            addBySearch: false,
        });

        return configs;
    }

    function buildNetworkConfigs(hoursPerMonth) {
        const rows = NetworkGrid.getAllData();
        const configs = [];
        const ids = SKU_CATALOG.oracleExport.serviceIds;
        const presets = SKU_CATALOG.oracleExport.presetIds;

        // Group LBs and NLBs together (Oracle bundles them in one config)
        const lbRows = rows.filter(r => r.service === 'Load Balancer');
        const nlbRows = rows.filter(r => r.service === 'Network Load Balancer');
        const fcRows = rows.filter(r => r.service.startsWith('FastConnect'));

        // Load Balancer configs (each LB row is its own config, NLBs bundled with first LB)
        for (const row of lbRows) {
            const services = [];
            const basePrice = PricingService.getPrice(SKU_CATALOG.networking.loadBalancer.base.partNumber);
            const bwPrice = PricingService.getPrice(SKU_CATALOG.networking.loadBalancer.bandwidth.partNumber);
            const bw = row.lbBandwidthMbps || 0;
            const qty = row.quantity || 1;

            const util = buildUtilization(hoursPerMonth);
            services.push({
                id: ids.loadBalancer,
                label: 'Flexible Load Balancer',
                utilization: util,
                items: [
                    buildItem('B93030', qty, basePrice, qty * basePrice * hoursPerMonth, { inPreset: true }),
                    buildItem('B93031', bw, bwPrice, bw * bwPrice * hoursPerMonth, { inPreset: true }),
                ],
                uiState: {},
                presetID: presets.networking,
                isFromShape: false,
            });

            configs.push({
                label: 'Load Balancer',
                services,
                addBySearch: false,
            });
        }

        // Standalone NLB configs (if no LB to bundle with)
        for (const row of nlbRows) {
            const util = buildUtilization(hoursPerMonth);
            util.instances = row.quantity || 1;
            configs.push({
                label: 'Network Load Balancer',
                services: [{
                    id: ids.networkLoadBalancer,
                    label: 'Network Load Balancer',
                    utilization: util,
                    items: [
                        buildItem('FR00013', row.quantity || 1, 0, 0, { inPreset: true }),
                    ],
                    uiState: {},
                    presetID: presets.networking,
                    isFromShape: false,
                }],
                addBySearch: false,
            });
        }

        // FastConnect: Oracle emits all speeds as items in one service
        // Group all FC rows into one config
        if (fcRows.length > 0) {
            const fcDef = SKU_CATALOG.networking.fastConnect;
            const allSpeeds = ['1 Gbps', '10 Gbps', '100 Gbps', '400 Gbps'];
            const fcItems = allSpeeds.map(speed => {
                const entry = fcDef[speed];
                const matchingRow = fcRows.find(r => r.service === 'FastConnect ' + speed);
                const qty = matchingRow ? (matchingRow.quantity || 1) : 0;
                const price = PricingService.getPrice(entry.partNumber);
                return buildItem(entry.partNumber, qty, price, qty * price * hoursPerMonth, { inPreset: true });
            });

            const util = buildUtilization(hoursPerMonth);
            configs.push({
                label: 'FastConnect',
                services: [{
                    id: ids.fastConnect,
                    label: 'Networking - FastConnect',
                    utilization: util,
                    items: fcItems,
                    uiState: {},
                    presetID: presets.fastConnect,
                    isFromShape: false,
                }],
                addBySearch: false,
            });
        }

        return configs;
    }

    function buildDrStorageConfigs(hoursPerMonth) {
        const configs = [];
        const ids = SKU_CATALOG.oracleExport.serviceIds;
        const storagePrice = PricingService.getPrice(SKU_CATALOG.storage.blockVolume.storage.partNumber);
        const perfPrice = PricingService.getPrice(SKU_CATALOG.storage.blockVolume.performanceUnits.partNumber);

        // Collect all DR storage from FSDR-enabled compute rows
        let totalDrGb = 0;
        ComputeGrid.getAllData().forEach(row => {
            if (!row.fsdr) return;
            const drGb = ((row.bootVolumeGb || 0) + (row.blockVolumeGb || 0)) * (row.quantity || 1);
            totalDrGb += drGb;
        });

        if (totalDrGb > 0) {
            configs.push({
                label: 'Block Volumes',
                services: [{
                    id: ids.blockVolumes,
                    label: 'Storage - Block Volumes',
                    utilization: buildUtilization(hoursPerMonth),
                    items: [
                        { sku: 'B91445', quantity: 0, inPreset: true, unitPrice: 0, monthlyCost: 0 },
                        { sku: 'B91961', quantity: totalDrGb, inPreset: true, unitPrice: storagePrice, monthlyCost: totalDrGb * storagePrice },
                        { sku: 'B91962', quantity: 0, inPreset: true, unitPrice: perfPrice, monthlyCost: 0 },
                    ],
                    uiState: {
                        hidePerformance: false,
                        hidePerformanceAndStorage: false,
                        forceFreeTier: false,
                        hideFreeTier: false,
                        freeTierApplied: false,
                        blockVolumesQty: totalDrGb,
                        vpuQty: 0,
                        prorateDisabledFromParent: true,
                        prorateEnabled: false,
                    },
                    presetID: SKU_CATALOG.oracleExport.presetIds.blockVolumesStandalone,
                    isFromShape: false,
                }],
                addBySearch: false,
            });
        }

        return configs;
    }

    /**
     * Export estimate in Oracle Cost Estimator JSON format for import validation.
     */
    function exportToOracleFormat() {
        const hoursPerMonth = parseInt(document.getElementById('hours-month')?.value) || 744;

        const configs = [
            ...buildComputeConfigs(hoursPerMonth),
            ...buildObjectStorageConfigs(hoursPerMonth),
            ...buildFileStorageConfigs(hoursPerMonth),
            ...buildDatabaseConfigs(hoursPerMonth),
            ...buildExadataConfigs(hoursPerMonth),
            ...buildAutonomousDbConfigs(hoursPerMonth),
            ...buildNetworkConfigs(hoursPerMonth),
            ...buildDrStorageConfigs(hoursPerMonth),
            ...buildFsdrConfigs(hoursPerMonth),
        ];

        const hash = SparkMD5.hash(JSON.stringify(configs));

        const estimate = {
            label: 'My Estimate',
            timeFrame: {
                months: 1,
                from: null,
                to: null,
                leapYear: [],
                calculation: 'simple',
            },
            currency: 'USD',
            meta: {
                exportVersion: 1,
                dataBuildID: PricingService.getBuildId() || {
                    buildDate: new Date().toISOString(),
                    buildNumber: 0,
                    instance: 'GEN2-PUBLIC-PROD',
                    realm: 'public',
                    serviceType: 'paas',
                },
                hash,
            },
            configs,
        };

        const blob = new Blob([JSON.stringify(estimate, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oci-estimate-oracle-${formatDate()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return { exportToExcel, exportToOracleFormat, saveEstimate, loadEstimate };
})();
