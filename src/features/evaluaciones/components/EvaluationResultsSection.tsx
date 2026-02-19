/**
 * Results area: V2 (V2InfoPanels + EvaluationRendererV2 + EvaluationAdjustmentsPanel)
 * or V1 (warnings, assignments, reminders, EvaluacionVisualRenderer, AI report, criterios).
 * Pure presentational; all data and callbacks come from props.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { EvaluacionVisualRenderer } from "@/components/evaluaciones/EvaluacionVisualRenderer";
import { EvaluationAssignmentsPanel, TeacherRemindersPanel, AIDesignReport } from "@/components/evaluaciones";
import type { AIDesignReportData } from "@/components/evaluaciones";
import { EvaluationRendererV2, V2InfoPanels } from "@/components/evaluaciones/v2/index";
import { EvaluationAdjustmentsPanel } from "@/components/evaluaciones/v2/EvaluationAdjustmentsPanel";
import type { V2Response } from "@/services/evaluations/v2Types";
import type { EvaluationDesignPlan, StudentReminders, MissingTemplateError } from "@/services/evaluations";
import type { GeneratedEvaluation } from "../types";
import type { Student } from "@/data/mockData";

export interface EvaluationResultsSectionProps {
  groupName: string | undefined;
  activeTab: string;
  onActiveTabChange: (value: string) => void;
  saveButton: React.ReactNode;
  showDebugPanel: boolean;
  debugA: unknown;
  debugB: unknown;
  debugC: unknown;
  debugAssignmentCounts: { A: number; B: number; C: number };
  debugVersions: { A?: string; B?: string | null; C?: string | null } | null;
  cardA: GeneratedEvaluation | undefined;
  cardB: GeneratedEvaluation | undefined;
  cardC: GeneratedEvaluation | undefined;
  diffCheckA: boolean | null;
  diffCheckB: boolean | null;
  diffCheckC: boolean | null;
  useBetaV2: boolean;
  v2RawResponse: V2Response | null;
  v2SelectedVersion: "A" | "B" | "C";
  onV2VersionChange: (v: "A" | "B" | "C") => void;
  onV2ResponseChange: (r: V2Response | null) => void;
  isGenerating: boolean;
  teacherName: string | null;
  onPointsWarning: (message: string) => void;
  onRenderError: (reason: string) => void;
  previousV2Response: V2Response | null;
  onAdjustmentApplied: (newResponse: V2Response, previousResponse: V2Response) => void;
  onUndo: () => void;
  groupContext: {
    subject: string | undefined;
    groupName: string | undefined;
    content: string[];
    competencies: string[];
    criteriosLogro: string[];
    students: { studentId: number; displayName: string }[];
  };
  evaluationDesignPlan: EvaluationDesignPlan | null;
  assignmentWarnings: string[];
  studentAssignments: Record<string, "A" | "B" | "C">;
  students: Student[] | undefined;
  teacherReminders: StudentReminders[];
  missingTemplateErrors: MissingTemplateError[];
  displayEvaluations: GeneratedEvaluation[];
  subjectDisplay: string;
  selectedContent: { nombre: string }[];
  duration: string;
  requirements: string;
  selectedCriteriosLogro: string[];
  onFeedbackRequest: (evaluationId: string, feedback: string) => void;
  onRegenerateRequest: (evaluationId: string) => void;
  aiDesignReport: string | null;
  criteriosLogroContent: React.ReactNode;
}

export function EvaluationResultsSection({
  groupName,
  activeTab,
  onActiveTabChange,
  saveButton,
  showDebugPanel,
  debugA,
  debugB,
  debugC,
  debugAssignmentCounts,
  debugVersions,
  cardA,
  cardB,
  cardC,
  diffCheckA,
  diffCheckB,
  diffCheckC,
  useBetaV2,
  v2RawResponse,
  v2SelectedVersion,
  onV2VersionChange,
  onV2ResponseChange,
  isGenerating,
  teacherName,
  onPointsWarning,
  onRenderError,
  previousV2Response,
  onAdjustmentApplied,
  onUndo,
  groupContext,
  evaluationDesignPlan,
  assignmentWarnings,
  studentAssignments,
  students,
  teacherReminders,
  missingTemplateErrors,
  displayEvaluations,
  subjectDisplay,
  selectedContent,
  duration,
  requirements,
  selectedCriteriosLogro,
  onFeedbackRequest,
  onRegenerateRequest,
  aiDesignReport,
  criteriosLogroContent
}: EvaluationResultsSectionProps) {
  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={onActiveTabChange}>
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="results">Evaluaciones Generadas</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Evaluaciones generadas para {groupName}
            </h2>
            {saveButton}
          </div>

          {showDebugPanel && (
            <Card className="mb-6 border-2 border-purple-300 bg-purple-50 dark:bg-purple-950/20">
              <CardHeader>
                <CardTitle className="text-sm text-purple-800 dark:text-purple-200">
                  [UI_VERSION_DEBUG] - Forensic Panel
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs font-mono space-y-3">
                <div className="font-bold text-purple-900">RAW API BUNDLE FIELDS:</div>
                <div className={typeof debugA !== "string" && debugA !== null ? "text-red-600 font-bold" : ""}>
                  A: type={typeof debugA} {typeof debugA === "object" && debugA !== null ? `keys=[${Object.keys(debugA as object).join(",")}]` : ""} start="{String(debugA ?? "").slice(0, 40)}" len={String(debugA ?? "").length}
                </div>
                <div className={typeof debugB !== "string" && debugB !== null ? "text-red-600 font-bold" : ""}>
                  B: type={typeof debugB} {typeof debugB === "object" && debugB !== null ? `keys=[${Object.keys(debugB as object).join(",")}]` : ""} start="{String(debugB ?? "").slice(0, 40)}" len={String(debugB ?? "").length}
                </div>
                <div className={typeof debugC !== "string" && debugC !== null ? "text-red-600 font-bold" : ""}>
                  C: type={typeof debugC} {typeof debugC === "object" && debugC !== null ? `keys=[${Object.keys(debugC as object).join(",")}]` : ""} start="{String(debugC ?? "").slice(0, 40)}" len={String(debugC ?? "").length}
                </div>
                <div>assignmentCounts: A={debugAssignmentCounts.A}, B={debugAssignmentCounts.B}, C={debugAssignmentCounts.C}</div>
                <div>renderSource: A={debugVersions ? "versions.A" : "legacy"}, B={debugVersions ? "versions.B" : "null"}, C={debugVersions ? "versions.C" : "null"}</div>

                {(typeof debugA === "object" && debugA !== null) || (typeof debugB === "object" && debugB !== null) || (typeof debugC === "object" && debugC !== null) && (
                  <div className="mt-2 p-2 bg-red-100 border-2 border-red-500 rounded text-red-800 font-bold text-xs">
                    ⚠️ BACKEND BUG: versions.* contains OBJECTS instead of strings!
                  </div>
                )}

                <div className="font-bold text-purple-900 mt-4 pt-4 border-t border-purple-200">CARD CONTENT (FINAL):</div>
                {cardA && <div>cardA.content: start="{cardA.content.slice(0, 40)}" len={cardA.content.length}</div>}
                {cardB && <div>cardB.content: start="{cardB.content.slice(0, 40)}" len={cardB.content.length}</div>}
                {cardC && <div>cardC.content: start="{cardC.content.slice(0, 40)}" len={cardC.content.length}</div>}

                <div className="font-bold text-purple-900 mt-4 pt-4 border-t border-purple-200">DIFF-STYLE CHECK:</div>
                <div className={diffCheckA === false ? "text-red-600 font-bold" : ""}>
                  cardA.content === versions.A: {diffCheckA === null ? "N/A" : diffCheckA ? "✅ TRUE" : "❌ FALSE"}
                </div>
                {cardB && (
                  <div className={diffCheckB === false ? "text-red-600 font-bold" : ""}>
                    cardB.content === versions.B: {diffCheckB === null ? "N/A" : diffCheckB ? "✅ TRUE" : "❌ FALSE"}
                  </div>
                )}
                {cardC && (
                  <div className={diffCheckC === false ? "text-red-600 font-bold" : ""}>
                    cardC.content === versions.C: {diffCheckC === null ? "N/A" : diffCheckC ? "✅ TRUE" : "❌ FALSE"}
                  </div>
                )}

                {(diffCheckA === false || diffCheckB === false || diffCheckC === false) && (
                  <div className="mt-4 p-3 bg-red-100 border-2 border-red-500 rounded text-red-800 font-bold">
                    🚨 BIG RED FLAG: CARD CONTENT DOES NOT MATCH VERSIONS SOURCE
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {useBetaV2 && v2RawResponse ? (
            <>
              <V2InfoPanels
                v2Response={v2RawResponse}
                selectedVersion={v2SelectedVersion}
                students={students || []}
                studentAssignments={studentAssignments}
                onV2ResponseChange={onV2ResponseChange}
              />

              <EvaluationRendererV2
                v2Response={v2RawResponse}
                selectedVersion={v2SelectedVersion}
                onVersionChange={onV2VersionChange}
                isLoading={isGenerating}
                showDebug={showDebugPanel}
                teacherName={teacherName}
                onV2ResponseChange={onV2ResponseChange}
                onPointsWarning={onPointsWarning}
                onRenderError={onRenderError}
              />

              <EvaluationAdjustmentsPanel
                v2Response={v2RawResponse}
                onAdjustmentApplied={onAdjustmentApplied}
                previousResponse={previousV2Response}
                onUndo={onUndo}
                groupContext={groupContext}
                evaluationDesignPlan={evaluationDesignPlan as unknown as Record<string, unknown> | undefined}
                isLoading={isGenerating}
              />
            </>
          ) : (
            <>
              {assignmentWarnings.length > 0 && (
                <Card className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Ajustes automáticos de versiones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">
                      {assignmentWarnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {Object.keys(studentAssignments).length > 0 && (
                <EvaluationAssignmentsPanel
                  assignments={studentAssignments}
                  students={students || []}
                />
              )}

              {(teacherReminders.length > 0 || missingTemplateErrors.length > 0) && (
                <TeacherRemindersPanel
                  reminders={teacherReminders}
                  students={students || []}
                  missingTemplateErrors={missingTemplateErrors}
                />
              )}

              {displayEvaluations.map((evaluation) => (
                <EvaluacionVisualRenderer
                  key={evaluation.id}
                  evaluation={evaluation}
                  subject={subjectDisplay}
                  selectedContent={selectedContent}
                  duration={duration}
                  requirements={requirements}
                  students={students}
                  criteriosLogro={selectedCriteriosLogro}
                  onFeedback={(evaluationId, feedback) => onFeedbackRequest(evaluationId, feedback)}
                  onRegenerate={(evaluationId) => onRegenerateRequest(evaluationId)}
                />
              ))}

              {aiDesignReport ? (
                <AIDesignReport
                  reportData={JSON.parse(aiDesignReport) as AIDesignReportData}
                  className="mt-6"
                />
              ) : (
                <Card className="mt-6 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-amber-800 dark:text-amber-200">
                      Reporte de IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      El reporte de IA no está disponible para esta evaluación (legacy o generación previa).
                    </p>
                  </CardContent>
                </Card>
              )}

              {selectedCriteriosLogro.length > 0 && (
                <Card className="border-2 border-green-300">
                  <CardHeader>
                    <CardTitle className="text-green-700">Criterios de logro seleccionados para evaluar</CardTitle>
                  </CardHeader>
                  <CardContent>{criteriosLogroContent}</CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
