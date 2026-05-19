export const LEARNING_STYLE_LABELS = [
  'Visual',
  'Kinestésico',
  'Auditivo',
  'Lector/escritor',
] as const;

export type LearningStyleLabel = (typeof LEARNING_STYLE_LABELS)[number];

export type LearningStyleCounts = Record<LearningStyleLabel, number>;

export type LearningStyleDistribution = {
  counts: LearningStyleCounts;
  /** Students with empty or unrecognized `perfil`. */
  unclassified: number;
  totalStudents: number;
};

function emptyCounts(): LearningStyleCounts {
  return {
    Visual: 0,
    'Kinestésico': 0,
    Auditivo: 0,
    'Lector/escritor': 0,
  };
}

/** Maps a perfil token (e.g. "Visual", "Lector/escritor") to a canonical style bucket. */
export function normalizeLearningStyleToken(token: string): LearningStyleLabel | null {
  const value = token.trim().toLowerCase();
  if (!value) return null;
  if (value.includes('visual')) return 'Visual';
  if (value.includes('kinestésico') || value.includes('kinesthetic')) return 'Kinestésico';
  if (value.includes('auditivo')) return 'Auditivo';
  if (value.includes('lecto') || value.includes('lector') || value.includes('escritor')) {
    return 'Lector/escritor';
  }
  return null;
}

/**
 * Composite catalog profiles use hyphen separation (e.g. "Visual-Kinestésico").
 * Group stats assign one primary style per student so counts sum to roster size.
 */
export function primaryStyleFromPerfil(perfil: string): LearningStyleLabel | null {
  const trimmed = perfil.trim();
  if (!trimmed) return null;
  const primaryToken = trimmed.split('-')[0]?.trim() ?? '';
  return normalizeLearningStyleToken(primaryToken);
}

/** Highest count among classified styles; `mixto` when none are classified. */
export function dominantLearningStyle(counts: LearningStyleCounts): LearningStyleLabel | 'mixto' {
  let best: LearningStyleLabel | null = null;
  let bestCount = 0;

  for (const label of LEARNING_STYLE_LABELS) {
    const count = counts[label];
    if (count > bestCount) {
      bestCount = count;
      best = label;
    }
  }

  return bestCount > 0 ? best! : 'mixto';
}

export function getLearningStyleDistribution(
  students: ReadonlyArray<{ perfil: string }>
): LearningStyleDistribution {
  const counts = emptyCounts();
  let unclassified = 0;

  for (const student of students) {
    const style = primaryStyleFromPerfil(student.perfil);
    if (style) {
      counts[style]++;
    } else {
      unclassified++;
    }
  }

  return {
    counts,
    unclassified,
    totalStudents: students.length,
  };
}
