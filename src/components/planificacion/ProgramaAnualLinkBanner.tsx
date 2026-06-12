import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  programaId: string;
  programaNombre?: string | null;
};

export function ProgramaAnualLinkBanner({ programaId, programaNombre }: Props) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Programa anual vinculado
        </CardTitle>
        <CardDescription>
          {programaNombre
            ? `Esta planificación importó unidades de «${programaNombre}».`
            : 'Esta planificación está vinculada a un programa anual.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/programa-anual/${programaId}`}>
            Ver programa anual
            <ExternalLink className="h-3.5 w-3.5 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
