import { useState, type ReactNode } from 'react';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  details?: string | null;
};

export function ErrorCard({ title, description, action, details }: Props) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(details);

  return (
    <Card className="border border-red-200 bg-white shadow-sm dark:border-red-900/50 dark:bg-slate-900">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-red-700 dark:text-red-300">
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-slate-700 dark:text-slate-300">{description}</p>
        )}
      </CardHeader>
      {hasDetails && open && (
        <CardContent>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-slate-100 p-3 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {details}
          </pre>
        </CardContent>
      )}
      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {action}
          {hasDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen((prev) => !prev)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {open ? 'Hide details' : 'Show details'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
