import type { SpaceState } from './types';

export const initialSpace: SpaceState = {
  thoughts: [
    {
      id: 'familiarity',
      text: 'A thought can feel true simply because it is familiar. What if it were new?',
      x: 346,
      y: 230,
      radius: 96,
      tone: 0,
    },
    {
      id: 'rehearsal',
      text: 'We do not choose every thought that appears, only which ones we rehearse.',
      x: 531,
      y: 230,
      radius: 96,
      tone: 1,
    },
    {
      id: 'language',
      text: 'Thinking alone still uses words and questions we learned from other people.',
      x: 858,
      y: 468,
      radius: 96,
      tone: 2,
    },
    {
      id: 'action',
      text: 'A belief becomes visible in what we are prepared to do because of it.',
      x: 307,
      y: 504,
      radius: 94,
      tone: 3,
    },
    {
      id: 'doubt',
      text: 'Doubt is thought refusing to close before it has looked again.',
      x: 1011,
      y: 202,
      radius: 91,
      tone: 4,
    },
  ],
  attachments: [['familiarity', 'rehearsal']],
};
