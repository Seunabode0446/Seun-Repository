import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Tooltip,
  Zoom,
  Fade
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Fullscreen as FullscreenIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as LineChartIcon,
  ScatterPlot as ScatterIcon
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  RadialLinearScale
} from 'chart.js';
import {
  Line,
  Bar,
  Doughnut,
  Pie,
  Scatter,
  Radar,
  PolarArea
} from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import { useInteractive } from '../../contexts/InteractiveContext';
import { useNotification } from '../../contexts/NotificationContext';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  RadialLinearScale
);

const InteractiveChart = ({
  data,
  type = 'line',
  title,
  subtitle,
  height = 300,
  enableInteraction = true,
  enableExport = true,
  enableFullscreen = true,
  enableSettings = true,
  enableRealtime = false,
  realtimeInterval = 5000,
  onDataUpdate,
  customOptions = {},
  colorScheme = 'default',
  animated = true,
  responsive = true,
  maintainAspectRatio = false
}) => {
  const chartRef = useRef(null);
  const { animations } = useInteractive();
  const { showNotification } = useNotification();

  // State management
  const [chartType, setChartType] = useState(type);
  const [chartData, setChartData] = useState(data);
  const [anchorEl, setAnchorEl] = useState(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Chart settings
  const [settings, setSettings] = useState({
    showLegend: true,
    showGrid: true,
    showTooltips: true,
    tension: 0.4,
    pointRadius: 4,
    borderWidth: 2,
    backgroundColor: 'rgba(75, 192, 192, 0.2)',
    borderColor: 'rgba(75, 192, 192, 1)'
  });

  // Color schemes
  const colorSchemes = {
    default: ['#1976d2', '#dc004e', '#388e3c', '#f57c00', '#7b1fa2'],
    pastel: ['#ffb3ba', '#bae1ff', '#baffc9', '#ffffba', '#ffdfba'],
    vibrant: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
    professional: ['#2c3e50', '#3498db', '#e74c3c', '#f39c12', '#9b59b6'],
    healthcare: ['#27ae60', '#3498db', '#e67e22', '#e74c3c', '#9b59b6']
  };

  // Real-time data updates
  useEffect(() => {
    if (!enableRealtime) return;

    const interval = setInterval(async () => {
      if (onDataUpdate) {
        setIsLoading(true);
        try {
          const newData = await onDataUpdate();
          setChartData(newData);
          setLastUpdate(new Date());
        } catch (error) {
          showNotification('Failed to update chart data', 'error');
        } finally {
          setIsLoading(false);
        }
      }
    }, realtimeInterval);

    return () => clearInterval(interval);
  }, [enableRealtime, realtimeInterval, onDataUpdate, showNotification]);

  // Update chart data when prop changes
  useEffect(() => {
    setChartData(data);
  }, [data]);

  // Chart options
  const getChartOptions = useCallback(() => {
    const baseOptions = {
      responsive,
      maintainAspectRatio,
      animation: animated && animations ? {
        duration: 1000,
        easing: 'easeInOutQuart'
      } : false,
      plugins: {
        legend: {
          display: settings.showLegend,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          enabled: settings.showTooltips,
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true
        },
        title: {
          display: Boolean(title),
          text: title,
          font: {
            size: 16,
            weight: 'bold'
          },
          padding: 20
        }
      },
      scales: chartType !== 'doughnut' && chartType !== 'pie' && chartType !== 'polarArea' ? {
        x: {
          display: true,
          grid: {
            display: settings.showGrid,
            color: 'rgba(0,0,0,0.1)'
          },
          ticks: {
            maxRotation: 45
          }
        },
        y: {
          display: true,
          grid: {
            display: settings.showGrid,
            color: 'rgba(0,0,0,0.1)'
          },
          beginAtZero: true
        }
      } : {},
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      onHover: (event, activeElements) => {
        event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
      },
      onClick: (event, activeElements) => {
        if (activeElements.length > 0 && enableInteraction) {
          const element = activeElements[0];
          const datasetIndex = element.datasetIndex;
          const index = element.index;
          const value = chartData.datasets[datasetIndex].data[index];
          const label = chartData.labels[index];
          
          showNotification(`Clicked: ${label} - ${value}`, 'info');
        }
      }
    };

    return { ...baseOptions, ...customOptions };
  }, [
    responsive,
    maintainAspectRatio,
    animated,
    animations,
    settings,
    title,
    chartType,
    customOptions,
    enableInteraction,
    chartData,
    showNotification
  ]);

  // Apply color scheme to data
  const getStyledData = useCallback(() => {
    if (!chartData) return null;

    const colors = colorSchemes[colorScheme] || colorSchemes.default;
    
    const styledData = {
      ...chartData,
      datasets: chartData.datasets.map((dataset, index) => ({
        ...dataset,
        backgroundColor: dataset.backgroundColor || 
          (chartType === 'line' ? colors[index % colors.length] + '20' : colors[index % colors.length]),
        borderColor: dataset.borderColor || colors[index % colors.length],
        borderWidth: settings.borderWidth,
        tension: chartType === 'line' ? settings.tension : undefined,
        pointRadius: chartType === 'line' ? settings.pointRadius : undefined,
        pointHoverRadius: chartType === 'line' ? settings.pointRadius + 2 : undefined,
        fill: chartType === 'line' ? dataset.fill : undefined
      }))
    };

    return styledData;
  }, [chartData, colorScheme, chartType, settings]);

  // Export chart
  const exportChart = useCallback((format = 'png') => {
    if (!chartRef.current) return;

    const canvas = chartRef.current.canvas;
    const url = canvas.toDataURL(`image/${format}`);
    
    const link = document.createElement('a');
    link.download = `chart-${Date.now()}.${format}`;
    link.href = url;
    link.click();
    
    showNotification(`Chart exported as ${format.toUpperCase()}`, 'success');
  }, [showNotification]);

  // Refresh data
  const refreshData = useCallback(async () => {
    if (onDataUpdate) {
      setIsLoading(true);
      try {
        const newData = await onDataUpdate();
        setChartData(newData);
        setLastUpdate(new Date());
        showNotification('Chart data refreshed', 'success');
      } catch (error) {
        showNotification('Failed to refresh chart data', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  }, [onDataUpdate, showNotification]);

  // Render chart component
  const renderChart = () => {
    const styledData = getStyledData();
    const options = getChartOptions();

    if (!styledData) return null;

    const chartProps = {
      ref: chartRef,
      data: styledData,
      options,
      height
    };

    switch (chartType) {
      case 'bar':
        return <Bar {...chartProps} />;
      case 'doughnut':
        return <Doughnut {...chartProps} />;
      case 'pie':
        return <Pie {...chartProps} />;
      case 'scatter':
        return <Scatter {...chartProps} />;
      case 'radar':
        return <Radar {...chartProps} />;
      case 'polarArea':
        return <PolarArea {...chartProps} />;
      case 'line':
      default:
        return <Line {...chartProps} />;
    }
  };

  const MotionCard = motion(Card);

  return (
    <>
      <MotionCard
        initial={animations ? { opacity: 0, y: 20 } : false}
        animate={animations ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.3 }}
        sx={{ height: '100%', position: 'relative' }}
      >
        <CardContent>
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box>
              <Typography variant="h6" component="h3" gutterBottom>
                {title}
              </Typography>
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
              {enableRealtime && (
                <Box display="flex" alignItems="center" gap={1} mt={1}>
                  <Chip
                    size="small"
                    label="Live"
                    color="success"
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Last update: {lastUpdate.toLocaleTimeString()}
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Box display="flex" gap={0.5}>
              {enableSettings && (
                <Tooltip title="Chart Settings">
                  <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {enableRealtime && (
                <Tooltip title="Refresh Data">
                  <IconButton size="small" onClick={refreshData} disabled={isLoading}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {enableFullscreen && (
                <Tooltip title="Fullscreen">
                  <IconButton size="small" onClick={() => setFullscreenOpen(true)}>
                    <FullscreenIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              <Tooltip title="More Options">
                <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                  <MoreIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Chart */}
          <Box position="relative" height={height}>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Updating chart data...
                  </Typography>
                </motion.div>
              ) : (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {renderChart()}
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </CardContent>
      </MotionCard>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        TransitionComponent={Fade}
      >
        <MenuItem onClick={() => setChartType('line')}>
          <LineChartIcon sx={{ mr: 1 }} />
          Line Chart
        </MenuItem>
        <MenuItem onClick={() => setChartType('bar')}>
          <BarChartIcon sx={{ mr: 1 }} />
          Bar Chart
        </MenuItem>
        <MenuItem onClick={() => setChartType('doughnut')}>
          <PieChartIcon sx={{ mr: 1 }} />
          Doughnut Chart
        </MenuItem>
        <MenuItem onClick={() => setChartType('scatter')}>
          <ScatterIcon sx={{ mr: 1 }} />
          Scatter Plot
        </MenuItem>
        {enableExport && [
          <MenuItem key="export-png" onClick={() => exportChart('png')}>
            <DownloadIcon sx={{ mr: 1 }} />
            Export as PNG
          </MenuItem>,
          <MenuItem key="export-jpg" onClick={() => exportChart('jpeg')}>
            <DownloadIcon sx={{ mr: 1 }} />
            Export as JPG
          </MenuItem>
        ]}
      </Menu>

      {/* Fullscreen Dialog */}
      <Dialog
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        maxWidth="lg"
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{title}</Typography>
            <IconButton onClick={() => setFullscreenOpen(false)}>
              <FullscreenIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box height={600}>
            {renderChart()}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Fade}
      >
        <DialogTitle>Chart Settings</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} pt={1}>
            <FormControl fullWidth>
              <InputLabel>Chart Type</InputLabel>
              <Select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                label="Chart Type"
              >
                <MenuItem value="line">Line Chart</MenuItem>
                <MenuItem value="bar">Bar Chart</MenuItem>
                <MenuItem value="doughnut">Doughnut Chart</MenuItem>
                <MenuItem value="pie">Pie Chart</MenuItem>
                <MenuItem value="scatter">Scatter Plot</MenuItem>
                <MenuItem value="radar">Radar Chart</MenuItem>
                <MenuItem value="polarArea">Polar Area</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Color Scheme</InputLabel>
              <Select
                value={colorScheme}
                onChange={(e) => setSettings(prev => ({ ...prev, colorScheme: e.target.value }))}
                label="Color Scheme"
              >
                <MenuItem value="default">Default</MenuItem>
                <MenuItem value="pastel">Pastel</MenuItem>
                <MenuItem value="vibrant">Vibrant</MenuItem>
                <MenuItem value="professional">Professional</MenuItem>
                <MenuItem value="healthcare">Healthcare</MenuItem>
              </Select>
            </FormControl>

            {chartType === 'line' && (
              <>
                <TextField
                  label="Line Tension"
                  type="number"
                  value={settings.tension}
                  onChange={(e) => setSettings(prev => ({ ...prev, tension: parseFloat(e.target.value) }))}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                  fullWidth
                />
                
                <TextField
                  label="Point Radius"
                  type="number"
                  value={settings.pointRadius}
                  onChange={(e) => setSettings(prev => ({ ...prev, pointRadius: parseInt(e.target.value) }))}
                  inputProps={{ min: 0, max: 10 }}
                  fullWidth
                />
              </>
            )}

            <TextField
              label="Border Width"
              type="number"
              value={settings.borderWidth}
              onChange={(e) => setSettings(prev => ({ ...prev, borderWidth: parseInt(e.target.value) }))}
              inputProps={{ min: 1, max: 10 }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button onClick={() => setSettingsOpen(false)} variant="contained">
            Apply Settings
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InteractiveChart;