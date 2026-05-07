import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  Button,
  IconButton,
  Chip,
  Autocomplete,
  DatePicker,
  TimePicker,
  Switch,
  Slider,
  Rating,
  Alert,
  Collapse,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  Tooltip,
  Zoom,
  Fade
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  AttachFile as AttachIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { LocalizationProvider, DatePicker as MuiDatePicker, TimePicker as MuiTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { useInteractive } from '../../contexts/InteractiveContext';
import { useNotification } from '../../contexts/NotificationContext';

const SmartForm = ({
  schema,
  initialValues = {},
  onSubmit,
  onValidate,
  enableAutoSave = true,
  autoSaveInterval = 5000,
  enableSteps = false,
  enableProgress = true,
  enableValidation = true,
  enableConditionalFields = true,
  enableFieldDependencies = true,
  enableSmartSuggestions = true,
  readOnly = false,
  title,
  subtitle,
  submitLabel = 'Submit',
  resetLabel = 'Reset',
  showResetButton = true,
  showProgress = true,
  animated = true
}) => {
  const { animations } = useInteractive();
  const { showNotification } = useNotification();

  // Form state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldWarnings, setFieldWarnings] = useState({});
  const [fieldSuggestions, setFieldSuggestions] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState(null);
  const [formProgress, setFormProgress] = useState(0);
  const [visibleFields, setVisibleFields] = useState(new Set());
  const [fieldDependencies, setFieldDependencies] = useState({});

  // Generate validation schema
  const validationSchema = useMemo(() => {
    if (!enableValidation || !schema?.fields) return null;

    const schemaObject = {};
    
    schema.fields.forEach(field => {
      let validator = Yup.string();
      
      if (field.required) {
        validator = validator.required(`${field.label} is required`);
      }
      
      if (field.type === 'email') {
        validator = validator.email('Invalid email format');
      }
      
      if (field.type === 'number') {
        validator = Yup.number();
        if (field.min !== undefined) validator = validator.min(field.min);
        if (field.max !== undefined) validator = validator.max(field.max);
      }
      
      if (field.minLength) {
        validator = validator.min(field.minLength, `Minimum ${field.minLength} characters`);
      }
      
      if (field.maxLength) {
        validator = validator.max(field.maxLength, `Maximum ${field.maxLength} characters`);
      }
      
      if (field.pattern) {
        validator = validator.matches(new RegExp(field.pattern), field.patternMessage || 'Invalid format');
      }
      
      schemaObject[field.name] = validator;
    });
    
    return Yup.object().shape(schemaObject);
  }, [schema, enableValidation]);

  // Initialize formik
  const formik = useFormik({
    initialValues: {
      ...schema?.fields?.reduce((acc, field) => {
        acc[field.name] = initialValues[field.name] || field.defaultValue || '';
        return acc;
      }, {}),
      ...initialValues
    },
    validationSchema,
    onSubmit: async (values) => {
      setIsSubmitting(true);
      try {
        await onSubmit?.(values);
        showNotification('Form submitted successfully', 'success');
      } catch (error) {
        showNotification('Failed to submit form', 'error');
      } finally {
        setIsSubmitting(false);
      }
    },
    validate: (values) => {
      if (onValidate) {
        return onValidate(values);
      }
    }
  });

  // Calculate form progress
  useEffect(() => {
    if (!schema?.fields) return;

    const totalFields = schema.fields.length;
    const filledFields = schema.fields.filter(field => {
      const value = formik.values[field.name];
      return value !== '' && value !== null && value !== undefined;
    }).length;

    setFormProgress((filledFields / totalFields) * 100);
  }, [formik.values, schema]);

  // Handle conditional field visibility
  useEffect(() => {
    if (!enableConditionalFields || !schema?.fields) return;

    const newVisibleFields = new Set();
    
    schema.fields.forEach(field => {
      let isVisible = true;
      
      if (field.condition) {
        const { dependsOn, value, operator = 'equals' } = field.condition;
        const dependentValue = formik.values[dependsOn];
        
        switch (operator) {
          case 'equals':
            isVisible = dependentValue === value;
            break;
          case 'not_equals':
            isVisible = dependentValue !== value;
            break;
          case 'contains':
            isVisible = Array.isArray(dependentValue) && dependentValue.includes(value);
            break;
          case 'greater_than':
            isVisible = Number(dependentValue) > Number(value);
            break;
          case 'less_than':
            isVisible = Number(dependentValue) < Number(value);
            break;
          case 'not_empty':
            isVisible = dependentValue && dependentValue !== '';
            break;
          default:
            isVisible = true;
        }
      }
      
      if (isVisible) {
        newVisibleFields.add(field.name);
      }
    });
    
    setVisibleFields(newVisibleFields);
  }, [formik.values, schema, enableConditionalFields]);

  // Auto-save functionality
  useEffect(() => {
    if (!enableAutoSave) return;

    const autoSaveTimer = setTimeout(() => {
      if (formik.dirty && !formik.isSubmitting) {
        // Simulate auto-save
        setLastAutoSave(new Date());
        showNotification('Form auto-saved', 'info');
      }
    }, autoSaveInterval);

    return () => clearTimeout(autoSaveTimer);
  }, [formik.values, enableAutoSave, autoSaveInterval, formik.dirty, formik.isSubmitting, showNotification]);

  // Smart suggestions
  useEffect(() => {
    if (!enableSmartSuggestions) return;

    const suggestions = {};
    
    schema?.fields?.forEach(field => {
      if (field.smartSuggestions && formik.values[field.name]) {
        // Generate suggestions based on field type and current value
        suggestions[field.name] = generateSuggestions(field, formik.values[field.name]);
      }
    });
    
    setFieldSuggestions(suggestions);
  }, [formik.values, schema, enableSmartSuggestions]);

  // Generate smart suggestions
  const generateSuggestions = useCallback((field, currentValue) => {
    const suggestions = [];
    
    switch (field.type) {
      case 'email':
        if (currentValue.includes('@') && !currentValue.includes('.')) {
          suggestions.push(`${currentValue}gmail.com`, `${currentValue}outlook.com`);
        }
        break;
      case 'phone':
        if (currentValue.length === 10 && !currentValue.includes('-')) {
          suggestions.push(
            `${currentValue.slice(0, 3)}-${currentValue.slice(3, 6)}-${currentValue.slice(6)}`
          );
        }
        break;
      case 'text':
        if (field.suggestions) {
          suggestions.push(...field.suggestions.filter(s => 
            s.toLowerCase().includes(currentValue.toLowerCase())
          ));
        }
        break;
    }
    
    return suggestions;
  }, []);

  // Handle step navigation
  const handleNext = useCallback(() => {
    if (currentStep < schema.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setCompletedSteps(prev => new Set([...prev, currentStep]));
    }
  }, [currentStep, schema]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleStepClick = useCallback((step) => {
    setCurrentStep(step);
  }, []);

  // Render field based on type
  const renderField = useCallback((field) => {
    if (!visibleFields.has(field.name) && enableConditionalFields) {
      return null;
    }

    const fieldProps = {
      name: field.name,
      value: formik.values[field.name] || '',
      onChange: formik.handleChange,
      onBlur: formik.handleBlur,
      error: formik.touched[field.name] && Boolean(formik.errors[field.name]),
      helperText: formik.touched[field.name] && formik.errors[field.name],
      disabled: readOnly || field.disabled,
      fullWidth: field.fullWidth !== false,
      required: field.required,
      placeholder: field.placeholder,
      size: field.size || 'medium'
    };

    const MotionBox = motion(Box);

    return (
      <MotionBox
        key={field.name}
        initial={animated && animations ? { opacity: 0, y: 20 } : false}
        animate={animated && animations ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.3 }}
        mb={2}
      >
        {/* Field Label and Description */}
        {field.label && (
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            {field.label}
            {field.required && <span style={{ color: 'red' }}> *</span>}
          </Typography>
        )}
        
        {field.description && (
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            {field.description}
          </Typography>
        )}

        {/* Field Input */}
        {field.type === 'text' || field.type === 'email' || field.type === 'password' ? (
          <TextField
            {...fieldProps}
            type={field.type}
            multiline={field.multiline}
            rows={field.rows}
            InputProps={{
              endAdornment: field.type === 'password' ? (
                <IconButton edge="end">
                  <VisibilityIcon />
                </IconButton>
              ) : null
            }}
          />
        ) : field.type === 'number' ? (
          <TextField
            {...fieldProps}
            type="number"
            inputProps={{
              min: field.min,
              max: field.max,
              step: field.step
            }}
          />
        ) : field.type === 'select' ? (
          <FormControl fullWidth error={fieldProps.error}>
            <InputLabel>{field.label}</InputLabel>
            <Select {...fieldProps} label={field.label}>
              {field.options?.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : field.type === 'autocomplete' ? (
          <Autocomplete
            options={field.options || []}
            getOptionLabel={(option) => option.label || option}
            value={field.options?.find(opt => opt.value === formik.values[field.name]) || null}
            onChange={(event, newValue) => {
              formik.setFieldValue(field.name, newValue?.value || '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                {...fieldProps}
                label={field.label}
              />
            )}
          />
        ) : field.type === 'checkbox' ? (
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(formik.values[field.name])}
                onChange={(e) => formik.setFieldValue(field.name, e.target.checked)}
                disabled={fieldProps.disabled}
              />
            }
            label={field.label}
          />
        ) : field.type === 'radio' ? (
          <FormControl component="fieldset" error={fieldProps.error}>
            <RadioGroup
              value={formik.values[field.name]}
              onChange={(e) => formik.setFieldValue(field.name, e.target.value)}
            >
              {field.options?.map(option => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                  disabled={fieldProps.disabled}
                />
              ))}
            </RadioGroup>
          </FormControl>
        ) : field.type === 'date' ? (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <MuiDatePicker
              label={field.label}
              value={formik.values[field.name] || null}
              onChange={(date) => formik.setFieldValue(field.name, date)}
              renderInput={(params) => <TextField {...params} {...fieldProps} />}
              disabled={fieldProps.disabled}
            />
          </LocalizationProvider>
        ) : field.type === 'time' ? (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <MuiTimePicker
              label={field.label}
              value={formik.values[field.name] || null}
              onChange={(time) => formik.setFieldValue(field.name, time)}
              renderInput={(params) => <TextField {...params} {...fieldProps} />}
              disabled={fieldProps.disabled}
            />
          </LocalizationProvider>
        ) : field.type === 'switch' ? (
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(formik.values[field.name])}
                onChange={(e) => formik.setFieldValue(field.name, e.target.checked)}
                disabled={fieldProps.disabled}
              />
            }
            label={field.label}
          />
        ) : field.type === 'slider' ? (
          <Box>
            <Typography gutterBottom>{field.label}</Typography>
            <Slider
              value={formik.values[field.name] || field.min || 0}
              onChange={(e, value) => formik.setFieldValue(field.name, value)}
              min={field.min || 0}
              max={field.max || 100}
              step={field.step || 1}
              marks={field.marks}
              valueLabelDisplay="auto"
              disabled={fieldProps.disabled}
            />
          </Box>
        ) : field.type === 'rating' ? (
          <Box>
            <Typography gutterBottom>{field.label}</Typography>
            <Rating
              value={formik.values[field.name] || 0}
              onChange={(e, value) => formik.setFieldValue(field.name, value)}
              max={field.max || 5}
              disabled={fieldProps.disabled}
            />
          </Box>
        ) : field.type === 'file' ? (
          <Box>
            <input
              type="file"
              id={field.name}
              multiple={field.multiple}
              accept={field.accept}
              onChange={(e) => formik.setFieldValue(field.name, e.target.files)}
              style={{ display: 'none' }}
              disabled={fieldProps.disabled}
            />
            <label htmlFor={field.name}>
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                disabled={fieldProps.disabled}
              >
                {field.label || 'Upload File'}
              </Button>
            </label>
          </Box>
        ) : null}

        {/* Field Suggestions */}
        {fieldSuggestions[field.name] && fieldSuggestions[field.name].length > 0 && (
          <Box mt={1}>
            <Typography variant="caption" color="text.secondary">
              Suggestions:
            </Typography>
            <Box display="flex" gap={0.5} flexWrap="wrap" mt={0.5}>
              {fieldSuggestions[field.name].map((suggestion, index) => (
                <Chip
                  key={index}
                  size="small"
                  label={suggestion}
                  onClick={() => formik.setFieldValue(field.name, suggestion)}
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Field Warnings */}
        {fieldWarnings[field.name] && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {fieldWarnings[field.name]}
          </Alert>
        )}
      </MotionBox>
    );
  }, [
    formik,
    visibleFields,
    enableConditionalFields,
    readOnly,
    animated,
    animations,
    fieldSuggestions,
    fieldWarnings
  ]);

  // Render step content
  const renderStepContent = useCallback((step) => {
    const stepFields = schema.fields.filter(field => field.step === step);
    return stepFields.map(renderField);
  }, [schema, renderField]);

  if (!schema) {
    return (
      <Alert severity="error">
        Form schema is required
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Form Header */}
        {(title || subtitle) && (
          <Box mb={3}>
            {title && (
              <Typography variant="h5" component="h2" gutterBottom>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        )}

        {/* Progress Bar */}
        {showProgress && enableProgress && (
          <Box mb={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Form Progress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Math.round(formProgress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={formProgress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {/* Auto-save indicator */}
        {enableAutoSave && lastAutoSave && (
          <Box mb={2}>
            <Chip
              size="small"
              icon={<CheckIcon />}
              label={`Auto-saved at ${lastAutoSave.toLocaleTimeString()}`}
              color="success"
              variant="outlined"
            />
          </Box>
        )}

        <form onSubmit={formik.handleSubmit}>
          {enableSteps && schema.steps ? (
            /* Stepped Form */
            <Stepper activeStep={currentStep} orientation="vertical">
              {schema.steps.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel
                    onClick={() => handleStepClick(index)}
                    sx={{ cursor: 'pointer' }}
                  >
                    {step.label}
                  </StepLabel>
                  <StepContent>
                    <Box mb={2}>
                      {renderStepContent(index)}
                    </Box>
                    <Box>
                      <Button
                        disabled={index === 0}
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                      >
                        Back
                      </Button>
                      <Button
                        variant="contained"
                        onClick={index === schema.steps.length - 1 ? formik.handleSubmit : handleNext}
                        disabled={isSubmitting}
                      >
                        {index === schema.steps.length - 1 ? submitLabel : 'Next'}
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          ) : (
            /* Regular Form */
            <Box>
              {schema.fields.map(renderField)}
              
              {/* Form Actions */}
              <Box display="flex" gap={2} justifyContent="flex-end" mt={3}>
                {showResetButton && (
                  <Button
                    type="button"
                    onClick={formik.handleReset}
                    disabled={isSubmitting}
                    startIcon={<ClearIcon />}
                  >
                    {resetLabel}
                  </Button>
                )}
                
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting || !formik.isValid}
                  startIcon={<SaveIcon />}
                >
                  {isSubmitting ? 'Submitting...' : submitLabel}
                </Button>
              </Box>
            </Box>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default SmartForm;