import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Eye, Save, Palette, Grid, Image } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentEditorProps {
  content: string;
  onChange: (content: string) => void;
  title?: string;
  documentType?: 'evaluation' | 'planning' | 'report';
  templates?: DocumentTemplate[];
  onSave?: (content: string) => void;
  onExportPDF?: (content: string) => void;
  onPreview?: (content: string) => void;
  className?: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  type: 'evaluation' | 'planning' | 'report';
  content: string;
  thumbnail?: string;
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({
  content,
  onChange,
  title = "Editor de Documentos",
  documentType = 'evaluation',
  templates = [],
  onSave,
  onExportPDF,
  onPreview,
  className = ""
}) => {
  const [activeTab, setActiveTab] = useState('editor');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const quillRef = useRef<ReactQuill>(null);

  // Configuración del editor Quill
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      ['clean']
    ],
  };

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent',
    'color', 'background', 'align',
    'blockquote', 'code-block',
    'link', 'image'
  ];

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      onChange(template.content);
      setSelectedTemplate(templateId);
      toast(`Plantilla "${template.name}" aplicada`);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(content);
      toast("Documento guardado correctamente");
    }
  };

  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF(content);
      toast("Exportando a PDF...");
    }
  };

  const handlePreview = () => {
    setIsPreviewMode(!isPreviewMode);
    if (onPreview) {
      onPreview(content);
    }
  };

  const insertPlaceholder = (type: 'image' | 'chart' | 'table') => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const placeholders = {
      image: '<div style="border: 2px dashed #e2e8f0; padding: 20px; text-align: center; margin: 10px 0; background: #f8fafc;"><p style="color: #64748b; font-style: italic;">📷 Insertar imagen aquí</p></div>',
      chart: '<div style="border: 2px dashed #e2e8f0; padding: 20px; text-align: center; margin: 10px 0; background: #f8fafc;"><p style="color: #64748b; font-style: italic;">📊 Insertar gráfico aquí</p></div>',
      table: '<table style="width: 100%; border-collapse: collapse; margin: 10px 0;"><tr><th style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;">Columna 1</th><th style="border: 1px solid #e2e8f0; padding: 8px; background: #f8fafc;">Columna 2</th></tr><tr><td style="border: 1px solid #e2e8f0; padding: 8px;">Dato 1</td><td style="border: 1px solid #e2e8f0; padding: 8px;">Dato 2</td></tr></table>'
    };

    const range = editor.getSelection();
    if (range) {
      editor.clipboard.dangerouslyPasteHTML(range.index, placeholders[type]);
    }
  };

  return (
    <Card className={`bg-background shadow-lg ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              className="flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              {isPreviewMode ? 'Editar' : 'Vista previa'}
            </Button>
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="flex items-center gap-1"
              >
                <Save className="w-4 h-4" />
                Guardar
              </Button>
            )}
            {onExportPDF && (
              <Button
                variant="default"
                size="sm"
                onClick={handleExportPDF}
                className="flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="templates">Plantillas</TabsTrigger>
            <TabsTrigger value="tools">Herramientas</TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="space-y-4">
            {isPreviewMode ? (
              <div className="min-h-96 p-4 border rounded-lg bg-background">
                <div 
                  dangerouslySetInnerHTML={{ __html: content }}
                  className="prose prose-sm max-w-none"
                />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={content}
                  onChange={onChange}
                  modules={modules}
                  formats={formats}
                  style={{ minHeight: '400px' }}
                  placeholder="Comience a escribir su documento aquí..."
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Plantillas Disponibles</h3>
              {templates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.filter(t => t.type === documentType).map((template) => (
                    <Card 
                      key={template.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{template.name}</h4>
                            <Badge variant="secondary" className="mt-1">
                              {template.type}
                            </Badge>
                          </div>
                          <FileText className="w-8 h-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay plantillas disponibles para este tipo de documento</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Herramientas de Inserción</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  onClick={() => insertPlaceholder('image')}
                  className="flex items-center gap-2 h-auto p-4"
                >
                  <Image className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-medium">Placeholder Imagen</div>
                    <div className="text-xs text-muted-foreground">Reservar espacio para imagen</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => insertPlaceholder('chart')}
                  className="flex items-center gap-2 h-auto p-4"
                >
                  <Grid className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-medium">Placeholder Gráfico</div>
                    <div className="text-xs text-muted-foreground">Reservar espacio para gráfico</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => insertPlaceholder('table')}
                  className="flex items-center gap-2 h-auto p-4"
                >
                  <Palette className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-medium">Tabla Base</div>
                    <div className="text-xs text-muted-foreground">Insertar tabla básica</div>
                  </div>
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};