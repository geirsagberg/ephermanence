import type { SpaceState } from './types';

export const initialSpace: SpaceState = {
  thoughts: [
    {
      id: 'attention',
      text: 'Attention might be a form of generosity.',
      x: 0.27,
      y: 0.32,
      radius: 90,
      tone: 0,
    },
    {
      id: 'silence',
      text: 'Silence changes depending on who shares it.',
      x: 0.47,
      y: 0.37,
      radius: 86,
      tone: 1,
    },
    {
      id: 'memory',
      text: 'A memory is edited each time it is visited.',
      x: 0.67,
      y: 0.65,
      radius: 91,
      tone: 2,
    },
    {
      id: 'paths',
      text: 'Desire paths are decisions made visible.',
      x: 0.24,
      y: 0.7,
      radius: 83,
      tone: 3,
    },
    {
      id: 'unfinished',
      text: 'Leave a little room for the unfinished thing.',
      x: 0.79,
      y: 0.28,
      radius: 88,
      tone: 4,
    },
  ],
  attachments: [['attention', 'silence']],
};
