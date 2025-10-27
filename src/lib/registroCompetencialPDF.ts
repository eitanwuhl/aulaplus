import jsPDF from 'jspdf';

interface PDFData {
  docente: string;
  grupo: string;
  materia: string;
  fechaInicio: string;
  fechaFin: string;
  competenciasTrabajadas: Array<{
    competencia: string;
    porcentaje: number;
    contenidos: string[];
  }>;
  competenciasPendientes: Array<{
    id: string;
    nombre: string;
    descripcion: string;
  }>;
  resumenGrupo?: string;
}

export const generateRegistroCompetencialPDF = async (data: PDFData): Promise<Blob> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let y = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REGISTRO COMPETENCIAL DOCENTE', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Administración Nacional de Educación Pública (ANEP)', pageWidth / 2, y, { align: 'center' });
  y += 20;

  // Información del docente
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL DOCENTE', margin, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.text(`Docente: ${data.docente}`, margin, y);
  y += 6;
  doc.text(`Grupo: ${data.grupo}`, margin, y);
  y += 6;
  doc.text(`Materia: ${data.materia}`, margin, y);
  y += 6;
  doc.text(`Período: ${data.fechaInicio} - ${data.fechaFin}`, margin, y);
  y += 6;

  if (data.resumenGrupo) {
    doc.text(`Características del grupo: ${data.resumenGrupo}`, margin, y);
    y += 6;
  } else {
    doc.text('Características del grupo: Sin registrar', margin, y);
    y += 6;
  }
  y += 10;

  // Competencias trabajadas
  doc.setFont('helvetica', 'bold');
  doc.text('COMPETENCIAS DESARROLLADAS EN EL PERÍODO', margin, y);
  y += 8;

  if (data.competenciasTrabajadas.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('No se registraron competencias trabajadas en este período.', margin, y);
    y += 10;
  } else {
    doc.setFont('helvetica', 'normal');
    data.competenciasTrabajadas.forEach((comp, index) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${comp.competencia} (${comp.porcentaje}%)`, margin, y);
      y += 6;
      
      if (comp.contenidos && comp.contenidos.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.text('   Contenidos asociados:', margin, y);
        y += 4;
        comp.contenidos.forEach(contenido => {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          const wrapped = doc.splitTextToSize(`   • ${contenido}`, pageWidth - margin * 2);
          doc.text(wrapped, margin, y);
          y += wrapped.length * 4;
        });
      }
      y += 6;
    });
  }

  y += 10;

  // Competencias pendientes
  if (y > 200) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('COMPETENCIAS PENDIENTES DE DESARROLLAR', margin, y);
  y += 8;

  if (data.competenciasPendientes.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Todas las competencias objetivo del período han sido trabajadas.', margin, y);
    y += 10;
  } else {
    doc.setFont('helvetica', 'normal');
    data.competenciasPendientes.forEach((comp, index) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(`${index + 1}. ${comp.nombre}`, margin, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(`   ${comp.descripcion}`, pageWidth - margin * 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4 + 6;
    });
  }

  // Footer
  y += 20;
  if (y > 250) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(`Documento generado el ${new Date().toLocaleDateString('es-UY')}`, margin, y);
  y += 4;
  doc.text('Este registro es de uso exclusivo para fines pedagógicos y de seguimiento curricular.', margin, y);

  return doc.output('blob');
};