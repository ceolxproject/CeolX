import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@CeolX/ui/lib/utils';

const Select = SelectPrimitive.Root;

const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'flex h-9 w-full items-center justify-between rounded-none border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex items-center justify-center">
        <ChevronDown className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner>
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'relative z-50 min-w-32 overflow-hidden rounded-none border border-border bg-popover text-popover-foreground shadow-md',
            className
          )}
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow className="flex cursor-default items-center justify-center py-1" />
          <SelectPrimitive.List className="p-1">{children}</SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow className="flex cursor-default items-center justify-center py-1" />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-none py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="absolute left-2 flex size-3.5 items-center justify-center">
        <span className="size-2 rounded-full bg-current" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.GroupLabel>) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
      {...props}
    />
  );
}

function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel, SelectGroup };
