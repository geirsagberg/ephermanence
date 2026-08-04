import type { SpaceState } from './types';

export const initialSpace: SpaceState = {
  thoughts: [
    {
      id: '1',
      text: 'The unexamined life is not worth living',
      x: -240,
      y: -120,
      radius: 96,
      tone: 0,
    },
    {
      id: '2',
      text: 'Men are disturbed not by things, but by the views which they take of things',
      x: -60,
      y: -150,
      radius: 96,
      tone: 1,
    },
    {
      id: '3',
      text: 'My experience is what I agree to attend to',
      x: 180,
      y: 100,
      radius: 96,
      tone: 2,
    },
    {
      id: '4',
      text: 'The heart has its reasons, which reason does not know',
      x: -280,
      y: 140,
      radius: 94,
      tone: 3,
    },
    {
      id: '5',
      text: 'I think, therefore I am',
      x: 300,
      y: -150,
      radius: 91,
      tone: 4,
    },
  ],
  attachments: [['1', '2']],
};

export function spaceForQuery(search: string): SpaceState {
  if (new URLSearchParams(search).has('debug')) return initialSpace;
  return { thoughts: [], attachments: [] };
}
