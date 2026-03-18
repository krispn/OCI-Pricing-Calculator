/**
 * Exadata Grid — AG Grid configuration for the Exadata Database tab.
 */
const ExadataGrid = (() => {
    let gridApi = null;
    let onTotalsChanged = null;

    const HOURS_PER_MONTH = () => parseInt(document.getElementById('hours-month')?.value) || 744;

    const EXADATA_SERVICES = {
        'Exadata DB (ECPU)':        { computeSku: 'B109356', unit: 'ECPU' },
        'Exadata DB - BYOL (ECPU)': { computeSku: 'B109357', unit: 'ECPU' },
    };

    const SERVICE_NAMES = Object.keys(EXADATA_SERVICES);

    function createDefaultRow() {
        return {
            description: '',
            service: 'Exadata DB (ECPU)',
            ecpuCount: 8,
            vmCount: 2,
            vmFsStorageGb: 280,
            smartStorageGb: 300,
            flashCacheGb: 0,
            quantity: 1,
            hourlyRate: 0,
            monthlyRate: 0,
            notes: '',
        };
    }

    function calculateRowCost(data) {
        const svcDef = EXADATA_SERVICES[data.service];
        if (!svcDef) return { hourlyRate: 0, monthlyRate: 0 };

        const ecpuPrice = PricingService.getPrice(svcDef.computeSku);
        const totalEcpus = (data.ecpuCount || 0) * (data.vmCount || 1);

        // Exascale infrastructure costs
        const infraEcpuPrice = PricingService.getPrice(SKU_CATALOG.database.exadata.exascaleEcpu.partNumber);
        const vmFsPrice = PricingService.getPrice(SKU_CATALOG.database.exadata.exascaleVmFs.partNumber);
        const smartStPrice = PricingService.getPrice(SKU_CATALOG.database.exadata.exascaleSmartStorage.partNumber);
        const flashPrice = PricingService.getPrice(SKU_CATALOG.database.exadata.exascaleFlashCache.partNumber);

        const vmFsGb = (data.vmFsStorageGb || 0) * (data.vmCount || 1);

        // Hourly: ECPUs (DB service) + infrastructure ECPUs
        const dbHourly = totalEcpus * ecpuPrice;
        const infraHourly = totalEcpus * infraEcpuPrice;

        // Monthly: storage
        const vmFsMonthly = vmFsGb * vmFsPrice;
        const smartStMonthly = (data.smartStorageGb || 0) * smartStPrice;
        const flashMonthly = (data.flashCacheGb || 0) * flashPrice;

        const totalHourly = dbHourly + infraHourly;
        const totalMonthly = (totalHourly * HOURS_PER_MONTH()) + vmFsMonthly + smartStMonthly + flashMonthly;

        return {
            hourlyRate: totalHourly * (data.quantity || 1),
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
        gridApi.forEachNode(node => {
            totalHourly += node.data.hourlyRate || 0;
            totalMonthly += node.data.monthlyRate || 0;
        });
        const el = document.getElementById('exadata-totals');
        if (el) {
            el.innerHTML = `<strong>Exadata Totals:</strong> $${totalHourly.toFixed(4)}/hr &nbsp;|&nbsp; $${totalMonthly.toFixed(2)}/month`;
        }
        if (onTotalsChanged) onTotalsChanged();
    }

    function onCellValueChanged(params) {
        const costs = calculateRowCost(params.data);
        params.data.hourlyRate = costs.hourlyRate;
        params.data.monthlyRate = costs.monthlyRate;
        params.api.refreshCells({ rowNodes: [params.node] });
        updateTotals();
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
            headerName: 'ECPUs/VM',
            field: 'ecpuCount',
            editable: true,
            width: 100,
            type: 'numericColumn',
        },
        {
            headerName: 'VMs',
            field: 'vmCount',
            editable: true,
            width: 70,
            type: 'numericColumn',
        },
        {
            headerName: 'VM FS (GB)',
            field: 'vmFsStorageGb',
            editable: true,
            width: 110,
            type: 'numericColumn',
        },
        {
            headerName: 'Smart DB (GB)',
            field: 'smartStorageGb',
            editable: true,
            width: 120,
            type: 'numericColumn',
        },
        {
            headerName: 'Flash Cache (GB)',
            field: 'flashCacheGb',
            editable: true,
            width: 130,
            type: 'numericColumn',
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

        document.getElementById('btn-add-exadata').addEventListener('click', () => {
            const newRow = createDefaultRow();
            const costs = calculateRowCost(newRow);
            newRow.hourlyRate = costs.hourlyRate;
            newRow.monthlyRate = costs.monthlyRate;
            gridApi.applyTransaction({ add: [newRow] });
            updateTotals();
        });

        document.getElementById('btn-delete-exadata').addEventListener('click', () => {
            const selected = gridApi.getSelectedRows();
            if (selected.length > 0) {
                gridApi.applyTransaction({ remove: selected });
                updateTotals();
            }
        });

        document.getElementById('btn-export-exadata-csv').addEventListener('click', () => {
            gridApi.exportDataAsCsv({ fileName: 'oci-exadata-estimate.csv' });
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
