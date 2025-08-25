import React from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Target, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface FitScoreCardProps {
  analysis?: any; // OpenAI fit analysis data
  isLoading?: boolean; // Loading state
  // Fallback props for when no analysis is available
  fitScore?: number;
  reasons?: string[];
  parameters?: Array<{
    name: string;
    score: number;
    status: 'strong' | 'medium' | 'weak';
    details: string;
  }>;
}

export const FitScoreCard: React.FC<FitScoreCardProps> = ({
  analysis,
  isLoading,
  fitScore = 85,
  reasons = [
    "Strong technical background matches role requirements",
    "Previous experience in similar industry verticals",
    "Leadership skills align with seniority expectations"
  ],
  parameters = [
    {
      name: "Technical Skills",
      score: 92,
      status: "strong",
      details: "React, Node.js, AWS, Database design"
    },
    {
      name: "Industry Experience",
      score: 78,
      status: "medium", 
      details: "5+ years in fintech, some gaps in specific domains"
    },
    {
      name: "Leadership",
      score: 88,
      status: "strong",
      details: "Team management, project delivery, stakeholder communication"
    },
    {
      name: "Cultural Fit",
      score: 82,
      status: "medium",
      details: "Values alignment, communication style, work preferences"
    }
  ]
}) => {
  // Use real analysis data if available, otherwise fallback to props
  const finalFitScore = analysis?.overallScore || fitScore;
  const finalReasons = analysis?.strengths || reasons;
  const finalParameters = analysis?.parameters || parameters;

  if (isLoading) {
    return (
      <Card>
        <CardHeader
          title="Overall Fit Score"
          subtitle="AI-powered analysis of your fit for this role"
        />
        <CardBody>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm text-gray-600">Analyzing fit...</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreVariant = (score: number) => {
    if (score >= 85) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'strong': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'medium': return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case 'weak': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader
        title="Overall Fit Score"
        subtitle="AI-powered analysis of your fit for this role"
        action={
          <div className="flex items-center space-x-2">
            <div className={`text-3xl font-bold ${getScoreColor(finalFitScore)}`}>
              {finalFitScore}%
            </div>
            <Badge variant={getScoreVariant(finalFitScore)} size="lg">
              {finalFitScore >= 85 ? 'Excellent Fit' : finalFitScore >= 70 ? 'Good Fit' : 'Needs Work'}
            </Badge>
          </div>
        }
      />
      <CardBody>
        <div className="space-y-6">
          {/* Key Reasons */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Why This Role Fits You</h4>
            <div className="space-y-2">
              {finalReasons.map((reason: string, index: number) => (
                <div key={index} className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Parameter Breakdown */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Detailed Scoring</h4>
            <div className="space-y-3">
              {finalParameters.map((param: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(param.status)}
                      <span className="font-medium text-gray-900">{param.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`font-semibold ${getScoreColor(param.score)}`}>
                        {param.score}%
                      </span>
                      <Badge variant={getScoreVariant(param.score)} size="sm">
                        {param.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{param.details}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This analysis will be enhanced with AI-generated insights based on your resume, 
              the job description, and company research. Scores and reasons will be dynamically updated.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
