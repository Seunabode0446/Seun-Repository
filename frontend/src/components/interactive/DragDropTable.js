import React, { useState, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  IconButton,
  TextField,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fade,
  Zoom
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  MoreVert as MoreIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { useInteractive } from '../../contexts/InteractiveContext';
import { useNotification } from '../../contexts/NotificationContext';

const DragDropTable = ({
  data = [],
  columns = [],
  onDataChange,
  onRowEdit,
  onRowDelete,
  onRowAdd,
  enableDragDrop = true,
  enableInlineEdit = true,
  enableSelection = true,
  enableFiltering = true,
  enableSorting = true,
  enableContextMenu = true,
  rowHeight = 'auto',
  maxHeight = 600,
  stickyHeader = true,
  striped = true,
  hover = true,
  dense = false,
  title,
  subtitle,
  actions = []
}) => {
  const {
    selectedItems,
    toggleSelection,
    clearSelection,
    selectAll,
    showContextMenu,
    hideContextMenu,
    contextMenu,
    animations
  } = useInteractive();
  const { showNotification } = useNotification();

  // Local state
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedRowForMenu, setSelectedRowForMenu] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newRowData, setNewRowData] = useState({});

  // Memoized filtered and sorted data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchTerm) {
      result = result.filter(row =>
        columns.some(col =>
          String(row[col.key] || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        result = result.filter(row => {
          const cellValue = row[key];
          if (Array.isArray(value)) {
            return value.includes(cellValue);
          }
          return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, filters, sortConfig, columns]);

  // Handle drag end
  const handleDragEnd = useCallback((result) => {
    if (!result.destination || !enableDragDrop) return;

    const items = Array.from(processedData);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    if (onDataChange) {
      onDataChange(items);
    }

    showNotification('Row order updated', 'success');
  }, [processedData, onDataChange, enableDragDrop, showNotification]);

  // Handle sorting
  const handleSort = useCallback((columnKey) => {
    if (!enableSorting) return;

    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, [enableSorting]);

  // Handle filtering
  const handleFilter = useCallback((columnKey, value) => {
    setFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  }, []);

  // Handle inline editing
  const startEdit = useCallback((row) => {
    if (!enableInlineEdit) return;
    
    setEditingRow(row.id);
    setEditData({ ...row });
  }, [enableInlineEdit]);

  const cancelEdit = useCallback(() => {
    setEditingRow(null);
    setEditData({});
  }, []);

  const saveEdit = useCallback(async () => {
    try {
      if (onRowEdit) {
        await onRowEdit(editData);
      }
      setEditingRow(null);
      setEditData({});
      showNotification('Row updated successfully', 'success');
    } catch (error) {
      showNotification('Failed to update row', 'error');
    }
  }, [editData, onRowEdit, showNotification]);

  // Handle context menu
  const handleContextMenu = useCallback((event, row) => {
    if (!enableContextMenu) return;
    
    event.preventDefault();
    setSelectedRowForMenu(row);
    setAnchorEl(event.currentTarget);
    
    const menuActions = [
      { label: 'Edit', icon: <EditIcon />, action: () => startEdit(row) },
      { label: 'Delete', icon: <DeleteIcon />, action: () => handleDelete(row) },
      { label: 'View Details', icon: <ViewIcon />, action: () => handleViewDetails(row) }
    ];
    
    showContextMenu(event, [row], menuActions);
  }, [enableContextMenu, showContextMenu, startEdit]);

  const handleDelete = useCallback(async (row) => {
    try {
      if (onRowDelete) {
        await onRowDelete(row);
      }
      showNotification('Row deleted successfully', 'success');
    } catch (error) {
      showNotification('Failed to delete row', 'error');
    }
    setAnchorEl(null);
  }, [onRowDelete, showNotification]);

  const handleViewDetails = useCallback((row) => {
    // Implement view details logic
    console.log('View details for:', row);
    setAnchorEl(null);
  }, []);

  // Handle adding new row
  const handleAddRow = useCallback(async () => {
    try {
      if (onRowAdd) {
        await onRowAdd(newRowData);
      }
      setNewRowData({});
      setAddDialogOpen(false);
      showNotification('Row added successfully', 'success');
    } catch (error) {
      showNotification('Failed to add row', 'error');
    }
  }, [newRowData, onRowAdd, showNotification]);

  // Render cell content
  const renderCell = useCallback((row, column) => {
    const isEditing = editingRow === row.id;
    const value = isEditing ? editData[column.key] : row[column.key];

    if (isEditing && column.editable !== false) {
      if (column.type === 'select') {
        return (
          <Select
            value={value || ''}
            onChange={(e) => setEditData(prev => ({ ...prev, [column.key]: e.target.value }))}
            size="small"
            fullWidth
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
            checked={Boolean(value)}
            onChange={(e) => setEditData(prev => ({ ...prev, [column.key]: e.target.checked }))}
          />
        );
      } else {
        return (
          <TextField
            value={value || ''}
            onChange={(e) => setEditData(prev => ({ ...prev, [column.key]: e.target.value }))}
            size="small"
            fullWidth
            type={column.type || 'text'}
          />
        );
      }
    }

    // Render display value
    if (column.render) {
      return column.render(value, row);
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

    if (column.type === 'date') {
      return new Date(value).toLocaleDateString();
    }

    return String(value || '');
  }, [editingRow, editData]);

  // Render filter for column
  const renderColumnFilter = useCallback((column) => {
    if (!enableFiltering || column.filterable === false) return null;

    if (column.type === 'select') {
      return (
        <Select
          value={filters[column.key] || 'all'}
          onChange={(e) => handleFilter(column.key, e.target.value)}
          size="small"
          sx={{ minWidth: 100 }}
        >
          <MenuItem value="all">All</MenuItem>
          {column.options?.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      );
    }

    return (
      <TextField
        value={filters[column.key] || ''}
        onChange={(e) => handleFilter(column.key, e.target.value)}
        size="small"
        placeholder={`Filter ${column.label}`}
        sx={{ minWidth: 120 }}
      />
    );
  }, [enableFiltering, filters, handleFilter]);

  return (
    <Box>
      {/* Header */}
      {(title || subtitle || enableSelection || actions.length > 0) && (
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
            
            {/* Selection actions */}
            {enableSelection && selectedItems.length > 0 && (
              <Box display="flex" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  {selectedItems.length} selected
                </Typography>
                <Button size="small" onClick={clearSelection}>
                  Clear
                </Button>
              </Box>
            )}
            
            {/* Custom actions */}
            {actions.map((action, index) => (
              <Button
                key={index}
                size="small"
                startIcon={action.icon}
                onClick={action.onClick}
                variant={action.variant || 'outlined'}
                color={action.color || 'primary'}
              >
                {action.label}
              </Button>
            ))}
            
            {/* Add button */}
            {onRowAdd && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddDialogOpen(true)}
                variant="contained"
              >
                Add Row
              </Button>
            )}
          </Box>
        </Box>
      )}

      {/* Table */}
      <TableContainer 
        component={Paper} 
        sx={{ 
          maxHeight,
          '& .MuiTableRow-root': {
            height: rowHeight
          }
        }}
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
            <TableHead>
              <TableRow>
                {enableDragDrop && <TableCell width={50} />}
                {enableSelection && (
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
                
                {columns.map((column) => (
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
                    
                    {/* Column filter */}
                    {enableFiltering && (
                      <Box mt={1}>
                        {renderColumnFilter(column)}
                      </Box>
                    )}
                  </TableCell>
                ))}
                
                <TableCell width={100}>Actions</TableCell>
              </TableRow>
            </TableHead>
            
            <Droppable droppableId="table-rows" isDropDisabled={!enableDragDrop}>
              {(provided) => (
                <TableBody ref={provided.innerRef} {...provided.droppableProps}>
                  <AnimatePresence>
                    {processedData.map((row, index) => (
                      <Draggable
                        key={row.id}
                        draggableId={String(row.id)}
                        index={index}
                        isDragDisabled={!enableDragDrop}
                      >
                        {(provided, snapshot) => (
                          <motion.tr
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            initial={animations ? { opacity: 0, y: 20 } : false}
                            animate={animations ? { opacity: 1, y: 0 } : false}
                            exit={animations ? { opacity: 0, y: -20 } : false}
                            transition={{ duration: 0.2 }}
                            style={{
                              ...provided.draggableProps.style,
                              backgroundColor: snapshot.isDragging ? 'rgba(0,0,0,0.05)' : 'transparent'
                            }}
                          >
                            <TableRow
                              hover={hover}
                              selected={selectedItems.includes(row.id)}
                              onContextMenu={(e) => handleContextMenu(e, row)}
                              sx={{
                                backgroundColor: striped && index % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent',
                                '&:hover': {
                                  backgroundColor: hover ? 'rgba(0,0,0,0.04)' : 'transparent'
                                }
                              }}
                            >
                              {enableDragDrop && (
                                <TableCell {...provided.dragHandleProps}>
                                  <DragIcon color="action" />
                                </TableCell>
                              )}
                              
                              {enableSelection && (
                                <TableCell padding="checkbox">
                                  <Checkbox
                                    checked={selectedItems.includes(row.id)}
                                    onChange={() => toggleSelection(row.id)}
                                  />
                                </TableCell>
                              )}
                              
                              {columns.map((column) => (
                                <TableCell key={column.key} align={column.align || 'left'}>
                                  {renderCell(row, column)}
                                </TableCell>
                              ))}
                              
                              <TableCell>
                                <Box display="flex" gap={0.5}>
                                  {editingRow === row.id ? (
                                    <>
                                      <Tooltip title="Save">
                                        <IconButton size="small" onClick={saveEdit} color="primary">
                                          <SaveIcon />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Cancel">
                                        <IconButton size="small" onClick={cancelEdit}>
                                          <CancelIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  ) : (
                                    <>
                                      {enableInlineEdit && (
                                        <Tooltip title="Edit">
                                          <IconButton size="small" onClick={() => startEdit(row)}>
                                            <EditIcon />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                      <Tooltip title="More">
                                        <IconButton
                                          size="small"
                                          onClick={(e) => handleContextMenu(e, row)}
                                        >
                                          <MoreIcon />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          </motion.tr>
                        )}
                      </Draggable>
                    ))}
                  </AnimatePresence>
                  {provided.placeholder}
                </TableBody>
              )}
            </Droppable>
          </Table>
        </DragDropContext>
      </TableContainer>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        TransitionComponent={Fade}
      >
        <MenuItem onClick={() => startEdit(selectedRowForMenu)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDelete(selectedRowForMenu)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleViewDetails(selectedRowForMenu)}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add Row Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
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
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddRow} variant="contained">
            Add Row
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DragDropTable;