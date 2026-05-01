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

interface RemoveReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function RemoveReasonDialog({ open, onOpenChange, onConfirm }: RemoveReasonDialogProps) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const isValid = trimmed.length >= MIN_REASON_LENGTH;

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Event</DialogTitle>
          <DialogDescription>
            Provide a reason for removal. The creator will be notified and can edit and resubmit.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this event is being removed (min 10 characters)…"
          className="min-h-[100px]"
          aria-label="Removal reason"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!isValid}>
            Remove Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
