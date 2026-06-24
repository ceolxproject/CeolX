import { useState } from 'react';

import { Button } from '@CeolX/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@CeolX/ui/components/dialog';
import { Textarea } from '@CeolX/ui/components/textarea';

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

interface RemoveReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function RemoveReasonDialog({ open, onOpenChange, onConfirm }: RemoveReasonDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const isValid = trimmed.length >= MIN_REASON_LENGTH && trimmed.length <= MAX_REASON_LENGTH;

  function handleConfirm() {
    if (!isValid) return;
    onConfirm(trimmed);
    setReason('');
    onOpenChange(false);
  }

  function handleOpenChange(val: boolean) {
    if (!val) setReason('');
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="space-y-4 pb-5">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl">Remove Event</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Provide a reason for removal. The creator will be notified and can edit and resubmit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this event is being removed…"
            className="min-h-30 resize-none"
            aria-label="Removal reason"
            maxLength={MAX_REASON_LENGTH}
          />
          <p className="text-xs text-muted-foreground text-right tabular-nums">
            {trimmed.length < MIN_REASON_LENGTH
              ? `At least ${MIN_REASON_LENGTH} characters`
              : `${trimmed.length}/${MAX_REASON_LENGTH}`}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="min-w-24">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid}
            className="min-w-24"
          >
            Remove Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
