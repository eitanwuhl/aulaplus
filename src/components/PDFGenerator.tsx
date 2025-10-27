import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface PDFGeneratorProps {
  elementId: string;
  fileName: string;
  onComplete?: () => void;
}

interface ReportData {
  student: any;
  chartData?: any[];
  includeCharts?: boolean;
}

export const PDFGenerator = {
  // Generate PDF from HTML element
  generateFromElement: async (elementId: string, fileName: string, onComplete?: () => void) => {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        console.error('Element not found');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${fileName}.pdf`);
      onComplete?.();
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  },

  // Generate enhanced PDF with charts
  generateEnhancedReport: async (reportData: ReportData, fileName: string) => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      let currentY = 20;

      // Header
      pdf.setFontSize(20);
      pdf.setTextColor(22, 78, 137);
      pdf.text('REPORTE EJECUTIVO ESTUDIANTIL', 20, currentY);
      
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Reunión con Padres/Tutores', 20, currentY + 8);
      
      // Date and info
      pdf.setFontSize(10);
      pdf.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 150, currentY);
      pdf.text(`Estudiante: ${reportData.student.name}`, 150, currentY + 5);
      
      currentY += 25;

      // Line separator
      pdf.setDrawColor(22, 78, 137);
      pdf.setLineWidth(0.5);
      pdf.line(20, currentY, 190, currentY);
      currentY += 10;

      // Student basic data
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('DATOS DEL ESTUDIANTE', 20, currentY);
      currentY += 8;

      pdf.setFontSize(10);
      pdf.text(`Nombre: ${reportData.student.name}`, 20, currentY);
      pdf.text(`Perfil: ${reportData.student.perfil}`, 20, currentY + 5);
      pdf.text(`Contemplaciones: ${reportData.student.contemplaciones?.length || 0}`, 20, currentY + 10);
      
      currentY += 20;

      // If including charts, we would need to convert them to images first
      if (reportData.includeCharts && reportData.chartData) {
        pdf.setFontSize(14);
        pdf.text('RENDIMIENTO ACADÉMICO', 20, currentY);
        currentY += 15;
        
        // Here we would add chart images converted from canvas
        // This is a simplified version - in production, you'd render charts to canvas first
      }

      // Save the PDF
      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error('Error generating enhanced PDF:', error);
    }
  },

  // Bulk export for multiple students
  generateBulkReports: async (students: any[], onProgress?: (progress: number) => void) => {
    try {
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        await PDFGenerator.generateEnhancedReport(
          { student },
          `reporte_${student.name.replace(/\s+/g, '_')}`
        );
        
        onProgress?.((i + 1) / students.length * 100);
        
        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error in bulk export:', error);
    }
  }
};

// Chart to image converter utility
export const chartToImage = async (chartRef: any): Promise<string> => {
  try {
    if (chartRef?.current) {
      const canvas = await html2canvas(chartRef.current);
      return canvas.toDataURL('image/png');
    }
    return '';
  } catch (error) {
    console.error('Error converting chart to image:', error);
    return '';
  }
};

export default PDFGenerator;