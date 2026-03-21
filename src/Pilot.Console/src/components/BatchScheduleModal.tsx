import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BatchScheduleModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  postIds: string[];
  onSchedule: (schedules: { postId: string; scheduledTime: string }[]) => Promise<void>;
}

export function BatchScheduleModal({
  isOpen,
  onOpenChange,
  postIds,
  onSchedule
}: BatchScheduleModalProps) {
  const [startTime, setStartTime] = React.useState('');
  const [endTime, setEndTime] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Set default times: start is now + 1 hour, end is tomorrow same time
  React.useEffect(() => {
    if (isOpen) {
      const start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0);
      
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      
      const formatDateTime = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setStartTime(formatDateTime(start));
      setEndTime(formatDateTime(end));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) {
      toast.error("Please select both start and end times");
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }

    setIsSubmitting(true);
    try {
      const schedules = calculateSchedules(postIds, start, end);
      await onSchedule(schedules);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to schedule posts");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateSchedules = (ids: string[], start: Date, end: Date) => {
    const n = ids.length;
    const startMs = start.getTime();
    const endMs = end.getTime();
    const totalDuration = endMs - startMs;
    
    if (n === 0) return [];
    if (n === 1) return [{ postId: ids[0], scheduledTime: start.toISOString() }];

    const interval = totalDuration / (n - 1);
    const randomness = interval * 0.1; // 10% of interval

    return ids.map((id, i) => {
      const baseTime = startMs + i * interval;
      // Random offset in [-randomness, randomness]
      const offset = (Math.random() * 2 - 1) * randomness;
      const scheduledTime = new Date(baseTime + offset);
      return { postId: id, scheduledTime: scheduledTime.toISOString() };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Batch Schedule Posts</DialogTitle>
          <DialogDescription>
            Distribute {postIds.length} posts between the selected start and end times with 10% randomness.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="startTime" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Start Date & Time
              </Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endTime" className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> End Date & Time
              </Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Confirm Schedule'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
