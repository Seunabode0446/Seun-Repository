import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';

const InteractiveContext = createContext();

export const useInteractive = () => {
  const context = useContext(InteractiveContext);
  if (!context) {
    throw new Error('useInteractive must be used within an InteractiveProvider');
  }
  return context;
};

export const InteractiveProvider = ({ children }) => {
  const { socket, isConnected } = useSocket();
  
  // Interactive state management
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropZones, setDropZones] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [filterState, setFilterState] = useState({});
  const [sortState, setSortState] = useState({});
  const [viewMode, setViewMode] = useState('grid'); // grid, list, kanban, calendar
  const [animations, setAnimations] = useState(true);
  const [interactiveMode, setInteractiveMode] = useState(true);
  
  // Real-time collaboration state
  const [activeUsers, setActiveUsers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [selections, setSelections] = useState({});
  
  // Interactive features state
  const [quickActions, setQuickActions] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [shortcuts, setShortcuts] = useState({});
  const [customizations, setCustomizations] = useState({});

  // Drag and Drop functionality
  const handleDragStart = useCallback((item, type) => {
    setDraggedItem({ ...item, type });
    
    // Broadcast drag start to other users
    if (socket && isConnected) {
      socket.emit('drag-start', {
        item,
        type,
        userId: socket.id,
        timestamp: Date.now()
      });
    }
  }, [socket, isConnected]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    
    // Broadcast drag end to other users
    if (socket && isConnected) {
      socket.emit('drag-end', {
        userId: socket.id,
        timestamp: Date.now()
      });
    }
  }, [socket, isConnected]);

  const handleDrop = useCallback((targetZone, position) => {
    if (!draggedItem) return;

    const dropData = {
      item: draggedItem,
      targetZone,
      position,
      timestamp: Date.now()
    };

    // Broadcast drop to other users
    if (socket && isConnected) {
      socket.emit('item-dropped', {
        ...dropData,
        userId: socket.id
      });
    }

    setDraggedItem(null);
    return dropData;
  }, [draggedItem, socket, isConnected]);

  // Selection management
  const toggleSelection = useCallback((itemId) => {
    setSelectedItems(prev => {
      const newSelection = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      
      // Broadcast selection change
      if (socket && isConnected) {
        socket.emit('selection-changed', {
          selectedItems: newSelection,
          userId: socket.id,
          timestamp: Date.now()
        });
      }
      
      return newSelection;
    });
  }, [socket, isConnected]);

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
    
    if (socket && isConnected) {
      socket.emit('selection-cleared', {
        userId: socket.id,
        timestamp: Date.now()
      });
    }
  }, [socket, isConnected]);

  const selectAll = useCallback((items) => {
    const allIds = items.map(item => item.id);
    setSelectedItems(allIds);
    
    if (socket && isConnected) {
      socket.emit('select-all', {
        selectedItems: allIds,
        userId: socket.id,
        timestamp: Date.now()
      });
    }
  }, [socket, isConnected]);

  // Filtering and sorting
  const updateFilter = useCallback((key, value) => {
    setFilterState(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState({});
  }, []);

  const updateSort = useCallback((key, direction = 'asc') => {
    setSortState({
      key,
      direction
    });
  }, []);

  // View mode management
  const changeViewMode = useCallback((mode) => {
    setViewMode(mode);
    
    // Save preference
    localStorage.setItem('preferredViewMode', mode);
    
    if (socket && isConnected) {
      socket.emit('view-mode-changed', {
        mode,
        userId: socket.id,
        timestamp: Date.now()
      });
    }
  }, [socket, isConnected]);

  // Quick actions
  const addQuickAction = useCallback((action) => {
    setQuickActions(prev => [...prev, action]);
  }, []);

  const removeQuickAction = useCallback((actionId) => {
    setQuickActions(prev => prev.filter(action => action.id !== actionId));
  }, []);

  const executeQuickAction = useCallback((actionId, data) => {
    const action = quickActions.find(a => a.id === actionId);
    if (action && action.handler) {
      action.handler(data);
    }
  }, [quickActions]);

  // Context menu
  const showContextMenu = useCallback((event, items, actions) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      items,
      actions
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Keyboard shortcuts
  const registerShortcut = useCallback((key, handler) => {
    setShortcuts(prev => ({
      ...prev,
      [key]: handler
    }));
  }, []);

  const unregisterShortcut = useCallback((key) => {
    setShortcuts(prev => {
      const newShortcuts = { ...prev };
      delete newShortcuts[key];
      return newShortcuts;
    });
  }, []);

  // Customizations
  const updateCustomization = useCallback((key, value) => {
    setCustomizations(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Save to localStorage
    localStorage.setItem('userCustomizations', JSON.stringify({
      ...customizations,
      [key]: value
    }));
  }, [customizations]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for real-time collaboration events
    socket.on('user-joined', (userData) => {
      setActiveUsers(prev => [...prev.filter(u => u.id !== userData.id), userData]);
    });

    socket.on('user-left', (userId) => {
      setActiveUsers(prev => prev.filter(u => u.id !== userId));
      setCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    });

    socket.on('cursor-moved', ({ userId, position }) => {
      setCursors(prev => ({
        ...prev,
        [userId]: position
      }));
    });

    socket.on('selection-changed', ({ userId, selectedItems }) => {
      setSelections(prev => ({
        ...prev,
        [userId]: selectedItems
      }));
    });

    socket.on('drag-start', ({ userId, item, type }) => {
      // Show other users' drag operations
      console.log(`User ${userId} started dragging ${type}:`, item);
    });

    socket.on('item-dropped', ({ userId, item, targetZone, position }) => {
      // Handle real-time drop updates
      console.log(`User ${userId} dropped item:`, { item, targetZone, position });
    });

    return () => {
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('cursor-moved');
      socket.off('selection-changed');
      socket.off('drag-start');
      socket.off('item-dropped');
    };
  }, [socket, isConnected]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = `${event.ctrlKey ? 'ctrl+' : ''}${event.shiftKey ? 'shift+' : ''}${event.altKey ? 'alt+' : ''}${event.key.toLowerCase()}`;
      
      if (shortcuts[key]) {
        event.preventDefault();
        shortcuts[key](event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  // Load saved preferences
  useEffect(() => {
    const savedViewMode = localStorage.getItem('preferredViewMode');
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }

    const savedCustomizations = localStorage.getItem('userCustomizations');
    if (savedCustomizations) {
      try {
        setCustomizations(JSON.parse(savedCustomizations));
      } catch (error) {
        console.error('Failed to load customizations:', error);
      }
    }
  }, []);

  // Mouse tracking for collaboration
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleMouseMove = (event) => {
      socket.emit('cursor-move', {
        x: event.clientX,
        y: event.clientY,
        timestamp: Date.now()
      });
    };

    // Throttle mouse events
    let throttleTimer = null;
    const throttledMouseMove = (event) => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        handleMouseMove(event);
        throttleTimer = null;
      }, 50);
    };

    document.addEventListener('mousemove', throttledMouseMove);
    return () => {
      document.removeEventListener('mousemove', throttledMouseMove);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [socket, isConnected]);

  const value = {
    // Drag and Drop
    draggedItem,
    dropZones,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    setDropZones,

    // Selection
    selectedItems,
    toggleSelection,
    clearSelection,
    selectAll,

    // Filtering and Sorting
    filterState,
    sortState,
    updateFilter,
    clearFilters,
    updateSort,

    // View Management
    viewMode,
    changeViewMode,
    animations,
    setAnimations,
    interactiveMode,
    setInteractiveMode,

    // Collaboration
    activeUsers,
    cursors,
    selections,

    // Quick Actions
    quickActions,
    addQuickAction,
    removeQuickAction,
    executeQuickAction,

    // Context Menu
    contextMenu,
    showContextMenu,
    hideContextMenu,

    // Shortcuts
    shortcuts,
    registerShortcut,
    unregisterShortcut,

    // Customizations
    customizations,
    updateCustomization
  };

  return (
    <InteractiveContext.Provider value={value}>
      {children}
    </InteractiveContext.Provider>
  );
};