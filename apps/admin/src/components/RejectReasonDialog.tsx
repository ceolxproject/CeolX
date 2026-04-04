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

interface RejectReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function RejectReasonDialog({ open, onOpenChange, onConfirm }: RejectReasonDialogProps) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
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
          <DialogTitle>Reject Event</DialogTitle>
          <DialogDescription>
            Provide a reason for rejection. This will be sent to the event creator.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this event is being rejected…"
          className="min-h-[100px]"
          aria-label="Rejection reason"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason.trim()}>
            Reject Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
