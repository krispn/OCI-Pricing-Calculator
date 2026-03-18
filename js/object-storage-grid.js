/**
 * Object Storage Grid — AG Grid configuration for the Object Storage tab.
 */
const ObjectStorageGrid = (() => {
    let gridApi = null;
    let onTotalsChanged = null;

    const STORAGE_TIERS = [
        'Standard',
        'Infrequent Access',
        'Archive',
    ];

    function createDefaultRow() {
        return {
            description: '',
            tier: 'Standard',
            sizeGb: 100,
            requestsPerMonth10k: 0,
            retrievalGb: 0,
            quantity: 1,
            monthlyRate: 0,
            notes: '',
        };
    }

    function calculateRowCost(data) {
        let monthly = 0;
        const sizeGb = data.sizeGb || 0;
        const qty = data.quantity || 1;

        switch (data.tier) {
            case 'Standard':
                monthly = sizeGb * PricingService.getPrice(SKU_CATALOG.storage.objectStorage.standard.partNumber);
                break;
            case 'Infrequent Access':
                monthly = sizeGb * PricingService.getPrice(SKU_CATALOG.storage.objectStorage.infrequentAccess.partNumber);
                // Add data retrieval cost
                monthly += (data.retrievalGb || 0) * PricingService.getPrice(SKU_CATALOG.storage.objectStorage.iaRetrieval.partNumber);
                break;
            case 'Archive':
                monthly = sizeGb * PricingService.getPrice(SKU_CATALOG.storage.objectStorage.archive.partNumber);
                break;
        }

        // Add request costs (price is per 10K requests)
        monthly += (data.requestsPerMonth10k || 0) * PricingService.getPrice(SKU_CATALOG.storage.objectStorage.requests.partNumber);

        return { monthlyRate: monthly * qty };
    }

    function recalcAll() {
        if (!gridApi) return;
        gridApi.forEachNode(node => {
            const costs = calculateRowCost(node.data);
            node.data.monthlyRate = costs.monthlyRate;
        });
        gridApi.refreshCells({ columns: ['monthlyRate'] });
        updateTotals();
    }

    function updateTotals() {
        let totalMonthly = 0;
        gridApi.forEachNode(node => { totalMonthly += node.data.monthlyRate || 0; });
        const el = document.getElementById('object-storage-totals');
        if (el) {
            el.innerHTML = `<strong>Object Storage Totals:</strong> $${totalMonthly.toFixed(2)}/month`;
        }
        if (onTotalsChanged) onTotalsChanged();
    }

    function onCellValueChanged(params) {
        const costs = calculateRowCost(params.data);
        params.data.monthlyRate = costs.monthlyRate;
        params.api.refreshCells({ rowNodes: [params.node] });
        updateTotals();
    }

    function isInfrequentAccess(params) {
        return params.data?.tier === 'Infrequent Access';
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
            headerName: 'Tier',
            field: 'tier',
            editable: true,
            width: 180,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: { values: STORAGE_TIERS },
        },
        {
            headerName: 'Size (GB)',
            field: 'sizeGb',
            editable: true,
            width: 100,
            type: 'numericColumn',
        },
        {
            headerName: 'Requests (10K/mo)',
            field: 'requestsPerMonth10k',
            editable: true,
            width: 150,
            type: 'numericColumn',
        },
        {
            headerName: 'Retrieval (GB/mo)',
            field: 'retrievalGb',
            editable: (params) => isInfrequentAccess(params),
            width: 150,
            type: 'numericColumn',
            cellStyle: (params) => isInfrequentAccess(params) ? {} : { backgroundColor: '#f0f0f0' },
        },
        {
            headerName: 'Qty',
            field: 'quantity',
            editable: true,
            width: 60,
            type: 'numericColumn',
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

        document.getElementById('btn-add-object-storage').addEventListener('click', () => {
            const newRow = createDefaultRow();
            const costs = calculateRowCost(newRow);
            newRow.monthlyRate = costs.monthlyRate;
            gridApi.applyTransaction({ add: [newRow] });
            updateTotals();
        });

        document.getElementById('btn-delete-object-storage').addEventListener('click', () => {
            const selected = gridApi.getSelectedRows();
            if (selected.length > 0) {
                gridApi.applyTransaction({ remove: selected });
                updateTotals();
            }
        });

        document.getElementById('btn-export-object-storage-csv').addEventListener('click', () => {
            gridApi.exportDataAsCsv({ fileName: 'oci-object-storage-estimate.csv' });
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
