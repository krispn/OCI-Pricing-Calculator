/**
 * Compute Grid — AG Grid configuration for the Compute tab.
 */
const ComputeGrid = (() => {
    let gridApi = null;
    let onTotalsChanged = null;

    const HOURS_PER_MONTH = () => parseInt(document.getElementById('hours-month')?.value) || 744;

    function getShapeNames() {
        return PricingService.getComputeShapes().map(s => s.name).sort();
    }

    function getShapeByName(name) {
        return PricingService.getComputeShapes().find(s => s.name === name);
    }

    function getOSOptions(shapeName) {
        const shape = getShapeByName(shapeName);
        if (!shape || !shape.supportedOSImages) return ['Oracle Linux'];
        const options = shape.supportedOSImages.map(os => os.label);
        // Oracle Linux is always available on shapes that support Linux but isn't in shapes.json
        if (shape.supportedOSImages.some(os => os.type === 'linux') && !options.includes('Oracle Linux')) {
            options.unshift('Oracle Linux');
        }
        return options;
    }

    function getVpuOptions() {
        return SKU_CATALOG.vpuTiers.map(t => t.label);
    }

    function getVpuValue(label) {
        const tier = SKU_CATALOG.vpuTiers.find(t => t.label === label);
        return tier ? tier.value : 10;
    }

    function createDefaultRow() {
        return {
            description: '',
            shape: 'VM.Standard.E5.Flex',
            os: 'Oracle Linux',
            ocpus: 1,
            memoryGb: 16,
            bootVolumeGb: 47,
            bootVolumePerf: 'Balanced (10 VPU)',
            blockVolumeGb: 0,
            blockVolumePerf: 'Balanced (10 VPU)',
            capacityType: 'On-Demand',
            quantity: 1,
            hourlyRate: 0,
            monthlyRate: 0,
            notes: '',
        };
    }

    function isGpuShape(shape) {
        const ocpuProduct = shape.products?.find(p => p.type?.value === 'ocpu');
        return ocpuProduct?.presetNames?.includes('OCI_COMPUTE_GPU');
    }

    function calculateRowCost(data) {
        const shape = getShapeByName(data.shape);
        if (!shape) return { hourlyRate: 0, monthlyRate: 0 };

        let computeHourly;

        if (isGpuShape(shape)) {
            // GPU shapes: API price is the total shape price per hour
            // (OCPUs and memory are bundled in)
            const ocpuProduct = shape.products?.find(p => p.type?.value === 'ocpu');
            computeHourly = ocpuProduct ? PricingService.getPrice(ocpuProduct.partNumber) : 0;
        } else {
            // Standard shapes: price is per OCPU/hour + per GB memory/hour
            const ocpuProduct = shape.products?.find(p => p.type?.value === 'ocpu');
            const ocpuPrice = ocpuProduct ? PricingService.getPrice(ocpuProduct.partNumber) : 0;

            const memProduct = shape.products?.find(p => p.type?.value === 'memory');
            const memPrice = memProduct ? PricingService.getPrice(memProduct.partNumber) : 0;

            const ocpus = data.ocpus || 0;
            const memGb = data.memoryGb || 0;

            computeHourly = (ocpus * ocpuPrice) + (memGb * memPrice);
        }

        // Windows license add-on
        if (data.os === 'Windows') {
            const winPrice = PricingService.getPrice(SKU_CATALOG.compute.windowsLicense.partNumber);
            computeHourly += (data.ocpus || 1) * winPrice;
        }

        // Storage costs (monthly)
        const storageBasePrice = PricingService.getPrice(SKU_CATALOG.storage.blockVolume.storage.partNumber);
        const perfUnitPrice = PricingService.getPrice(SKU_CATALOG.storage.blockVolume.performanceUnits.partNumber);

        const bootVpus = getVpuValue(data.bootVolumePerf);
        const bootMonthly = (data.bootVolumeGb || 0) * (storageBasePrice + (bootVpus * perfUnitPrice));

        const blockVpus = getVpuValue(data.blockVolumePerf);
        const blockMonthly = (data.blockVolumeGb || 0) * (storageBasePrice + (blockVpus * perfUnitPrice));

        // Apply capacity discount
        let discount = 0;
        if (data.capacityType === 'Reserved 1Y') discount = SKU_CATALOG.reservedDiscounts['1yr'];
        if (data.capacityType === 'Reserved 3Y') discount = SKU_CATALOG.reservedDiscounts['3yr'];

        const effectiveHourly = computeHourly * (1 - discount);
        const monthlyCompute = effectiveHourly * HOURS_PER_MONTH();
        const monthlyTotal = monthlyCompute + bootMonthly + blockMonthly;

        return {
            hourlyRate: effectiveHourly * (data.quantity || 1),
            monthlyRate: monthlyTotal * (data.quantity || 1),
        };
    }

    function recalcAll() {
        if (!gridApi) return;
        gridApi.forEachNode(node => {
            const costs = calculateRowCost(node.data);
            node.data.hourlyRate = costs.hourlyRate;
            node.data.monthlyRate = costs.monthlyRate;
        });
        gridApi.refreshCells({ columns: ['hourlyRate', 'monthlyRate'] });
        updateTotals();
    }

    function updateTotals() {
        let totalHourly = 0, totalMonthly = 0;
        gridApi.forEachNode(node => {
            totalHourly += node.data.hourlyRate || 0;
            totalMonthly += node.data.monthlyRate || 0;
        });
        const el = document.getElementById('compute-totals');
        if (el) {
            el.innerHTML = `<strong>Compute Totals:</strong> $${totalHourly.toFixed(4)}/hr &nbsp;|&nbsp; $${totalMonthly.toFixed(2)}/month`;
        }
        if (onTotalsChanged) onTotalsChanged();
    }

    function onCellValueChanged(params) {
        const field = params.column.getColId();
        const data = params.data;

        // When shape changes, reset OS and apply constraints
        if (field === 'shape') {
            const shape = getShapeByName(data.shape);
            if (shape) {
                const osOptions = getOSOptions(data.shape);
                if (!osOptions.includes(data.os)) {
                    data.os = osOptions[0] || 'Oracle Linux';
                }
                // For flexible shapes, enforce min/max
                const ocpuProduct = shape.products?.find(p => p.type?.value === 'ocpu');
                if (ocpuProduct && ocpuProduct.min != null) {
                    data.ocpus = Math.max(ocpuProduct.min, Math.min(ocpuProduct.max || 999, data.ocpus));
                }
                const memProduct = shape.products?.find(p => p.type?.value === 'memory');
                if (memProduct && memProduct.min != null) {
                    data.memoryGb = Math.max(memProduct.min, Math.min(memProduct.max || 99999, data.memoryGb));
                }
                // For fixed shapes, set fixed values
                if (shape.subType?.value !== 'flexible') {
                    if (ocpuProduct?.qty) data.ocpus = ocpuProduct.qty;
                    if (shape.bundleMemoryQty) data.memoryGb = shape.bundleMemoryQty;
                }
            }
        }

        const costs = calculateRowCost(data);
        data.hourlyRate = costs.hourlyRate;
        data.monthlyRate = costs.monthlyRate;
        params.api.refreshCells({ rowNodes: [params.node] });
        updateTotals();
    }

    function isFlexible(params) {
        const shape = getShapeByName(params.data?.shape);
        return shape?.subType?.value === 'flexible';
    }

    const columnDefs = [
        {
            headerCheckboxSelection: true,
            checkboxSelection: true,
            width: 40,
            pinned: 'left',
            suppressSizeToFit: true,
        },
        {
            headerName: '',
            width: 36,
            pinned: 'left',
            suppressSizeToFit: true,
            cellRenderer: (params) => {
                const btn = document.createElement('button');
                btn.innerHTML = '&#x2398;';
                btn.title = 'Duplicate row';
                btn.className = 'btn-duplicate';
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const clone = { ...params.data };
                    const costs = calculateRowCost(clone);
                    clone.hourlyRate = costs.hourlyRate;
                    clone.monthlyRate = costs.monthlyRate;
                    params.api.applyTransaction({ add: [clone], addIndex: params.node.rowIndex + 1 });
                    updateTotals();
                });
                return btn;
            },
            editable: false,
            filter: false,
            sortable: false,
        },
        {
            headerName: 'Description',
            field: 'description',
            editable: true,
            width: 200,
        },
        {
            headerName: 'Shape',
            field: 'shape',
            editable: true,
            width: 220,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: () => ({ values: getShapeNames() }),
        },
        {
            headerName: 'OS',
            field: 'os',
            editable: true,
            width: 140,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: (params) => ({ values: getOSOptions(params.data?.shape) }),
        },
        {
            headerName: 'OCPUs',
            field: 'ocpus',
            editable: (params) => isFlexible(params),
            width: 80,
            type: 'numericColumn',
            cellStyle: (params) => isFlexible(params) ? {} : { backgroundColor: '#f0f0f0' },
        },
        {
            headerName: 'Memory (GB)',
            field: 'memoryGb',
            editable: (params) => isFlexible(params),
            width: 110,
            type: 'numericColumn',
            cellStyle: (params) => isFlexible(params) ? {} : { backgroundColor: '#f0f0f0' },
        },
        {
            headerName: 'Boot Vol (GB)',
            field: 'bootVolumeGb',
            editable: true,
            width: 110,
            type: 'numericColumn',
        },
        {
            headerName: 'Boot Vol Perf',
            field: 'bootVolumePerf',
            editable: true,
            width: 180,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: getVpuOptions() },
        },
        {
            headerName: 'Block Vol (GB)',
            field: 'blockVolumeGb',
            editable: true,
            width: 120,
            type: 'numericColumn',
        },
        {
            headerName: 'Block Vol Perf',
            field: 'blockVolumePerf',
            editable: true,
            width: 180,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: getVpuOptions() },
        },
        {
            headerName: 'Capacity',
            field: 'capacityType',
            editable: true,
            width: 120,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: ['On-Demand', 'Preemptible', 'Reserved 1Y', 'Reserved 3Y'] },
        },
        {
            headerName: 'Qty',
            field: 'quantity',
            editable: true,
            width: 60,
            type: 'numericColumn',
        },
        {
            headerName: '$/Hour',
            field: 'hourlyRate',
            editable: false,
            width: 100,
            type: 'numericColumn',
            valueFormatter: (p) => '$' + (p.value || 0).toFixed(4),
            cellStyle: { fontWeight: 'bold' },
        },
        {
            headerName: '$/Month',
            field: 'monthlyRate',
            editable: false,
            width: 120,
            type: 'numericColumn',
            valueFormatter: (p) => '$' + (p.value || 0).toFixed(2),
            cellStyle: { fontWeight: 'bold', color: '#1a73e8' },
        },
        {
            headerName: 'Notes',
            field: 'notes',
            editable: true,
            width: 200,
        },
    ];

    function init(containerId, totalsCallback) {
        onTotalsChanged = totalsCallback;

        const gridOptions = {
            columnDefs,
            rowData: [],
            defaultColDef: {
                resizable: true,
                sortable: true,
                filter: true,
            },
            rowSelection: 'multiple',
            onCellValueChanged,
            stopEditingWhenCellsLoseFocus: true,
            singleClickEdit: true,
        };

        const container = document.getElementById(containerId);
        gridApi = agGrid.createGrid(container, gridOptions);

        // Wire up buttons
        document.getElementById('btn-add-compute').addEventListener('click', () => {
            const newRow = createDefaultRow();
            const costs = calculateRowCost(newRow);
            newRow.hourlyRate = costs.hourlyRate;
            newRow.monthlyRate = costs.monthlyRate;
            gridApi.applyTransaction({ add: [newRow] });
            updateTotals();
        });

        document.getElementById('btn-delete-compute').addEventListener('click', () => {
            const selected = gridApi.getSelectedRows();
            if (selected.length > 0) {
                gridApi.applyTransaction({ remove: selected });
                updateTotals();
            }
        });

        document.getElementById('btn-export-compute-csv').addEventListener('click', () => {
            gridApi.exportDataAsCsv({ fileName: 'oci-compute-estimate.csv' });
        });
    }

    function getGridApi() { return gridApi; }

    function getAllData() {
        const rows = [];
        gridApi.forEachNode(node => rows.push({ ...node.data }));
        return rows;
    }

    function loadData(rows) {
        gridApi.setGridOption('rowData', rows);
        recalcAll();
    }

    function getMonthlyTotal() {
        let total = 0;
        gridApi.forEachNode(node => { total += node.data.monthlyRate || 0; });
        return total;
    }

    return { init, recalcAll, getGridApi, getAllData, loadData, getMonthlyTotal };
})();
