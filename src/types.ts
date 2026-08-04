export type Thought = {
  id: string;
  text: string;
  x: number;
  y: number;
  radius: number;
  tone: number;
};

export type Attachment = [string, string];

export type SpaceState = {
  thoughts: Thought[];
  attachments: Attachment[];
};
