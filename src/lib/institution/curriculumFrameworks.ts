import type { CurriculumFramework } from '@/types/institution';

export type FrameworkMeta = {
  id: CurriculumFramework;
  label: string;
  shortLabel: string;
  anepBase: boolean;
  pilot: boolean;
  nivelesHint: string;
};

export const CURRICULUM_FRAMEWORKS: FrameworkMeta[] = [
  {
    id: 'anep_ebi',
    label: 'ANEP MCN / EBI',
    shortLabel: 'ANEP EBI',
    anepBase: true,
    pilot: true,
    nivelesHint: 'Inicial → 9°CB',
  },
  {
    id: 'anep_bach',
    label: 'ANEP Bachillerato DGES',
    shortLabel: 'ANEP Bach.',
    anepBase: true,
    pilot: true,
    nivelesHint: '1°EMS → 3°EMS',
  },
  {
    id: 'cambridge_primary',
    label: 'Cambridge Primary',
    shortLabel: 'Cambridge Pri.',
    anepBase: false,
    pilot: true,
    nivelesHint: 'Stages 1–6',
  },
  {
    id: 'cambridge_lower',
    label: 'Cambridge Lower Secondary',
    shortLabel: 'Cambridge LS',
    anepBase: false,
    pilot: true,
    nivelesHint: 'Stages 7–9',
  },
  {
    id: 'cambridge_igcse',
    label: 'Cambridge IGCSE',
    shortLabel: 'IGCSE',
    anepBase: false,
    pilot: true,
    nivelesHint: 'Stage 10+',
  },
  {
    id: 'cambridge_al',
    label: 'Cambridge AS & A Level',
    shortLabel: 'AS/A Level',
    anepBase: false,
    pilot: false,
    nivelesHint: 'Post-IGCSE',
  },
  {
    id: 'ib_pyp',
    label: 'IB PYP',
    shortLabel: 'IB PYP',
    anepBase: false,
    pilot: true,
    nivelesHint: 'Inicial → 6°',
  },
  {
    id: 'ib_myp',
    label: 'IB MYP',
    shortLabel: 'IB MYP',
    anepBase: false,
    pilot: true,
    nivelesHint: 'MYP Years 1–5',
  },
  {
    id: 'ib_dp',
    label: 'IB DP',
    shortLabel: 'IB DP',
    anepBase: false,
    pilot: true,
    nivelesHint: 'DP Years 1–2',
  },
  {
    id: 'ib_cp',
    label: 'IB CP',
    shortLabel: 'IB CP',
    anepBase: false,
    pilot: false,
    nivelesHint: 'CP Years 1–2',
  },
];

export const PILOT_FRAMEWORKS = CURRICULUM_FRAMEWORKS.filter((f) => f.pilot);

export const NIVELES_OFRECIDOS_OPTIONS = [
  { id: 'inicial', label: 'Educación Inicial (3–5 años)' },
  { id: 'primaria', label: 'Primaria (1°–6°)' },
  { id: 'cb', label: 'Ciclo Básico (7°CB–9°CB)' },
  { id: 'bachillerato', label: 'Bachillerato (1°EMS–3°EMS)' },
];

export const IDIOMAS_OPTIONS = ['Español', 'Inglés', 'Hebreo', 'Francés', 'Portugués', 'Otro'];

export function frameworkLabel(id: CurriculumFramework): string {
  return CURRICULUM_FRAMEWORKS.find((f) => f.id === id)?.label ?? id;
}

export function canManageInstitution(profileRole?: string): boolean {
  return profileRole === 'direccion' || profileRole === 'admin';
}

export function canViewInstitutionConfig(profileRole?: string): boolean {
  return (
    profileRole === 'direccion' ||
    profileRole === 'psicopedagogico' ||
    profileRole === 'admin'
  );
}
