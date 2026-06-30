'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';

import { cn } from '@CeolX/ui/lib/utils';

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

const PopoverClose = PopoverPrimitive.Close;

function PopoverContent({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 6,
  className,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'z-50 origin-(--transform-origin) rounded-xl border border-border bg-popover text-popover-foreground shadow-md outline-none transition-[opacity,transform] duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverClose };
