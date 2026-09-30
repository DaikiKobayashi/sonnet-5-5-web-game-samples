// Hand-drawn string art for the small sprites. Pure data (no DOM) so it can be
// validated offline. Each entry: { w, h, pal, rows }.
// Legend used throughout: '.' transparent, 'k' outline.

export const PLAYER_PAL = {
  k: '#14101a', g: '#22334d', G: '#5b86b6', r: '#d8342e', R: '#f4655a', d: '#8c1b21',
  w: '#e9e7ec', s: '#8a8896', t: '#1d1c24', T: '#41404c', l: '#8f1d1d', L: '#ff6a4e',
  y: '#f3d769', o: '#f5a742', e: '#5c5b66', E: '#a5a3b0', x: '#3d3a46',
};
export const PLAYER_BRAKE_PAL = { ...PLAYER_PAL, l: '#ff4a3a', L: '#ffd2a8' };

// 40 x 22, rear view, straight.
export const CAR_PLAYER = [
  '...............kkkkkkkkkkk..............',
  '............kkkggggggggggkkk............',
  '...........kgGGgggggggggggggk...........',
  '..........kgGGgggggggggggggggk..........',
  '.........kgggggggggggggggggggk..........',
  '........kkkkkkkkkkkkkkkkkkkkkkkk........',
  '.......kRRRRRRRRRRRRRRRRRRRRRRRRk.......',
  '......kRrrrrrrrrrrrrrrrrrrrrrrrrRk......',
  '.....kRrrrrrrrrrrrrrrrrrrrrrrrrrrRk.....',
  '....kRrrrrrrrrrrrrrrrrrrrrrrrrrrrrRk....',
  '...kkrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrkk..',
  '..kLLkrrrrrrrrrrrrrrrrrrrrrrrrrrrrkLLk..',
  '..kLLkdddddddddddddkkkkkkkkdddddddkLLk..',
  '..kllkdddddddddddddkyyyyyykdddddddkllk..',
  '..kkkkddddddddddddkkkkkkkkkkddddddkkkk..',
  '.kttttkxxxxxxxxxxxxxxxxxxxxxxxxxxxkttttk',
  '.ktTtTkkkkkkkkkkkkkkkkkkkkkkkkkkkkktTtTk',
  '.ktTtTk...........kwwwwwwk........ktTtTk',
  '.ktTtTk...........keEEEEek........ktTtTk',
  '.ktttTk...........kkkkkkkk........ktttTk',
  '.kttttk...........................kttttk',
  '..kkkk.............................kkkk.',
];

export const TRAFFIC_PALS = {
  sedan: [
    { b: '#e8e6ea', B: '#ffffff', d: '#9a97a3' },
    { b: '#2f62c4', B: '#5a8de8', d: '#1f3f86' },
    { b: '#3c9a58', B: '#6bc47e', d: '#256a3a' },
  ],
  truck: [
    { b: '#e2792c', B: '#f7a45a', d: '#a04f18' },
    { b: '#2d9a9a', B: '#5cc9c4', d: '#1d6666' },
    { b: '#8b8f9c', B: '#b8bcc8', d: '#5c606c' },
  ],
  sports: [
    { b: '#f2c53d', B: '#ffe57a', d: '#b98a1c' },
    { b: '#8a3cc4', B: '#b76ee6', d: '#5a2484' },
    { b: '#28c4d8', B: '#7ae8f4', d: '#1a7f8e' },
  ],
};
export const TRAFFIC_BASE_PAL = {
  k: '#14101a', g: '#22334d', G: '#5b86b6', w: '#e9e7ec', s: '#8a8896', S: '#b4b2bf',
  t: '#1d1c24', T: '#41404c', l: '#9a1f1f', L: '#ff5a48', y: '#f3d769', e: '#5c5b66', E: '#a5a3b0', x: '#3d3a46',
};

// 36 x 20
export const CAR_SEDAN = [
  '............kkkkkkkkkkkk............',
  '..........kkggggggggggggkk..........',
  '.........kgGGggggggggggggk..........',
  '........kgggggggggggggggggk.........',
  '.......kkkkkkkkkkkkkkkkkkkkk........',
  '......kBBBBBBBBBBBBBBBBBBBBBk.......',
  '.....kBbbbbbbbbbbbbbbbbbbbbbBk......',
  '....kBbbbbbbbbbbbbbbbbbbbbbbbBk.....',
  '...kkbbbbbbbbbbbbbbbbbbbbbbbbbkk....',
  '..kLLkbbbbbbbbbbbbbbbbbbbbbbbkLLk...',
  '..kLLkddddddddddkkkkkkkkddddddkLLk..',
  '..kllkddddddddddkyyyyyykddddddkllk..',
  '..kkkkddddddddddkkkkkkkkddddddkkkk..',
  '.kttttkxxxxxxxxxxxxxxxxxxxxxxxkttttk',
  '.ktTtTkkkkkkkkkkkkkkkkkkkkkkkkktTtTk',
  '.ktTtTk...........keEek.......ktTtTk',
  '.ktttTk...........kkkkk.......ktttTk',
  '.kttttk.......................kttttk',
  '..kkkk.........................kkkk.',
  '....................................',
];

// 44 x 34
export const CAR_TRUCK = [
  '......kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk......',
  '.....kBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBddddddddddddddddddddddddddddddBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBbbbbbbbbbbbbbbbbdbbbbbbbbbbbbbBk.....',
  '.....kBddddddddddddddddddddddddddddddBk.....',
  '.....kBbbbbbbbbkkbbbbbbdbbbbbbkkbbbbbBk.....',
  '.....kddddddddddddddddddddddddddddddddk.....',
  '....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk....',
  '...kLLkSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSkLLk..',
  '...kLLkssssssssssssskyyyyyyksssssssssskLLk..',
  '...kllkssssssssssssskyyyyyyksssssssssskllk..',
  '...kkkkkxxxxxxxxxxxxkkkkkkkkxxxxxxxxxkkkkk..',
  '..kttttttk......................kttttttk....',
  '..ktTtTtTk......................ktTtTtTk....',
  '..ktTtTtTk......................ktTtTtTk....',
  '..ktTtTtTk........keEEEek.......ktTtTtTk....',
  '..ktttttTk........kkkkkkk.......ktttttTk....',
  '..kttttttk......................kttttttk....',
  '...kkkkkk........................kkkkkk.....',
];

// 38 x 18
export const CAR_SPORTS = [
  '.......kkkkkkkkkkkkkkkkkkkkkkkk.......',
  '......kBBBBBBBBBBBBBBBBBBBBBBBBk......',
  '......kkk.kkkkkkkkkkkkkkkkkk.kkk......',
  '..........kgGGggggggggggggk...........',
  '.........kggggggggggggggggggk.........',
  '........kkkkkkkkkkkkkkkkkkkkkk........',
  '.......kBBBBBBBBBBBBBBBBBBBBBBk.......',
  '......kBbbbbbbbbbbbbbbbbbbbbbbBk......',
  '.....kBbbbbbbbbbbbbbbbbbbbbbbbbBk.....',
  '....kkbbbbbbbbbbbbbbbbbbbbbbbbbbkk....',
  '...kLLkbbbbbbbbbbbbbbbbbbbbbbbbkLLk...',
  '...kLLkdddddddddddkkkkkkkkddddddkLLk..',
  '...kkkkddddddddddkyyyyyykdddddddkkkk..',
  '..kttttkxxxxxxxxxxkkkkkkkkxxxxxxkttttk',
  '..ktTtTkkkkkkkkkkkkkkkkkkkkkkkkktTtTk.',
  '..ktTtTk......keEEek....keEEek..ktTtTk',
  '..kttttk......kkkkkk....kkkkkk..kttttk',
  '...kkkk..........................kkkk.',
];

// 32 x 22 seaside rock
export const ROCK_PAL = { k: '#2a2a3a', h: '#8d8d9a', H: '#bdbdc9', d: '#5a5a6e', m: '#6f9a58' };
export const RS_ROCK = [
  '............kkkkkkkk............',
  '..........kkHHHHHHHHkk..........',
  '........kkHHHHHHHhhhhhkk........',
  '.......kHHHHHHHhhhhhhhhhk.......',
  '......kHHHHHHhhhhhhhhhhhhk......',
  '.....kHHHHHhhhhhhhhhhhhhhhk.....',
  '....kHHHHhhhhhhhhhhhhhhhhhhk....',
  '...kHHHHhhhhhhhhhhhhhhhhhhhhk...',
  '..kHHHhhhhhhhhhhhhhkhhhhhhhhhk..',
  '..kHHhhhhhhhhhhhhhhkhhhhhhhhhhk.',
  '.kHhhhhhhhhhhhhhhhhkhhhhhhhhhhhk',
  '.khhhhhhhhhhhhhhhhhhkhhhhhhhhhhk',
  '.khhhhmmhhhhhhhhhhhhkhhhhhhhhhhk',
  '.khhhmmmmhhhhhhhhhhhhkhhhhhhhhhk',
  '.khhhhmmhhhhhhhhhhhhhhkhhhhhhhhk',
  '.kddhhhhhhhhhhhhhhhhhhhkhhhhhhdk',
  '.kdddhhhhhhhhhhhhhhhhhhhhhhhhddk',
  '.kddddddhhhhhhhhhhhhhhhhhhhddddk',
  '..kddddddddddhhhhhhhhhhdddddddk.',
  '..kkddddddddddddddddddddddddddk.',
  '...kkkddddddddddddddddddddddkk..',
  '.....kkkkkkkkkkkkkkkkkkkkkkkk...',
];

// 32 x 20 shrub with pink flowers
export const SHRUB_PAL = { k: '#173a19', g: '#4f9a3c', G: '#7cc45a', d: '#2f6a28', p: '#f070a0', P: '#ffc0dc' };
export const RS_SHRUB = [
  '..........kkk........kk.........',
  '.........kGGGk......kGGk........',
  '......kkkGGgggk...kkGgggk.......',
  '.....kGGGggggggk.kGGggggggk.....',
  '....kGGgggggggggkGgggggggggk....',
  '...kGGgggggpgggggggggggpggggk...',
  '..kGGggggggPpggggggggggPpgggggk.',
  '..kGgggggggggggggpggggggggggggk.',
  '.kGgggggggggggggPpggggggggggggk.',
  '.kggggggggggggggggggggggggggggk.',
  '.kggggddgggggggggggggggggggdggk.',
  '.kgggddddggggggggggggggggddddgk.',
  '..kggdddddgggggggggggggdddddddk.',
  '..kdddddddddddgggggggddddddddk..',
  '...kdddddddddddddddddddddddddk..',
  '....kddddddddddddddddddddddk....',
  '.....kkddddddddddddddddddkk.....',
  '.......kkkkddddddddddkkkk.......',
  '..........kkkkkkkkkkk...........',
  '................................',
];

// 28 x 16 fern
export const FERN_PAL = { k: '#0f2a1c', g: '#2f8a4a', G: '#6cc46e', d: '#1d5c34' };
export const RS_FERN = [
  '....k......k......k....k....',
  '...kGk....kGk....kGk..kGk...',
  '..kGgk...kGgk...kGgk.kGgk...',
  '.kGggk..kGggk..kGggk.kGggk..',
  '.kgggGk.kgggk.kGgggk.kggggk.',
  'kGggggk.kgggkkGgggk..kgggggk',
  'kggggggkkgggkgggggk.kgggggk.',
  '.kgggggkgggggggggkkkggggggk.',
  '.kkgggggggggggggggggggggkk..',
  '...kkggggggggggggggggggkk...',
  '.....kkgggggdddddgggggk.....',
  '.......kkgggdddddgggkk......',
  '.........kkgdddddgkk........',
  '...........kddddk...........',
  '...........kdddk............',
  '............kkk.............',
];

// 12 x 16 bollard
export const BOLLARD_PAL = { k: '#12141c', W: '#ffffff', w: '#d8dce8', s: '#7c8090', Y: '#ffd23c', d: '#3a3d48' };
export const RS_BOLLARD = [
  '....kkkk....',
  '...kWWWWk...',
  '...kwwwwk...',
  '...kssssk...',
  '...kYYYYk...',
  '...kYYYYk...',
  '...kssssk...',
  '...kssssk...',
  '...kssssk...',
  '...kYYYYk...',
  '...kYYYYk...',
  '...kssssk...',
  '...kssssk...',
  '..kkssssskk.',
  '.kdddddddddk',
  '.kkkkkkkkkkk',
];

// All string art with their expected sizes, for validation.
export const ART_LIST = [
  ['CAR_PLAYER', CAR_PLAYER, 40, 22],
  ['CAR_SEDAN', CAR_SEDAN, 36, 20],
  ['CAR_TRUCK', CAR_TRUCK, 44, 34],
  ['CAR_SPORTS', CAR_SPORTS, 38, 18],
  ['RS_ROCK', RS_ROCK, 32, 22],
  ['RS_SHRUB', RS_SHRUB, 32, 20],
  ['RS_FERN', RS_FERN, 28, 16],
  ['RS_BOLLARD', RS_BOLLARD, 12, 16],
];
