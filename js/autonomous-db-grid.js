/**
 * Autonomous DB Grid — AG Grid configuration for the Autonomous Database tab.
 */
const AutonomousDbGrid = (() => {
    let gridApi = null;
    let onTotalsChanged = null;

    const HOURS_PER_MONTH = () => parseInt(document.getElementById('hours-month')?.value) || 744;

    const AUTO_SERVICES = {
        'Lakehouse (ECPU)':       { computeSku: 'B95701', storageSku: 'B95754', unit: 'ECPU', hasEcpu: true },
        'Lakehouse - BYOL (ECPU)':{ computeSku: 'B95703', storageSku: 'B95754', unit: 'ECPU', hasEcpu: true },
        'ATP (ECPU)':             { computeSku: 'B95702', storageSku: 'B95706', unit: 'ECPU', hasEcpu: true },
        'ATP - BYOL (ECPU)':      { computeSku: 'B95704', storageSku: 'B95706', unit: 'ECPU', hasEcpu: true },
        'JSON (ECPU)':            { computeSku: 'B99708', storageSku: 'B95754', unit: 'ECPU', hasEcpu: true },
        'Developer':              { computeSku: 'B110316', storageSku: null,     unit: 'Instance', hasEcpu: false },
    };

    const SERVICE_NAMES = Object.keys(AUTO_SERVICES);

    function createDefaultRow() {
        return {
            description: '',
            service: 'Lakehouse (ECPU)',
            ecpuCount: 2,
            storageGb: 1024,
            fsdr: false,
            quantity: 1,
            hourlyRate: 0,
            monthlyRate: 0,
            notes: '',
        };
    }

    function calculateRowCost(data) {
        const svcDef = AUTO_SERVICES[data.service];
        if (!svcDef) return { hourlyRate: 0, monthlyRate: 0 };

        const computePrice = PricingService.getPrice(svcDef.computeSku);
        const computeQty = svcDef.hasEcpu ? (data.ecpuCount || 0) : 1;
        const computeHourly = computeQty * computePrice;

        let storageMonthly = 0;
        if (svcDef.storageSku) {
            const storagePrice = PricingService.getPrice(svcDef.storageSku);
            storageMonthly = (data.storageGb || 0) * storagePrice;
        }

        // FSDR cost (databases: charged in BOTH primary + standby = 2x ECPUs)
        let fsdrMonthly = 0;
        if (data.fsdr && svcDef.hasEcpu) {
            const fsdrPrice = PricingService.getPrice(SKU_CATALOG.fsdr.ecpu.partNumber);
            fsdrMonthly = (data.ecpuCount || 0) * 2 * fsdrPrice * HOURS_PER_MONTH();
        }

        const totalMonthly = (computeHourly * HOURS_PER_MONTH()) + storageMonthly + fsdrMonthly;

        return {
            hourlyRate: computeHourly * (data.quantity || 1),
            monthlyRate: totalMonthly * (data.quantity || 1),
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
        let totalEcpus = 0, totalStorageGb = 0;
        gridApi.forEachNode(node => {
            const d = node.data;
            const qty = d.quantity || 1;
            totalHourly += d.hourlyRate || 0;
            totalMonthly += d.monthlyRate || 0;
            totalEcpus += (d.ecpuCount || 0) * qty;
            totalStorageGb += (d.storageGb || 0) * qty;
        });
        const el = document.getElementById('autonomous-db-totals');
        if (el) {
            el.innerHTML = `<strong>Autonomous DB Totals:</strong> $${totalHourly.toFixed(4)}/hr &nbsp;|&nbsp; $${totalMonthly.toFixed(2)}/month`;
        }
        gridApi.setGridOption('pinnedBottomRowData', [{
            description: 'TOTALS',
            service: '',
            ecpuCount: totalEcpus,
            storageGb: totalStorageGb,
            fsdr: null,
            quantity: null,
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

    function hasEcpu(params) {
        const svcDef = AUTO_SERVICES[params.data?.service];
        return svcDef?.hasEcpu !== false;
    }

    function hasStorage(params) {
        const svcDef = AUTO_SERVICES[params.data?.service];
        return svcDef?.storageSku != null;
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
            headerName: 'Service',
            field: 'service',
            editable: true,
            width: 220,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: SERVICE_NAMES },
        },
        {
            headerName: 'ECPUs',
            field: 'ecpuCount',
            editable: (params) => hasEcpu(params),
            width: 90,
            type: 'numericColumn',
            cellStyle: (params) => hasEcpu(params) ? {} : { backgroundColor: '#f0f0f0' },
        },
        {
            headerName: 'Storage (GB)',
            field: 'storageGb',
            editable: (params) => hasStorage(params),
            width: 120,
            type: 'numericColumn',
            cellStyle: (params) => hasStorage(params) ? {} : { backgroundColor: '#f0f0f0' },
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

        document.getElementById('btn-add-autonomous-db').addEventListener('click', () => {
            const newRow = createDefaultRow();
            const costs = calculateRowCost(newRow);
            newRow.hourlyRate = costs.hourlyRate;
            newRow.monthlyRate = costs.monthlyRate;
            gridApi.applyTransaction({ add: [newRow] });
            updateTotals();
        });

        document.getElementById('btn-delete-autonomous-db').addEventListener('click', () => {
            const selected = gridApi.getSelectedRows();
            if (selected.length > 0) {
                gridApi.applyTransaction({ remove: selected });
                updateTotals();
            }
        });

        document.getElementById('btn-export-autonomous-db-csv').addEventListener('click', () => {
            gridApi.exportDataAsCsv({ fileName: 'oci-autonomous-db-estimate.csv' });
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
     * Get monthly cost of replicated Autonomous DB storage for FSDR rows.
     */
    function getDrStorageMonthly() {
        let total = 0;
        gridApi.forEachNode(node => {
            const d = node.data;
            if (!d.fsdr) return;
            const svcDef = AUTO_SERVICES[d.service];
            if (!svcDef?.storageSku) return;
            const storagePrice = PricingService.getPrice(svcDef.storageSku);
            total += (d.storageGb || 0) * storagePrice * (d.quantity || 1);
        });
        return total;
    }

    function getFsdrMonthly() {
        let total = 0;
        gridApi.forEachNode(node => {
            const d = node.data;
            if (!d.fsdr) return;
            const svcDef = AUTO_SERVICES[d.service];
            if (!svcDef?.hasEcpu) return;
            const fsdrPrice = PricingService.getPrice(SKU_CATALOG.fsdr.ecpu.partNumber);
            total += (d.ecpuCount || 0) * 2 * fsdrPrice * HOURS_PER_MONTH() * (d.quantity || 1);
        });
        return total;
    }

    return { init, recalcAll, getGridApi, getAllData, loadData, getMonthlyTotal, getDrStorageMonthly, getFsdrMonthly };
})();
