import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeft, Send, MessageSquare, Phone, Mail, Paperclip, Download } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToStorage, createCommunicationMessage } from '@/lib/storage';

interface Communication {
  id: string;
  user_id: string;
  to_role: 'direccion' | 'psicopedagogico';
  subject: string;
  message: string;
  attachment_urls: string[];
  status: string;
  created_at: string;
}

const Comunicaciones = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeType, setActiveType] = useState<'direccion' | 'psicopedagogico'>('direccion');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar comunicaciones existentes
  useEffect(() => {
    const loadCommunications = async () => {
      try {
        const { data, error } = await supabase
          .from('comunicaciones')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setCommunications((data || []) as Communication[]);
      } catch (error) {
        console.error('Error loading communications:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCommunications();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const handleSendMessage = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "El asunto y mensaje son obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Subir archivos adjuntos si existen
      const attachmentUrls: string[] = [];
      for (const file of attachments) {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${user.id}/${fileName}`;
        const url = await uploadFileToStorage('comunicaciones', filePath, file, file.type);
        attachmentUrls.push(url);
      }

      // Crear mensaje
      await createCommunicationMessage(
        activeType,
        subject.trim(),
        message.trim(),
        attachmentUrls
      );

      // Recargar comunicaciones
      const { data } = await supabase
        .from('comunicaciones')
        .select('*')
        .order('created_at', { ascending: false });
      
      setCommunications((data || []) as Communication[]);
      
      // Limpiar formulario
      setSubject('');
      setMessage('');
      setAttachments([]);

      toast({
        title: "Mensaje enviado",
        description: "Tu comunicación ha sido enviada correctamente"
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      });
    }
  };

  const getContactInfo = (type: 'direccion' | 'psicopedagogico') => {
    return type === 'direccion' 
      ? { name: 'Directora - Lic. Ana Martínez', phone: '(011) 4567-8910', email: 'direccion@escuela.edu.ar' }
      : { name: 'Equipo Psicopedagógico', phone: '(011) 4567-8911', email: 'psicopedagogia@escuela.edu.ar' };
  };

  const filteredCommunications = communications.filter(comm => comm.to_role === activeType);
  const contactInfo = getContactInfo(activeType);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">Comunicaciones</h1>
          <p className="text-gray-600 mt-2">Contacta directamente con el equipo directivo y psicopedagógico</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Selection Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contactar con:</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant={activeType === 'direccion' ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setActiveType('direccion')}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Dirección
                </Button>
                <Button
                  variant={activeType === 'psicopedagogico' ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setActiveType('psicopedagogico')}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Equipo Psicopedagógico
                </Button>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Información de contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4" />
                  {contactInfo.phone}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4" />
                  {contactInfo.email}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Communication Form and History */}
          <div className="lg:col-span-2 space-y-6">
            {/* New Message Form */}
            <Card>
              <CardHeader>
                <CardTitle>Nuevo mensaje para {contactInfo.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subject">Asunto</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Escribe el asunto del mensaje"
                  />
                </div>
                <div>
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe tu mensaje aquí..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="attachments">Archivos adjuntos</Label>
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {attachments.length > 0 && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {attachments.length} archivo(s) seleccionado(s)
                    </div>
                  )}
                </div>
                <Button onClick={handleSendMessage} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Enviar mensaje
                </Button>
              </CardContent>
            </Card>

            {/* Message History */}
            <Card>
              <CardHeader>
                <CardTitle>Historial de comunicaciones</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredCommunications.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay comunicaciones previas con {activeType === 'direccion' ? 'Dirección' : 'Equipo Psicopedagógico'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {filteredCommunications.map((comm) => (
                      <div key={comm.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-semibold">{comm.subject}</h4>
                          <Badge variant="outline">{comm.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{comm.message}</p>
                        {comm.attachment_urls && comm.attachment_urls.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {comm.attachment_urls.map((url, index) => (
                              <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(url, '_blank')}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Adjunto {index + 1}
                              </Button>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(comm.created_at).toLocaleString('es-UY')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Comunicaciones;