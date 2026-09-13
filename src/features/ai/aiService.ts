import { createTimelineEvent } from '../timeline/timelineService';
import type { CreateEventInput } from '../timeline/timelineService';

export interface GenerateItineraryRequest {
  tripId: string;
  prompt: string;
  destination: string;
  startDate: string;
  endDate: string;
  userId: string;
}

interface AIActivity {
  title: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  durationMinutes: number;
}

export async function generateItinerary(req: GenerateItineraryRequest): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/generate-itinerary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: req.prompt,
        destination: req.destination,
        startDate: req.startDate,
        endDate: req.endDate,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to generate itinerary');
    }

    const data = await response.json();
    const activities: AIActivity[] = data.activities || [];

    // Save each activity to the bucket list and timeline
    for (const activity of activities) {
      // 1. Add to timeline
      const timelineEvent: CreateEventInput = {
        tripId: req.tripId,
        title: activity.title,
        description: activity.description,
        location: activity.location,
        date: activity.date,
        startTime: activity.startTime,
        durationMinutes: activity.durationMinutes,
        color: '#4A90E2', // default color for AI events
        tags: ['AI Generated'],
        sourceType: 'custom',
        createdBy: req.userId,
      };
      await createTimelineEvent(timelineEvent);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[generateItinerary]', err);
    return { success: false, error: err.message || 'An unknown error occurred.' };
  }
}
