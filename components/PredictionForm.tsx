import React, { useState, useEffect } from 'react';
import { TradeSetup, UploadedFile, TradeTemplate } from '../types';
import { TrendingUpIcon, AlertTriangleIcon } from './icons/Icons';
import TemplateService from '../services/templateService';

interface PredictionFormProps {
  onSubmit: (tradeSetup: TradeSetup) => void;
  isLoading: boolean;
  selectedFile: UploadedFile;
  selectedTemplate?: TradeTemplate | null;
  onTemplateApplied?: () => void;
}

const PredictionForm: React.FC<PredictionFormProps> = ({
  onSubmit,
  isLoading,
  selectedFile,
  selectedTemplate,
  onTemplateApplied
}) => {
  const templateService = TemplateService.getInstance();
  const [templates, setTemplates] = useState<TradeTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  
  const [tradeSetup, setTradeSetup] = useState<TradeSetup>({
    symbol: '',
    direction: 'long',
    entryPrice: 0,
    stopLoss: undefined,
    takeProfit: undefined,
    positionSize: 0,
    timeframe: '15m',
    marketConditions: {
      weekly: '',
      daily: ''
    },
    strategy: '',
    notes: ''
  });

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        console.log('Loading templates...');
        const availableTemplates = await templateService.getAllTemplates();
        console.log('Available templates:', availableTemplates);
        setTemplates(availableTemplates);
        setTemplatesLoaded(true);
        
        // Don't auto-select default template, let user choose
        if (availableTemplates.length > 0) {
          console.log('Templates loaded successfully:', availableTemplates.length);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
        // Create fallback template if loading fails
        const fallbackTemplate: TradeTemplate = {
          id: 'fallback',
          name: 'Basic Template',
          description: 'Basic trading template',
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          template: {
            symbol: '',
            direction: 'long',
            entryPrice: 0,
            stopLoss: 0,
            takeProfit: 0,
            positionSize: 0,
            timeframe: '15m',
            marketConditions: { weekly: '', daily: '' },
            strategy: '',
            notes: ''
          }
        };
        setTemplates([fallbackTemplate]);
        setTemplatesLoaded(true);
        console.log('Using fallback template due to loading error');
      }
    };

    loadTemplates();
  }, [templateService]);

  // Apply selected template from parent component
  useEffect(() => {
    if (selectedTemplate) {
      console.log('Applying selected template:', selectedTemplate.name);
      setTradeSetup(selectedTemplate.template);
      setSelectedTemplateId(selectedTemplate.id);
      
      // Notify parent that template has been applied
      if (onTemplateApplied) {
        onTemplateApplied();
      }
    }
  }, [selectedTemplate, onTemplateApplied]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!tradeSetup.symbol.trim()) {
      newErrors.symbol = 'Symbol is required';
    }

    if (tradeSetup.entryPrice <= 0) {
      newErrors.entryPrice = 'Entry price must be greater than 0';
    }

    if (tradeSetup.stopLoss && tradeSetup.stopLoss <= 0) {
      newErrors.stopLoss = 'Stop loss must be greater than 0';
    }

    if (tradeSetup.takeProfit && tradeSetup.takeProfit <= 0) {
      newErrors.takeProfit = 'Take profit must be greater than 0';
    }

    if (tradeSetup.positionSize <= 0) {
      newErrors.positionSize = 'Position size must be greater than 0';
    }

    // Validate stop loss vs entry price
    if (tradeSetup.stopLoss && tradeSetup.entryPrice > 0) {
      if (tradeSetup.direction === 'long' && tradeSetup.stopLoss >= tradeSetup.entryPrice) {
        newErrors.stopLoss = 'Stop loss should be below entry price for long positions';
      }
      if (tradeSetup.direction === 'short' && tradeSetup.stopLoss <= tradeSetup.entryPrice) {
        newErrors.stopLoss = 'Stop loss should be above entry price for short positions';
      }
    }

    // Validate take profit vs entry price
    if (tradeSetup.takeProfit && tradeSetup.entryPrice > 0) {
      if (tradeSetup.direction === 'long' && tradeSetup.takeProfit <= tradeSetup.entryPrice) {
        newErrors.takeProfit = 'Take profit should be above entry price for long positions';
      }
      if (tradeSetup.direction === 'short' && tradeSetup.takeProfit >= tradeSetup.entryPrice) {
        newErrors.takeProfit = 'Take profit should be below entry price for short positions';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(tradeSetup);
    }
  };

  const handleInputChange = (field: keyof TradeSetup, value: any) => {
    setTradeSetup(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleMarketConditionChange = (type: 'weekly' | 'daily', value: string) => {
    setTradeSetup(prev => ({
      ...prev,
      marketConditions: {
        ...prev.marketConditions,
        [type]: value
      }
    }));
  };

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    
    if (!templateId) {
      // Reset to empty form if no template selected
      setTradeSetup({
        symbol: '',
        direction: 'long',
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        positionSize: 0,
        timeframe: '15m',
        marketConditions: {
          weekly: '',
          daily: ''
        },
        strategy: '',
        notes: ''
      });
      setErrors({});
      return;
    }
    
    try {
      const template = await templateService.getTemplate(templateId);
      if (template) {
        setTradeSetup(template.template);
        setErrors({});
      }
    } catch (error) {
      console.warn('Failed to load template:', error);
    }
  };

  const calculateRiskReward = () => {
    if (!tradeSetup.entryPrice || !tradeSetup.stopLoss || !tradeSetup.takeProfit) {
      return null;
    }

    const risk = tradeSetup.direction === 'long' 
      ? tradeSetup.entryPrice - tradeSetup.stopLoss
      : tradeSetup.stopLoss - tradeSetup.entryPrice;

    const reward = tradeSetup.direction === 'long'
      ? tradeSetup.takeProfit - tradeSetup.entryPrice
      : tradeSetup.entryPrice - tradeSetup.takeProfit;

    if (risk <= 0) return null;

    return (reward / risk).toFixed(2);
  };

  const riskReward = calculateRiskReward();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center mb-6">
          <TrendingUpIcon className="h-6 w-6 text-cyan-400 mr-3" />
          <h2 className="text-xl font-semibold text-gray-100">New Trade Prediction</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Trade Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Symbol *
              </label>
              <input
                type="text"
                value={tradeSetup.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                placeholder="e.g., AAPL, TSLA, SPY"
                className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  errors.symbol ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {errors.symbol && (
                <p className="mt-1 text-sm text-red-400">{errors.symbol}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Direction *
              </label>
              <select
                value={tradeSetup.direction}
                onChange={(e) => handleInputChange('direction', e.target.value as 'long' | 'short')}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="long">Long (Buy)</option>
                <option value="short">Short (Sell)</option>
              </select>
            </div>
          </div>

          {/* Price Levels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entry Price *
              </label>
              <input
                type="number"
                step="0.01"
                value={tradeSetup.entryPrice || ''}
                onChange={(e) => handleInputChange('entryPrice', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  errors.entryPrice ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {errors.entryPrice && (
                <p className="mt-1 text-sm text-red-400">{errors.entryPrice}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Stop Loss
              </label>
              <input
                type="number"
                step="0.01"
                value={tradeSetup.stopLoss || ''}
                onChange={(e) => handleInputChange('stopLoss', parseFloat(e.target.value) || undefined)}
                placeholder="0.00"
                className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  errors.stopLoss ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {errors.stopLoss && (
                <p className="mt-1 text-sm text-red-400">{errors.stopLoss}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Take Profit
              </label>
              <input
                type="number"
                step="0.01"
                value={tradeSetup.takeProfit || ''}
                onChange={(e) => handleInputChange('takeProfit', parseFloat(e.target.value) || undefined)}
                placeholder="0.00"
                className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  errors.takeProfit ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {errors.takeProfit && (
                <p className="mt-1 text-sm text-red-400">{errors.takeProfit}</p>
              )}
            </div>
          </div>

          {/* Risk/Reward Display */}
          {riskReward && (
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Risk/Reward Ratio:</span>
                <span className={`font-semibold ${
                  parseFloat(riskReward) >= 2 ? 'text-green-400' : 
                  parseFloat(riskReward) >= 1 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  1:{riskReward}
                </span>
              </div>
            </div>
          )}

          {/* Position and Timeframe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Position Size *
              </label>
              <input
                type="number"
                step="0.01"
                value={tradeSetup.positionSize || ''}
                onChange={(e) => handleInputChange('positionSize', parseFloat(e.target.value) || 0)}
                placeholder="1.00"
                className={`w-full px-4 py-2 bg-gray-700 border rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  errors.positionSize ? 'border-red-500' : 'border-gray-600'
                }`}
              />
              {errors.positionSize && (
                <p className="mt-1 text-sm text-red-400">{errors.positionSize}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Timeframe
              </label>
              <select
                value={tradeSetup.timeframe}
                onChange={(e) => handleInputChange('timeframe', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1H">1 Hour</option>
                <option value="4H">4 Hours</option>
                <option value="1D">1 Day</option>
                <option value="1W">1 Week</option>
              </select>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-4">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                disabled={!templatesLoaded}
              >
                <option value="">Choose a template...</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
              {!templatesLoaded && (
                <p className="mt-1 text-sm text-yellow-400">Loading templates...</p>
              )}
              {templatesLoaded && templates.length === 0 && (
                <p className="mt-1 text-sm text-yellow-400">No templates available</p>
              )}
            </div>

            {/* Market Conditions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Weekly Market Condition
                </label>
                <input
                  type="text"
                  value={tradeSetup.marketConditions?.weekly || ''}
                  onChange={(e) => handleMarketConditionChange('weekly', e.target.value)}
                  placeholder="e.g., bullish, bearish, sideways"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Daily Market Condition
                </label>
                <input
                  type="text"
                  value={tradeSetup.marketConditions?.daily || ''}
                  onChange={(e) => handleMarketConditionChange('daily', e.target.value)}
                  placeholder="e.g., bullish, bearish, sideways"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Strategy
              </label>
              <input
                type="text"
                value={tradeSetup.strategy || ''}
                onChange={(e) => handleInputChange('strategy', e.target.value)}
                placeholder="e.g., Breakout, Mean reversion, Momentum"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={tradeSetup.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional notes about this trade setup..."
                rows={3}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center text-sm text-gray-400">
              <AlertTriangleIcon className="h-4 w-4 mr-2" />
              Prediction based on historical data from {selectedFile.name}
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUpIcon className="h-4 w-4 mr-2" />
                  Get Prediction
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PredictionForm;