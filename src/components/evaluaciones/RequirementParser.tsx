import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface RequirementStatus {
  requirement: string;
  status: 'fulfilled' | 'partial' | 'not_possible';
  itemReference?: string;
}

interface RequirementParserProps {
  requirements?: string;
  evaluationContent: string;
  className?: string;
}

export const RequirementParser: React.FC<RequirementParserProps> = ({
  requirements,
  evaluationContent,
  className = ''
}) => {
  if (!requirements || requirements.trim() === '') {
    return null;
  }

  const parseRequirements = (reqText: string): RequirementStatus[] => {
    const lines = reqText.split(/[.\n]/).filter(line => line.trim() !== '');
    
    return lines.map((req, index) => {
      const requirement = req.trim();
      
      // Simple heuristic to determine status based on evaluation content
      let status: 'fulfilled' | 'partial' | 'not_possible' = 'fulfilled';
      
      // Check for specific keywords that might indicate partial or impossible requirements
      if (requirement.toLowerCase().includes('oral') && !evaluationContent.toLowerCase().includes('oral')) {
        status = 'partial';
      } else if (requirement.toLowerCase().includes('específico') && evaluationContent.length < 500) {
        status = 'partial';
      } else if (requirement.toLowerCase().includes('imposible') || requirement.toLowerCase().includes('no se puede')) {
        status = 'not_possible';
      }
      
      return {
        requirement,
        status,
        itemReference: `Ítem ${index + 1}`
      };
    });
  };

  const requirements_parsed = parseRequirements(requirements);
  const fulfilledCount = requirements_parsed.filter(r => r.status === 'fulfilled').length;
  const totalCount = requirements_parsed.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fulfilled':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'not_possible':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'fulfilled':
        return <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">✅ Cumplido</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">⚠️ Parcial</Badge>;
      case 'not_possible':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">⛔ No posible</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className={`border-l-4 border-l-blue-500 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            Requerimientos del Docente
          </CardTitle>
          <Badge variant="outline" className="font-mono">
            Cumplidos: {fulfilledCount}/{totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requirements_parsed.map((req, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              {getStatusIcon(req.status)}
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">{req.requirement}</p>
                <div className="flex items-center gap-2">
                  {getStatusBadge(req.status)}
                  {req.itemReference && (
                    <span className="text-xs text-muted-foreground">
                      Ref: {req.itemReference}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RequirementParser;