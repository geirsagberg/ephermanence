import type { SpaceState } from './types';

export const initialSpace: SpaceState = {
  thoughts: [
    {
      id: 'familiarity',
      text: 'The unexamined life is not worth living',
      x: 346,
      y: 230,
      radius: 96,
      tone: 0,
    },
    {
      id: 'rehearsal',
      text: 'Men are disturbed not by things, but by the views which they take of things',
      x: 531,
      y: 200,
      radius: 96,
      tone: 1,
    },
    {
      id: 'language',
      text: 'My experience is what I agree to attend to',
      x: 858,
      y: 468,
      radius: 96,
      tone: 2,
    },
    {
      id: 'action',
      text: 'The heart has its reasons, which reason does not know',
      x: 307,
      y: 504,
      radius: 94,
      tone: 3,
    },
    {
      id: 'doubt',
      text: 'I think, therefore I am',
      x: 1011,
      y: 202,
      radius: 91,
      tone: 4,
    },
  ],
  attachments: [['familiarity', 'rehearsal']],
};
