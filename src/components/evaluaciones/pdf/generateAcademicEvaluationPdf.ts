/**
 * Generates an academic (text-based) PDF from a V2 evaluation spec.
 * Returns a Blob for download. Filename: Evaluacion_{subject}_{group}_{date}.pdf
 */

import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { AcademicEvaluationDocument } from './AcademicEvaluationDocument';
import type { NormalizedEvaluation, EvaluationSpecV2, EvaluationMetaV2 } from '@/services/evaluations/v2Types';

export interface GenerateAcademicPdfOptions {
  /** Normalized evaluation (from normalizeV2Response) */
  evaluation: NormalizedEvaluation;
  /** Raw spec meta (subject, groupName, etc.); falls back to evaluation fields if omitted */
  meta?: EvaluationMetaV2 | null;
  /** Teacher display name; fallback "Docente" if not provided */
  teacherName?: string | null;
  /** Optional platform/school title in header */
  platformTitle?: string | null;
  /** If true, append _<timestamp> to filename so each export has a unique file (avoids opening a cached/old PDF). */
  devUniqueFilename?: boolean;
}

/**
 * Build a deterministic filename: Evaluacion_{subject}_{group}_{date}.pdf
 * Date is today (YYYY-MM-DD) or derived from spec generatedAt if available.
 */
export function getAcademicPdfFilename(options: {
  evaluation: NormalizedEvaluation;
  meta?: EvaluationMetaV2 | null;
  devUniqueFilename?: boolean;
}): string {
  const subject = (options.meta?.subject ?? options.evaluation.subject ?? 'Evaluacion')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);
  const group = (options.meta?.groupName ?? options.evaluation.groupName ?? 'grupo')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '_')
    .slice(0, 30);
  let date = new Date().toISOString().slice(0, 10);
  const generatedAt = options.evaluation.generatedAt;
  if (generatedAt) {
    try {
      const d = new Date(generatedAt);
      if (!Number.isNaN(d.getTime())) date = d.toISOString().slice(0, 10);
    } catch {
      // keep today
    }
  }
  const base = `Evaluacion_${subject}_${group}_${date}.pdf`;
  if (options.devUniqueFilename) {
    return base.replace(/\.pdf$/, `_${Date.now()}.pdf`);
  }
  return base;
}

/**
 * Generate PDF blob for the given evaluation. Use with URL.createObjectURL(blob) and
 * <a download={filename} href={url}> for download.
 */
export async function generateAcademicEvaluationPdf(
  options: GenerateAcademicPdfOptions
): Promise<Blob> {
  const { evaluation, meta, teacherName, platformTitle } = options;
  const blob = await pdf(
    React.createElement(AcademicEvaluationDocument, {
      evaluation,
      meta: meta ?? null,
      teacherName: teacherName ?? null,
      platformTitle: platformTitle ?? null,
    })
  ).toBlob();
  return blob;
}

/**
 * Convenience: generate PDF from raw V2 spec (e.g. from API or DB).
 * Normalizes the spec and then generates the PDF. Requires normalizeV2Response.
 */
export async function generateAcademicEvaluationPdfFromSpec(
  spec: EvaluationSpecV2,
  options: {
    teacherName?: string | null;
    platformTitle?: string | null;
    /** Version to use for content (A, B, C). Default 'A'. */
    version?: 'A' | 'B' | 'C';
  } = {}
): Promise<{ blob: Blob; filename: string }> {
  const { normalizeV2Response } = await import('@/services/evaluations/v2Normalizer');
  const version = options.version ?? 'A';
  const v2Response = {
    success: true,
    evaluationSpec: spec,
    requestedVersions: { A: true, B: false, C: false },
    teacherReminders: [],
    warnings: [],
  };
  const result = normalizeV2Response(v2Response, version);
  if (!result.success || !result.evaluation) {
    throw new Error('No se pudo normalizar la evaluación para el PDF: ' + (result.errors?.join('; ') || 'datos inválidos'));
  }
  const blob = await generateAcademicEvaluationPdf({
    evaluation: result.evaluation,
    meta: spec.meta,
    teacherName: options.teacherName,
    platformTitle: options.platformTitle,
  });
  const filename = getAcademicPdfFilename({ evaluation: result.evaluation, meta: spec.meta });
  return { blob, filename };
}
