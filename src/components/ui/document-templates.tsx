import React from 'react';

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'evaluation' | 'planning' | 'report';
  content: string;
  description?: string;
  thumbnail?: string;
}

export const documentTemplates: DocumentTemplate[] = [
  // Plantillas para Evaluaciones
  {
    id: 'eval-standard',
    name: 'Evaluación Estándar',
    type: 'evaluation',
    description: 'Plantilla base para evaluaciones tradicionales',
    content: `
<div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
  <header style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px;">
    <h1 style="color: #2563eb; margin: 0; font-size: 24px;">EVALUACIÓN - [MATERIA]</h1>
    <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <p style="margin: 5px 0; color: #64748b;"><strong>Estudiante:</strong> ____________________</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Fecha:</strong> ____________________</p>
      </div>
      <div>
        <p style="margin: 5px 0; color: #64748b;"><strong>Curso:</strong> ____________________</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Tiempo:</strong> 80 minutos</p>
      </div>
    </div>
  </header>

  <section style="margin-bottom: 25px;">
    <h2 style="color: #1e40af; border-left: 4px solid #3b82f6; padding-left: 10px;">Instrucciones Generales</h2>
    <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 10px 0;">
      <ul style="margin: 0; padding-left: 20px; color: #475569;">
        <li>Lee cuidadosamente cada pregunta antes de responder</li>
        <li>Responde con claridad y orden</li>
        <li>Utiliza ejemplos cuando sea necesario</li>
        <li>Revisa tus respuestas antes de entregar</li>
      </ul>
    </div>
  </section>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #1e40af; font-size: 18px;">1. Pregunta Conceptual (25 puntos)</h3>
    <div style="background: #fafafa; padding: 15px; border-left: 3px solid #06b6d4; margin: 10px 0;">
      <p style="margin: 0; color: #374151;"><strong>Explica los conceptos principales sobre [TEMA]. Utiliza ejemplos concretos en tu respuesta.</strong></p>
    </div>
    <div style="margin: 15px 0;">
      📷 <em style="color: #64748b;">Insertar imagen de apoyo aquí</em>
    </div>
    <div style="border: 1px solid #e2e8f0; min-height: 120px; padding: 10px; margin: 10px 0;">
      <p style="color: #94a3b8; font-style: italic;">Espacio para respuesta...</p>
    </div>
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #1e40af; font-size: 18px;">2. Ejercicio Práctico (35 puntos)</h3>
    <div style="background: #fafafa; padding: 15px; border-left: 3px solid #10b981; margin: 10px 0;">
      <p style="margin: 0; color: #374151;"><strong>Resuelve el siguiente problema aplicando los conceptos estudiados:</strong></p>
    </div>
    <div style="border: 1px solid #e2e8f0; min-height: 150px; padding: 10px; margin: 10px 0;">
      <p style="color: #94a3b8; font-style: italic;">Espacio para desarrollo...</p>
    </div>
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #1e40af; font-size: 18px;">3. Análisis y Reflexión (25 puntos)</h3>
    <div style="background: #fafafa; padding: 15px; border-left: 3px solid #f59e0b; margin: 10px 0;">
      <p style="margin: 0; color: #374151;"><strong>Analiza la siguiente situación y propone soluciones:</strong></p>
    </div>
    <div style="border: 1px solid #e2e8f0; min-height: 120px; padding: 10px; margin: 10px 0;">
      <p style="color: #94a3b8; font-style: italic;">Espacio para análisis...</p>
    </div>
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #1e40af; font-size: 18px;">4. Integración de Conocimientos (15 puntos)</h3>
    <div style="background: #fafafa; padding: 15px; border-left: 3px solid #8b5cf6; margin: 10px 0;">
      <p style="margin: 0; color: #374151;"><strong>Relaciona los contenidos estudiados con situaciones de la vida real:</strong></p>
    </div>
    <div style="border: 1px solid #e2e8f0; min-height: 100px; padding: 10px; margin: 10px 0;">
      <p style="color: #94a3b8; font-style: italic;">Espacio para respuesta...</p>
    </div>
  </div>

  <footer style="margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px;">
    <p style="color: #64748b; font-size: 14px; margin: 0;">¡Éxito en tu evaluación!</p>
  </footer>
</div>
    `
  },
  
  {
    id: 'eval-adapted',
    name: 'Evaluación Adaptada',
    type: 'evaluation',
    description: 'Plantilla para evaluaciones con adaptaciones pedagógicas',
    content: `
<div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
  <header style="text-align: center; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 25px;">
    <h1 style="color: #059669; margin: 0; font-size: 24px;">EVALUACIÓN ADAPTADA - [MATERIA]</h1>
    <div style="background: #d1fae5; padding: 10px; border-radius: 8px; margin: 10px 0;">
      <p style="margin: 0; color: #065f46; font-weight: 500;">✓ Evaluación con adaptaciones pedagógicas</p>
    </div>
    <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <p style="margin: 5px 0; color: #64748b;"><strong>Estudiante:</strong> ____________________</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Fecha:</strong> ____________________</p>
      </div>
      <div>
        <p style="margin: 5px 0; color: #64748b;"><strong>Tiempo:</strong> Flexible</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Apoyo:</strong> Disponible</p>
      </div>
    </div>
  </header>

  <section style="margin-bottom: 25px;">
    <h2 style="color: #047857; border-left: 4px solid #10b981; padding-left: 10px;">Adaptaciones Incluidas</h2>
    <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 10px 0;">
      <ul style="margin: 0; padding-left: 20px; color: #065f46;">
        <li>🕒 Tiempo extendido disponible</li>
        <li>📖 Lectura de enunciados si lo necesitas</li>
        <li>🎯 Instrucciones paso a paso</li>
        <li>📝 Puedes usar apuntes como apoyo</li>
        <li>👥 Apoyo docente disponible</li>
      </ul>
    </div>
  </section>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #047857; font-size: 18px;">1. Actividad Visual y Conceptual (30 puntos)</h3>
    <div style="background: #f0fdf4; padding: 15px; border-left: 3px solid #22c55e; margin: 10px 0;">
      <p style="margin: 0; color: #374151;"><strong>Observa la imagen y responde las preguntas guiadas:</strong></p>
    </div>
    <div style="border: 2px dashed #a7f3d0; padding: 20px; text-align: center; margin: 15px 0; background: #f0fdf4;">
      <p style="color: #059669; font-style: italic; margin: 0;">📷 Insertar imagen de apoyo aquí</p>
    </div>
    <div style="background: #fafafa; padding: 15px; border-radius: 8px; margin: 10px 0;">
      <p style="margin: 5px 0; color: #374151;"><strong>a)</strong> ¿Qué observas en la imagen?</p>
      <div style="border: 1px solid #e2e8f0; min-height: 60px; padding: 10px; margin: 5px 0; background: white;">
        <p style="color: #94a3b8; font-style: italic;">Tu respuesta...</p>
      </div>
      
      <p style="margin: 5px 0; color: #374151;"><strong>b)</strong> ¿Cómo se relaciona con lo que estudiamos?</p>
      <div style="border: 1px solid #e2e8f0; min-height: 60px; padding: 10px; margin: 5px 0; background: white;">
        <p style="color: #94a3b8; font-style: italic;">Tu respuesta...</p>
      </div>
    </div>
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #047857; font-size: 18px;">2. Ejercicio Guiado (40 puntos)</h3>
    <div style="background: #f0fdf4; padding: 15px; border-left: 3px solid #22c55e; margin: 10px 0;">
      <p style="margin: 0; color: #374151;"><strong>Sigue estos pasos para resolver el ejercicio:</strong></p>
    </div>
    <div style="background: #fafafa; padding: 15px; border-radius: 8px; margin: 10px 0;">
      <div style="margin-bottom: 15px;">
        <p style="margin: 0; color: #374151; font-weight: 500;">Paso 1: Identifica los datos</p>
        <div style="border: 1px solid #e2e8f0; min-height: 50px; padding: 10px; margin: 10px 0; background: white;">
          <p style="color: #94a3b8; font-style: italic;">Escribe aquí los datos que encuentres...</p>
        </div>
      </div>
      <div style="margin-bottom: 15px;">
        <p style="margin: 0; color: #374151; font-weight: 500;">Paso 2: Aplica la fórmula o proceso</p>
        <div style="border: 1px solid #e2e8f0; min-height: 50px; padding: 10px; margin: 10px 0; background: white;">
          <p style="color: #94a3b8; font-style: italic;">Desarrolla el proceso paso a paso...</p>
        </div>
      </div>
      <div style="margin-bottom: 15px;">
        <p style="margin: 0; color: #374151; font-weight: 500;">Paso 3: Llega a la respuesta</p>
        <div style="border: 1px solid #e2e8f0; min-height: 50px; padding: 10px; margin: 10px 0; background: white;">
          <p style="color: #94a3b8; font-style: italic;">Tu respuesta final...</p>
        </div>
      </div>
    </div>
  </div>

  <div style="margin-bottom: 30px;">
    <h3 style="color: #047857; font-size: 18px;">3. Reflexión Personal (30 puntos)</h3>
    <div style="background: #f0fdf4; padding: 15px; border-left: 3px solid #22c55e; margin: 10px 0;">
      <p style="margin: 0; color: #374151;"><strong>Responde con tus propias palabras:</strong></p>
    </div>
    <div style="background: #fafafa; padding: 15px; border-radius: 8px; margin: 10px 0;">
      <p style="margin: 5px 0; color: #374151;">¿Qué fue lo que más te gustó de este tema?</p>
      <div style="border: 1px solid #e2e8f0; min-height: 60px; padding: 10px; margin: 5px 0; background: white;">
        <p style="color: #94a3b8; font-style: italic;">Cuenta tu experiencia...</p>
      </div>
      
      <p style="margin: 5px 0; color: #374151;">¿Dónde podrías usar esto en tu vida diaria?</p>
      <div style="border: 1px solid #e2e8f0; min-height: 60px; padding: 10px; margin: 5px 0; background: white;">
        <p style="color: #94a3b8; font-style: italic;">Comparte tus ideas...</p>
      </div>
    </div>
  </div>

  <footer style="margin-top: 40px; text-align: center; border-top: 1px solid #d1fae5; padding-top: 15px; background: #f0fdf4;">
    <p style="color: #047857; font-size: 16px; margin: 0; font-weight: 500;">¡Tómate tu tiempo y da lo mejor de ti!</p>
    <p style="color: #065f46; font-size: 14px; margin: 5px 0;">Recuerda: puedes pedir ayuda cuando lo necesites</p>
  </footer>
</div>
    `
  },

  // Plantillas para Planificación
  {
    id: 'plan-standard',
    name: 'Planificación Estándar',
    type: 'planning',
    description: 'Plantilla base para planificación de clases',
    content: `
<div style="max-width: 900px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
  <header style="text-align: center; border-bottom: 3px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #7c3aed; margin: 0; font-size: 28px;">PLANIFICACIÓN DE CLASE</h1>
    <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left;">
      <div>
        <p style="margin: 5px 0; color: #64748b;"><strong>Materia:</strong> ____________________</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Contenido:</strong> ____________________</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Grupo:</strong> ____________________</p>
      </div>
      <div>
        <p style="margin: 5px 0; color: #64748b;"><strong>Fecha:</strong> ____________________</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Duración:</strong> 80 minutos</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Docente:</strong> ____________________</p>
      </div>
    </div>
  </header>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #6d28d9; border-left: 4px solid #8b5cf6; padding-left: 15px; font-size: 20px;">📋 Objetivo de la Clase</h2>
    <div style="background: #faf5ff; padding: 20px; border-radius: 10px; margin: 15px 0; border: 1px solid #e9d5ff;">
      <p style="margin: 0; color: #581c87; font-size: 16px; line-height: 1.6;">
        <strong>Objetivo General:</strong> [Describir qué se espera que los estudiantes logren al finalizar la clase]
      </p>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #6d28d9; border-left: 4px solid #8b5cf6; padding-left: 15px; font-size: 20px;">🚀 APERTURA (15 minutos)</h2>
    <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <h3 style="color: #1e40af; margin-top: 0;">Actividad Motivadora</h3>
      <div style="border: 1px solid #e2e8f0; min-height: 80px; padding: 15px; background: white; border-radius: 8px;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Describir la actividad inicial para captar la atención y conectar con conocimientos previos]</p>
      </div>
      
      <h4 style="color: #475569; margin: 15px 0 5px 0;">Recursos necesarios:</h4>
      <ul style="margin: 5px 0; padding-left: 20px; color: #64748b;">
        <li>Material 1</li>
        <li>Material 2</li>
      </ul>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #6d28d9; border-left: 4px solid #8b5cf6; padding-left: 15px; font-size: 20px;">⚡ DESARROLLO (45 minutos)</h2>
    
    <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <h3 style="color: #059669; margin-top: 0;">Fase 1: Presentación del Contenido (15 min)</h3>
      <div style="border: 1px solid #e2e8f0; min-height: 100px; padding: 15px; background: white; border-radius: 8px; margin: 10px 0;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Estrategias para presentar el nuevo contenido]</p>
      </div>
      
      <div style="margin: 15px 0;">
        📊 <em style="color: #64748b;">Insertar gráfico o diagrama explicativo aquí</em>
      </div>
    </div>

    <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <h3 style="color: #dc2626; margin-top: 0;">Fase 2: Práctica Guiada (15 min)</h3>
      <div style="border: 1px solid #e2e8f0; min-height: 100px; padding: 15px; background: white; border-radius: 8px; margin: 10px 0;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Actividades de práctica con acompañamiento docente]</p>
      </div>
    </div>

    <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <h3 style="color: #ea580c; margin-top: 0;">Fase 3: Trabajo Colaborativo (15 min)</h3>
      <div style="border: 1px solid #e2e8f0; min-height: 100px; padding: 15px; background: white; border-radius: 8px; margin: 10px 0;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Actividades grupales o individuales para consolidar el aprendizaje]</p>
      </div>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #6d28d9; border-left: 4px solid #8b5cf6; padding-left: 15px; font-size: 20px;">🎯 CIERRE (20 minutos)</h2>
    <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <h3 style="color: #92400e; margin-top: 0;">Síntesis y Evaluación</h3>
      <div style="border: 1px solid #e2e8f0; min-height: 80px; padding: 15px; background: white; border-radius: 8px;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Actividades para consolidar aprendizajes y verificar comprensión]</p>
      </div>
      
      <h4 style="color: #92400e; margin: 15px 0 5px 0;">Estrategias de evaluación:</h4>
      <ul style="margin: 5px 0; padding-left: 20px; color: #a16207;">
        <li>Preguntas de verificación</li>
        <li>Actividad de síntesis</li>
        <li>Reflexión personal</li>
      </ul>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #6d28d9; border-left: 4px solid #8b5cf6; padding-left: 15px; font-size: 20px;">🎨 ADAPTACIONES PEDAGÓGICAS</h2>
    <div style="background: #ecfdf5; padding: 20px; border-radius: 10px; margin: 15px 0; border: 1px solid #a7f3d0;">
      <div style="border: 1px solid #e2e8f0; min-height: 100px; padding: 15px; background: white; border-radius: 8px;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Describir adaptaciones específicas para estudiantes con necesidades particulares]</p>
      </div>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #6d28d9; border-left: 4px solid #8b5cf6; padding-left: 15px; font-size: 20px;">📚 RECURSOS Y MATERIALES</h2>
    <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h4 style="color: #1e40af; margin: 0 0 10px 0;">Recursos Didácticos:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #475569;">
            <li>Recurso 1</li>
            <li>Recurso 2</li>
            <li>Recurso 3</li>
          </ul>
        </div>
        <div>
          <h4 style="color: #1e40af; margin: 0 0 10px 0;">Materiales:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #475569;">
            <li>Material 1</li>
            <li>Material 2</li>
            <li>Material 3</li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <footer style="margin-top: 40px; text-align: center; border-top: 2px solid #e9d5ff; padding-top: 20px; background: #faf5ff;">
    <p style="color: #6d28d9; font-size: 16px; margin: 0; font-weight: 500;">Planificación Lista para Implementar</p>
    <p style="color: #7c3aed; font-size: 14px; margin: 5px 0;">Recuerda adaptar según las necesidades del grupo</p>
  </footer>
</div>
    `
  },

  // Plantilla para Reportes
  {
    id: 'report-executive',
    name: 'Reporte Ejecutivo',
    type: 'report',
    description: 'Plantilla para reportes estudiantiles profesionales',
    content: `
<div style="max-width: 800px; margin: 0 auto; padding: 30px; font-family: Arial, sans-serif; background: white;">
  <header style="text-align: center; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #dc2626; margin: 0; font-size: 28px; letter-spacing: 1px;">REPORTE EJECUTIVO ESTUDIANTIL</h1>
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0; color: #991b1b; font-weight: 500;">Reunión con Padres/Tutores</p>
    </div>
    <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left;">
      <div>
        <p style="margin: 5px 0; color: #64748b;"><strong>Estudiante:</strong> ____________________</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Curso:</strong> ____________________</p>
      </div>
      <div>
        <p style="margin: 5px 0; color: #64748b;"><strong>Fecha:</strong> ____________________</p>
        <p style="margin: 5px 0; color: #64748b;"><strong>Periodo:</strong> ____________________</p>
      </div>
    </div>
  </header>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #b91c1c; border-left: 4px solid #ef4444; padding-left: 15px; font-size: 20px;">📊 RESUMEN EJECUTIVO</h2>
    <div style="background: #fef2f2; padding: 20px; border-radius: 10px; margin: 15px 0; border: 1px solid #fecaca;">
      <div style="border: 1px solid #e2e8f0; min-height: 100px; padding: 15px; background: white; border-radius: 8px;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Síntesis general del rendimiento y desarrollo del estudiante durante el periodo]</p>
      </div>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #b91c1c; border-left: 4px solid #ef4444; padding-left: 15px; font-size: 20px;">📈 RENDIMIENTO ACADÉMICO</h2>
    <div style="background: #f9fafb; padding: 20px; border-radius: 10px; margin: 15px 0;">
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #1f2937; margin: 0 0 10px 0;">Evolución por Materia</h3>
        <div style="border: 2px dashed #d1d5db; padding: 20px; text-align: center; margin: 15px 0; background: #f9fafb;">
          <p style="color: #6b7280; font-style: italic; margin: 0;">📊 Insertar gráfico de evolución académica aquí</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px;">
          <h4 style="color: #0369a1; margin: 0 0 10px 0;">🏆 Fortalezas Destacadas</h4>
          <div style="border: 1px solid #e2e8f0; min-height: 80px; padding: 10px; background: white; border-radius: 6px;">
            <p style="color: #64748b; font-style: italic; margin: 0;">[Áreas donde el estudiante demuestra excelencia]</p>
          </div>
        </div>
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px;">
          <h4 style="color: #92400e; margin: 0 0 10px 0;">🎯 Áreas de Mejora</h4>
          <div style="border: 1px solid #e2e8f0; min-height: 80px; padding: 10px; background: white; border-radius: 6px;">
            <p style="color: #64748b; font-style: italic; margin: 0;">[Aspectos que requieren atención y trabajo]</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #b91c1c; border-left: 4px solid #ef4444; padding-left: 15px; font-size: 20px;">👥 DESARROLLO SOCIOEMOCIONAL</h2>
    <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h4 style="color: #065f46; margin: 0 0 10px 0;">Habilidades Sociales</h4>
          <div style="border: 1px solid #e2e8f0; min-height: 80px; padding: 10px; background: white; border-radius: 6px;">
            <p style="color: #64748b; font-style: italic; margin: 0;">[Interacción con pares, trabajo en equipo, comunicación]</p>
          </div>
        </div>
        <div>
          <h4 style="color: #065f46; margin: 0 0 10px 0;">Autonomía y Responsabilidad</h4>
          <div style="border: 1px solid #e2e8f0; min-height: 80px; padding: 10px; background: white; border-radius: 6px;">
            <p style="color: #64748b; font-style: italic; margin: 0;">[Nivel de independencia, cumplimiento de tareas, organización]</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #b91c1c; border-left: 4px solid #ef4444; padding-left: 15px; font-size: 20px;">🎯 ADAPTACIONES Y APOYOS</h2>
    <div style="background: #f5f3ff; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <div style="border: 1px solid #e2e8f0; min-height: 100px; padding: 15px; background: white; border-radius: 8px;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Contemplaciones aplicadas, efectividad de las adaptaciones, necesidades futuras]</p>
      </div>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #b91c1c; border-left: 4px solid #ef4444; padding-left: 15px; font-size: 20px;">💡 RECOMENDACIONES</h2>
    <div style="background: #fffbeb; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h4 style="color: #92400e; margin: 0 0 10px 0;">Para la Escuela</h4>
          <div style="border: 1px solid #e2e8f0; min-height: 80px; padding: 10px; background: white; border-radius: 6px;">
            <p style="color: #64748b; font-style: italic; margin: 0;">[Estrategias y enfoques pedagógicos recomendados]</p>
          </div>
        </div>
        <div>
          <h4 style="color: #92400e; margin: 0 0 10px 0;">Para el Hogar</h4>
          <div style="border: 1px solid #e2e8f0; min-height: 80px; padding: 10px; background: white; border-radius: 6px;">
            <p style="color: #64748b; font-style: italic; margin: 0;">[Sugerencias para el apoyo familiar]</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section style="margin-bottom: 30px;">
    <h2 style="color: #b91c1c; border-left: 4px solid #ef4444; padding-left: 15px; font-size: 20px;">📅 PRÓXIMOS PASOS</h2>
    <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; margin: 15px 0;">
      <div style="border: 1px solid #e2e8f0; min-height: 100px; padding: 15px; background: white; border-radius: 8px;">
        <p style="color: #64748b; font-style: italic; margin: 0;">[Objetivos a corto y mediano plazo, próximas evaluaciones, seguimientos programados]</p>
      </div>
    </div>
  </section>

  <footer style="margin-top: 40px; text-align: center; border-top: 2px solid #fecaca; padding-top: 20px; background: #fef2f2;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 20px;">
      <div>
        <p style="margin: 0; color: #991b1b; font-weight: 500;">Docente/Tutor</p>
        <div style="border-bottom: 1px solid #dc2626; margin: 10px 0; height: 40px;"></div>
        <p style="margin: 0; color: #64748b; font-size: 12px;">Firma y Fecha</p>
      </div>
      <div>
        <p style="margin: 0; color: #991b1b; font-weight: 500;">Padre/Madre/Tutor</p>
        <div style="border-bottom: 1px solid #dc2626; margin: 10px 0; height: 40px;"></div>
        <p style="margin: 0; color: #64748b; font-size: 12px;">Firma y Fecha</p>
      </div>
    </div>
    <p style="color: #dc2626; font-size: 14px; margin: 0; font-weight: 500;">Este reporte ha sido elaborado con el compromiso de acompañar el crecimiento integral del estudiante</p>
  </footer>
</div>
    `
  }
];

export const getTemplatesByType = (type: 'evaluation' | 'planning' | 'report'): DocumentTemplate[] => {
  return documentTemplates.filter(template => template.type === type);
};

export const getTemplateById = (id: string): DocumentTemplate | undefined => {
  return documentTemplates.find(template => template.id === id);
};