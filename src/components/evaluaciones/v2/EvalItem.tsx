/**
 * V2 Evaluation Renderer - Item Component
 * 
 * Renders individual evaluation items based on their type.
 * Supports versioned content - displays adapted prompts when Version B/C is selected.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { NormalizedItem } from '@/services/evaluations/v2Types';
import ResponseOptions from './ResponseOptions';
import { Sparkles } from 'lucide-react';

interface EvalItemProps {
  item: NormalizedItem;
  showPoints?: boolean;
}

export const EvalItem: React.FC<EvalItemProps> = ({ item, showPoints = true }) => {
  return (
    <div className="py-4 border-b last:border-b-0 eval-item pdf-no-break">
      {/* Item header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-start gap-3">
          <span className="font-bold text-lg text-primary min-w-[2rem]">
            {item.number}.
          </span>
          <div className="flex-1">
            <p className="font-medium text-foreground leading-relaxed">
              {item.prompt}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Adapted content indicator */}
          {item.isAdapted && (
            <Badge variant="default" className="text-xs bg-purple-600 hover:bg-purple-700 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Adaptado
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {item.typeLabel}
          </Badge>
          {showPoints && (
            <Badge variant="secondary" className="text-xs">
              {item.points} {item.points === 1 ? 'pt' : 'pts'}
            </Badge>
          )}
        </div>
      </div>

      {/* Type-specific content */}
      <div className="ml-10">
        {renderItemContent(item)}
      </div>

      {/* Equivalent response options */}
      {item.responseOptions?.enabled && (
        <div className="ml-10">
          <ResponseOptions options={item.responseOptions} />
        </div>
      )}
    </div>
  );
};

function renderItemContent(item: NormalizedItem): React.ReactNode {
  switch (item.type) {
    case 'multiple_choice':
      return <MultipleChoiceContent item={item} />;

    case 'true_false':
      return <TrueFalseContent />;

    case 'true_false_justify':
      return <TrueFalseJustifyContent />;

    case 'short_answer':
      return <ShortAnswerContent item={item} />;

    case 'paragraph':
    case 'essay':
      return <EssayContent item={item} />;

    case 'source_analysis':
      return <SourceAnalysisContent item={item} />;

    case 'matching':
      return <MatchingContent item={item} />;

    case 'ordering':
      return <OrderingContent item={item} />;

    case 'table_completion':
      return <TableCompletionContent item={item} />;

    default:
      return <DefaultContent />;
  }
}

// ============================================================================
// TYPE-SPECIFIC COMPONENTS
// ============================================================================

const MultipleChoiceContent: React.FC<{ item: NormalizedItem }> = ({ item }) => {
  if (!item.options || item.options.length === 0) {
    return <DefaultContent />;
  }

  return (
    <div className="space-y-2 mt-2">
      {item.options.map((option) => (
        <div key={option.id} className="flex items-start gap-3">
          <span className="font-medium text-muted-foreground w-6">
            {option.letter})
          </span>
          <span className="text-foreground">{option.text}</span>
        </div>
      ))}
    </div>
  );
};

const TrueFalseContent: React.FC = () => (
  <div className="flex gap-6 mt-2">
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="w-5 h-5 border-2 rounded border-muted-foreground" />
      <span>Verdadero</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="w-5 h-5 border-2 rounded border-muted-foreground" />
      <span>Falso</span>
    </label>
  </div>
);

const TrueFalseJustifyContent: React.FC = () => (
  <div className="space-y-3 mt-2">
    <div className="flex gap-6">
      <label className="flex items-center gap-2 cursor-pointer">
        <div className="w-5 h-5 border-2 rounded border-muted-foreground" />
        <span>Verdadero</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <div className="w-5 h-5 border-2 rounded border-muted-foreground" />
        <span>Falso</span>
      </label>
    </div>
    <div>
      <p className="text-sm text-muted-foreground mb-1">Justificación:</p>
      <div className="h-16 border-b-2 border-dotted border-muted-foreground" />
    </div>
  </div>
);

const ShortAnswerContent: React.FC<{ item: NormalizedItem }> = ({ item }) => (
  <div className="mt-2">
    <div className="h-8 border-b-2 border-dotted border-muted-foreground" />
    {item.maxLength && (
      <p className="text-xs text-muted-foreground mt-1">
        Máximo {item.maxLength} caracteres
      </p>
    )}
  </div>
);

const EssayContent: React.FC<{ item: NormalizedItem }> = ({ item }) => (
  <div className="space-y-3 mt-2">
    {/* Guiding questions */}
    {item.guidingQuestions && item.guidingQuestions.length > 0 && (
      <div className="p-3 bg-muted/50 rounded-md">
        <p className="text-sm font-medium mb-2">Preguntas orientadoras:</p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          {item.guidingQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>
    )}

    {/* Answer lines */}
    <div className="space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-6 border-b border-dotted border-muted-foreground" />
      ))}
    </div>

    {/* Length hints */}
    {(item.minLength || item.maxLength) && (
      <p className="text-xs text-muted-foreground">
        {item.minLength && `Mínimo ${item.minLength} palabras`}
        {item.minLength && item.maxLength && ' • '}
        {item.maxLength && `Máximo ${item.maxLength} palabras`}
      </p>
    )}
  </div>
);

const SourceAnalysisContent: React.FC<{ item: NormalizedItem }> = ({ item }) => (
  <div className="space-y-4 mt-2">
    {/* Source display */}
    {item.source && (
      <div className="p-4 bg-muted/30 rounded-md border-l-4 border-primary">
        {item.source.type === 'image' && item.source.url ? (
          <div className="text-center">
            <img 
              src={item.source.url} 
              alt={item.source.caption || 'Fuente'} 
              className="max-w-full max-h-64 mx-auto rounded"
            />
          </div>
        ) : item.source.content ? (
          <blockquote className="italic text-foreground">
            "{item.source.content}"
          </blockquote>
        ) : null}
        
        {item.source.caption && (
          <p className="text-sm text-muted-foreground mt-2">{item.source.caption}</p>
        )}
        {item.source.attribution && (
          <p className="text-xs text-muted-foreground mt-1">— {item.source.attribution}</p>
        )}
      </div>
    )}

    {/* Sub-items */}
    {item.subItems && item.subItems.length > 0 && (
      <div className="space-y-4 pl-4">
        {item.subItems.map((sub) => (
          <div key={sub.id}>
            <p className="font-medium">
              <span className="text-muted-foreground">{sub.letter})</span> {sub.prompt}
              {sub.points > 0 && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({sub.points} {sub.points === 1 ? 'pt' : 'pts'})
                </span>
              )}
            </p>
            <div className="mt-2 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-5 border-b border-dotted border-muted-foreground" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )}

    {/* Default answer area if no sub-items */}
    {(!item.subItems || item.subItems.length === 0) && (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-6 border-b border-dotted border-muted-foreground" />
        ))}
      </div>
    )}
  </div>
);

const MatchingContent: React.FC<{ item: NormalizedItem }> = ({ item }) => {
  const left = item.leftColumn || [];
  const right = item.rightColumn || [];

  return (
    <div className="mt-2">
      <p className="text-sm text-muted-foreground mb-3">
        Uní con flechas los elementos de la columna A con los de la columna B:
      </p>
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-2">
          <p className="font-medium text-sm mb-2">Columna A</p>
          {left.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <span className="font-medium text-muted-foreground">{i + 1}.</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="font-medium text-sm mb-2">Columna B</p>
          {right.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <span className="font-medium text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const OrderingContent: React.FC<{ item: NormalizedItem }> = ({ item }) => {
  const items = item.itemsToOrder || [];

  return (
    <div className="mt-2">
      <p className="text-sm text-muted-foreground mb-3">
        Ordená los siguientes elementos en la secuencia correcta (1, 2, 3...):
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
            <div className="w-8 h-8 border-2 rounded border-muted-foreground flex items-center justify-center text-sm">
              __
            </div>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * TableCompletionContent - Renders a real table for table_completion items
 * 
 * Mapping from spec → UI:
 * - item.table.columns → <th> headers
 * - item.table.rows → <tr><td> cells
 * - Empty string cells ("") → blank fillable area (visual underline)
 * - Non-empty cells → pre-filled content (read-only display)
 * 
 * Design considerations:
 * - Uses semantic <table> markup for accessibility and print
 * - Responsive: wraps text, uses min-width for readability
 * - Print/PDF: avoids horizontal overflow with word-break
 * - Empty cells show a dotted underline to indicate "fill here"
 */
const TableCompletionContent: React.FC<{ item: NormalizedItem }> = ({ item }) => {
  const table = item.table;
  
  // Fallback if no table data
  if (!table || !table.columns || table.columns.length === 0) {
    return (
      <div className="mt-2 p-4 border-2 border-dashed border-muted-foreground/30 rounded text-center text-muted-foreground">
        [Tabla sin datos]
      </div>
    );
  }
  
  const { columns, rows } = table;
  const hasRows = rows && rows.length > 0;
  
  return (
    <div className="mt-3 overflow-x-auto print:overflow-visible pdf-no-break">
      <table className="w-full border-collapse border border-muted-foreground/30 text-sm table-fixed">
        {/* Table header */}
        <thead>
          <tr className="bg-muted/50">
            {columns.map((col) => (
              <th
                key={col.id}
                className="border border-muted-foreground/30 px-3 py-2 text-left font-semibold text-foreground break-words"
                style={{ width: `${100 / columns.length}%` }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        
        {/* Table body */}
        <tbody>
          {hasRows ? (
            rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="even:bg-muted/20 pdf-no-break">
                {columns.map((col, colIndex) => {
                  const cellValue = row[colIndex] ?? '';
                  const isEmpty = cellValue.trim() === '';
                  
                  return (
                    <td
                      key={`${col.id}-${rowIndex}`}
                      className="border border-muted-foreground/30 px-3 py-2 break-words align-top"
                    >
                      {isEmpty ? (
                        // Empty cell: show fillable blank area
                        <div className="min-h-[1.5rem] border-b-2 border-dotted border-muted-foreground/50" />
                      ) : (
                        // Pre-filled cell: show content
                        <span className="text-foreground">{cellValue}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            // No rows provided: generate 3 blank rows for completion
            [...Array(3)].map((_, rowIndex) => (
              <tr key={`blank-row-${rowIndex}`} className="even:bg-muted/20 pdf-no-break">
                {columns.map((col) => (
                  <td
                    key={`${col.id}-blank-${rowIndex}`}
                    className="border border-muted-foreground/30 px-3 py-2"
                  >
                    <div className="min-h-[1.5rem] border-b-2 border-dotted border-muted-foreground/50" />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      
      {/* Instructions hint */}
      <p className="text-xs text-muted-foreground mt-2 italic">
        Completá las celdas vacías según corresponda.
      </p>
    </div>
  );
};

const TableCompletionPlaceholder: React.FC = () => (
  <div className="mt-2 p-4 border-2 border-dashed border-muted-foreground/30 rounded text-center text-muted-foreground">
    [Tabla para completar]
  </div>
);

const DefaultContent: React.FC = () => (
  <div className="mt-2">
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-6 border-b border-dotted border-muted-foreground" />
      ))}
    </div>
  </div>
);

export default EvalItem;
