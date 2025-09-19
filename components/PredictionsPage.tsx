import React, { useState, useEffect, useCallback } from 'react';
import { UploadedFile, TradeSetup, PredictionResult, TradeTemplate } from '../types';
import { predictTradeOutcome } from '../services/geminiService';
import DatabaseClient from '../services/databaseClient';
import TemplateService from '../services/templateService';
import PredictionForm from './PredictionForm';
import PredictionResults from './PredictionResults';
import PredictionHistory from './PredictionHistory';
import { BrainCircuitIcon, TrendingUpIcon, AlertTriangleIcon, BarChart3Icon } from './icons/Icons';

interface PredictionsPageProps {
  files: UploadedFile[];
  selectedFile: UploadedFile | null;
  onFileSelect: (file: UploadedFile) => void;
  onBack: () => void;
}

const PredictionsPage: React.FC<PredictionsPageProps> = ({
  files,
  selectedFile,
  onFileSelect,
  onBack
}) => {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'predict' | 'results' | 'history'>('predict');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<TradeTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [dbClient] = useState(() => DatabaseClient.getInstance());
  const [templateService] = useState(() => TemplateService.getInstance());

  // Load predictions for selected file
  useEffect(() => {
    const loadPredictions = async () => {
      if (!selectedFile) return;
      
      try {
        const filePredictions = await dbClient.getPredictionsByFile(selectedFile.id);
        setPredictions(filePredictions);
      } catch (error) {
        console.error('Failed to load predictions:', error);
      }
    };

    loadPredictions();
  }, [selectedFile, dbClient]);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const availableTemplates = await templateService.getAllTemplates();
        setTemplates(availableTemplates);
        setTemplatesLoaded(true);
      } catch (error) {
        console.error('Failed to load templates:', error);
        setTemplatesLoaded(true); // Still set to true to show error state
      }
    };

    loadTemplates();
  }, [templateService]);

  const handlePredictTrade = useCallback(async (tradeSetup: TradeSetup) => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Generate prediction using Gemini AI
      const prediction = await predictTradeOutcome(selectedFile, tradeSetup);
      
      // Save prediction to database
      const savedPrediction = await dbClient.savePrediction(prediction);
      const predictionWithId = { ...prediction, id: savedPrediction.id };
      
      // Update state
      setCurrentPrediction(predictionWithId);
      setPredictions(prev => [predictionWithId, ...prev]);
      setActiveTab('results');
      
    } catch (error) {
      console.error('Prediction failed:', error);
      setError(error instanceof Error ? error.message : 'Prediction failed');
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, dbClient]);

  const handleDeletePrediction = useCallback(async (predictionId: number) => {
    try {
      await dbClient.deletePrediction(predictionId);
      setPredictions(prev => prev.filter(p => p.id !== predictionId));
      
      if (currentPrediction?.id === predictionId) {
        setCurrentPrediction(null);
      }
    } catch (error) {
      console.error('Failed to delete prediction:', error);
      setError('Failed to delete prediction');
    }
  }, [dbClient, currentPrediction]);

  const handleViewPrediction = useCallback((prediction: PredictionResult) => {
    setCurrentPrediction(prediction);
    setActiveTab('results');
  }, []);

  const handleTemplateSelect = useCallback((template: TradeTemplate) => {
    // Switch to predict tab and pass template to form
    setActiveTab('predict');
    setShowTemplateModal(false);
    
    // We'll need to pass the selected template to the PredictionForm
    // For now, we'll store it in state and pass it as a prop
    setSelectedTemplate(template);
  }, []);

  const [selectedTemplate, setSelectedTemplate] = useState<TradeTemplate | null>(null);

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <BrainCircuitIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-300 mb-2">No File Selected</h2>
          <p className="text-gray-500 mb-6">Select a trading journal file to start making predictions</p>
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Available files:</p>
              {files.slice(0, 3).map(file => (
                <button
                  key={file.id}
                  onClick={() => onFileSelect(file)}
                  className="block w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
                >
                  {file.name}
                </button>
              ))}
              {files.length > 3 && (
                <p className="text-xs text-gray-500">...and {files.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-950/40 border-b border-gray-500/20 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={onBack}
                className="flex items-center space-x-2 px-3 py-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg transition-all duration-200 border border-gray-600/30 hover:border-gray-500/50"
              >
                <span className="text-lg">←</span>
                <span className="hidden sm:inline">Back</span>
              </button>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="flex items-center space-x-2 px-3 py-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg transition-all duration-200 border border-gray-600/30 hover:border-gray-500/50"
              >
                <span className="text-lg">📋</span>
                <span className="hidden sm:inline">Templates</span>
              </button>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-100 flex items-center">
                <BrainCircuitIcon className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-400 mr-2 sm:mr-3" />
                AI Trade Predictions
              </h1>
              <p className="text-gray-400 mt-1 text-sm sm:text-base">
                Analyzing: <span className="text-cyan-400">{selectedFile.name}</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="text-right text-xs sm:text-sm">
              <div className="text-gray-300">{predictions.length} predictions</div>
              <div className="text-gray-500">for this file</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mt-4 sm:mt-6 px-4 sm:px-6">
          {[
            { id: 'predict', label: 'New Prediction', icon: TrendingUpIcon },
            { id: 'results', label: 'Current Result', icon: BarChart3Icon },
            { id: 'history', label: 'History', icon: AlertTriangleIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-sm sm:text-base ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.id === 'predict' ? 'New' : tab.id === 'results' ? 'Result' : 'History'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="flex items-center">
            <AlertTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-300">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {activeTab === 'predict' && (
          <PredictionForm
            onSubmit={handlePredictTrade}
            isLoading={isLoading}
            selectedFile={selectedFile}
            selectedTemplate={selectedTemplate}
            onTemplateApplied={() => setSelectedTemplate(null)}
          />
        )}

        {activeTab === 'results' && (
          <PredictionResults
            prediction={currentPrediction}
            isLoading={isLoading}
            onNewPrediction={() => setActiveTab('predict')}
          />
        )}

        {activeTab === 'history' && (
          <PredictionHistory
            predictions={predictions}
            onViewPrediction={handleViewPrediction}
            onDeletePrediction={handleDeletePrediction}
            selectedFile={selectedFile}
          />
        )}
      </div>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-100">Select Template</h2>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {!templatesLoaded ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Loading templates...</div>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">No templates available</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="border border-gray-600 rounded-lg p-4 hover:border-cyan-500/50 cursor-pointer transition-colors"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-100">
                          {template.name}
                          {template.isDefault && (
                            <span className="ml-2 text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded">
                              Default
                            </span>
                          )}
                        </h3>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">{template.description}</p>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-500">Symbol:</span>
                          <span className="text-gray-300 ml-1">
                            {template.template.symbol || 'Not set'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Direction:</span>
                          <span className="text-gray-300 ml-1 capitalize">
                            {template.template.direction}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Timeframe:</span>
                          <span className="text-gray-300 ml-1">
                            {template.template.timeframe}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Strategy:</span>
                          <span className="text-gray-300 ml-1">
                            {template.template.strategy || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionsPage;