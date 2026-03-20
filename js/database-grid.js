/**
 * Database Grid — AG Grid configuration for the Database tab.
 */
const DatabaseGrid = (() => {
    let gridApi = null;
    let onTotalsChanged = null;

    const HOURS_PER_MONTH = () => parseInt(document.getElementById('hours-month')?.value) || 744;

    // Base Database Service definitions with their SKU mappings
    const DB_SERVICES = {
        'Standard (OCPU)':         { computeSku: 'B90569', unit: 'OCPU', hasStorage: true },
        'Enterprise (OCPU)':       { computeSku: 'B90570', unit: 'OCPU', hasStorage: true },
        'High Performance (OCPU)': { computeSku: 'B90571', unit: 'OCPU', hasStorage: true },
        'Extreme Performance (OCPU)': { computeSku: 'B90572', unit: 'OCPU', hasStorage: true },
        'BYOL (OCPU)':             { computeSku: 'B90573', unit: 'OCPU', hasStorage: true },
        'Standard (ECPU)':         { computeSku: 'B111585', unit: 'ECPU', hasStorage: true },
        'Enterprise (ECPU)':       { computeSku: 'B111586', unit: 'ECPU', hasStorage: true },
        'High Perf (ECPU)':        { computeSku: 'B111587', unit: 'ECPU', hasStorage: true },
        'BYOL (ECPU)':             { computeSku: 'B111588', unit: 'ECPU', hasStorage: true },
    };

    const SERVICE_NAMES = Object.keys(DB_SERVICES);

    function createDefaultRow() {
        return {
            description: '',
            service: 'Standard (OCPU)',
            cpuCount: 1,
            storageGb: 256,
            fsdr: false,
            quantity: 1,
            hourlyRate: 0,
            monthlyRate: 0,
            notes: '',
        };
    }

    function calculateRowCost(data) {
        const svcDef = DB_SERVICES[data.service];
        if (!svcDef) return { hourlyRate: 0, monthlyRate: 0 };

        // Compute cost (hourly)
        const computePrice = PricingService.getPrice(svcDef.computeSku);
        const computeHourly = (data.cpuCount || 0) * computePrice;

        // Storage cost (monthly)
        let storageMonthlyCost = 0;
        if (svcDef.hasStorage) {
            const storageSku = svcDef.storageSku || SKU_CATALOG.database.baseDbStorage.partNumber;
            const storagePrice = PricingService.getPrice(storageSku);
            storageMonthlyCost = (data.storageGb || 0) * storagePrice;
        }

        // FSDR cost (databases: charged in BOTH primary + standby = 2x CPUs)
        let fsdrMonthly = 0;
        if (data.fsdr) {
            const isEcpu = svcDef.unit === 'ECPU';
            const fsdrSku = isEcpu ? SKU_CATALOG.fsdr.ecpu.partNumber : SKU_CATALOG.fsdr.ocpu.partNumber;
            const fsdrPrice = PricingService.getPrice(fsdrSku);
            // 2x because DB is protected in both primary and standby regions
            fsdrMonthly = (data.cpuCount || 0) * 2 * fsdrPrice * HOURS_PER_MONTH();
        }

        const monthlyCompute = computeHourly * HOURS_PER_MONTH();
        const monthlyTotal = monthlyCompute + storageMonthlyCost + fsdrMonthly;

        return {
            hourlyRate: computeHourly * (data.quantity || 1),
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
        let dbCount = 0, totalStorageGb = 0, totalOcpus = 0, totalEcpus = 0;
        gridApi.forEachNode(node => {
            const d = node.data;
            const qty = d.quantity || 1;
            totalHourly += d.hourlyRate || 0;
            totalMonthly += d.monthlyRate || 0;
            dbCount += qty;
            totalStorageGb += (d.storageGb || 0) * qty;
            const svcDef = DB_SERVICES[d.service];
            if (svcDef?.unit === 'ECPU') {
                totalEcpus += (d.cpuCount || 0) * qty;
            } else {
                totalOcpus += (d.cpuCount || 0) * qty;
            }
        });
        const el = document.getElementById('database-totals');
        if (el) {
            el.innerHTML = `<strong>Database Totals:</strong> $${totalHourly.toFixed(4)}/hr &nbsp;|&nbsp; $${totalMonthly.toFixed(2)}/month`;
        }
        const cpuLabel = [];
        if (totalOcpus > 0) cpuLabel.push(`${totalOcpus} OCPUs`);
        if (totalEcpus > 0) cpuLabel.push(`${totalEcpus} ECPUs`);
        gridApi.setGridOption('pinnedBottomRowData', [{
            description: `TOTALS (${dbCount} DBs${cpuLabel.length ? ' - ' + cpuLabel.join(', ') : ''})`,
            service: '',
            cpuCount: totalOcpus + totalEcpus,
            storageGb: totalStorageGb,
            fsdr: null,
            quantity: dbCount,
            hourlyRate: totalHourly,
            monthlyRate: totalMonthly,
            notes: '',
        }]);
        if (onTotalsChanged) onTotalsChanged();
    }

    function onCellValueChanged(params) {
        const costs = calculateRowCost(params.data);
        params.data.hourlyRate = costs.hourlyRate;
        params.data.monthlyRate = costs.monthlyRate;
        params.api.refreshCells({ rowNodes: [params.node] });
        updateTotals();
    }

    function getCpuLabel(params) {
        const svcDef = DB_SERVICES[params.data?.service];
        return svcDef ? svcDef.unit + 's' : 'CPUs';
    }

    const columnDefs = [
        {
            headerCheckboxSelection: true,
            checkboxSelection: true,
            width: 40,
            pinned: 'left',
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
            headerName: 'Edition',
            field: 'service',
            editable: true,
            width: 250,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: SERVICE_NAMES },
        },
        {
            headerName: 'OCPUs / ECPUs',
            field: 'cpuCount',
            editable: true,
            width: 130,
            type: 'numericColumn',
        },
        {
            headerName: 'Storage (GB)',
            field: 'storageGb',
            editable: (params) => {
                const svcDef = DB_SERVICES[params.data?.service];
                return svcDef?.hasStorage !== false;
            },
            width: 110,
            type: 'numericColumn',
            cellStyle: (params) => {
                const svcDef = DB_SERVICES[params.data?.service];
                return svcDef?.hasStorage === false ? { backgroundColor: '#f0f0f0' } : {};
            },
        },
        {
            headerName: 'FSDR',
            field: 'fsdr',
            editable: true,
            width: 65,
            cellDataType: 'boolean',
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
            width: 300,
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
            onCellEditingStarted: (params) => {
                if (params.node.isRowPinned()) params.api.stopEditing();
            },
            getRowStyle: (params) => {
                if (params.node.isRowPinned()) return { fontWeight: 'bold', backgroundColor: '#e8f0fe' };
            },
        };

        const container = document.getElementById(containerId);
        gridApi = agGrid.createGrid(container, gridOptions);

        document.getElementById('btn-add-database').addEventListener('click', () => {
            const newRow = createDefaultRow();
            const costs = calculateRowCost(newRow);
            newRow.hourlyRate = costs.hourlyRate;
            newRow.monthlyRate = costs.monthlyRate;
            gridApi.applyTransaction({ add: [newRow] });
            updateTotals();
        });

        document.getElementById('btn-delete-database').addEventListener('click', () => {
            const selected = gridApi.getSelectedRows();
            if (selected.length > 0) {
                gridApi.applyTransaction({ remove: selected });
                updateTotals();
            }
        });

        document.getElementById('btn-export-database-csv').addEventListener('click', () => {
            gridApi.exportDataAsCsv({ fileName: 'oci-database-estimate.csv' });
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

    /**
     * Get monthly cost of replicated DB storage for FSDR rows.
     * DR storage at Lower Cost (0 VPU).
     */
    function getDrStorageMonthly() {
        let total = 0;
        const storagePrice = PricingService.getPrice(SKU_CATALOG.database.baseDbStorage.partNumber);
        gridApi.forEachNode(node => {
            const d = node.data;
            if (!d.fsdr) return;
            total += (d.storageGb || 0) * storagePrice * (d.quantity || 1);
        });
        return total;
    }

    function getFsdrMonthly() {
        let total = 0;
        gridApi.forEachNode(node => {
            const d = node.data;
            if (!d.fsdr) return;
            const svcDef = DB_SERVICES[d.service];
            if (!svcDef) return;
            const isEcpu = svcDef.unit === 'ECPU';
            const fsdrSku = isEcpu ? SKU_CATALOG.fsdr.ecpu.partNumber : SKU_CATALOG.fsdr.ocpu.partNumber;
            const fsdrPrice = PricingService.getPrice(fsdrSku);
            total += (d.cpuCount || 0) * 2 * fsdrPrice * HOURS_PER_MONTH() * (d.quantity || 1);
        });
        return total;
    }

    return { init, recalcAll, getGridApi, getAllData, loadData, getMonthlyTotal, getDrStorageMonthly, getFsdrMonthly };
})();
