import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { FileText, Sparkles, Copy, RefreshCw, Edit } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useBulletinGenerator } from "@/hooks/useBulletinGenerator";

interface GeneradorTextosBoletinProps {
  student: {
    id: number;
    name: string;
    perfil: string;
    evaluacionesCualitativas: {
      fecha: string;
      evaluador: string;
      area: string;
      comentario: string;
      tipo: 'docente' | 'psicopedagogico';
    }[];
  };
}

const GeneradorTextosBoletin = ({ student }: GeneradorTextosBoletinProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState('trimestre-actual');
  const [isEditing, setIsEditing] = useState(false);
  const [customAspects, setCustomAspects] = useState<string>('');
  const { toast } = useToast();
  
  const { 
    isGenerating, 
    generatedText, 
    generateBulletinText, 
    regenerateText,
    setGeneratedText 
  } = useBulletinGenerator({ student });

  const handleGenerate = () => {
    generateBulletinText(selectedPeriod, customAspects);
    toast({
      title: "Generando texto...",
      description: "Texto para boletín de Historia basado en lineamientos pedagógicos",
    });
  };

  const handleRegenerate = () => {
    regenerateText(selectedPeriod, customAspects);
    toast({
      title: "Regenerando texto...",
      description: "Creando nueva versión del texto del boletín",
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedText);
    toast({
      title: "Copiado al portapapeles",
      description: "Texto listo para pegar en el boletín",
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="w-5 h-5" />
          Generador de Texto para Boletín
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Texto automático para Historia basado en lineamientos pedagógicos
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Configuración minimalista */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-foreground">Período:</label>
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="flex-1 max-w-48 p-2 border border-input rounded-md text-sm bg-background"
          >
            <option value="trimestre-actual">Trimestre Actual</option>
            <option value="semestre-actual">Semestre Actual</option>
            <option value="anual">Año Completo</option>
          </select>
        </div>

        {/* Aspectos personalizados a incluir */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Aspectos específicos a incluir (opcional):</label>
          <Textarea 
            value={customAspects}
            onChange={(e) => setCustomAspects(e.target.value)}
            placeholder="Ej: Enfatizar su progreso en análisis crítico, mencionar su mejora en debates grupales, destacar el uso de vocabulario histórico..."
            className="min-h-20 bg-background border-input text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Describe qué aspectos específicos quieres que la IA incluya en el texto del boletín
          </p>
        </div>

        {/* Botón de generación */}
        <div className="flex justify-center py-2">
          <Button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generar Texto para Boletín
              </>
            )}
          </Button>
        </div>

        {/* Texto generado - minimalista */}
        {generatedText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-muted/30 p-4 rounded-lg border border-border"
          >
            <Textarea 
              value={generatedText}
              onChange={(e) => setGeneratedText(e.target.value)}
              className="w-full min-h-32 bg-background border-input resize-none"
              placeholder="El texto generado aparecerá aquí..."
              readOnly={!isEditing}
            />
            
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-muted-foreground">
                {generatedText.split(' ').length} palabras • Historia 9º Año
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setIsEditing(!isEditing)}
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  {isEditing ? 'Listo' : 'Editar'}
                </Button>
                <Button 
                  onClick={copyToClipboard}
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copiar
                </Button>
                <Button 
                  onClick={handleRegenerate}
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Generar nuevo
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default GeneradorTextosBoletin;