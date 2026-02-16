import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EvaluationSpecV2, RubricLevelV2 } from '@/services/evaluations/v2Types';

interface ItemRubricPanelProps {
  evaluationSpec: EvaluationSpecV2;
  editable?: boolean;
  onRubricChange?: (
    sectionId: string,
    itemId: string,
    nextLevels: RubricLevelV2[]
  ) => void;
}

const toNumberOrUndefined = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const shortPrompt = (prompt?: string): string => {
  const text = (prompt || '').trim();
  if (!text) return 'Sin consigna';
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
};

export const ItemRubricPanel: React.FC<ItemRubricPanelProps> = ({
  evaluationSpec,
  editable = true,
  onRubricChange,
}) => {
  const sectionsWithRubric = (evaluationSpec.sections || [])
    .map((section) => ({
      ...section,
      items: (section.items || []).filter(
        (item) => Array.isArray(item.rubric?.levels) && item.rubric!.levels.length > 0
      ),
    }))
    .filter((section) => section.items.length > 0);

  if (sectionsWithRubric.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {sectionsWithRubric.map((section, sectionIndex) => (
        <div key={section.id} className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 border-b px-3 py-2">
            <p className="text-sm font-semibold">
              Parte {sectionIndex + 1}: {section.title}
            </p>
          </div>

          <div className="p-3 space-y-4">
            {section.items.map((item, itemIndex) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-medium">
                      Ítem {itemIndex + 1} · {item.type}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {shortPrompt(item.prompt)}
                    </p>
                  </div>
                  <Badge variant="outline">{item.points} pts</Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground">Nivel</th>
                        <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground">Descriptor</th>
                        <th className="text-left py-2 pr-3 text-xs uppercase tracking-wide text-muted-foreground">Mín.</th>
                        <th className="text-left py-2 text-xs uppercase tracking-wide text-muted-foreground">Máx.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.rubric?.levels || []).map((level, levelIndex) => (
                        <tr key={`${item.id}-${level.key}-${levelIndex}`} className="border-b last:border-0 align-top">
                          <td className="py-2 pr-3 min-w-[140px]">
                            <p className="text-xs font-semibold text-muted-foreground">{level.label}</p>
                            <p className="text-[11px] text-muted-foreground">{level.key}</p>
                          </td>
                          <td className="py-2 pr-3 min-w-[260px]">
                            {editable ? (
                              <Textarea
                                defaultValue={level.descriptor}
                                className="min-h-[72px] text-xs"
                                onBlur={(e) => {
                                  if (!onRubricChange) return;
                                  const nextLevels = [...(item.rubric?.levels || [])];
                                  nextLevels[levelIndex] = {
                                    ...nextLevels[levelIndex],
                                    descriptor: e.target.value.trim() || nextLevels[levelIndex].descriptor,
                                  };
                                  onRubricChange(section.id, item.id, nextLevels);
                                }}
                              />
                            ) : (
                              <p className="text-xs text-muted-foreground leading-relaxed">{level.descriptor}</p>
                            )}
                          </td>
                          <td className="py-2 pr-3 min-w-[80px]">
                            {editable ? (
                              <Input
                                type="number"
                                defaultValue={level.minPoints ?? ''}
                                className="h-8 text-xs"
                                onBlur={(e) => {
                                  if (!onRubricChange) return;
                                  const nextLevels = [...(item.rubric?.levels || [])];
                                  nextLevels[levelIndex] = {
                                    ...nextLevels[levelIndex],
                                    minPoints: toNumberOrUndefined(e.target.value),
                                  };
                                  onRubricChange(section.id, item.id, nextLevels);
                                }}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{level.minPoints ?? '-'}</span>
                            )}
                          </td>
                          <td className="py-2 min-w-[80px]">
                            {editable ? (
                              <Input
                                type="number"
                                defaultValue={level.maxPoints ?? ''}
                                className="h-8 text-xs"
                                onBlur={(e) => {
                                  if (!onRubricChange) return;
                                  const nextLevels = [...(item.rubric?.levels || [])];
                                  nextLevels[levelIndex] = {
                                    ...nextLevels[levelIndex],
                                    maxPoints: toNumberOrUndefined(e.target.value),
                                  };
                                  onRubricChange(section.id, item.id, nextLevels);
                                }}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{level.maxPoints ?? '-'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ItemRubricPanel;
