import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Paper,
  Grid,
  Fab,
  Zoom,
  Fade,
  Slide
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Notifications as NotificationIcon,
  VideoCall as VideoCallIcon,
  LocationOn as LocationIcon,
  AttachFile as AttachFileIcon,
  Repeat as RepeatIcon,
  Today as TodayIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ViewWeek as WeekViewIcon,
  ViewDay as DayViewIcon,
  ViewModule as MonthViewIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useInteractive } from '../../contexts/InteractiveContext';
import { useCollaboration } from '../../contexts/CollaborationContext';
import { useNotification } from '../../contexts/NotificationContext';

const localizer = momentLocalizer(moment);

const InteractiveCalendar = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { animations, selectedItems, toggleSelection } = useInteractive();
  const { activeUsers, joinRoom, leaveRoom } = useCollaboration();
  const { showNotification } = useNotification();

  // Calendar state
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(Views.MONTH);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState(null);

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start: new Date(),
    end: new Date(),
    allDay: false,
    location: '',
    attendees: [],
    category: 'meeting',
    priority: 'medium',
    reminder: '15',
    recurring: false,
    recurringType: 'weekly',
    color: '#1976d2'
  });

  // UI state
  const [anchorEl, setAnchorEl] = useState(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Calendar configuration
  const eventCategories = [
    { value: 'meeting', label: 'Meeting', color: '#1976d2' },
    { value: 'appointment', label: 'Appointment', color: '#388e3c' },
    { value: 'task', label: 'Task', color: '#f57c00' },
    { value: 'reminder', label: 'Reminder', color: '#7b1fa2' },
    { value: 'personal', label: 'Personal', color: '#d32f2f' },
    { value: 'training', label: 'Training', color: '#0288d1' }
  ];

  const priorityLevels = [
    { value: 'low', label: 'Low', color: '#4caf50' },
    { value: 'medium', label: 'Medium', color: '#ff9800' },
    { value: 'high', label: 'High', color: '#f44336' },
    { value: 'urgent', label: 'Urgent', color: '#9c27b0' }
  ];

  // Load calendar events
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/calendar/events', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const formattedEvents = data.map(event => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
          resource: {
            category: event.category,
            priority: event.priority,
            attendees: event.attendees || [],
            location: event.location,
            color: event.color || eventCategories.find(c => c.value === event.category)?.color
          }
        }));
        
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
      showNotification('Failed to load calendar events', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  // Real-time collaboration
  useEffect(() => {
    joinRoom('calendar', 'calendar');
    
    return () => {
      leaveRoom();
    };
  }, [joinRoom, leaveRoom]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('event-created', (eventData) => {
      const newEvent = {
        ...eventData,
        start: new Date(eventData.start),
        end: new Date(eventData.end)
      };
      setEvents(prev => [...prev, newEvent]);
      showNotification(`New event: ${eventData.title}`, 'info');
    });

    socket.on('event-updated', (eventData) => {
      const updatedEvent = {
        ...eventData,
        start: new Date(eventData.start),
        end: new Date(eventData.end)
      };
      setEvents(prev => prev.map(event => 
        event.id === eventData.id ? updatedEvent : event
      ));
      showNotification(`Event updated: ${eventData.title}`, 'info');
    });

    socket.on('event-deleted', (eventId) => {
      setEvents(prev => prev.filter(event => event.id !== eventId));
      showNotification('Event deleted', 'info');
    });

    return () => {
      socket.off('event-created');
      socket.off('event-updated');
      socket.off('event-deleted');
    };
  }, [socket, isConnected, showNotification]);

  // Load events on mount
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Filter events based on search and filters
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.resource?.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (activeFilters.category && activeFilters.category !== 'all') {
      filtered = filtered.filter(event => event.resource?.category === activeFilters.category);
    }

    // Apply priority filter
    if (activeFilters.priority && activeFilters.priority !== 'all') {
      filtered = filtered.filter(event => event.resource?.priority === activeFilters.priority);
    }

    // Apply attendee filter
    if (activeFilters.attendee) {
      filtered = filtered.filter(event =>
        event.resource?.attendees?.some(attendee =>
          attendee.toLowerCase().includes(activeFilters.attendee.toLowerCase())
        )
      );
    }

    return filtered;
  }, [events, searchTerm, activeFilters]);

  // Handle event selection
  const handleSelectEvent = useCallback((event) => {
    setSelectedEvent(event);
    setShowEventDialog(true);
  }, []);

  // Handle slot selection (create new event)
  const handleSelectSlot = useCallback(({ start, end }) => {
    setEventForm(prev => ({
      ...prev,
      start,
      end,
      allDay: moment(end).diff(moment(start), 'hours') >= 24
    }));
    setShowCreateDialog(true);
  }, []);

  // Handle event drag and drop
  const handleEventDrop = useCallback(async ({ event, start, end }) => {
    const updatedEvent = {
      ...event,
      start,
      end
    };

    try {
      const response = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          start: start.toISOString(),
          end: end.toISOString()
        })
      });

      if (response.ok) {
        setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
        showNotification('Event moved successfully', 'success');
        
        // Broadcast update
        if (socket) {
          socket.emit('event-updated', updatedEvent);
        }
      }
    } catch (error) {
      showNotification('Failed to move event', 'error');
    }
  }, [socket, showNotification]);

  // Handle event resize
  const handleEventResize = useCallback(async ({ event, start, end }) => {
    const updatedEvent = {
      ...event,
      start,
      end
    };

    try {
      const response = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          start: start.toISOString(),
          end: end.toISOString()
        })
      });

      if (response.ok) {
        setEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
        showNotification('Event resized successfully', 'success');
        
        // Broadcast update
        if (socket) {
          socket.emit('event-updated', updatedEvent);
        }
      }
    } catch (error) {
      showNotification('Failed to resize event', 'error');
    }
  }, [socket, showNotification]);

  // Create new event
  const handleCreateEvent = useCallback(async () => {
    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...eventForm,
          createdBy: user.id
        })
      });

      if (response.ok) {
        const newEvent = await response.json();
        const formattedEvent = {
          ...newEvent,
          start: new Date(newEvent.start),
          end: new Date(newEvent.end),
          resource: {
            category: newEvent.category,
            priority: newEvent.priority,
            attendees: newEvent.attendees || [],
            location: newEvent.location,
            color: newEvent.color
          }
        };
        
        setEvents(prev => [...prev, formattedEvent]);
        setShowCreateDialog(false);
        setEventForm({
          title: '',
          description: '',
          start: new Date(),
          end: new Date(),
          allDay: false,
          location: '',
          attendees: [],
          category: 'meeting',
          priority: 'medium',
          reminder: '15',
          recurring: false,
          recurringType: 'weekly',
          color: '#1976d2'
        });
        
        showNotification('Event created successfully', 'success');
        
        // Broadcast creation
        if (socket) {
          socket.emit('event-created', formattedEvent);
        }
      }
    } catch (error) {
      showNotification('Failed to create event', 'error');
    }
  }, [eventForm, user, socket, showNotification]);

  // Update event
  const handleUpdateEvent = useCallback(async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(eventForm)
      });

      if (response.ok) {
        const updatedEvent = {
          ...selectedEvent,
          ...eventForm,
          resource: {
            ...selectedEvent.resource,
            category: eventForm.category,
            priority: eventForm.priority,
            location: eventForm.location,
            color: eventForm.color
          }
        };
        
        setEvents(prev => prev.map(e => e.id === selectedEvent.id ? updatedEvent : e));
        setShowEventDialog(false);
        setSelectedEvent(null);
        
        showNotification('Event updated successfully', 'success');
        
        // Broadcast update
        if (socket) {
          socket.emit('event-updated', updatedEvent);
        }
      }
    } catch (error) {
      showNotification('Failed to update event', 'error');
    }
  }, [selectedEvent, eventForm, socket, showNotification]);

  // Delete event
  const handleDeleteEvent = useCallback(async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
        setShowEventDialog(false);
        setSelectedEvent(null);
        
        showNotification('Event deleted successfully', 'success');
        
        // Broadcast deletion
        if (socket) {
          socket.emit('event-deleted', selectedEvent.id);
        }
      }
    } catch (error) {
      showNotification('Failed to delete event', 'error');
    }
  }, [selectedEvent, socket, showNotification]);

  // Custom event component
  const EventComponent = ({ event }) => (
    <Box
      sx={{
        backgroundColor: event.resource?.color || '#1976d2',
        color: 'white',
        padding: '2px 4px',
        borderRadius: 1,
        fontSize: '0.75rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        '&:hover': {
          opacity: 0.8
        }
      }}
    >
      <Box display="flex" alignItems="center" gap={0.5}>
        {event.resource?.priority === 'urgent' && (
          <Badge color="error" variant="dot" />
        )}
        <Typography variant="caption" noWrap>
          {event.title}
        </Typography>
      </Box>
    </Box>
  );

  // Custom toolbar
  const CustomToolbar = ({ label, onNavigate, onView, view }) => (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
      <Box display="flex" alignItems="center" gap={1}>
        <IconButton onClick={() => onNavigate('PREV')}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" component="h2" minWidth={200} textAlign="center">
          {label}
        </Typography>
        <IconButton onClick={() => onNavigate('NEXT')}>
          <ChevronRightIcon />
        </IconButton>
        <Button size="small" onClick={() => onNavigate('TODAY')}>
          Today
        </Button>
      </Box>

      <Box display="flex" gap={1}>
        <TextField
          size="small"
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon color="action" />
          }}
          sx={{ width: 200 }}
        />
        
        <Tooltip title="Filters">
          <IconButton
            onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
            color={Object.keys(activeFilters).length > 0 ? 'primary' : 'default'}
          >
            <Badge badgeContent={Object.keys(activeFilters).length} color="primary">
              <FilterIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        <Button
          variant={view === Views.MONTH ? 'contained' : 'outlined'}
          size="small"
          onClick={() => onView(Views.MONTH)}
          startIcon={<MonthViewIcon />}
        >
          Month
        </Button>
        <Button
          variant={view === Views.WEEK ? 'contained' : 'outlined'}
          size="small"
          onClick={() => onView(Views.WEEK)}
          startIcon={<WeekViewIcon />}
        >
          Week
        </Button>
        <Button
          variant={view === Views.DAY ? 'contained' : 'outlined'}
          size="small"
          onClick={() => onView(Views.DAY)}
          startIcon={<DayViewIcon />}
        >
          Day
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Interactive Calendar
        </Typography>
        
        <Box display="flex" gap={1} alignItems="center">
          {/* Active Users */}
          {activeUsers.length > 0 && (
            <Box display="flex" gap={0.5} mr={2}>
              {activeUsers.slice(0, 3).map(user => (
                <Tooltip key={user.id} title={user.name}>
                  <Avatar sx={{ width: 32, height: 32 }}>
                    {user.name[0]}
                  </Avatar>
                </Tooltip>
              ))}
              {activeUsers.length > 3 && (
                <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem' }}>
                  +{activeUsers.length - 3}
                </Avatar>
              )}
            </Box>
          )}
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateDialog(true)}
          >
            New Event
          </Button>
        </Box>
      </Box>

      {/* Calendar */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Calendar
            localizer={localizer}
            events={filteredEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            selectable
            resizable
            dragFromOutsideItem={draggedEvent}
            views={[Views.MONTH, Views.WEEK, Views.DAY]}
            view={currentView}
            onView={setCurrentView}
            date={currentDate}
            onNavigate={setCurrentDate}
            components={{
              toolbar: CustomToolbar,
              event: EventComponent
            }}
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: event.resource?.color || '#1976d2',
                borderColor: event.resource?.color || '#1976d2',
                color: 'white'
              }
            })}
          />
        </CardContent>
      </Card>

      {/* Floating Action Button */}
      <Zoom in={true}>
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setShowCreateDialog(true)}
        >
          <AddIcon />
        </Fab>
      </Zoom>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        PaperProps={{ sx: { minWidth: 250 } }}
        TransitionComponent={Fade}
      >
        <Box p={2}>
          <Typography variant="subtitle2" gutterBottom>
            Filters
          </Typography>
          
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={activeFilters.category || 'all'}
              onChange={(e) => setActiveFilters(prev => ({ ...prev, category: e.target.value }))}
              label="Category"
            >
              <MenuItem value="all">All Categories</MenuItem>
              {eventCategories.map(category => (
                <MenuItem key={category.value} value={category.value}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box
                      width={12}
                      height={12}
                      borderRadius="50%"
                      bgcolor={category.color}
                    />
                    {category.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={activeFilters.priority || 'all'}
              onChange={(e) => setActiveFilters(prev => ({ ...prev, priority: e.target.value }))}
              label="Priority"
            >
              <MenuItem value="all">All Priorities</MenuItem>
              {priorityLevels.map(priority => (
                <MenuItem key={priority.value} value={priority.value}>
                  <Chip
                    size="small"
                    label={priority.label}
                    sx={{ backgroundColor: priority.color, color: 'white' }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Button
            size="small"
            onClick={() => setActiveFilters({})}
            disabled={Object.keys(activeFilters).length === 0}
          >
            Clear Filters
          </Button>
        </Box>
      </Menu>

      {/* Create Event Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up' }}
      >
        <DialogTitle>Create New Event</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Event Title"
                value={eventForm.title}
                onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={eventForm.description}
                onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Start Date & Time"
                type="datetime-local"
                value={moment(eventForm.start).format('YYYY-MM-DDTHH:mm')}
                onChange={(e) => setEventForm(prev => ({ ...prev, start: new Date(e.target.value) }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="End Date & Time"
                type="datetime-local"
                value={moment(eventForm.end).format('YYYY-MM-DDTHH:mm')}
                onChange={(e) => setEventForm(prev => ({ ...prev, end: new Date(e.target.value) }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={eventForm.category}
                  onChange={(e) => setEventForm(prev => ({ ...prev, category: e.target.value }))}
                  label="Category"
                >
                  {eventCategories.map(category => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={eventForm.priority}
                  onChange={(e) => setEventForm(prev => ({ ...prev, priority: e.target.value }))}
                  label="Priority"
                >
                  {priorityLevels.map(priority => (
                    <MenuItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Location"
                value={eventForm.location}
                onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                InputProps={{
                  startAdornment: <LocationIcon color="action" />
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateEvent} variant="contained">
            Create Event
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event Details Dialog */}
      <Dialog
        open={showEventDialog}
        onClose={() => setShowEventDialog(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Event Details</Typography>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <MoreIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedEvent.title}
              </Typography>
              
              <Box display="flex" gap={2} mb={2}>
                <Chip
                  label={selectedEvent.resource?.category}
                  sx={{ backgroundColor: selectedEvent.resource?.color, color: 'white' }}
                />
                <Chip
                  label={selectedEvent.resource?.priority}
                  color={selectedEvent.resource?.priority === 'urgent' ? 'error' : 'default'}
                />
              </Box>
              
              <Typography variant="body1" paragraph>
                {selectedEvent.description}
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <ScheduleIcon color="action" />
                  <Typography variant="body2">
                    {moment(selectedEvent.start).format('MMMM Do YYYY, h:mm A')} - 
                    {moment(selectedEvent.end).format('h:mm A')}
                  </Typography>
                </Box>
                
                {selectedEvent.resource?.location && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <LocationIcon color="action" />
                    <Typography variant="body2">
                      {selectedEvent.resource.location}
                    </Typography>
                  </Box>
                )}
                
                {selectedEvent.resource?.attendees?.length > 0 && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <GroupIcon color="action" />
                    <Typography variant="body2">
                      {selectedEvent.resource.attendees.join(', ')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEventDialog(false)}>
            Close
          </Button>
          <Button onClick={handleDeleteEvent} color="error">
            Delete
          </Button>
          <Button onClick={handleUpdateEvent} variant="contained">
            Edit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        TransitionComponent={Fade}
      >
        <MenuItem onClick={handleUpdateEvent}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Event</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteEvent}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Event</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon>
            <VideoCallIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Join Video Call</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <NotificationIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Set Reminder</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default InteractiveCalendar;