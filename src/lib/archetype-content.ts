import type { ArchetypeSlug } from './classifier';

export interface ArchetypeContent {
  slug: ArchetypeSlug;
  name: string;
  title: string;
  description: string;
  element: string;
  color: string;
  accentHex: string;
}

export const archetypes: Record<ArchetypeSlug, ArchetypeContent> = {
  air_weaver: {
    slug: 'air_weaver',
    name: 'Air Weaver',
    title: 'The Air Weaver',
    description: 'You move through the world like breath itself — analyzing, understanding, building frameworks that make the invisible visible. Your power is clarity. You don\'t just learn systems; you master them.',
    element: 'Air',
    color: 'text-blue-300',
    accentHex: '#93c5fd',
  },
  embodied_intuitive: {
    slug: 'embodied_intuitive',
    name: 'Embodied Intuitive',
    title: 'The Embodied Intuitive',
    description: 'Your body knows things your mind hasn\'t caught up to yet. You feel truth before you think it, sense shifts before they happen. Your wisdom lives in sensation, movement, and the electricity of physical knowing.',
    element: 'Earth',
    color: 'text-emerald-300',
    accentHex: '#6ee7b7',
  },
  ascending_seeker: {
    slug: 'ascending_seeker',
    name: 'Ascending Seeker',
    title: 'The Ascending Seeker',
    description: 'You are the open sky — curious without needing answers, exploring without needing destinations. Where others grip, you release. Your power is surrender, and in that surrender, you find what everyone else misses.',
    element: 'Spirit',
    color: 'text-purple-300',
    accentHex: '#c4b5fd',
  },
  shadow_dancer: {
    slug: 'shadow_dancer',
    name: 'Shadow Dancer',
    title: 'The Shadow Dancer',
    description: 'You go where others won\'t. The depths, the patterns, the uncomfortable truths — these are your territory. You know that transformation lives in the places most people avoid, and you walk there willingly.',
    element: 'Shadow',
    color: 'text-red-300',
    accentHex: '#fca5a5',
  },
  flow_artist: {
    slug: 'flow_artist',
    name: 'Flow Artist',
    title: 'The Flow Artist',
    description: 'Body and spirit move as one in you. You\'re both grounded and transcendent — feeling the physical world deeply while remaining open to what lies beyond it. Your gift is making the sacred look effortless.',
    element: 'Water',
    color: 'text-cyan-300',
    accentHex: '#67e8f9',
  },
  grounded_mystic: {
    slug: 'grounded_mystic',
    name: 'Grounded Mystic',
    title: 'The Grounded Mystic',
    description: 'You hold the paradox: the analytical mind and the shadow-walking soul. You need both the framework AND the mystery, the structure AND the depth. Your rare combination sees patterns others can\'t even name.',
    element: 'Mercury',
    color: 'text-hermetic-gold',
    accentHex: '#C5A059',
  },
};

/** Convert an ArchetypeSlug ('air_weaver') to a URL slug ('air-weaver'). */
export function toUrlSlug(slug: ArchetypeSlug): string {
  return slug.replace(/_/g, '-');
}

/** Look up archetype content by URL slug ('air-weaver'). */
export function archetypeByUrlSlug(urlSlug: string): ArchetypeContent | undefined {
  const internalSlug = urlSlug.replace(/-/g, '_');
  return archetypes[internalSlug as ArchetypeSlug];
}
