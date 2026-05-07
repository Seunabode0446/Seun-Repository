import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Avatar,
  Badge,
  Tooltip,
  LinearProgress,
  CircularProgress,
  Zoom,
  Slide,
  Fade
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  Description as DescriptionIcon,
  Notifications as NotificationsIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  DragIndicator as DragIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';

import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useInteractive } from '../../contexts/InteractiveContext';
import { useNotification } from '../../contexts/NotificationContext';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  ArcElement,
  BarElement
);

const InteractiveStaffDashboard = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { 
    selectedItems, 
    toggleSelection, 
    viewMode, 
    changeViewMode,
    draggedItem,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    quickActions,
    addQuickAction,
    executeQuickAction,
    showContextMenu,
    animations
  } = useInteractive();
  const { showNotification } = useNotification();

  // Dashboard state
  const [dashboardData, setDashboardData] = useState({
    todaysTasks: [],
    recentNotes: [],
    upcomingDeadlines: [],
    quickStats: {},
    notifications: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [widgets, setWidgets] = useState([
    { id: 'tasks', title: 'Today\'s Tasks', type: 'task-list', position: 0 },
    { id: 'notes', title: 'Recent Notes', type: 'note-list', position: 1 },
    { id: 'stats', title: 'Quick Stats', type: 'stats-cards', position: 2 },
    { id: 'chart', title: 'Weekly Progress', type: 'chart', position: 3 },
    { id: 'deadlines', title: 'Upcoming Deadlines', type: 'deadline-list', position: 4 },
    { id: 'notifications', title: 'Notifications', type: 'notification-list', position: 5 }
  ]);

  // Dialog states
  const [quickNoteDialog, setQuickNoteDialog] = useState(false);
  const [quickTaskDialog, setQuickTaskDialog] = useState(false);
  const [quickNote, setQuickNote] = useState('');
  const [quickTask, setQuickTask] = useState({ title: '', client: '', priority: 'medium' });

  // Interactive features
  const [editMode, setEditMode] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      
      // Simulate API calls with real-time data
      const response = await fetch('/api/dashboard/staff', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
        
        // Show notification for new items
        if (data.notifications?.length > 0) {
          showNotification(`You have ${data.notifications.length} new notifications`, 'info');
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showNotification('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showNotification]);

  // Real-time updates
  useEffect(() => {
    loadDashboardData();

    if (socket && isConnected) {
      socket.on('dashboard-update', (update) => {
        setDashboardData(prev => ({
          ...prev,
          ...update
        }));
        showNotification('Dashboard updated', 'info');
      });

      socket.on('new-task-assigned', (task) => {
        setDashboardData(prev => ({
          ...prev,
          todaysTasks: [task, ...prev.todaysTasks]
        }));
        showNotification(`New task assigned: ${task.title}`, 'info');
      });

      socket.on('urgent-notification', (notification) => {
        showNotification(notification.message, 'warning');
      });

      return () => {
        socket.off('dashboard-update');
        socket.off('new-task-assigned');
        socket.off('urgent-notification');
      };
    }
  }, [socket, isConnected, loadDashboardData, showNotification]);

  // Quick actions setup
  useEffect(() => {
    const actions = [
      {
        id: 'quick-note',
        label: 'Quick Note',
        icon: <AssignmentIcon />,
        handler: () => setQuickNoteDialog(true)
      },
      {
        id: 'new-task',
        label: 'New Task',
        icon: <AddIcon />,
        handler: () => setQuickTaskDialog(true)
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: <RefreshIcon />,
        handler: loadDashboardData
      }
    ];

    actions.forEach(addQuickAction);
  }, [addQuickAction, loadDashboardData]);

  // Handle widget reordering
  const handleDragEndWidget = (result) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update positions
    const updatedWidgets = items.map((item, index) => ({
      ...item,
      position: index
    }));

    setWidgets(updatedWidgets);
    
    // Save layout preference
    localStorage.setItem('staffDashboardLayout', JSON.stringify(updatedWidgets));
    showNotification('Dashboard layout updated', 'success');
  };

  // Quick note submission
  const handleQuickNoteSubmit = async () => {
    if (!quickNote.trim()) return;

    try {
      const response = await fetch('/api/notes/quick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: quickNote,
          type: 'quick-note'
        })
      });

      if (response.ok) {
        setQuickNote('');
        setQuickNoteDialog(false);
        showNotification('Quick note saved successfully', 'success');
        loadDashboardData();
      }
    } catch (error) {
      showNotification('Failed to save quick note', 'error');
    }
  };

  // Quick task submission
  const handleQuickTaskSubmit = async () => {
    if (!quickTask.title.trim()) return;

    try {
      const response = await fetch('/api/tasks/quick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(quickTask)
      });

      if (response.ok) {
        setQuickTask({ title: '', client: '', priority: 'medium' });
        setQuickTaskDialog(false);
        showNotification('Quick task created successfully', 'success');
        loadDashboardData();
      }
    } catch (error) {
      showNotification('Failed to create quick task', 'error');
    }
  };

  // Chart data
  const weeklyProgressData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Tasks Completed',
        data: [12, 19, 3, 5, 2, 3, 9],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4
      },
      {
        label: 'Notes Written',
        data: [8, 15, 12, 18, 10, 7, 14],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.4
      }
    ]
  };

  const taskStatusData = {
    labels: ['Completed', 'In Progress', 'Pending', 'Overdue'],
    datasets: [
      {
        data: [45, 25, 20, 10],
        backgroundColor: [
          '#4CAF50',
          '#2196F3',
          '#FF9800',
          '#F44336'
        ],
        borderWidth: 0
      }
    ]
  };

  // Widget components
  const renderWidget = (widget) => {
    const MotionCard = motion(Card);
    
    return (
      <MotionCard
        key={widget.id}
        initial={animations ? { opacity: 0, y: 20 } : false}
        animate={animations ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.3, delay: widget.position * 0.1 }}
        sx={{
          height: '100%',
          cursor: editMode ? 'grab' : 'default',
          '&:hover': editMode ? { transform: 'scale(1.02)' } : {},
          transition: 'transform 0.2s ease-in-out'
        }}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" component="h2">
              {widget.title}
            </Typography>
            {editMode && <DragIcon color="action" />}
          </Box>
          
          {widget.type === 'task-list' && (
            <Box>
              {dashboardData.todaysTasks?.slice(0, 5).map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={animations ? { opacity: 0, x: -20 } : false}
                  animate={animations ? { opacity: 1, x: 0 } : false}
                  transition={{ delay: index * 0.1 }}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    py={1}
                    borderBottom="1px solid #eee"
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        size="small"
                        label={task.priority}
                        color={task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'default'}
                      />
                      <Typography variant="body2">{task.title}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleSelection(task.id)}>
                      <CheckCircleIcon 
                        color={selectedItems.includes(task.id) ? 'success' : 'action'} 
                      />
                    </IconButton>
                  </Box>
                </motion.div>
              ))}
            </Box>
          )}

          {widget.type === 'note-list' && (
            <Box>
              {dashboardData.recentNotes?.slice(0, 3).map((note, index) => (
                <motion.div
                  key={note.id}
                  initial={animations ? { opacity: 0, x: -20 } : false}
                  animate={animations ? { opacity: 1, x: 0 } : false}
                  transition={{ delay: index * 0.1 }}
                >
                  <Box py={1} borderBottom="1px solid #eee">
                    <Typography variant="body2" fontWeight="bold">
                      {note.clientName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {note.content.substring(0, 100)}...
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>
          )}

          {widget.type === 'stats-cards' && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {dashboardData.quickStats?.completedTasks || 0}
                  </Typography>
                  <Typography variant="caption">Completed Today</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box textAlign="center">
                  <Typography variant="h4" color="secondary">
                    {dashboardData.quickStats?.pendingTasks || 0}
                  </Typography>
                  <Typography variant="caption">Pending</Typography>
                </Box>
              </Grid>
            </Grid>
          )}

          {widget.type === 'chart' && (
            <Box height={200}>
              <Line 
                data={weeklyProgressData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </Box>
          )}

          {widget.type === 'deadline-list' && (
            <Box>
              {dashboardData.upcomingDeadlines?.slice(0, 4).map((deadline, index) => (
                <motion.div
                  key={deadline.id}
                  initial={animations ? { opacity: 0, x: -20 } : false}
                  animate={animations ? { opacity: 1, x: 0 } : false}
                  transition={{ delay: index * 0.1 }}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    py={1}
                    borderBottom="1px solid #eee"
                  >
                    <Typography variant="body2">{deadline.title}</Typography>
                    <Chip
                      size="small"
                      label={deadline.daysLeft + ' days'}
                      color={deadline.daysLeft <= 3 ? 'error' : deadline.daysLeft <= 7 ? 'warning' : 'default'}
                    />
                  </Box>
                </motion.div>
              ))}
            </Box>
          )}

          {widget.type === 'notification-list' && (
            <Box>
              {dashboardData.notifications?.slice(0, 4).map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={animations ? { opacity: 0, x: -20 } : false}
                  animate={animations ? { opacity: 1, x: 0 } : false}
                  transition={{ delay: index * 0.1 }}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={1}
                    py={1}
                    borderBottom="1px solid #eee"
                  >
                    <Badge
                      variant="dot"
                      color={notification.priority === 'high' ? 'error' : 'primary'}
                    >
                      <NotificationsIcon fontSize="small" />
                    </Badge>
                    <Typography variant="body2" flex={1}>
                      {notification.message}
                    </Typography>
                  </Box>
                </motion.div>
              ))}
            </Box>
          )}
        </CardContent>
      </MotionCard>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Welcome back, {user?.firstName}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's what's happening with your work today.
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Tooltip title="Toggle Edit Mode">
            <IconButton
              onClick={() => setEditMode(!editMode)}
              color={editMode ? 'primary' : 'default'}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Change View">
            <IconButton onClick={() => changeViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? <ViewListIcon /> : <ViewModuleIcon />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Refresh">
            <IconButton onClick={loadDashboardData} disabled={refreshing}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Progress indicator */}
      {refreshing && <LinearProgress sx={{ mb: 2 }} />}

      {/* Dashboard Widgets */}
      <DragDropContext onDragEnd={handleDragEndWidget}>
        <Droppable droppableId="dashboard-widgets" isDropDisabled={!editMode}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              <Grid container spacing={3}>
                {widgets
                  .sort((a, b) => a.position - b.position)
                  .map((widget, index) => (
                    <Draggable
                      key={widget.id}
                      draggableId={widget.id}
                      index={index}
                      isDragDisabled={!editMode}
                    >
                      {(provided, snapshot) => (
                        <Grid
                          item
                          xs={12}
                          md={6}
                          lg={4}
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                            transform: snapshot.isDragging
                              ? provided.draggableProps.style?.transform
                              : 'none'
                          }}
                        >
                          {renderWidget(widget)}
                        </Grid>
                      )}
                    </Draggable>
                  ))}
              </Grid>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Floating Action Buttons */}
      <Box position="fixed" bottom={24} right={24}>
        <Zoom in={true}>
          <Fab
            color="primary"
            onClick={() => setQuickNoteDialog(true)}
            sx={{ mr: 1 }}
          >
            <AssignmentIcon />
          </Fab>
        </Zoom>
        <Zoom in={true} style={{ transitionDelay: '100ms' }}>
          <Fab
            color="secondary"
            onClick={() => setQuickTaskDialog(true)}
          >
            <AddIcon />
          </Fab>
        </Zoom>
      </Box>

      {/* Quick Note Dialog */}
      <Dialog
        open={quickNoteDialog}
        onClose={() => setQuickNoteDialog(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' }}
      >
        <DialogTitle>Quick Note</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            variant="outlined"
            placeholder="Write a quick note..."
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickNoteDialog(false)}>Cancel</Button>
          <Button onClick={handleQuickNoteSubmit} variant="contained">
            Save Note
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Task Dialog */}
      <Dialog
        open={quickTaskDialog}
        onClose={() => setQuickTaskDialog(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' }}
      >
        <DialogTitle>Quick Task</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Task Title"
            variant="outlined"
            value={quickTask.title}
            onChange={(e) => setQuickTask(prev => ({ ...prev, title: e.target.value }))}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Client"
            variant="outlined"
            value={quickTask.client}
            onChange={(e) => setQuickTask(prev => ({ ...prev, client: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            fullWidth
            label="Priority"
            variant="outlined"
            value={quickTask.priority}
            onChange={(e) => setQuickTask(prev => ({ ...prev, priority: e.target.value }))}
            SelectProps={{ native: true }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickTaskDialog(false)}>Cancel</Button>
          <Button onClick={handleQuickTaskSubmit} variant="contained">
            Create Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InteractiveStaffDashboard;