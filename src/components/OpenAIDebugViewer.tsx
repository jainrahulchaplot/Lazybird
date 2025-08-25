import React from 'react';
import { Card, CardHeader, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { TextArea } from './ui/Input';
import { X, Eye, Code, Image as ImageIcon, MessageSquare } from 'lucide-react';

interface OpenAIDebugData {
  imageBase64: string;
  systemPrompt: string;
  userPromptText: string;
  rawResponse: string;
  parsedData: any;
  success: boolean;
  error?: string;
}

interface OpenAIDebugViewerProps {
  isOpen: boolean;
  onClose: () => void;
  debugData: OpenAIDebugData | null;
}

export const OpenAIDebugViewer: React.FC<OpenAIDebugViewerProps> = ({
  isOpen,
  onClose,
  debugData
}) => {
  if (!isOpen || !debugData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Eye className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">OpenAI Vision API Debug</h2>
              <p className="text-sm text-gray-600">
                {debugData.success ? 'Processing successful' : 'Processing failed'}
              </p>
            </div>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            icon={X}
          >
            Close
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Image and Prompts */}
            <div className="space-y-6">
              {/* Uploaded Image */}
              <Card>
                <CardHeader
                  title="Uploaded Image"
                  subtitle="The screenshot sent to OpenAI"
                  action={<ImageIcon className="h-5 w-5 text-gray-400" />}
                />
                <CardBody>
                  <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                    <img
                      src={`data:image/jpeg;base64,${debugData.imageBase64}`}
                      alt="Uploaded screenshot"
                      className="max-w-full max-h-[300px] object-contain rounded shadow-sm"
                    />
                  </div>
                </CardBody>
              </Card>

              {/* System Prompt */}
              <Card>
                <CardHeader
                  title="System Prompt"
                  subtitle="Instructions given to OpenAI"
                  action={<Code className="h-5 w-5 text-gray-400" />}
                />
                <CardBody>
                  <TextArea
                    value={debugData.systemPrompt}
                    readOnly
                    rows={12}
                    className="font-mono text-sm bg-gray-50"
                  />
                </CardBody>
              </Card>

              {/* User Prompt */}
              <Card>
                <CardHeader
                  title="User Prompt"
                  subtitle="Direct request sent with the image"
                  action={<MessageSquare className="h-5 w-5 text-gray-400" />}
                />
                <CardBody>
                  <TextArea
                    value={debugData.userPromptText}
                    readOnly
                    rows={3}
                    className="font-mono text-sm bg-gray-50"
                  />
                </CardBody>
              </Card>
            </div>

            {/* Right Column - Response and Results */}
            <div className="space-y-6">
              {/* Raw OpenAI Response */}
              <Card>
                <CardHeader
                  title="Raw OpenAI Response"
                  subtitle="Unprocessed response from the API"
                  action={
                    <div className="flex items-center space-x-2">
                      {debugData.success ? (
                        <span className="text-green-600 text-sm font-medium">✓ Success</span>
                      ) : (
                        <span className="text-red-600 text-sm font-medium">✗ Failed</span>
                      )}
                    </div>
                  }
                />
                <CardBody>
                  <div className="space-y-4">
                    <TextArea
                      value={debugData.rawResponse}
                      readOnly
                      rows={15}
                      className="font-mono text-sm bg-gray-50"
                    />
                    
                    {/* Show formatted response if it's long text */}
                    {debugData.rawResponse && debugData.rawResponse.length > 200 && (
                      <div className="p-4 bg-blue-50 rounded-lg border">
                        <h4 className="font-medium text-blue-900 mb-2">Formatted Response:</h4>
                        <div className="text-sm text-blue-800 whitespace-pre-wrap">
                          {debugData.rawResponse}
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>

              {/* Extracted Info */}
              <Card>
                <CardHeader
                  title="Extracted Information"
                  subtitle={debugData.success ? "Basic info extracted from response" : "Extraction result"}
                />
                <CardBody>
                  <TextArea
                    value={debugData.parsedData ? JSON.stringify(debugData.parsedData, null, 2) : 'No structured data extracted'}
                    readOnly
                    rows={8}
                    className={`font-mono text-sm ${
                      debugData.success ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  />
                </CardBody>
              </Card>

              {/* Error Details (if any) */}
              {debugData.error && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader
                    title="Error Details"
                    subtitle="What went wrong during processing"
                  />
                  <CardBody>
                    <div className="text-red-700 font-medium">
                      {debugData.error}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Processing Summary */}
              <Card className={debugData.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <CardHeader
                  title="Processing Summary"
                  subtitle="Key information about this request"
                />
                <CardBody>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Status:</span>
                      <span className={debugData.success ? 'text-green-700' : 'text-red-700'}>
                        {debugData.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Model Used:</span>
                      <span>gpt-4o-mini (Vision)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Image Size:</span>
                      <span>{Math.round(debugData.imageBase64.length * 0.75 / 1024)} KB</span>
                    </div>
                    {debugData.success && debugData.parsedData && (
                      <>
                        <div className="flex justify-between">
                          <span className="font-medium">Company Extracted:</span>
                          <span className="text-green-700">{debugData.parsedData?.company || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Role Extracted:</span>
                          <span className="text-green-700">{debugData.parsedData?.role || 'N/A'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};