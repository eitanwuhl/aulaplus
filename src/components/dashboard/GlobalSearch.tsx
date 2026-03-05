import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { mockGroups } from "@/data/mockData";

type StudentResult = {
  id: number;
  name: string;
  groupId: string;
  groupName: string;
};

type GroupResult = {
  id: string;
  name: string;
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const allStudents: StudentResult[] = useMemo(() => {
    return mockGroups.flatMap((group) =>
      group.students.map((student) => ({
        id: student.id,
        name: student.name,
        groupId: group.id,
        groupName: group.name,
      }))
    );
  }, []);

  const { students, groups } = useMemo(() => {
    const q = normalize(query);
    if (!q) return { students: [] as StudentResult[], groups: [] as GroupResult[] };

    const filteredStudents = allStudents
      .filter((student) => normalize(student.name).includes(q))
      .slice(0, 6);

    const filteredGroups = mockGroups
      .filter((group) => normalize(group.name).includes(q))
      .map((group) => ({ id: group.id, name: group.name }))
      .slice(0, 6);

    return { students: filteredStudents, groups: filteredGroups };
  }, [allStudents, query]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const hasResults = students.length > 0 || groups.length > 0;

  const handleStudentSelect = (studentId: number) => {
    navigate("/teacher-groups", { state: { studentId } });
    setOpen(false);
    setQuery("");
  };

  const handleGroupSelect = (groupId: string) => {
    navigate("/teacher-groups", { state: { groupId } });
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar estudiantes, grupos..."
        className="pl-9 h-8 w-64"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(Boolean(event.target.value.trim()));
        }}
        onFocus={() => {
          if (query.trim().length > 0) setOpen(true);
        }}
      />

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-md border bg-popover shadow-md z-50 p-2">
          {!hasResults ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
          ) : (
            <div className="space-y-2">
              {students.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Estudiantes
                  </div>
                  {students.map((student) => (
                    <button
                      key={`student-${student.id}`}
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-center justify-between"
                      onClick={() => handleStudentSelect(student.id)}
                    >
                      <span className="inline-flex items-center gap-2 text-sm">
                        <User className="w-3.5 h-3.5" />
                        {student.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{student.groupName}</span>
                    </button>
                  ))}
                </div>
              )}

              {groups.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Grupos</div>
                  {groups.map((group) => (
                    <button
                      key={`group-${group.id}`}
                      type="button"
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 text-sm"
                      onClick={() => handleGroupSelect(group.id)}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
