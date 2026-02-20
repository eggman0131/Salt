import * as React from 'react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

type AddButtonProps = ButtonProps & {
  label?: string;
};

const AddButton = ({ label = 'Add', className, ...props }: AddButtonProps) => {
  return (
    <Button
      className={cn('h-7 px-2 py-1 text-xs gap-1', className)}
      {...props}
    >
      <Plus className="h-3 w-3" />
      {label}
    </Button>
  );
};

export { AddButton };
