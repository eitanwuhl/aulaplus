/**
 * SessionMaterialsPanel
 * 
 * Simplified UI component for attaching materials at session-level
 * Used in EditorSesionNuevo within the "Recursos" tab
 * 
 * Session-level attachments are specific to this session only (do not inherit to other sessions)
 */

import React from 'react';
import { AttachMaterialsPanel } from '@/components/materials';

interface SessionMaterialsPanelProps {
  sesionId?: string;
}

export function SessionMaterialsPanel({
  sesionId
}: SessionMaterialsPanelProps) {
  // AttachMaterialsPanel already handles all the logic for session-level attachments
  // We just need to pass the correct targetType and targetId
  
  if (!sesionId) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Guarda la sesión primero para poder adjuntar materiales específicos.
        </p>
      </div>
    );
  }
  
  return (
    <AttachMaterialsPanel 
      targetType="sesion" 
      targetId={sesionId}
    />
  );
}

