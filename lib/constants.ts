import type {
  AffectiveAudioTrack,
  CctSettings,
  EnvironmentConfig,
} from './types';

export const DEFAULT_CCT_SETTINGS: CctSettings = {
  sessionMode: 'timer',
  durationMinutes: 5,
  correctTarget: 25,
  nBack: 1,
  startIntervalMs: 2500,
  minIntervalMs: 250,
  maxIntervalMs: 5000,
  stepDownMs: 100,
  stepUpMs: 100,
  correctThreshold: 4,
  wrongThreshold: 4,
  showTimer: true,
  showIntervalStats: true,
  showVisualDigit: false,
  beepEnabled: true,
  beepVolume: 0.2,
  buttonMode: false,
};

export const AFFECTIVE_AUDIO_TRACKS: AffectiveAudioTrack[] = [
  {
    id: 'growl',
    title: 'Aggressive Low Growl',
    category: 'Threat',
    src: '/assets/aistudio/aggressive-low-frequency-growl-sound-effects-608306_421bb72d.mp3',
  },
  {
    id: 'baby-crying',
    title: 'Upset Baby Crying',
    category: 'Distress',
    src: '/assets/aistudio/baby-upset-crying-1yr-old-leo-manitoulin-island-summer-05-23030_b1070d11.mp3',
  },
  {
    id: 'mosquito',
    title: 'Mosquito Buzz',
    category: 'Irritant',
    src: '/assets/aistudio/Mosquito_sound_22a8e9f3.wav',
  },
  {
    id: 'scary-door',
    title: 'Scary Wooden Door',
    category: 'Suspense',
    src: '/assets/aistudio/scary-wooden-door-opening-190_a77bb119.wav',
  },
  {
    id: 'creaky-door',
    title: 'Creaky Door Open',
    category: 'Suspense',
    src: '/assets/aistudio/creaky-door-open-195_7ce4a2dc.wav',
  },
  {
    id: 'moaning',
    title: 'Vocal Moaning',
    category: 'Arousal',
    src: '/assets/aistudio/moaning_14312760.m4a',
  },
  {
    id: 'cereal-eating',
    title: 'Eating Dry Cereal',
    category: 'Misophonia',
    src: '/assets/aistudio/human-eating-dry-cereal-130_54da3277.wav',
  },
  {
    id: 'chip-eating',
    title: 'Eating Potato Chip',
    category: 'Misophonia',
    src: '/assets/aistudio/human-eating-a-potato-chip-131_200500a4.wav',
  },
  {
    id: 'hungry-eating',
    title: 'Hungry Man Eating',
    category: 'Misophonia',
    src: '/assets/aistudio/hungry-man-eating-2252_0ad9bc3c.wav',
  },
  {
    id: 'animal-meat',
    title: 'Animal Eating Meat',
    category: 'Visceral',
    src: '/assets/aistudio/animal-eating-juicy-meat-2246_f2c8bbfd.wav',
  },
  {
    id: 'pig-drinking',
    title: 'Pig Drinking Water',
    category: 'Misophonia',
    src: '/assets/aistudio/farm-pig-drinking-water-2242_62979059.wav',
  },
  {
    id: 'swallowing',
    title: 'Throat Swallowing',
    category: 'Misophonia',
    src: '/assets/aistudio/swallowing-a-water-drink-in-the-throat-150_947c94de.wav',
  },
];

export const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
  backgroundMode: 'standard',
  youtubeUrl: '',
  youtubeVideoId: '',
  youtubeStartSeconds: 0,
  youtubeVolume: 65,
  youtubeMuted: false,
  youtubeLoop: true,
  youtubeScrimOpacity: 0,
  affectiveAudioEnabled: false,
  affectiveAudioMode: 'mix',
  affectivePlaybackStyle: 'random_loop',
  affectiveSingleTrackId: AFFECTIVE_AUDIO_TRACKS[0].id,
  affectiveSelectedTrackIds: AFFECTIVE_AUDIO_TRACKS.slice(0, 4).map((t) => t.id),
  affectiveVolume: 70,
  affectiveGapSeconds: 0.3,
};
