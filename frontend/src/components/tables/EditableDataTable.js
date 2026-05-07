import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Select,
  MenuItem,
  Checkbox,
  IconButton,
  Button,
  Box,
  Typography,
  Chip,
  Avatar,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Switch,
  Slider,
  Rating,
  DatePicker,
  TimePicker,
  Autocomplete,
  Badge,
  LinearProgress,
  Collapse,
  Alert,
  Fade,
  Zoom,
  Slide
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { LocalizationProvider, DatePicker as MuiDatePicker, TimePicker as MuiTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { useInteractive } from '../../contexts/InteractiveContext';
import { useNotification } from '../../contexts/NotificationContext';

const EditableDataTable = ({
  data = [],
  columns = [],
  onDataChange,
  onRowAdd,
  onRowEdit,
  onRowDelete,
  onCellEdit,
  enableInlineEdit = true,
  enableRowSelection = true,
  enableColumnReorder = true,
  enableRowReorder = true,
  enableFiltering = true,
  enableSorting = true,
  enableSearch = true,
  enableExport = true,
  enableImport = true,
  enableValidation = true,
  enableBulkActions = true,
  enableVirtualization = false,
  pageSize = 25,
  maxHeight = 600,
  stickyHeader = true,
  striped = true,
  hover = true,
  dense = false,
  title,
  subtitle,
  emptyMessage = 'No data available',
  loadingMessage = 'Loading...',
  errorMessage = 'Error loading data',
  validationRules = {},
  customCellRenderers = {},
  customEditors = {},
  bulkActions = [],
  contextMenuActions = [],
  onSelectionChange,
  onFilterChange,
  onSortChange,
  className,
  style
}) => {
  const {
    selectedItems,
    toggleSelection,
    clearSelection,
    selectAll,
    showContextMenu,
    animations
  } = useInteractive();
  const { showNotification } = useNotification();

  // Table state
  const [editingCell, setEditingCell] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(new Set(columns.map(col => col.key)));
  const [columnOrder, setColumnOrder] = useState(columns.map(col => col.key));
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});

  // UI state
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRowForMenu, setSelectedRowForMenu] = useState(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false);
  const [bulkActionMenuAnchor, setBulkActionMenuAnchor] = useState(null);
  const [newRowData, setNewRowData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  // Refs
  const tableRef = useRef(null);
  const editInputRef = useRef(null);

  // Process data with filters, search, and sorting
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchTerm && enableSearch) {
      result = result.filter(row =>
        columns.some(col => {
          const value = row[col.key];
          return String(value || '').toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply column filters
    if (enableFiltering) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          result = result.filter(row => {
            const cellValue = row[key];
            if (Array.isArray(value)) {
              return value.includes(cellValue);
            }
            if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
              const numValue = Number(cellValue);
              return numValue >= value.min && numValue <= value.max;
            }
            return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
          });
        }
      });
    }

    // Apply sorting
    if (sortConfig.key && enableSorting) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, filters, sortConfig, columns, enableSearch, enableFiltering, enableSorting]);

  // Paginated data
  const paginatedData = useMemo(() => {
    if (!pageSize) return processedData;
    
    const start = currentPage * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  // Validate cell value
  const validateCell = useCallback((rowId, columnKey, value) => {
    const column = columns.find(col => col.key === columnKey);
    const rules = validationRules[columnKey] || column?.validation || {};
    const errors = [];
    const warnings = [];

    // Required validation
    if (rules.required && (!value || value === '')) {
      errors.push('This field is required');
    }

    // Type validation
    if (value && rules.type) {
      switch (rules.type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push('Invalid email format');
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            errors.push('Must be a number');
          } else {
            const num = Number(value);
            if (rules.min !== undefined && num < rules.min) {
              errors.push(`Must be at least ${rules.min}`);
            }
            if (rules.max !== undefined && num > rules.max) {
              errors.push(`Must be at most ${rules.max}`);
            }
          }
          break;
        case 'url':
          try {
            new URL(value);
          } catch {
            errors.push('Invalid URL format');
          }
          break;
      }
    }

    // Length validation
    if (value && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`Must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Must be at most ${rules.maxLength} characters`);
      }
    }

    // Pattern validation
    if (value && rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        errors.push(rules.patternMessage || 'Invalid format');
      }
    }

    // Custom validation
    if (rules.custom && typeof rules.custom === 'function') {
      const result = rules.custom(value, data.find(row => row.id === rowId));
      if (result !== true) {
        if (typeof result === 'string') {
          errors.push(result);
        } else if (Array.isArray(result)) {
          errors.push(...result);
        }
      }
    }

    return { errors, warnings };
  }, [columns, validationRules, data]);

  // Start editing cell
  const startCellEdit = useCallback((rowId, columnKey, currentValue) => {
    if (!enableInlineEdit) return;
    
    setEditingCell({ rowId, columnKey });
    setEditValue(currentValue || '');
    
    // Focus input after state update
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
      }
    }, 0);
  }, [enableInlineEdit]);

  // Save cell edit
  const saveCellEdit = useCallback(async () => {
    if (!editingCell) return;

    const { rowId, columnKey } = editingCell;
    
    // Validate if enabled
    if (enableValidation) {
      const validation = validateCell(rowId, columnKey, editValue);
      if (validation.errors.length > 0) {
        setValidationErrors(prev => ({
          ...prev,
          [`${rowId}-${columnKey}`]: validation.errors
        }));
        showNotification(validation.errors[0], 'error');
        return;
      }
    }

    try {
      // Call edit handler
      if (onCellEdit) {
        await onCellEdit(rowId, columnKey, editValue);
      } else if (onDataChange) {
        const newData = data.map(row =>
          row.id === rowId ? { ...row, [columnKey]: editValue } : row
        );
        await onDataChange(newData);
      }

      // Clear validation errors
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${rowId}-${columnKey}`];
        return newErrors;
      });

      setEditingCell(null);
      setEditValue('');
      showNotification('Cell updated successfully', 'success');
    } catch (error) {
      showNotification('Failed to update cell', 'error');
    }
  }, [editingCell, editValue, enableValidation, validateCell, onCellEdit, onDataChange, data, showNotification]);

  // Cancel cell edit
  const cancelCellEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setValidationErrors(prev => {
      if (!editingCell) return prev;
      const newErrors = { ...prev };
      delete newErrors[`${editingCell.rowId}-${editingCell.columnKey}`];
      return newErrors;
    });
  }, [editingCell]);

  // Handle key press in edit mode
  const handleEditKeyPress = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveCellEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelCellEdit();
    }
  }, [saveCellEdit, cancelCellEdit]);

  // Handle sorting
  const handleSort = useCallback((columnKey) => {
    if (!enableSorting) return;

    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));

    if (onSortChange) {
      onSortChange(columnKey, sortConfig.direction);
    }
  }, [enableSorting, sortConfig.direction, onSortChange]);

  // Handle filtering
  const handleFilter = useCallback((columnKey, value) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (value === null || value === '' || value === 'all') {
        delete newFilters[columnKey];
      } else {
        newFilters[columnKey] = value;
      }
      return newFilters;
    });

    if (onFilterChange) {
      onFilterChange(filters);
    }
  }, [filters, onFilterChange]);

  // Handle row selection
  const handleRowSelect = useCallback((rowId, event) => {
    if (!enableRowSelection) return;

    if (event.shiftKey && selectedItems.length > 0) {
      // Range selection
      const lastSelected = selectedItems[selectedItems.length - 1];
      const currentIndex = processedData.findIndex(row => row.id === rowId);
      const lastIndex = processedData.findIndex(row => row.id === lastSelected);
      
      const start = Math.min(currentIndex, lastIndex);
      const end = Math.max(currentIndex, lastIndex);
      
      const rangeIds = processedData.slice(start, end + 1).map(row => row.id);
      rangeIds.forEach(id => {
        if (!selectedItems.includes(id)) {
          toggleSelection(id);
        }
      });
    } else {
      toggleSelection(rowId);
    }

    if (onSelectionChange) {
      onSelectionChange(selectedItems);
    }
  }, [enableRowSelection, selectedItems, processedData, toggleSelection, onSelectionChange]);

  // Handle context menu
  const handleContextMenu = useCallback((event, row) => {
    event.preventDefault();
    setSelectedRowForMenu(row);
    setAnchorEl({ x: event.clientX, y: event.clientY });
  }, []);

  // Handle bulk actions
  const handleBulkAction = useCallback(async (action) => {
    if (selectedItems.length === 0) return;

    try {
      if (action.handler) {
        await action.handler(selectedItems);
      }
      
      setBulkActionMenuAnchor(null);
      showNotification(`${action.label} completed for ${selectedItems.length} items`, 'success');
    } catch (error) {
      showNotification(`Failed to ${action.label.toLowerCase()}`, 'error');
    }
  }, [selectedItems, showNotification]);

  // Add new row
  const handleAddRow = useCallback(async () => {
    try {
      if (onRowAdd) {
        await onRowAdd(newRowData);
      } else if (onDataChange) {
        const newRow = {
          id: Date.now(),
          ...newRowData
        };
        await onDataChange([...data, newRow]);
      }

      setAddRowDialogOpen(false);
      setNewRowData({});
      showNotification('Row added successfully', 'success');
    } catch (error) {
      showNotification('Failed to add row', 'error');
    }
  }, [newRowData, onRowAdd, onDataChange, data, showNotification]);

  // Delete row
  const handleDeleteRow = useCallback(async (rowId) => {
    try {
      if (onRowDelete) {
        await onRowDelete(rowId);
      } else if (onDataChange) {
        const newData = data.filter(row => row.id !== rowId);
        await onDataChange(newData);
      }

      setAnchorEl(null);
      showNotification('Row deleted successfully', 'success');
    } catch (error) {
      showNotification('Failed to delete row', 'error');
    }
  }, [onRowDelete, onDataChange, data, showNotification]);

  // Export data
  const handleExport = useCallback(() => {
    const csvContent = [
      columns.filter(col => visibleColumns.has(col.key)).map(col => col.label).join(','),
      ...processedData.map(row =>
        columns
          .filter(col => visibleColumns.has(col.key))
          .map(col => `"${row[col.key] || ''}"`)
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `table-data-${Date.now()}.csv`;
    link.click();
    
    showNotification('Data exported successfully', 'success');
  }, [columns, visibleColumns, processedData, showNotification]);

  // Render cell content
  const renderCell = useCallback((row, column) => {
    const cellKey = `${row.id}-${column.key}`;
    const isEditing = editingCell?.rowId === row.id && editingCell?.columnKey === column.key;
    const value = row[column.key];
    const hasError = validationErrors[cellKey]?.length > 0;
    const hasWarning = warnings[cellKey]?.length > 0;

    if (isEditing) {
      // Render editor
      const customEditor = customEditors[column.key];
      if (customEditor) {
        return customEditor(value, editValue, setEditValue, saveCellEdit, cancelCellEdit);
      }

      if (column.type === 'select') {
        return (
          <Select
            ref={editInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveCellEdit}
            onKeyDown={handleEditKeyPress}
            size="small"
            fullWidth
            autoFocus
          >
            {column.options?.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        );
      } else if (column.type === 'boolean') {
        return (
          <Checkbox
            checked={Boolean(editValue)}
            onChange={(e) => {
              setEditValue(e.target.checked);
              setTimeout(saveCellEdit, 0);
            }}
            autoFocus
          />
        );
      } else {
        return (
          <TextField
            ref={editInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveCellEdit}
            onKeyDown={handleEditKeyPress}
            size="small"
            fullWidth
            autoFocus
            error={hasError}
            helperText={hasError ? validationErrors[cellKey][0] : ''}
            type={column.type || 'text'}
          />
        );
      }
    }

    // Render display value
    const customRenderer = customCellRenderers[column.key];
    if (customRenderer) {
      return customRenderer(value, row, column);
    }

    if (column.type === 'boolean') {
      return <Checkbox checked={Boolean(value)} disabled />;
    }

    if (column.type === 'chip') {
      return (
        <Chip
          label={value}
          size="small"
          color={column.chipColor?.(value) || 'default'}
        />
      );
    }

    if (column.type === 'avatar') {
      return <Avatar src={value} sx={{ width: 32, height: 32 }} />;
    }

    if (column.type === 'date') {
      return value ? new Date(value).toLocaleDateString() : '';
    }

    if (column.type === 'rating') {
      return <Rating value={Number(value) || 0} readOnly size="small" />;
    }

    return (
      <Box
        onClick={() => startCellEdit(row.id, column.key, value)}
        sx={{
          cursor: enableInlineEdit ? 'pointer' : 'default',
          padding: '4px',
          borderRadius: 1,
          '&:hover': enableInlineEdit ? {
            backgroundColor: 'action.hover'
          } : {},
          position: 'relative'
        }}
      >
        {String(value || '')}
        {hasError && (
          <Tooltip title={validationErrors[cellKey].join(', ')}>
            <ErrorIcon
              color="error"
              sx={{ position: 'absolute', top: 0, right: 0, fontSize: 12 }}
            />
          </Tooltip>
        )}
        {hasWarning && (
          <Tooltip title={warnings[cellKey].join(', ')}>
            <WarningIcon
              color="warning"
              sx={{ position: 'absolute', top: 0, right: 0, fontSize: 12 }}
            />
          </Tooltip>
        )}
      </Box>
    );
  }, [
    editingCell,
    editValue,
    validationErrors,
    warnings,
    customEditors,
    customCellRenderers,
    enableInlineEdit,
    startCellEdit,
    saveCellEdit,
    cancelCellEdit,
    handleEditKeyPress
  ]);

  return (
    <Box className={className} style={style}>
      {/* Header */}
      {(title || subtitle || enableSearch || enableExport || enableImport || bulkActions.length > 0) && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            {title && (
              <Typography variant="h6" component="h2">
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          
          <Box display="flex" gap={1} alignItems="center">
            {/* Search */}
            {enableSearch && (
              <TextField
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon color="action" />
                }}
                sx={{ width: 200 }}
              />
            )}
            
            {/* Bulk Actions */}
            {enableBulkActions && selectedItems.length > 0 && bulkActions.length > 0 && (
              <Button
                size="small"
                onClick={(e) => setBulkActionMenuAnchor(e.currentTarget)}
                startIcon={<Badge badgeContent={selectedItems.length} color="primary" />}
              >
                Bulk Actions
              </Button>
            )}
            
            {/* Export */}
            {enableExport && (
              <Tooltip title="Export Data">
                <IconButton size="small" onClick={handleExport}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}
            
            {/* Add Row */}
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setAddRowDialogOpen(true)}
              variant="contained"
            >
              Add Row
            </Button>
          </Box>
        </Box>
      )}

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Table */}
      <TableContainer
        component={Paper}
        ref={tableRef}
        sx={{ maxHeight, overflow: 'auto' }}
      >
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {enableRowSelection && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedItems.length > 0 && selectedItems.length < processedData.length}
                    checked={processedData.length > 0 && selectedItems.length === processedData.length}
                    onChange={() => {
                      if (selectedItems.length === processedData.length) {
                        clearSelection();
                      } else {
                        selectAll(processedData);
                      }
                    }}
                  />
                </TableCell>
              )}
              
              {columns
                .filter(col => visibleColumns.has(col.key))
                .map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align || 'left'}
                    style={{ minWidth: column.minWidth }}
                    sortDirection={sortConfig.key === column.key ? sortConfig.direction : false}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      {enableSorting && column.sortable !== false ? (
                        <Button
                          size="small"
                          onClick={() => handleSort(column.key)}
                          endIcon={<SortIcon />}
                          sx={{ textTransform: 'none' }}
                        >
                          {column.label}
                        </Button>
                      ) : (
                        <Typography variant="subtitle2" fontWeight="bold">
                          {column.label}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                ))}
              
              <TableCell width={100}>Actions</TableCell>
            </TableRow>
          </TableHead>
          
          <TableBody>
            <AnimatePresence>
              {paginatedData.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={animations ? { opacity: 0, y: 20 } : false}
                  animate={animations ? { opacity: 1, y: 0 } : false}
                  exit={animations ? { opacity: 0, y: -20 } : false}
                  transition={{ duration: 0.2 }}
                >
                  <TableRow
                    hover={hover}
                    selected={selectedItems.includes(row.id)}
                    onContextMenu={(e) => handleContextMenu(e, row)}
                    sx={{
                      backgroundColor: striped && index % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent'
                    }}
                  >
                    {enableRowSelection && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedItems.includes(row.id)}
                          onChange={(e) => handleRowSelect(row.id, e)}
                        />
                      </TableCell>
                    )}
                    
                    {columns
                      .filter(col => visibleColumns.has(col.key))
                      .map((column) => (
                        <TableCell key={column.key} align={column.align || 'left'}>
                          {renderCell(row, column)}
                        </TableCell>
                      ))}
                    
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => setEditingRow(row.id)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDeleteRow(row.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="More">
                          <IconButton
                            size="small"
                            onClick={(e) => handleContextMenu(e, row)}
                          >
                            <MoreIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                </motion.tr>
              ))}
            </AnimatePresence>
            
            {processedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 2} align="center">
                  <Typography variant="body2" color="text.secondary" py={4}>
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Context Menu */}
      <Menu
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorReference="anchorPosition"
        anchorPosition={anchorEl}
        TransitionComponent={Fade}
      >
        {contextMenuActions.map((action, index) => (
          <MenuItem
            key={index}
            onClick={() => {
              action.handler(selectedRowForMenu);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>
              {action.icon}
            </ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Bulk Actions Menu */}
      <Menu
        anchorEl={bulkActionMenuAnchor}
        open={Boolean(bulkActionMenuAnchor)}
        onClose={() => setBulkActionMenuAnchor(null)}
        TransitionComponent={Fade}
      >
        {bulkActions.map((action, index) => (
          <MenuItem
            key={index}
            onClick={() => handleBulkAction(action)}
          >
            <ListItemIcon>
              {action.icon}
            </ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Add Row Dialog */}
      <Dialog
        open={addRowDialogOpen}
        onClose={() => setAddRowDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>Add New Row</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {columns
              .filter(col => col.editable !== false)
              .map((column) => (
                <TextField
                  key={column.key}
                  label={column.label}
                  value={newRowData[column.key] || ''}
                  onChange={(e) => setNewRowData(prev => ({ ...prev, [column.key]: e.target.value }))}
                  type={column.type || 'text'}
                  fullWidth
                  required={column.required}
                />
              ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRowDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddRow} variant="contained">
            Add Row
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EditableDataTable;