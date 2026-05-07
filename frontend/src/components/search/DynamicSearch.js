import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  Avatar,
  Badge,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  FormControlLabel,
  Slider,
  DatePicker,
  Autocomplete,
  Fade,
  Zoom,
  Collapse
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Sort as SortIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Tune as TuneIcon,
  History as HistoryIcon,
  Bookmark as BookmarkIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from 'use-debounce';

import { useInteractive } from '../../contexts/InteractiveContext';
import { useNotification } from '../../contexts/NotificationContext';

const DynamicSearch = ({
  data = [],
  searchFields = [],
  filterFields = [],
  sortFields = [],
  onSearch,
  onFilter,
  onSort,
  onResultSelect,
  placeholder = 'Search...',
  enableAdvancedSearch = true,
  enableFilters = true,
  enableSorting = true,
  enableHistory = true,
  enableBookmarks = true,
  enableExport = true,
  maxResults = 50,
  showResultCount = true,
  showSuggestions = true,
  highlightMatches = true,
  caseSensitive = false,
  fuzzySearch = true,
  instantSearch = true,
  searchDelay = 300,
  minSearchLength = 2,
  groupResults = false,
  groupBy = null,
  customResultRenderer = null,
  emptyStateMessage = 'No results found',
  loadingMessage = 'Searching...',
  className,
  style
}) => {
  const { animations, viewMode, changeViewMode } = useInteractive();
  const { showNotification } = useNotification();
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, searchDelay);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [bookmarkedSearches, setBookmarkedSearches] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  
  // Filter state
  const [activeFilters, setActiveFilters] = useState({});
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Sort state
  const [sortBy, setSortBy] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null);
  
  // UI state
  const [showResults, setShowResults] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [resultCount, setResultCount] = useState(0);
  
  // Refs
  const searchInputRef = useRef(null);
  const resultsRef = useRef(null);

  // Perform search
  const performSearch = useCallback(async (term, filters = {}, sort = {}) => {
    if (!term || term.length < minSearchLength) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    try {
      let results = [];

      if (onSearch) {
        // Custom search function
        results = await onSearch(term, filters, sort);
      } else {
        // Default search implementation
        results = data.filter(item => {
          // Text search
          const searchableText = searchFields.length > 0
            ? searchFields.map(field => item[field]).join(' ')
            : Object.values(item).join(' ');

          const matchesSearch = caseSensitive
            ? searchableText.includes(term)
            : searchableText.toLowerCase().includes(term.toLowerCase());

          if (!matchesSearch) return false;

          // Apply filters
          return Object.entries(filters).every(([key, value]) => {
            if (!value || value === 'all') return true;
            
            const itemValue = item[key];
            
            if (Array.isArray(value)) {
              return value.includes(itemValue);
            }
            
            if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
              const numValue = Number(itemValue);
              return numValue >= value.min && numValue <= value.max;
            }
            
            return itemValue === value;
          });
        });

        // Apply sorting
        if (sort.field) {
          results.sort((a, b) => {
            const aVal = a[sort.field];
            const bVal = b[sort.field];
            
            if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
            return 0;
          });
        }

        // Limit results
        results = results.slice(0, maxResults);
      }

      setSearchResults(results);
      setResultCount(results.length);

      // Add to search history
      if (enableHistory && term.trim()) {
        setSearchHistory(prev => {
          const newHistory = [term, ...prev.filter(h => h !== term)].slice(0, 10);
          localStorage.setItem('searchHistory', JSON.stringify(newHistory));
          return newHistory;
        });
      }

    } catch (error) {
      console.error('Search error:', error);
      showNotification('Search failed', 'error');
    } finally {
      setIsSearching(false);
    }
  }, [
    data,
    searchFields,
    minSearchLength,
    onSearch,
    caseSensitive,
    maxResults,
    enableHistory,
    showNotification
  ]);

  // Generate suggestions
  const generateSuggestions = useCallback((term) => {
    if (!showSuggestions || !term || term.length < 2) {
      setSuggestions([]);
      return;
    }

    const termLower = term.toLowerCase();
    const suggestionSet = new Set();

    // Extract suggestions from data
    data.forEach(item => {
      searchFields.forEach(field => {
        const value = item[field];
        if (typeof value === 'string' && value.toLowerCase().includes(termLower)) {
          // Add word suggestions
          const words = value.split(/\s+/);
          words.forEach(word => {
            if (word.toLowerCase().startsWith(termLower)) {
              suggestionSet.add(word);
            }
          });
          
          // Add phrase suggestions
          if (value.toLowerCase().startsWith(termLower)) {
            suggestionSet.add(value);
          }
        }
      });
    });

    // Add from search history
    searchHistory.forEach(historyTerm => {
      if (historyTerm.toLowerCase().includes(termLower)) {
        suggestionSet.add(historyTerm);
      }
    });

    setSuggestions(Array.from(suggestionSet).slice(0, 8));
  }, [data, searchFields, showSuggestions, searchHistory]);

  // Handle search input change
  const handleSearchChange = useCallback((event) => {
    const value = event.target.value;
    setSearchTerm(value);
    
    if (showSuggestions) {
      generateSuggestions(value);
    }
  }, [generateSuggestions, showSuggestions]);

  // Handle search execution
  useEffect(() => {
    if (instantSearch && debouncedSearchTerm) {
      performSearch(debouncedSearchTerm, activeFilters, { field: sortBy, direction: sortDirection });
    }
  }, [debouncedSearchTerm, activeFilters, sortBy, sortDirection, instantSearch, performSearch]);

  // Handle filter change
  const handleFilterChange = useCallback((filterKey, value) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      
      if (value === null || value === '' || value === 'all') {
        delete newFilters[filterKey];
      } else {
        newFilters[filterKey] = value;
      }
      
      return newFilters;
    });
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setActiveFilters({});
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((field, direction = 'asc') => {
    setSortBy(field);
    setSortDirection(direction);
    setSortMenuAnchor(null);
  }, []);

  // Handle result selection
  const handleResultSelect = useCallback((result) => {
    setSelectedResult(result);
    setShowResults(false);
    
    if (onResultSelect) {
      onResultSelect(result);
    }
  }, [onResultSelect]);

  // Bookmark search
  const bookmarkSearch = useCallback(() => {
    if (!searchTerm.trim()) return;
    
    const bookmark = {
      id: Date.now(),
      term: searchTerm,
      filters: activeFilters,
      sort: { field: sortBy, direction: sortDirection },
      timestamp: new Date()
    };
    
    setBookmarkedSearches(prev => {
      const newBookmarks = [bookmark, ...prev].slice(0, 20);
      localStorage.setItem('searchBookmarks', JSON.stringify(newBookmarks));
      return newBookmarks;
    });
    
    showNotification('Search bookmarked', 'success');
  }, [searchTerm, activeFilters, sortBy, sortDirection, showNotification]);

  // Load bookmarked search
  const loadBookmark = useCallback((bookmark) => {
    setSearchTerm(bookmark.term);
    setActiveFilters(bookmark.filters);
    setSortBy(bookmark.sort.field);
    setSortDirection(bookmark.sort.direction);
    performSearch(bookmark.term, bookmark.filters, bookmark.sort);
  }, [performSearch]);

  // Export results
  const exportResults = useCallback(() => {
    const csvContent = searchResults.map(result => 
      searchFields.map(field => result[field]).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `search-results-${Date.now()}.csv`;
    link.click();
    
    showNotification('Results exported', 'success');
  }, [searchResults, searchFields, showNotification]);

  // Load saved data
  useEffect(() => {
    if (enableHistory) {
      const savedHistory = localStorage.getItem('searchHistory');
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    }
    
    if (enableBookmarks) {
      const savedBookmarks = localStorage.getItem('searchBookmarks');
      if (savedBookmarks) {
        setBookmarkedSearches(JSON.parse(savedBookmarks));
      }
    }
  }, [enableHistory, enableBookmarks]);

  // Render filter controls
  const renderFilterControls = () => (
    <Box>
      {filterFields.map(field => (
        <Box key={field.key} mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            {field.label}
          </Typography>
          
          {field.type === 'select' ? (
            <FormControl fullWidth size="small">
              <Select
                value={activeFilters[field.key] || 'all'}
                onChange={(e) => handleFilterChange(field.key, e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {field.options.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : field.type === 'multiselect' ? (
            <Box>
              {field.options.map(option => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={Array.isArray(activeFilters[field.key]) && activeFilters[field.key].includes(option.value)}
                      onChange={(e) => {
                        const currentValues = activeFilters[field.key] || [];
                        const newValues = e.target.checked
                          ? [...currentValues, option.value]
                          : currentValues.filter(v => v !== option.value);
                        handleFilterChange(field.key, newValues.length > 0 ? newValues : null);
                      }}
                    />
                  }
                  label={option.label}
                />
              ))}
            </Box>
          ) : field.type === 'range' ? (
            <Box px={1}>
              <Slider
                value={[
                  activeFilters[field.key]?.min || field.min,
                  activeFilters[field.key]?.max || field.max
                ]}
                onChange={(e, value) => handleFilterChange(field.key, { min: value[0], max: value[1] })}
                min={field.min}
                max={field.max}
                valueLabelDisplay="auto"
                marks={field.marks}
              />
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  );

  // Render search result
  const renderResult = (result, index) => {
    if (customResultRenderer) {
      return customResultRenderer(result, index, searchTerm);
    }

    return (
      <ListItem key={result.id || index} disablePadding>
        <ListItemButton onClick={() => handleResultSelect(result)}>
          {result.avatar && (
            <Avatar src={result.avatar} sx={{ mr: 2 }}>
              {result.name?.[0]}
            </Avatar>
          )}
          <Box flex={1}>
            <Typography variant="body1" fontWeight="bold">
              {highlightMatches ? highlightText(result.title || result.name, searchTerm) : (result.title || result.name)}
            </Typography>
            {result.description && (
              <Typography variant="body2" color="text.secondary">
                {highlightMatches ? highlightText(result.description, searchTerm) : result.description}
              </Typography>
            )}
            {result.tags && (
              <Box mt={0.5}>
                {result.tags.slice(0, 3).map(tag => (
                  <Chip key={tag} size="small" label={tag} sx={{ mr: 0.5 }} />
                ))}
              </Box>
            )}
          </Box>
        </ListItemButton>
      </ListItem>
    );
  };

  // Highlight matching text
  const highlightText = (text, term) => {
    if (!term || !text) return text;
    
    const regex = new RegExp(`(${term})`, caseSensitive ? 'g' : 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: 0 }}>
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <Box className={className} style={style}>
      {/* Search Input */}
      <TextField
        ref={searchInputRef}
        fullWidth
        value={searchTerm}
        onChange={handleSearchChange}
        placeholder={placeholder}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Box display="flex" gap={0.5}>
                {searchTerm && (
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <ClearIcon />
                  </IconButton>
                )}
                
                {enableFilters && (
                  <Tooltip title="Filters">
                    <IconButton
                      size="small"
                      onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
                      color={Object.keys(activeFilters).length > 0 ? 'primary' : 'default'}
                    >
                      <Badge badgeContent={Object.keys(activeFilters).length} color="primary">
                        <FilterIcon />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                )}
                
                {enableSorting && (
                  <Tooltip title="Sort">
                    <IconButton
                      size="small"
                      onClick={(e) => setSortMenuAnchor(e.currentTarget)}
                      color={sortBy ? 'primary' : 'default'}
                    >
                      <SortIcon />
                    </IconButton>
                  </Tooltip>
                )}
                
                {enableAdvancedSearch && (
                  <Tooltip title="Advanced Search">
                    <IconButton
                      size="small"
                      onClick={() => setAdvancedSearchOpen(true)}
                    >
                      <TuneIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </InputAdornment>
          )
        }}
        onFocus={() => {
          if (suggestions.length > 0 || searchResults.length > 0) {
            setShowResults(true);
          }
        }}
      />

      {/* Active Filters */}
      {Object.keys(activeFilters).length > 0 && (
        <Box mt={1} display="flex" gap={0.5} flexWrap="wrap" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Filters:
          </Typography>
          {Object.entries(activeFilters).map(([key, value]) => (
            <Chip
              key={key}
              size="small"
              label={`${key}: ${Array.isArray(value) ? value.join(', ') : value}`}
              onDelete={() => handleFilterChange(key, null)}
              color="primary"
              variant="outlined"
            />
          ))}
          <Button size="small" onClick={clearFilters}>
            Clear All
          </Button>
        </Box>
      )}

      {/* Search Results */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={animations ? { opacity: 0, y: -10 } : false}
            animate={animations ? { opacity: 1, y: 0 } : false}
            exit={animations ? { opacity: 0, y: -10 } : false}
            transition={{ duration: 0.2 }}
          >
            <Paper
              ref={resultsRef}
              sx={{
                mt: 1,
                maxHeight: 400,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              {/* Results Header */}
              <Box p={2} borderBottom="1px solid" borderColor="divider">
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">
                    {isSearching ? loadingMessage : 
                     showResultCount ? `${resultCount} results` : 'Search Results'}
                  </Typography>
                  
                  <Box display="flex" gap={0.5}>
                    {enableBookmarks && searchTerm && (
                      <Tooltip title="Bookmark Search">
                        <IconButton size="small" onClick={bookmarkSearch}>
                          <BookmarkIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    {enableExport && searchResults.length > 0 && (
                      <Tooltip title="Export Results">
                        <IconButton size="small" onClick={exportResults}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="Close">
                      <IconButton size="small" onClick={() => setShowResults(false)}>
                        <CloseIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>

              {/* Suggestions */}
              {suggestions.length > 0 && searchTerm && (
                <Box p={1} borderBottom="1px solid" borderColor="divider">
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Suggestions:
                  </Typography>
                  <Box display="flex" gap={0.5} flexWrap="wrap">
                    {suggestions.map((suggestion, index) => (
                      <Chip
                        key={index}
                        size="small"
                        label={suggestion}
                        onClick={() => {
                          setSearchTerm(suggestion);
                          performSearch(suggestion, activeFilters, { field: sortBy, direction: sortDirection });
                        }}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Results List */}
              <List>
                {searchResults.length > 0 ? (
                  searchResults.map(renderResult)
                ) : !isSearching && searchTerm ? (
                  <ListItem>
                    <Typography variant="body2" color="text.secondary">
                      {emptyStateMessage}
                    </Typography>
                  </ListItem>
                ) : null}
              </List>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        PaperProps={{ sx: { minWidth: 250, maxHeight: 400 } }}
        TransitionComponent={Fade}
      >
        <Box p={2}>
          <Typography variant="subtitle2" gutterBottom>
            Filters
          </Typography>
          {renderFilterControls()}
        </Box>
      </Menu>

      {/* Sort Menu */}
      <Menu
        anchorEl={sortMenuAnchor}
        open={Boolean(sortMenuAnchor)}
        onClose={() => setSortMenuAnchor(null)}
        TransitionComponent={Fade}
      >
        {sortFields.map(field => (
          <div key={field.key}>
            <MenuItem onClick={() => handleSortChange(field.key, 'asc')}>
              <ListItemText primary={`${field.label} (A-Z)`} />
            </MenuItem>
            <MenuItem onClick={() => handleSortChange(field.key, 'desc')}>
              <ListItemText primary={`${field.label} (Z-A)`} />
            </MenuItem>
          </div>
        ))}
      </Menu>

      {/* Advanced Search Dialog */}
      <Dialog
        open={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Zoom}
      >
        <DialogTitle>Advanced Search</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} pt={1}>
            {/* Search History */}
            {enableHistory && searchHistory.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Recent Searches
                </Typography>
                <Box display="flex" gap={0.5} flexWrap="wrap">
                  {searchHistory.map((term, index) => (
                    <Chip
                      key={index}
                      size="small"
                      label={term}
                      onClick={() => {
                        setSearchTerm(term);
                        setAdvancedSearchOpen(false);
                      }}
                      icon={<HistoryIcon />}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Bookmarked Searches */}
            {enableBookmarks && bookmarkedSearches.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Bookmarked Searches
                </Typography>
                <List>
                  {bookmarkedSearches.slice(0, 5).map(bookmark => (
                    <ListItem key={bookmark.id} disablePadding>
                      <ListItemButton onClick={() => {
                        loadBookmark(bookmark);
                        setAdvancedSearchOpen(false);
                      }}>
                        <ListItemIcon>
                          <BookmarkIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={bookmark.term}
                          secondary={new Date(bookmark.timestamp).toLocaleDateString()}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Advanced Filters */}
            {enableFilters && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Advanced Filters
                </Typography>
                {renderFilterControls()}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvancedSearchOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DynamicSearch;