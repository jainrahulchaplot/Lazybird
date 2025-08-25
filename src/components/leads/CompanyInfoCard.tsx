import React from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Building2, Users, Globe, TrendingUp, DollarSign, Calendar, MapPin, Target, CheckCircle, AlertCircle } from 'lucide-react';

interface CompanyInfoCardProps {
  companyName?: string;
  research?: any; // OpenAI company research data
  isLoading?: boolean; // Loading state
}

export const CompanyInfoCard: React.FC<CompanyInfoCardProps> = ({
  companyName = "Company",
  research,
  isLoading
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader
          title="Company Information"
          subtitle={`Research about ${companyName}`}
        />
        <CardBody>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm text-gray-600">Researching company...</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Use real research data if available, otherwise show placeholder
  const hasResearch = research && Object.keys(research).length > 0;

  return (
    <Card>
      <CardHeader
        title="Company Information"
        subtitle={`Research about ${companyName}`}
      />
      <CardBody>
        {hasResearch ? (
          <div className="space-y-6">
            {/* Company Details */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Company Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {research.industry && (
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Industry:</span>
                    <span>{research.industry}</span>
                  </div>
                )}
                {research.size && (
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Size:</span>
                    <span>{research.size}</span>
                  </div>
                )}
                {research.founded && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Founded:</span>
                    <span>{research.founded}</span>
                  </div>
                )}
                {research.headquarters && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">HQ:</span>
                    <span>{research.headquarters}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Key Highlights */}
            {research.highlights && research.highlights.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Key Highlights</h4>
                <div className="space-y-2">
                  {research.highlights.map((highlight: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent News */}
            {research.recentNews && research.recentNews.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Recent News</h4>
                <div className="space-y-2">
                  {research.recentNews.map((news: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{news}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Building2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No research available</h3>
            <p className="text-xs text-gray-600">Company research will appear here once loaded</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
};
