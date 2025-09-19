import React from 'react';
import { PredictionResult } from '../types';
import { TrendingUpIcon, AlertTriangleIcon, BarChart3Icon, BrainCircuitIcon } from './icons/Icons';

interface PredictionResultsProps {
  prediction: PredictionResult | null;
  isLoading: boolean;
  onNewPrediction: () => void;
}

const PredictionResults: React.FC<PredictionResultsProps> = ({
  prediction,
  isLoading,
  onNewPrediction
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Analyzing Trade Setup</h3>
          <p className="text-gray-500">AI is processing your trade against historical data...</p>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <BarChart3Icon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Prediction Available</h3>
          <p className="text-gray-500 mb-6">Create a new prediction to see results here</p>
          <button
            onClick={onNewPrediction}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors"
          >
            Create Prediction
          </button>
        </div>
      </div>
    );
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getSuccessColor = (probability: number) => {
    if (probability >= 0.7) return 'text-green-400';
    if (probability >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <BrainCircuitIcon className="h-6 w-6 text-cyan-400 mr-3" />
            <h2 className="text-xl font-semibold text-gray-100">AI Prediction Results</h2>
          </div>
          <div className="text-sm text-gray-400">
            {prediction.predictionDate && new Date(prediction.predictionDate).toLocaleString()}
          </div>
        </div>

        {/* Trade Setup Summary */}
        <div className="bg-gray-700/30 rounded-lg p-4 mb-4">
          <h3 className="text-lg font-medium text-gray-200 mb-3">Trade Setup</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Symbol:</span>
              <span className="text-gray-200 ml-2 font-medium">{prediction.tradeSetup.symbol}</span>
            </div>
            <div>
              <span className="text-gray-400">Direction:</span>
              <span className={`ml-2 font-medium ${
                prediction.tradeSetup.direction === 'long' ? 'text-green-400' : 'text-red-400'
              }`}>
                {prediction.tradeSetup.direction.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Entry:</span>
              <span className="text-gray-200 ml-2 font-medium">${prediction.tradeSetup.entryPrice}</span>
            </div>
            <div>
              <span className="text-gray-400">Size:</span>
              <span className="text-gray-200 ml-2 font-medium">{prediction.tradeSetup.positionSize}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Success Probability */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-200">Success Probability</h3>
            <TrendingUpIcon className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold mb-2 ${getSuccessColor(prediction.successProbability)}`}>
              {(prediction.successProbability * 100).toFixed(1)}%
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  prediction.successProbability >= 0.7 ? 'bg-green-400' :
                  prediction.successProbability >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${prediction.successProbability * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Risk Level */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-200">Risk Assessment</h3>
            <AlertTriangleIcon className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="text-center">
            <div className={`inline-flex px-4 py-2 rounded-full border text-sm font-medium uppercase tracking-wide ${getRiskColor(prediction.riskLevel)}`}>
              {prediction.riskLevel} Risk
            </div>
            {prediction.expectedReturn !== undefined && (
              <div className="mt-3">
                <div className="text-sm text-gray-400">Expected Return</div>
                <div className={`text-xl font-semibold ${
                  prediction.expectedReturn > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {prediction.expectedReturn > 0 ? '+' : ''}{prediction.expectedReturn.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confidence Score */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-200">AI Confidence</h3>
            <BarChart3Icon className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold mb-2 ${getConfidenceColor(prediction.confidenceScore)}`}>
              {(prediction.confidenceScore * 100).toFixed(0)}%
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  prediction.confidenceScore >= 0.8 ? 'bg-green-400' :
                  prediction.confidenceScore >= 0.6 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${prediction.confidenceScore * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Position Size Recommendation */}
      {prediction.suggestedPositionSize && prediction.suggestedPositionSize !== prediction.tradeSetup.positionSize && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-medium text-gray-200 mb-4">Position Size Recommendation</h3>
          <div className="flex items-center justify-between bg-gray-700/30 rounded-lg p-4">
            <div>
              <div className="text-sm text-gray-400">Your Size</div>
              <div className="text-xl font-semibold text-gray-200">{prediction.tradeSetup.positionSize}</div>
            </div>
            <div className="text-gray-500">→</div>
            <div>
              <div className="text-sm text-gray-400">AI Suggested</div>
              <div className="text-xl font-semibold text-cyan-400">{prediction.suggestedPositionSize}</div>
            </div>
          </div>
        </div>
      )}

      {/* AI Reasoning */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-medium text-gray-200 mb-4">AI Analysis & Reasoning</h3>
        <div className="bg-gray-700/30 rounded-lg p-4">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {prediction.reasoning}
          </p>
        </div>
      </div>

      {/* Market Conditions */}
      {prediction.marketConditions && Object.keys(prediction.marketConditions).length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-medium text-gray-200 mb-4">Market Context</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(prediction.marketConditions).map(([key, value]) => (
              <div key={key} className="bg-gray-700/30 rounded-lg p-3">
                <div className="text-sm text-gray-400 capitalize">{key}</div>
                <div className="text-gray-200 font-medium">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-center">
        <button
          onClick={onNewPrediction}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors flex items-center"
        >
          <TrendingUpIcon className="h-5 w-5 mr-2" />
          Create New Prediction
        </button>
      </div>
    </div>
  );
};

export default PredictionResults;