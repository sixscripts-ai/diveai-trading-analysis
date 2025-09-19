import React, { useState } from 'react';
import { PredictionResult, UploadedFile } from '../types';
import { DeleteIcon, BarChart3Icon, TrendingUpIcon } from './icons/Icons';

interface PredictionHistoryProps {
  predictions: PredictionResult[];
  onViewPrediction: (prediction: PredictionResult) => void;
  onDeletePrediction: (predictionId: number) => void;
  selectedFile: UploadedFile;
}

const PredictionHistory: React.FC<PredictionHistoryProps> = ({
  predictions,
  onViewPrediction,
  onDeletePrediction,
  selectedFile
}) => {
  const [sortBy, setSortBy] = useState<'date' | 'probability' | 'confidence'>('date');
  const [filterRisk, setFilterRisk] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  const sortedAndFilteredPredictions = predictions
    .filter(p => filterRisk === 'all' || p.riskLevel === filterRisk)
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.predictionDate || 0).getTime() - new Date(a.predictionDate || 0).getTime();
        case 'probability':
          return b.successProbability - a.successProbability;
        case 'confidence':
          return b.confidenceScore - a.confidenceScore;
        default:
          return 0;
      }
    });

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'high': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getSuccessColor = (probability: number) => {
    if (probability >= 0.7) return 'text-green-400';
    if (probability >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleDeleteClick = (e: React.MouseEvent, predictionId: number) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this prediction?')) {
      onDeletePrediction(predictionId);
    }
  };

  if (predictions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <BarChart3Icon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Predictions Yet</h3>
          <p className="text-gray-500">
            Create your first prediction for <span className="text-cyan-400">{selectedFile.name}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header and Filters */}
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <BarChart3Icon className="h-6 w-6 text-cyan-400 mr-3" />
            <h2 className="text-xl font-semibold text-gray-100">Prediction History</h2>
            <span className="ml-3 px-2 py-1 bg-gray-700 rounded-full text-sm text-gray-300">
              {predictions.length} predictions
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="date">Date (Newest)</option>
              <option value="probability">Success Probability</option>
              <option value="confidence">AI Confidence</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Risk Level</label>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value as any)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Predictions List */}
      <div className="space-y-4">
        {sortedAndFilteredPredictions.map((prediction) => (
          <div
            key={prediction.id}
            onClick={() => onViewPrediction(prediction)}
            className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 cursor-pointer transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-100">
                      {prediction.tradeSetup.symbol}
                    </h3>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      prediction.tradeSetup.direction === 'long' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'
                    }`}>
                      {prediction.tradeSetup.direction.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(prediction.riskLevel)}`}>
                      {prediction.riskLevel.toUpperCase()} RISK
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">
                      {prediction.predictionDate && new Date(prediction.predictionDate).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => handleDeleteClick(e, prediction.id!)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1"
                    >
                      <DeleteIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-400">Entry Price</div>
                    <div className="text-gray-200 font-medium">${prediction.tradeSetup.entryPrice}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Success Probability</div>
                    <div className={`font-semibold ${getSuccessColor(prediction.successProbability)}`}>
                      {(prediction.successProbability * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">AI Confidence</div>
                    <div className="text-gray-200 font-medium">
                      {(prediction.confidenceScore * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Expected Return</div>
                    <div className={`font-medium ${
                      (prediction.expectedReturn || 0) > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {prediction.expectedReturn !== undefined 
                        ? `${prediction.expectedReturn > 0 ? '+' : ''}${prediction.expectedReturn.toFixed(2)}%`
                        : 'N/A'
                      }
                    </div>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Success Probability</span>
                    <span className={getSuccessColor(prediction.successProbability)}>
                      {(prediction.successProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        prediction.successProbability >= 0.7 ? 'bg-green-400' :
                        prediction.successProbability >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${prediction.successProbability * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Reasoning Preview */}
                {prediction.reasoning && (
                  <div className="mt-4 p-3 bg-gray-700/30 rounded-lg">
                    <div className="text-sm text-gray-300 line-clamp-2">
                      {prediction.reasoning.length > 150 
                        ? `${prediction.reasoning.substring(0, 150)}...`
                        : prediction.reasoning
                      }
                    </div>
                  </div>
                )}
              </div>

              {/* View Button */}
              <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center">
                  <TrendingUpIcon className="h-4 w-4 mr-1" />
                  View
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-medium text-gray-200 mb-4">Summary Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">
              {predictions.length}
            </div>
            <div className="text-sm text-gray-400">Total Predictions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {((predictions.reduce((sum, p) => sum + p.successProbability, 0) / predictions.length) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400">Avg Success Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {((predictions.reduce((sum, p) => sum + p.confidenceScore, 0) / predictions.length) * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-400">Avg Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {predictions.filter(p => p.riskLevel === 'high').length}
            </div>
            <div className="text-sm text-gray-400">High Risk Trades</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionHistory;