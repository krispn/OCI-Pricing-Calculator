/**
 * File Storage Grid — AG Grid configuration for the File Storage tab.
 */
const FileStorageGrid = (() => {
    let gridApi = null;
    let onTotalsChanged = null;

    function createDefaultRow() {
        return {
            description: '',
            sizeGb: 100,
            quantity: 1,
            monthlyRate: 0,
            notes: '',
        };
    }

    function calculateRowCost(data) {
        const price = PricingService.getPrice(SKU_CATALOG.storage.fileStorage.storage.partNumber);
        const monthly = (data.sizeGb || 0) * price;
        return { monthlyRate: monthly * (data.quantity || 1) };
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
        let totalMonthly = 0, totalSizeGb = 0;
        gridApi.forEachNode(node => {
            const d = node.data;
            const qty = d.quantity || 1;
            totalMonthly += d.monthlyRate || 0;
            totalSizeGb += (d.sizeGb || 0) * qty;
        });
        const el = document.getElementById('file-storage-totals');
        if (el) {
            el.innerHTML = `<strong>File Storage Totals:</strong> $${totalMonthly.toFixed(2)}/month`;
        }
        gridApi.setGridOption('pinnedBottomRowData', [{
            description: 'TOTALS',
            sizeGb: totalSizeGb,
            quantity: null,
            monthlyRate: totalMonthly,
            notes: '',
        }]);
        if (onTotalsChanged) onTotalsChanged();
    }

    function onCellValueChanged(params) {
        const costs = calculateRowCost(params.data);
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
            width: 250,
        },
        {
            headerName: 'Size (GB)',
            field: 'sizeGb',
            editable: true,
            width: 120,
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

        document.getElementById('btn-add-file-storage').addEventListener('click', () => {
            const newRow = createDefaultRow();
            const costs = calculateRowCost(newRow);
            newRow.monthlyRate = costs.monthlyRate;
            gridApi.applyTransaction({ add: [newRow] });
            updateTotals();
        });

        document.getElementById('btn-delete-file-storage').addEventListener('click', () => {
            const selected = gridApi.getSelectedRows();
            if (selected.length > 0) {
                gridApi.applyTransaction({ remove: selected });
                updateTotals();
            }
        });

        document.getElementById('btn-export-file-storage-csv').addEventListener('click', () => {
            gridApi.exportDataAsCsv({ fileName: 'oci-file-storage-estimate.csv' });
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
