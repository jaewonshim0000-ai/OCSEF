import type { AppData } from './types';

/**
 * Fictional sample family. Every person, place, and phone number here is made
 * up. Phone numbers use the UK range reserved for drama (07700 900xxx).
 *
 * The sample family ships as if a trusted helper had already completed setup,
 * so a few fields are approved for the locked view. Any field added later
 * starts with its "Show before unlock" switch off, and "Erase everything"
 * returns to an empty locked preview.
 */

export const DEMO_MEDIA: Record<string, { file: string; mime: string }> = {
  'demo-peggy': { file: 'peggy.svg', mime: 'image/svg+xml' },
  'demo-maya': { file: 'maya.svg', mime: 'image/svg+xml' },
  'demo-sam': { file: 'sam.svg', mime: 'image/svg+xml' },
  'demo-front-door': { file: 'front-door.svg', mime: 'image/svg+xml' },
  'demo-kitchen': { file: 'kitchen.svg', mime: 'image/svg+xml' },
  'demo-jacket': { file: 'jacket.svg', mime: 'image/svg+xml' },
  'demo-keys': { file: 'keys.svg', mime: 'image/svg+xml' },
  'demo-bag': { file: 'bag.svg', mime: 'image/svg+xml' },
  'demo-beach': { file: 'beach.svg', mime: 'image/svg+xml' },
  'demo-garden': { file: 'garden.svg', mime: 'image/svg+xml' },
  'demo-piano': { file: 'piano.svg', mime: 'image/svg+xml' },
  'demo-cat': { file: 'cat.svg', mime: 'image/svg+xml' },
  'demo-peggy-voice': { file: 'peggy-voice.wav', mime: 'audio/wav' },
  'demo-maya-hello': { file: 'maya-hello.wav', mime: 'audio/wav' },
  'demo-memory-beach': { file: 'memory-beach.wav', mime: 'audio/wav' },
  'demo-step-keys': { file: 'step-keys.wav', mime: 'audio/wav' },
  'demo-record-player': { file: 'record-player.svg', mime: 'image/svg+xml' },
  'demo-maya-message': { file: 'maya-message.wav', mime: 'audio/wav' },
  'demo-sam-message': { file: 'sam-message.wav', mime: 'audio/wav' },
  'demo-song-waltz': { file: 'song-waltz.wav', mime: 'audio/wav' },
  'demo-song-lullaby': { file: 'song-lullaby.wav', mime: 'audio/wav' },
};

/** The sample family's PIN. Shown on the keypad in sample mode only. */
export const SAMPLE_PIN = '2580';

export function demoAppData(): AppData {
  return {
    profile: {
      preferredName: 'Peggy',
      photo: { id: 'demo-peggy', alt: 'Peggy smiling, with short grey hair, round glasses and a pearl necklace' },
      intro: "I'm Peggy. I live at home with my cat, Biscuit. I taught piano for thirty years.",
      details: [
        'I grew up by the sea in Whitby.',
        'I like my tea strong, with a little milk.',
        'I love my rose garden.',
      ],
      voice: {
        id: 'demo-peggy-voice',
        transcript: "Hello, it's me, Peggy. You're safe. Take a slow breath. Maya is only a phone call away.",
      },
    },
    home: {
      label: 'My home',
      photo: {
        id: 'demo-front-door',
        alt: 'A blue front door with a brass knocker, and a pot of red geraniums on each side',
      },
      cue: 'My front door is blue, with red flowers on each side.',
      address: '14 Elm Street, Riverton RT4 2AB',
      landmarks: ['The red post box on the corner', "Rosie's Bakery across the road", 'The big oak tree by the gate'],
      spaces: [
        {
          id: 'space-kitchen',
          label: 'Kitchen',
          photo: {
            id: 'demo-kitchen',
            alt: 'My kitchen: green cupboards, a window over the sink, the kettle and tea tin on the counter, and the fridge on the right',
          },
          hotspots: [
            { id: 'hs-mug', x: 17, y: 27, label: 'Blue mug', detail: 'In the cupboard to the left of the window, bottom shelf.' },
            { id: 'hs-tea', x: 77.5, y: 53, label: 'Tea bags', detail: 'In the red tin next to the kettle.' },
            { id: 'hs-milk', x: 94, y: 52, label: 'Milk', detail: 'In the fridge door, on the right.' },
            { id: 'hs-glasses', x: 33, y: 68, label: 'Spare glasses', detail: 'In the drawer to the left of the sink.' },
          ],
        },
      ],
    },
    contacts: [
      {
        id: 'contact-maya',
        name: 'Maya',
        relationship: 'My daughter',
        photo: { id: 'demo-maya', alt: 'Maya smiling, with dark curly hair and a yellow jumper' },
        phone: '07700 900123',
        primary: true,
        voice: {
          id: 'demo-maya-message',
          transcript: "Hi Mum, it's Maya, your daughter. You're Peggy, and you're at home with Biscuit. I love you, and I'll ring you later.",
        },
        order: 0,
      },
      {
        id: 'contact-sam',
        name: 'Sam',
        relationship: 'My son',
        photo: { id: 'demo-sam', alt: 'Sam smiling, with short brown hair and a blue shirt' },
        phone: '07700 900456',
        primary: false,
        voice: {
          id: 'demo-sam-message',
          transcript: "Hello Mum, it's Sam, your son. You taught me to play the piano, remember? See you on Saturday for our walk.",
        },
        order: 1,
      },
      {
        id: 'contact-priya',
        name: 'Priya',
        relationship: 'My care partner',
        photo: null,
        phone: '07700 900789',
        primary: false,
        voice: null,
        order: 2,
      },
    ],
    schedule: {
      items: [
        { id: 'item-breakfast', time: '08:00', label: 'Breakfast' },
        { id: 'item-walk', time: '10:30', label: 'Walk to the park with Sam' },
        { id: 'item-lunch', time: '12:00', label: 'Lunch' },
        { id: 'item-tea', time: '15:00', label: 'Tea with Maya' },
        { id: 'item-dinner', time: '18:00', label: 'Dinner' },
        { id: 'item-bed', time: '21:30', label: 'Bedtime' },
      ],
      lockedCue: 'Lunch at noon',
    },
    routines: [
      {
        id: 'routine-go-out',
        title: 'Get ready to go out',
        scheduleTime: '10:00',
        order: 0,
        progress: null,
        steps: [
          {
            id: 'step-coat',
            text: 'Put on your green raincoat. It hangs on the hook by the front door.',
            photo: { id: 'demo-jacket', alt: 'A green raincoat hanging on a wooden coat rail beside the blue front door' },
            audio: null,
          },
          {
            id: 'step-keys',
            text: 'Pick up your keys. They are in the blue bowl on the hall table.',
            photo: { id: 'demo-keys', alt: 'A set of keys with a red key ring in a blue bowl on the hall table' },
            audio: { id: 'demo-step-keys', transcript: 'Your keys are in the blue bowl on the hall table.' },
          },
          {
            id: 'step-bag',
            text: 'Check your bag has your purse and your glasses.',
            photo: { id: 'demo-bag', alt: 'A brown handbag with a pink purse and a blue glasses case inside' },
            audio: null,
          },
          {
            id: 'step-door',
            text: 'Close the blue front door behind you.',
            photo: { id: 'demo-front-door', alt: 'The blue front door with red flowers on each side' },
            audio: null,
          },
        ],
      },
      {
        id: 'routine-dressed',
        title: 'Getting dressed',
        scheduleTime: '08:30',
        order: 1,
        progress: null,
        steps: [
          { id: 'step-d1', text: "Today's clothes are on the chair by your bed.", photo: null, audio: null },
          { id: 'step-d2', text: 'Put on your blouse.', photo: null, audio: null },
          { id: 'step-d3', text: 'Put on your trousers.', photo: null, audio: null },
          { id: 'step-d4', text: 'Put on your socks and slippers.', photo: null, audio: null },
          { id: 'step-d5', text: 'Have a look in the mirror. You are all ready.', photo: null, audio: null },
        ],
      },
    ],
    memories: [
      {
        id: 'memory-beach',
        title: 'Whitby beach, 1978',
        photo: { id: 'demo-beach', alt: 'A sunny beach with two children building a sandcastle and a striped windbreak' },
        caption: 'Building sandcastles with Maya and Sam. Dad bought everyone ice creams.',
        audio: {
          id: 'demo-memory-beach',
          transcript: 'Mum, remember Whitby? Sam dropped his ice cream, and a seagull swooped down and took it!',
        },
        order: 0,
      },
      {
        id: 'memory-garden',
        title: 'My rose garden',
        photo: { id: 'demo-garden', alt: 'Pink and red roses along a wooden fence, with a watering can on the grass' },
        caption: 'The pink roses by the back fence flower every June.',
        audio: null,
        order: 1,
      },
      {
        id: 'memory-piano',
        title: 'Piano lessons',
        photo: { id: 'demo-piano', alt: 'An upright piano with sheet music and a vase of flowers on top' },
        caption: 'Teaching piano in the front room. So many happy scales.',
        audio: null,
        order: 2,
      },
      {
        id: 'memory-cat',
        title: 'Biscuit',
        photo: { id: 'demo-cat', alt: 'A ginger cat curled up asleep on a sunny windowsill' },
        caption: 'Biscuit loves the sunny spot on the windowsill.',
        audio: {
          id: 'demo-maya-hello',
          transcript: "Hi Mum, it's Maya. Give Biscuit a stroke from me. I'll see you on Sunday for tea.",
        },
        order: 3,
      },
    ],
    // Both tunes are original music-box melodies written for this demo.
    songs: [
      {
        id: 'song-waltz',
        title: 'The Riverside Waltz',
        artist: 'The Riverton Dance Band',
        note: 'We danced to this at our wedding in 1962. By the end, everyone had joined in.',
        photo: { id: 'demo-record-player', alt: 'A red record player with a spinning record on a wooden sideboard' },
        audio: { id: 'demo-song-waltz', transcript: 'A slow, gentle waltz played on a music box.' },
        order: 0,
      },
      {
        id: 'song-lullaby',
        title: "Peggy's lullaby",
        artist: 'Made up by Peggy for the children',
        note: 'I sang this to Maya and Sam every night at bedtime.',
        photo: null,
        audio: { id: 'demo-song-lullaby', transcript: 'A soft, slow lullaby melody played on a music box.' },
        order: 1,
      },
      {
        id: 'song-hymns',
        title: "Sunday hymns at St Mary's",
        artist: "St Mary's choir",
        note: 'Singing next to Mum on Sunday mornings.',
        photo: null,
        audio: null,
        order: 2,
      },
    ],
    approvals: {
      youName: true,
      youPhoto: true,
      youVoice: false,
      homePhoto: true,
      homeCue: true,
      contact: { id: 'contact-maya', name: true, relationship: true, photo: true, call: true, voice: true },
      routineCue: true,
    },
    prefs: { textSize: 'standard', readAloud: true, callMode: 'demo', backgroundMusic: true },
    // seedSample replaces personPin with a hash of SAMPLE_PIN.
    security: { personPin: null, helperPin: null, lockEnabled: true, lockHelp: true },
    setup: { mode: 'sample', wizardStep: null, lastBackupAt: null },
  };
}
