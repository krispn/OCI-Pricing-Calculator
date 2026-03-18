/**
 * Network Grid — AG Grid configuration for the Networking tab.
 */
const NetworkGrid = (() => {
    let gridApi = null;
    let onTotalsChanged = null;

    const HOURS_PER_MONTH = () => parseInt(document.getElementById('hours-month')?.value) || 744;

    const NETWORK_SERVICES = {
        'Load Balancer':         { type: 'lb' },
        'Network Load Balancer': { type: 'nlb' },
        'FastConnect 1 Gbps':    { type: 'fc', sku: 'B88325' },
        'FastConnect 10 Gbps':   { type: 'fc', sku: 'B88326' },
        'FastConnect 100 Gbps':  { type: 'fc', sku: 'B93126' },
        'FastConnect 400 Gbps':  { type: 'fc', sku: 'B107975' },
    };

    const SERVICE_NAMES = Object.keys(NETWORK_SERVICES);

    function createDefaultRow() {
        return {
            description: '',
            service: 'Load Balancer',
            lbBandwidthMbps: 10,
            quantity: 1,
            hourlyRate: 0,
            monthlyRate: 0,
            notes: '',
        };
    }

    function calculateRowCost(data) {
        const svcDef = NETWORK_SERVICES[data.service];
        if (!svcDef) return { hourlyRate: 0, monthlyRate: 0 };

        let hourly = 0;

        if (svcDef.type === 'lb') {
            // Load Balancer: base + bandwidth per Mbps
            const basePrice = PricingService.getPrice(SKU_CATALOG.networking.loadBalancer.base.partNumber);
            const bwPrice = PricingService.getPrice(SKU_CATALOG.networking.loadBalancer.bandwidth.partNumber);
            hourly = basePrice + (data.lbBandwidthMbps || 0) * bwPrice;
        } else if (svcDef.type === 'nlb') {
            // Network Load Balancer is free
            hourly = 0;
        } else if (svcDef.type === 'fc') {
            // FastConnect: per port per hour
            hourly = PricingService.getPrice(svcDef.sku);
        }

        const monthly = hourly * HOURS_PER_MONTH();

        return {
            hourlyRate: hourly * (data.quantity || 1),
            monthlyRate: monthly * (data.quantity || 1),
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
        const el = document.getElementById('network-totals');
        if (el) {
            el.innerHTML = `<strong>Network Totals:</strong> $${totalHourly.toFixed(4)}/hr &nbsp;|&nbsp; $${totalMonthly.toFixed(2)}/month`;
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

    function isLb(params) {
        const svcDef = NETWORK_SERVICES[params.data?.service];
        return svcDef?.type === 'lb';
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
            headerName: 'Bandwidth (Mbps)',
            field: 'lbBandwidthMbps',
            editable: (params) => isLb(params),
            width: 150,
            type: 'numericColumn',
            cellStyle: (params) => isLb(params) ? {} : { backgroundColor: '#f0f0f0' },
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
        };

        const container = document.getElementById(containerId);
        gridApi = agGrid.createGrid(container, gridOptions);

        document.getElementById('btn-add-network').addEventListener('click', () => {
            const newRow = createDefaultRow();
            const costs = calculateRowCost(newRow);
            newRow.hourlyRate = costs.hourlyRate;
            newRow.monthlyRate = costs.monthlyRate;
            gridApi.applyTransaction({ add: [newRow] });
            updateTotals();
        });

        document.getElementById('btn-delete-network').addEventListener('click', () => {
            const selected = gridApi.getSelectedRows();
            if (selected.length > 0) {
                gridApi.applyTransaction({ remove: selected });
                updateTotals();
            }
        });

        document.getElementById('btn-export-network-csv').addEventListener('click', () => {
            gridApi.exportDataAsCsv({ fileName: 'oci-network-estimate.csv' });
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
