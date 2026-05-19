import { describe, it, expect } from 'vitest';
import {
  dominantLearningStyle,
  getLearningStyleDistribution,
  normalizeLearningStyleToken,
  primaryStyleFromPerfil,
} from './learningStyleStats';

describe('primaryStyleFromPerfil', () => {
  it('uses the segment before the hyphen as primary style', () => {
    expect(primaryStyleFromPerfil('Visual-Kinestésico')).toBe('Visual');
    expect(primaryStyleFromPerfil('Kinestésico-Visual')).toBe('Kinestésico');
    expect(primaryStyleFromPerfil('Lector/escritor-Auditivo')).toBe('Lector/escritor');
  });
});

describe('getLearningStyleDistribution', () => {
  it('counts each student once so style counts sum to roster size', () => {
    const group1 = [
      { perfil: 'Visual-Kinestésico' },
      { perfil: 'Auditivo-Lector/escritor' },
      { perfil: 'Visual-Lector/escritor' },
      { perfil: 'Kinestésico-Visual' },
    ];

    const { counts, unclassified, totalStudents } = getLearningStyleDistribution(group1);

    const styleSum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(styleSum + unclassified).toBe(totalStudents);
    expect(totalStudents).toBe(4);
    expect(counts.Visual).toBe(2);
    expect(counts['Kinestésico']).toBe(1);
    expect(counts.Auditivo).toBe(1);
    expect(counts['Lector/escritor']).toBe(0);
  });

  it('tracks students without a recognizable perfil', () => {
    const { counts, unclassified } = getLearningStyleDistribution([
      { perfil: '' },
      { perfil: 'Visual' },
    ]);

    expect(unclassified).toBe(1);
    expect(counts.Visual).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b, 0) + unclassified).toBe(2);
  });
});

describe('normalizeLearningStyleToken', () => {
  it('maps lector/escritor variants', () => {
    expect(normalizeLearningStyleToken('Lector/escritor')).toBe('Lector/escritor');
  });
});

describe('dominantLearningStyle', () => {
  it('returns mixto when all buckets are zero', () => {
    expect(
      dominantLearningStyle({
        Visual: 0,
        'Kinestésico': 0,
        Auditivo: 0,
        'Lector/escritor': 0,
      })
    ).toBe('mixto');
  });

  it('returns the label with the highest count', () => {
    expect(
      dominantLearningStyle({
        Visual: 2,
        'Kinestésico': 1,
        Auditivo: 0,
        'Lector/escritor': 0,
      })
    ).toBe('Visual');
  });
});

describe('unrecognized perfil', () => {
  it('counts unknown tokens as unclassified', () => {
    const { counts, unclassified } = getLearningStyleDistribution([{ perfil: 'Concreto' }]);
    expect(unclassified).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(0);
  });
});
