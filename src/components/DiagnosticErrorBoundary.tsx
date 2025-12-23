import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * TEMPORARY DIAGNOSTIC ERROR BOUNDARY
 * This is ONLY for debugging the white screen issue.
 * Should be REMOVED after diagnosis is complete.
 */
export class DiagnosticErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentName = this.props.componentName || 'Unknown Component';
    
    console.error('='.repeat(80));
    console.error(`[🔍 DIAGNOSTIC ERROR BOUNDARY] Caught error in: ${componentName}`);
    console.error('='.repeat(80));
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('='.repeat(80));

    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto p-6">
          <Card className="border-red-500">
            <CardHeader className="bg-red-50">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" />
                DIAGNOSTIC: React Error Caught
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-sm text-gray-700 mb-2">Component:</p>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                    {this.props.componentName || 'Unknown'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-sm text-gray-700 mb-2">Error Message:</p>
                  <p className="text-sm font-mono bg-red-50 p-2 rounded text-red-800">
                    {this.state.error?.message || 'Unknown error'}
                  </p>
                </div>

                <div>
                  <p className="font-semibold text-sm text-gray-700 mb-2">Stack Trace:</p>
                  <pre className="text-xs font-mono bg-gray-100 p-3 rounded overflow-auto max-h-64">
                    {this.state.error?.stack || 'No stack available'}
                  </pre>
                </div>

                <div>
                  <p className="font-semibold text-sm text-gray-700 mb-2">Component Stack:</p>
                  <pre className="text-xs font-mono bg-gray-100 p-3 rounded overflow-auto max-h-64">
                    {this.state.errorInfo?.componentStack || 'No component stack available'}
                  </pre>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-gray-600">
                    Check browser console for full diagnostic logs.
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    This error boundary is temporary and only for debugging.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
