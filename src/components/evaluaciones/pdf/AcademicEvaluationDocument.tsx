/**
 * Academic PDF Document — Real text-based evaluation export (not screenshot).
 * Renders EvaluationSpecV2 / NormalizedEvaluation as a printable A4 document with
 * header, body (sections/items with answer spaces), and footer.
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import type { NormalizedEvaluation, NormalizedItem, NormalizedSection } from '@/services/evaluations/v2Types';
import type { EvaluationMetaV2 } from '@/services/evaluations/v2Types';
import { getDisplayPromptWithInlineOptions } from '@/services/evaluations/responseOptionsInline';

/** Set to true temporarily to confirm the academic PDF path is used (shows "ACADEMIC_PDF_DEBUG" in header). */
const DEBUG_ACADEMIC_PDF = false;

// Use built-in Helvetica (no need to register for basic Latin)
const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  /* Header: two-column grid, fixed 50% widths, no flexGrow/space-between */
  headerBlock: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
  },
  headerColHalf: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerColFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 10,
    color: '#333',
    marginRight: 6,
  },
  headerValue: {
    fontSize: 10,
    color: '#000',
  },
  headerUnderlineWide: {
    width: 280,
    borderBottomWidth: 0.8,
    borderBottomColor: '#000',
    marginLeft: 6,
  },
  headerStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 8,
  },
  itemBlock: {
    marginBottom: 14,
  },
  itemHeaderBlock: {
    marginBottom: 0,
  },
  itemAnswerBlock: {
    marginTop: 0,
  },
  /* Single row: number + prompt (left), points (right, fixed width) — exam style */
  itemHeader: {
    flexDirection: 'row',
    marginBottom: 2,
    alignItems: 'flex-start',
  },
  itemPromptWrap: {
    flex: 1,
    minWidth: 0,
  },
  itemNumber: {
    width: 24,
    fontWeight: 'bold',
    fontSize: 11,
  },
  itemPrompt: {
    fontSize: 11,
    lineHeight: 1.4,
  },
  itemPointsCol: {
    width: 48,
    alignItems: 'flex-end',
  },
  itemPointsText: {
    fontSize: 10,
    color: '#555',
  },
  itemInstruction: {
    fontSize: 8,
    color: '#666',
    marginLeft: 24,
    marginBottom: 2,
  },
  /* Ruled lines: thin stroke, consistent spacing (real test-paper look) */
  ruledLine: {
    height: 18,
    borderBottomWidth: 0.4,
    borderBottomColor: '#888',
    marginBottom: 0,
  },
  ruledBlock: {
    marginLeft: 24,
    marginTop: 4,
  },
  ruledBlockEssay: {
    marginLeft: 24,
    marginTop: 4,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  choiceBlock: {
    marginLeft: 24,
    marginTop: 2,
  },
  /* Checkbox: square View (no Unicode circles) for reliable output */
  checkbox: {
    width: 11,
    height: 11,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
  },
  choiceText: {
    flex: 1,
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 9,
    color: '#555',
  },
  footerBrand: {
    fontSize: 8,
    color: '#999',
  },
});

export interface AcademicEvaluationDocumentProps {
  evaluation: NormalizedEvaluation;
  meta?: EvaluationMetaV2 | null;
  teacherName?: string | null;
  /** Optional platform/school title for first page header */
  platformTitle?: string | null;
}

/** Minimal instruction for student handout (no type labels). Returns null if none. */
function getItemInstruction(type: string): string | null {
  if (type === 'multiple_choice') return 'Marca una opción.';
  if (type === 'true_false') return 'Marca V o F.';
  if (type === 'true_false_justify') return 'Marca V o F y justifica.';
  return null;
}

/** Open-ended types whose answer area (ruled lines / writing block) may flow to the next page */
function isOpenEndedItemType(type: string): boolean {
  return (
    type === 'essay' ||
    type === 'paragraph' ||
    type === 'source_analysis' ||
    type === 'short_answer' ||
    type === 'true_false_justify'
  );
}

function RuledLines({ count = 4, essay = false }: { count?: number; essay?: boolean }) {
  const blockStyle = essay ? styles.ruledBlockEssay : styles.ruledBlock;
  return (
    <View style={blockStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.ruledLine} />
      ))}
    </View>
  );
}

function AnswerSpacePDF({ item, globalIndex }: { item: NormalizedItem; globalIndex: number }) {
  const type = item.type;
  if (type === 'short_answer') {
    return <RuledLines count={5} />;
  }
  if (type === 'paragraph' || type === 'essay' || type === 'source_analysis') {
    return <RuledLines count={14} essay />;
  }
  if (type === 'multiple_choice' && item.options?.length) {
    return (
      <View style={styles.choiceBlock}>
        {item.options.map((opt) => (
          <View key={opt.id} style={styles.choiceRow}>
            <View style={styles.checkbox} />
            <Text style={styles.choiceText}>
              {opt.letter}) {opt.text}
            </Text>
          </View>
        ))}
      </View>
    );
  }
  if (type === 'true_false' || type === 'true_false_justify') {
    return (
      <View style={styles.choiceBlock}>
        <View style={styles.choiceRow}>
          <View style={styles.checkbox} />
          <Text style={styles.choiceText}>V</Text>
        </View>
        <View style={styles.choiceRow}>
          <View style={styles.checkbox} />
          <Text style={styles.choiceText}>F</Text>
        </View>
        {type === 'true_false_justify' && (
          <>
            <Text style={{ marginTop: 4, marginLeft: 0, fontSize: 10, color: '#555' }}>
              Justificación:
            </Text>
            <RuledLines count={3} />
          </>
        )}
      </View>
    );
  }
  if (type === 'matching' || type === 'ordering' || type === 'table_completion') {
    return <RuledLines count={6} />;
  }
  return <RuledLines count={4} />;
}

export function AcademicEvaluationDocument({
  evaluation,
  meta,
  teacherName,
  platformTitle,
}: AcademicEvaluationDocumentProps) {
  const subject = meta?.subject ?? evaluation.subject;
  const groupName = meta?.groupName ?? evaluation.groupName ?? '';
  const teacher = teacherName?.trim() || 'Docente';

  const sections = evaluation.sections ?? [];
  const itemsWithGlobalNumber: Array<{ section: NormalizedSection; item: NormalizedItem; globalNumber: number }> = [];
  let n = 0;
  sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      n += 1;
      itemsWithGlobalNumber.push({ section, item, globalNumber: n });
    });
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header: two-column academic form (first page only) */}
        <View style={styles.headerBlock} fixed>
          {DEBUG_ACADEMIC_PDF && (
            <Text style={{ fontSize: 8, color: '#999', marginBottom: 2 }}>ACADEMIC_PDF_DEBUG</Text>
          )}
          <View style={styles.headerRow}>
            <View style={styles.headerColHalf}>
              <Text style={styles.headerLabel}>Docente:</Text>
              <Text style={styles.headerValue}>{teacher}</Text>
            </View>
            <View style={styles.headerColHalf}>
              <Text style={styles.headerLabel}>Asignatura:</Text>
              <Text style={styles.headerValue}>{subject || '—'}</Text>
            </View>
          </View>
          <View style={styles.headerRow}>
            <View style={styles.headerColHalf}>
              <Text style={styles.headerLabel}>Grupo:</Text>
              <Text style={styles.headerValue}>{groupName || '—'}</Text>
            </View>
            <View style={styles.headerColHalf}>
              <Text style={styles.headerLabel}>Fecha:</Text>
              <Text style={styles.headerValue}>____/____/____</Text>
            </View>
          </View>
          <View style={[styles.headerRow, styles.headerStudentRow]}>
            <View style={styles.headerColFull}>
              <Text style={styles.headerLabel}>Alumno/a:</Text>
              <View style={styles.headerUnderlineWide} />
            </View>
          </View>
        </View>

        {/* Body: sections and items; natural pagination, wrap={false} so no item splits mid-content */}
        {sections.map((section) => (
          <View key={section.id}>
            <Text style={styles.sectionTitle}>
              {section.title || `Sección ${section.number}`}
            </Text>
            {(section.items || []).map((item) => {
              const row = itemsWithGlobalNumber.find(
                (r) => r.item.id === item.id && r.section.id === section.id
              );
              const num = row?.globalNumber ?? 0;
              const displayPrompt = getDisplayPromptWithInlineOptions(item.prompt, item.responseOptions);
              const answerCanFlow = isOpenEndedItemType(item.type);
              const instruction = getItemInstruction(item.type);
              return (
                <View key={item.id} style={styles.itemBlock}>
                  <View wrap={false} style={styles.itemHeaderBlock}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemNumber}>{num}.</Text>
                      <View style={styles.itemPromptWrap}>
                        <Text style={styles.itemPrompt}>{displayPrompt}</Text>
                      </View>
                      <View style={styles.itemPointsCol}>
                        <Text style={styles.itemPointsText}>
                          ({item.points} {item.points === 1 ? 'pt' : 'pts'})
                        </Text>
                      </View>
                    </View>
                    {instruction ? (
                      <Text style={styles.itemInstruction}>{instruction}</Text>
                    ) : null}
                  </View>
                  <View wrap={answerCanFlow} style={styles.itemAnswerBlock}>
                    <AnswerSpacePDF item={item} globalIndex={num} />
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* Footer: Page X de Y on every page via render callback */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerBrand}>AULA+</Text>
          <Text
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
            fixed
          />
        </View>
      </Page>
    </Document>
  );
}

export default AcademicEvaluationDocument;
