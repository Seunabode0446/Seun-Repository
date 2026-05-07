import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
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
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Card,
  CardContent,
  Zoom,
  Fade
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as CenterIcon,
  AccountTree as WorkflowIcon,
  Assignment as TaskIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationIcon,
  CheckCircle as ApprovalIcon,
  Email as EmailIcon,
  Description as DocumentIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ConnectionLineType,
  Panel,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useInteractive } from '../../contexts/InteractiveContext';
import { useNotification } from '../../contexts/NotificationContext';

// Custom node types
const nodeTypes = {
  start: StartNode,
  task: TaskNode,
  decision: DecisionNode,
  approval: ApprovalNode,
  notification: NotificationNode,
  end: EndNode
};

// Node components
function StartNode({ data, selected }) {
  return (
    <Card sx={{ 
      minWidth: 150, 
      border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
      borderRadius: '50px',
      backgroundColor: '#e8f5e8'
    }}>
      <CardContent sx={{ textAlign: 'center', py: 1 }}>
        <PlayIcon color="success" />
        <Typography variant="body2" fontWeight="bold">
          {data.label || 'Start'}
        </Typography>
      </CardContent>
    </Card>
  );
}

function TaskNode({ data, selected }) {
  return (
    <Card sx={{ 
      minWidth: 180, 
      border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
      backgroundColor: '#f3f4f6'
    }}>
      <CardContent sx={{ py: 1 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <TaskIcon color="primary" />
          <Typography variant="body2" fontWeight="bold">
            {data.label || 'Task'}
          </Typography>
        </Box>
        {data.assignee && (
          <Chip size="small" label={data.assignee} variant="outlined" />
        )}
        {data.duration && (
          <Typography variant="caption" color="text.secondary" display="block">
            Duration: {data.duration}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function DecisionNode({ data, selected }) {
  return (
    <Card sx={{ 
      minWidth: 160, 
      border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
      transform: 'rotate(45deg)',
      backgroundColor: '#fff3cd'
    }}>
      <CardContent sx={{ textAlign: 'center', py: 1, transform: 'rotate(-45deg)' }}>
        <Typography variant="body2" fontWeight="bold">
          {data.label || 'Decision'}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ApprovalNode({ data, selected }) {
  return (
    <Card sx={{ 
      minWidth: 170, 
      border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
      backgroundColor: '#e3f2fd'
    }}>
      <CardContent sx={{ py: 1 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <ApprovalIcon color="info" />
          <Typography variant="body2" fontWeight="bold">
            {data.label || 'Approval'}
          </Typography>
        </Box>
        {data.approver && (
          <Chip size="small" label={data.approver} color="info" variant="outlined" />
        )}
      </CardContent>
    </Card>
  );
}

function NotificationNode({ data, selected }) {
  return (
    <Card sx={{ 
      minWidth: 160, 
      border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
      backgroundColor: '#fce4ec'
    }}>
      <CardContent sx={{ py: 1 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <NotificationIcon color="secondary" />
          <Typography variant="body2" fontWeight="bold">
            {data.label || 'Notification'}
          </Typography>
        </Box>
        {data.recipients && (
          <Typography variant="caption" color="text.secondary">
            To: {data.recipients}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function EndNode({ data, selected }) {
  return (
    <Card sx={{ 
      minWidth: 150, 
      border: selected ? '2px solid #1976d2' : '1px solid #e0e0e0',
      borderRadius: '50px',
      backgroundColor: '#ffebee'
    }}>
      <CardContent sx={{ textAlign: 'center', py: 1 }}>
        <StopIcon color="error" />
        <Typography variant="body2" fontWeight="bold">
          {data.label || 'End'}
        </Typography>
      </CardContent>
    </Card>
  );
}

const WorkflowCanvas = ({
  workflow,
  onWorkflowChange,
  readOnly = false,
  showMiniMap = true,
  showControls = true,
  showBackground = true
}) => {
  const { animations } = useInteractive();
  const { showNotification } = useNotification();
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow?.edges || []);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // UI state
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [nodeMenuAnchor, setNodeMenuAnchor] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStep, setExecutionStep] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Node creation state
  const [newNodeType, setNewNodeType] = useState('task');
  const [newNodeData, setNewNodeData] = useState({
    label: '',
    assignee: '',
    duration: '',
    description: ''
  });

  // Workflow execution state
  const [executionHistory, setExecutionHistory] = useState([]);
  const [currentExecution, setCurrentExecution] = useState(null);

  // Node palette
  const nodePalette = [
    { type: 'start', label: 'Start', icon: <PlayIcon />, color: '#4caf50' },
    { type: 'task', label: 'Task', icon: <TaskIcon />, color: '#2196f3' },
    { type: 'decision', label: 'Decision', icon: <WorkflowIcon />, color: '#ff9800' },
    { type: 'approval', label: 'Approval', icon: <ApprovalIcon />, color: '#9c27b0' },
    { type: 'notification', label: 'Notification', icon: <NotificationIcon />, color: '#e91e63' },
    { type: 'end', label: 'End', icon: <StopIcon />, color: '#f44336' }
  ];

  // Handle connection
  const onConnect = useCallback((params) => {
    if (readOnly) return;
    
    const newEdge = {
      ...params,
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: '#1976d2'
      },
      style: {
        strokeWidth: 2,
        stroke: '#1976d2'
      }
    };
    
    setEdges((eds) => addEdge(newEdge, eds));
    showNotification('Connection created', 'success');
  }, [readOnly, setEdges, showNotification]);

  // Handle node selection
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Handle node context menu
  const onNodeContextMenu = useCallback((event, node) => {
    if (readOnly) return;
    
    event.preventDefault();
    setSelectedNode(node);
    setNodeMenuAnchor({ x: event.clientX, y: event.clientY });
  }, [readOnly]);

  // Add new node
  const addNode = useCallback((type, position) => {
    if (readOnly) return;
    
    const newNode = {
      id: `node-${Date.now()}`,
      type,
      position: position || { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: `New ${type}`,
        ...newNodeData
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    setNewNodeData({ label: '', assignee: '', duration: '', description: '' });
    showNotification(`${type} node added`, 'success');
  }, [readOnly, setNodes, newNodeData, showNotification]);

  // Edit node
  const editNode = useCallback(() => {
    if (!selectedNode) return;
    
    setNewNodeData(selectedNode.data);
    setNodeDialogOpen(true);
    setNodeMenuAnchor(null);
  }, [selectedNode]);

  // Delete node
  const deleteNode = useCallback(() => {
    if (!selectedNode || readOnly) return;
    
    setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
    setEdges((eds) => eds.filter((edge) => 
      edge.source !== selectedNode.id && edge.target !== selectedNode.id
    ));
    
    setSelectedNode(null);
    setNodeMenuAnchor(null);
    showNotification('Node deleted', 'success');
  }, [selectedNode, readOnly, setNodes, setEdges, showNotification]);

  // Save node changes
  const saveNodeChanges = useCallback(() => {
    if (!selectedNode) return;
    
    setNodes((nds) => 
      nds.map((node) => 
        node.id === selectedNode.id 
          ? { ...node, data: { ...node.data, ...newNodeData } }
          : node
      )
    );
    
    setNodeDialogOpen(false);
    setSelectedNode(null);
    showNotification('Node updated', 'success');
  }, [selectedNode, newNodeData, setNodes, showNotification]);

  // Execute workflow
  const executeWorkflow = useCallback(async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    setExecutionStep(0);
    
    const execution = {
      id: `exec-${Date.now()}`,
      startTime: new Date(),
      status: 'running',
      steps: []
    };
    
    setCurrentExecution(execution);
    
    // Simulate workflow execution
    for (let i = 0; i < nodes.length; i++) {
      setExecutionStep(i);
      
      // Highlight current node
      setNodes((nds) => 
        nds.map((node, index) => ({
          ...node,
          style: {
            ...node.style,
            border: index === i ? '3px solid #4caf50' : undefined,
            boxShadow: index === i ? '0 0 10px rgba(76, 175, 80, 0.5)' : undefined
          }
        }))
      );
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      execution.steps.push({
        nodeId: nodes[i].id,
        timestamp: new Date(),
        status: 'completed'
      });
    }
    
    // Reset node styles
    setNodes((nds) => 
      nds.map((node) => ({
        ...node,
        style: {
          ...node.style,
          border: undefined,
          boxShadow: undefined
        }
      }))
    );
    
    execution.endTime = new Date();
    execution.status = 'completed';
    
    setExecutionHistory(prev => [...prev, execution]);
    setCurrentExecution(null);
    setIsExecuting(false);
    setExecutionStep(0);
    
    showNotification('Workflow execution completed', 'success');
  }, [isExecuting, nodes, setNodes, showNotification]);

  // Stop execution
  const stopExecution = useCallback(() => {
    if (currentExecution) {
      currentExecution.status = 'stopped';
      currentExecution.endTime = new Date();
      setExecutionHistory(prev => [...prev, currentExecution]);
    }
    
    setIsExecuting(false);
    setCurrentExecution(null);
    setExecutionStep(0);
    
    // Reset node styles
    setNodes((nds) => 
      nds.map((node) => ({
        ...node,
        style: {
          ...node.style,
          border: undefined,
          boxShadow: undefined
        }
      }))
    );
    
    showNotification('Workflow execution stopped', 'warning');
  }, [currentExecution, setNodes, showNotification]);

  // Save workflow
  const saveWorkflow = useCallback(() => {
    if (onWorkflowChange) {
      onWorkflowChange({
        nodes,
        edges,
        lastModified: new Date()
      });
    }
    showNotification('Workflow saved', 'success');
  }, [nodes, edges, onWorkflowChange, showNotification]);

  // Center view
  const centerView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  }, [reactFlowInstance]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn();
    }
  }, [reactFlowInstance]);

  const zoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut();
    }
  }, [reactFlowInstance]);

  // Update workflow when props change
  useEffect(() => {
    if (workflow) {
      setNodes(workflow.nodes || []);
      setEdges(workflow.edges || []);
    }
  }, [workflow, setNodes, setEdges]);

  return (
    <Box sx={{ height: '100%', position: 'relative' }}>
      {/* Node Palette */}
      {!readOnly && (
        <Paper
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1000,
            p: 2,
            minWidth: 200
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Node Palette
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            {nodePalette.map((nodeType) => (
              <Button
                key={nodeType.type}
                variant="outlined"
                size="small"
                startIcon={nodeType.icon}
                onClick={() => addNode(nodeType.type)}
                sx={{ justifyContent: 'flex-start' }}
              >
                {nodeType.label}
              </Button>
            ))}
          </Box>
        </Paper>
      )}

      {/* Workflow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        attributionPosition="bottom-left"
      >
        {showBackground && <Background />}
        {showMiniMap && <MiniMap />}
        {showControls && <Controls />}
        
        {/* Custom Panel */}
        <Panel position="top-right">
          <Box display="flex" gap={1}>
            {!readOnly && (
              <>
                <Tooltip title="Save Workflow">
                  <IconButton onClick={saveWorkflow} color="primary">
                    <SaveIcon />
                  </IconButton>
                </Tooltip>
                
                {!isExecuting ? (
                  <Tooltip title="Execute Workflow">
                    <IconButton onClick={executeWorkflow} color="success">
                      <PlayIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="Stop Execution">
                    <IconButton onClick={stopExecution} color="error">
                      <StopIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
            
            <Tooltip title="Center View">
              <IconButton onClick={centerView}>
                <CenterIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Zoom In">
              <IconButton onClick={zoomIn}>
                <ZoomInIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Zoom Out">
              <IconButton onClick={zoomOut}>
                <ZoomOutIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Panel>

        {/* Execution Status */}
        {isExecuting && (
          <Panel position="bottom-center">
            <Paper sx={{ p: 2 }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2">
                  Executing workflow... Step {executionStep + 1} of {nodes.length}
                </Typography>
                <Button size="small" onClick={stopExecution} color="error">
                  Stop
                </Button>
              </Box>
            </Paper>
          </Panel>
        )}
      </ReactFlow>

      {/* Node Context Menu */}
      <Menu
        open={Boolean(nodeMenuAnchor)}
        onClose={() => setNodeMenuAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={nodeMenuAnchor}
        TransitionComponent={Fade}
      >
        <MenuItem onClick={editNode}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Node</ListItemText>
        </MenuItem>
        <MenuItem onClick={deleteNode}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Node</ListItemText>
        </MenuItem>
      </Menu>

      {/* Node Edit Dialog */}
      <Dialog
        open={nodeDialogOpen}
        onClose={() => setNodeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>Edit Node</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label="Label"
              value={newNodeData.label}
              onChange={(e) => setNewNodeData(prev => ({ ...prev, label: e.target.value }))}
              fullWidth
            />
            
            <TextField
              label="Description"
              value={newNodeData.description}
              onChange={(e) => setNewNodeData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
            />
            
            {selectedNode?.type === 'task' && (
              <>
                <TextField
                  label="Assignee"
                  value={newNodeData.assignee}
                  onChange={(e) => setNewNodeData(prev => ({ ...prev, assignee: e.target.value }))}
                  fullWidth
                />
                
                <TextField
                  label="Duration"
                  value={newNodeData.duration}
                  onChange={(e) => setNewNodeData(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="e.g., 2 hours, 1 day"
                  fullWidth
                />
              </>
            )}
            
            {selectedNode?.type === 'approval' && (
              <TextField
                label="Approver"
                value={newNodeData.approver}
                onChange={(e) => setNewNodeData(prev => ({ ...prev, approver: e.target.value }))}
                fullWidth
              />
            )}
            
            {selectedNode?.type === 'notification' && (
              <TextField
                label="Recipients"
                value={newNodeData.recipients}
                onChange={(e) => setNewNodeData(prev => ({ ...prev, recipients: e.target.value }))}
                placeholder="email1@example.com, email2@example.com"
                fullWidth
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNodeDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveNodeChanges} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkflowCanvas;