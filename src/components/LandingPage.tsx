/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, Building2, ShieldCheck, Award, Sparkles, Phone, Mail, 
  MapPin, Activity, FileText, CheckCircle2, Calendar, Calculator, 
  Compass, Layers, Eye, X, Check, Send, ChevronLeft, ChevronRight, HardHat, 
  Scale, Briefcase, Ruler, Clock, ExternalLink, Hammer, Wrench,
  CheckSquare, FileCheck, Users, HelpCircle, AlertTriangle, RefreshCw
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

// Authentic CTVill Local Assets
import logoJpg from '../assets/images/ctvill/logo.jpg';
import introOuter from '../assets/images/ctvill/intro_outer.webp';

// BG Comm Assets (Dumaguete, Negros - 2020)
import bgcommOuter from '../assets/images/ctvill/bgcomm_outer.webp';
import bgcommBanner1 from '../assets/images/ctvill/bgcomm_banner1.webp';
import bgcommBanner2 from '../assets/images/ctvill/bgcomm_banner2.webp';
import bgcommBanner3 from '../assets/images/ctvill/bgcomm_banner3.webp';
import bgcommBanner4 from '../assets/images/ctvill/bgcomm_banner4.webp';
import bgcommBanner5 from '../assets/images/ctvill/bgcomm_banner5.webp';
import bgcommBanner6 from '../assets/images/ctvill/bgcomm_banner6.webp';
import bgcommBanner7 from '../assets/images/ctvill/bgcomm_banner7.webp';
import bgcommBanner8 from '../assets/images/ctvill/bgcomm_banner8.webp';
import bgcommBanner9 from '../assets/images/ctvill/bgcomm_banner9.webp';
import bgcommBanner10 from '../assets/images/ctvill/bgcomm_banner10.webp';
import bgcommBanner11 from '../assets/images/ctvill/bgcomm_banner11.webp';
import bgcommThumb1 from '../assets/images/ctvill/bgcomm_banner1_thumb.webp';
import bgcommThumb2 from '../assets/images/ctvill/bgcomm_banner2_thumb.webp';
import bgcommThumb3 from '../assets/images/ctvill/bgcomm_banner3_thumb.webp';
import bgcommThumb4 from '../assets/images/ctvill/bgcomm_banner4_thumb.webp';
import bgcommThumb5 from '../assets/images/ctvill/bgcomm_banner5_thumb.webp';
import bgcommThumb6 from '../assets/images/ctvill/bgcomm_banner6_thumb.webp';
import bgcommThumb7 from '../assets/images/ctvill/bgcomm_banner7_thumb.webp';
import bgcommThumb8 from '../assets/images/ctvill/bgcomm_banner8_thumb.webp';
import bgcommThumb9 from '../assets/images/ctvill/bgcomm_banner9_thumb.webp';
import bgcommThumb10 from '../assets/images/ctvill/bgcomm_banner10_thumb.webp';
import bgcommThumb11 from '../assets/images/ctvill/bgcomm_banner11_thumb.webp';
import bgcommBlueprint1 from '../assets/images/ctvill/bgcomm_blueprint1.webp';
import bgcommBlueprint2 from '../assets/images/ctvill/bgcomm_blueprint2.webp';
import bgcommBlueprint3 from '../assets/images/ctvill/bgcomm_blueprint3.webp';
import bgcommBlueprint4 from '../assets/images/ctvill/bgcomm_blueprint4.webp';
import bgcommBlueprint5 from '../assets/images/ctvill/bgcomm_blueprint5.webp';
import bgcommBlueprint6 from '../assets/images/ctvill/bgcomm_blueprint6.webp';

// NexBridge Assets (Malolos, Bulacan - 2020)
import nexbridgeOuter from '../assets/images/ctvill/nexbridge_outer.webp';
import nexbridgeBanner1 from '../assets/images/ctvill/nexbridge_banner1.webp';
import nexbridgeBanner2 from '../assets/images/ctvill/nexbridge_banner2.webp';
import nexbridgeBanner3 from '../assets/images/ctvill/nexbridge_banner3.webp';
import nexbridgeBanner4 from '../assets/images/ctvill/nexbridge_banner4.webp';
import nexbridgeBanner5 from '../assets/images/ctvill/nexbridge_banner5.webp';
import nexbridgeBanner6 from '../assets/images/ctvill/nexbridge_banner6.webp';
import nexbridgeBanner7 from '../assets/images/ctvill/nexbridge_banner7.webp';
import nexbridgeBanner8 from '../assets/images/ctvill/nexbridge_banner8.webp';
import nexbridgeBanner9 from '../assets/images/ctvill/nexbridge_banner9.webp';
import nexbridgeBanner10 from '../assets/images/ctvill/nexbridge_banner10.webp';
import nexbridgeBanner11 from '../assets/images/ctvill/nexbridge_banner11.webp';
import nexbridgeBanner12 from '../assets/images/ctvill/nexbridge_banner12.webp';
import nexbridgeBanner13 from '../assets/images/ctvill/nexbridge_banner13.webp';
import nexbridgeThumb1 from '../assets/images/ctvill/nexbridge_banner1_thumb.webp';
import nexbridgeThumb2 from '../assets/images/ctvill/nexbridge_banner2_thumb.webp';
import nexbridgeThumb3 from '../assets/images/ctvill/nexbridge_banner3_thumb.webp';
import nexbridgeThumb4 from '../assets/images/ctvill/nexbridge_banner4_thumb.webp';
import nexbridgeThumb5 from '../assets/images/ctvill/nexbridge_banner5_thumb.webp';
import nexbridgeThumb6 from '../assets/images/ctvill/nexbridge_banner6_thumb.webp';
import nexbridgeThumb7 from '../assets/images/ctvill/nexbridge_banner7_thumb.webp';
import nexbridgeThumb8 from '../assets/images/ctvill/nexbridge_banner8_thumb.webp';
import nexbridgeThumb9 from '../assets/images/ctvill/nexbridge_banner9_thumb.webp';
import nexbridgeThumb10 from '../assets/images/ctvill/nexbridge_banner10_thumb.webp';
import nexbridgeThumb11 from '../assets/images/ctvill/nexbridge_banner11_thumb.webp';
import nexbridgeThumb12 from '../assets/images/ctvill/nexbridge_banner12_thumb.webp';
import nexbridgeThumb13 from '../assets/images/ctvill/nexbridge_banner13_thumb.webp';
import nexbridgeBlueprint1 from '../assets/images/ctvill/nexbridge_blueprint1.webp';
import nexbridgeBlueprint2 from '../assets/images/ctvill/nexbridge_blueprint2.webp';
import nexbridgeBlueprint3 from '../assets/images/ctvill/nexbridge_blueprint3.webp';
import nexbridgeBlueprint4 from '../assets/images/ctvill/nexbridge_blueprint4.webp';
import nexbridgeBlueprint5 from '../assets/images/ctvill/nexbridge_blueprint5.webp';
import nexbridgeBlueprint6 from '../assets/images/ctvill/nexbridge_blueprint6.webp';
import nexbridgeBlueprint7 from '../assets/images/ctvill/nexbridge_blueprint7.webp';

// Owl Milk Tea Assets (BF Homes, Parañaque - 2019)
import owlOuter from '../assets/images/ctvill/owl_outer.webp';
import owlBanner1 from '../assets/images/ctvill/owl_banner1.webp';
import owlBanner2 from '../assets/images/ctvill/owl_banner2.webp';
import owlBanner3 from '../assets/images/ctvill/owl_banner3.webp';
import owlBanner4 from '../assets/images/ctvill/owl_banner4.webp';
import owlBanner5 from '../assets/images/ctvill/owl_banner5.webp';
import owlBanner6 from '../assets/images/ctvill/owl_banner6.webp';
import owlBanner7 from '../assets/images/ctvill/owl_banner7.webp';
import owlBanner8 from '../assets/images/ctvill/owl_banner8.webp';
import owlBanner9 from '../assets/images/ctvill/owl_banner9.webp';
import owlBanner10 from '../assets/images/ctvill/owl_banner10.webp';
import owlBanner11 from '../assets/images/ctvill/owl_banner11.webp';
import owlBanner12 from '../assets/images/ctvill/owl_banner12.webp';
import owlBanner13 from '../assets/images/ctvill/owl_banner13.webp';
import owlThumb1 from '../assets/images/ctvill/owl_banner1_thumb.webp';
import owlThumb2 from '../assets/images/ctvill/owl_banner2_thumb.webp';
import owlThumb3 from '../assets/images/ctvill/owl_banner3_thumb.webp';
import owlThumb4 from '../assets/images/ctvill/owl_banner4_thumb.webp';
import owlThumb5 from '../assets/images/ctvill/owl_banner5_thumb.webp';
import owlThumb6 from '../assets/images/ctvill/owl_banner6_thumb.webp';
import owlThumb7 from '../assets/images/ctvill/owl_banner7_thumb.webp';
import owlThumb8 from '../assets/images/ctvill/owl_banner8_thumb.webp';
import owlThumb9 from '../assets/images/ctvill/owl_banner9_thumb.webp';
import owlThumb10 from '../assets/images/ctvill/owl_banner10_thumb.webp';
import owlThumb11 from '../assets/images/ctvill/owl_banner11_thumb.webp';
import owlThumb12 from '../assets/images/ctvill/owl_banner12_thumb.webp';
import owlThumb13 from '../assets/images/ctvill/owl_banner13_thumb.webp';
import owlBlueprint1 from '../assets/images/ctvill/owl_blueprint1.webp';
import owlBlueprint2 from '../assets/images/ctvill/owl_blueprint2.webp';
import owlBlueprint3 from '../assets/images/ctvill/owl_blueprint3.webp';
import owlBlueprint4 from '../assets/images/ctvill/owl_blueprint4.webp';

// Redbin Assets (Makati City - 2019)
import redbinOuter from '../assets/images/ctvill/redbin_outer.webp';
import redbinBanner1 from '../assets/images/ctvill/redbin_banner1.webp';
import redbinBanner2 from '../assets/images/ctvill/redbin_banner2.webp';
import redbinBanner3 from '../assets/images/ctvill/redbin_banner3.webp';
import redbinBanner4 from '../assets/images/ctvill/redbin_banner4.webp';
import redbinBanner5 from '../assets/images/ctvill/redbin_banner5.webp';
import redbinBanner6 from '../assets/images/ctvill/redbin_banner6.webp';
import redbinBanner7 from '../assets/images/ctvill/redbin_banner7.webp';
import redbinBanner8 from '../assets/images/ctvill/redbin_banner8.webp';
import redbinBanner9 from '../assets/images/ctvill/redbin_banner9.webp';
import redbinBanner10 from '../assets/images/ctvill/redbin_banner10.webp';
import redbinBanner11 from '../assets/images/ctvill/redbin_banner11.webp';
import redbinThumb1 from '../assets/images/ctvill/redbin_banner1_thumb.webp';
import redbinThumb2 from '../assets/images/ctvill/redbin_banner2_thumb.webp';
import redbinThumb3 from '../assets/images/ctvill/redbin_banner3_thumb.webp';
import redbinThumb4 from '../assets/images/ctvill/redbin_banner4_thumb.webp';
import redbinThumb5 from '../assets/images/ctvill/redbin_banner5_thumb.webp';
import redbinThumb6 from '../assets/images/ctvill/redbin_banner6_thumb.webp';
import redbinThumb7 from '../assets/images/ctvill/redbin_banner7_thumb.webp';
import redbinThumb8 from '../assets/images/ctvill/redbin_banner8_thumb.webp';
import redbinThumb9 from '../assets/images/ctvill/redbin_banner9_thumb.webp';
import redbinThumb10 from '../assets/images/ctvill/redbin_banner10_thumb.webp';
import redbinThumb11 from '../assets/images/ctvill/redbin_banner11_thumb.webp';
import redbinBlueprint1 from '../assets/images/ctvill/redbin_blueprint1.webp';
import redbinBlueprint2 from '../assets/images/ctvill/redbin_blueprint2.webp';
import redbinBlueprint3 from '../assets/images/ctvill/redbin_blueprint3.webp';
import redbinBlueprint4 from '../assets/images/ctvill/redbin_blueprint4.webp';
import redbinBlueprint5 from '../assets/images/ctvill/redbin_blueprint5.webp';
import redbinBlueprint6 from '../assets/images/ctvill/redbin_blueprint6.webp';
import redbinBlueprint7 from '../assets/images/ctvill/redbin_blueprint7.webp';
import redbinBlueprint8 from '../assets/images/ctvill/redbin_blueprint8.webp';

// Pillar & Designer Assets
import createThumb1 from '../assets/images/ctvill/create_thumb1.jpg';
import createThumb2 from '../assets/images/ctvill/create_thumb2.jpg';
import createThumb3 from '../assets/images/ctvill/create_thumb3.jpg';
import createThumb4 from '../assets/images/ctvill/create_thumb4.jpg';
import designerMakeplace from '../assets/images/ctvill/designer_makeplace.jpg';
import designerKatherine from '../assets/images/ctvill/designer_katherine.jpg';

interface LandingPageProps {
  onEnterPortal: () => void;
}

interface ProjectData {
  id: string;
  title: string;
  subtitle: string;
  category: 'bpo' | 'tech' | 'retail' | 'agency';
  categoryLabel: string;
  location: string;
  area: string;
  timeline: string;
  year: string;
  designer: string;
  designerOrg: string;
  designerImg: string;
  designerBio: string;
  designerContact?: string;
  outerImg: string;
  bannerImgs: string[];
  bannerThumbs: string[]; // Micro-thumbnails for instant 60fps gallery scrolling
  blueprintImgs: string[]; // Synchronized 1:1 with bannerImgs for dynamic floor plan highlight
  headline: string;
  story: string;
  highlights: string[];
  keyChallenges: string;
}

const PROJECTS: ProjectData[] = [
  {
    id: 'bgcomm',
    title: 'BG Comm',
    subtitle: 'Fit-Out of BPO Office (2nd Branch)',
    category: 'bpo',
    categoryLabel: 'BPO & Call Center',
    location: 'Dumaguete, Negros',
    area: '1,000 sq. meters',
    timeline: '3 months',
    year: '2020',
    designer: 'Make Place Studio',
    designerOrg: 'Make Place Studio (Est. 2016)',
    designerImg: designerMakeplace,
    designerBio: 'Make Place Studio is an interior design firm that creates experiential, meaningful spaces for businesses and households, advocating for the role of design in corporate productivity.',
    designerContact: '0917-676-3618 • makeplacestudio@gmail.com',
    outerImg: bgcommOuter,
    bannerImgs: [
      bgcommBanner1,
      bgcommBanner2,
      bgcommBanner3,
      bgcommBanner4,
      bgcommBanner5,
      bgcommBanner6,
      bgcommBanner7,
      bgcommBanner8,
      bgcommBanner9,
      bgcommBanner10,
      bgcommBanner11
    ],
    bannerThumbs: [
      bgcommThumb1,
      bgcommThumb2,
      bgcommThumb3,
      bgcommThumb4,
      bgcommThumb5,
      bgcommThumb6,
      bgcommThumb7,
      bgcommThumb8,
      bgcommThumb9,
      bgcommThumb10,
      bgcommThumb11
    ],
    // 1:1 synchronized blueprint mappings matching ctvill.com exactly
    blueprintImgs: [
      bgcommBlueprint1, // slide 1: Reception lobby seating
      bgcommBlueprint2, // slide 2: Reception desk counter
      bgcommBlueprint3, // slide 3: Meeting room & lounge
      bgcommBlueprint3, // slide 4: Meeting room angle
      bgcommBlueprint4, // slide 5: Operations call floor
      bgcommBlueprint4, // slide 6: Call floor desks
      bgcommBlueprint4, // slide 7: Acoustic partitions
      bgcommBlueprint5, // slide 8: Executive conference
      bgcommBlueprint5, // slide 9: Boardroom table
      bgcommBlueprint6, // slide 10: Pantry & breakout
      bgcommBlueprint6  // slide 11: Breakout area
    ],
    headline: 'Bigger is Better',
    story: 'Bringing BGComm’s 2nd branch to its chairman’s hometown of Negros. At 1,000 square meters, its footprint was nearly 10x larger than their first branch. Dumaguete provided an energetic, fluent talent pool, and the client sought a vibrant, stress-alleviating atmosphere for high-paced BPO operations.',
    highlights: [
      'Bright accent color palettes integrated with sleek concrete wall finishes',
      'Fully custom modular ergonomic desks enabling dynamic floor reconfiguration',
      'CTVill’s premier milestone project outside Luzon, delivered strictly on time',
      'Comprehensive HVAC and acoustic baffle zoning to dampen call center resonance'
    ],
    keyChallenges: 'Handling regional sea shipping logistics and long-distance workforce management while adhering rigorously to a tight 3-month handover window.'
  },
  {
    id: 'nexbridge',
    title: 'NexBridge',
    subtitle: 'Fit-Out of System Developer Office (2nd Branch)',
    category: 'tech',
    categoryLabel: 'Software & Tech Hub',
    location: 'Malolos, Bulacan',
    area: '350 sq. meters',
    timeline: '2 months',
    year: '2020',
    designer: 'Archt. Katherine Cervancia',
    designerOrg: 'Project Architect, CTVill (Malayan Colleges Laguna)',
    designerImg: designerKatherine,
    designerBio: 'A prodigy architect from Malayan Colleges Laguna, Archt. Cervancia led the architectural and interior fit-out for NexBridge, delivering strategic space functionality that exceeded all executive expectations.',
    outerImg: nexbridgeOuter,
    bannerImgs: [
      nexbridgeBanner1,
      nexbridgeBanner2,
      nexbridgeBanner3,
      nexbridgeBanner4,
      nexbridgeBanner5,
      nexbridgeBanner6,
      nexbridgeBanner7,
      nexbridgeBanner8,
      nexbridgeBanner9,
      nexbridgeBanner10,
      nexbridgeBanner11,
      nexbridgeBanner12,
      nexbridgeBanner13
    ],
    bannerThumbs: [
      nexbridgeThumb1,
      nexbridgeThumb2,
      nexbridgeThumb3,
      nexbridgeThumb4,
      nexbridgeThumb5,
      nexbridgeThumb6,
      nexbridgeThumb7,
      nexbridgeThumb8,
      nexbridgeThumb9,
      nexbridgeThumb10,
      nexbridgeThumb11,
      nexbridgeThumb12,
      nexbridgeThumb13
    ],
    // 1:1 synchronized blueprint mappings matching ctvill.com exactly
    blueprintImgs: [
      nexbridgeBlueprint1, // slide 1: Entry & lounge
      nexbridgeBlueprint1, // slide 2: Reception angle
      nexbridgeBlueprint2, // slide 3: Open developer workspace
      nexbridgeBlueprint3, // slide 4: High-ceiling scrum nook
      nexbridgeBlueprint3, // slide 5: Collaboration whiteboard
      nexbridgeBlueprint4, // slide 6: Meeting pod A
      nexbridgeBlueprint4, // slide 7: Meeting pod B
      nexbridgeBlueprint4, // slide 8: Meeting pod C
      nexbridgeBlueprint5, // slide 9: Focus booths
      nexbridgeBlueprint5, // slide 10: Private quiet room
      nexbridgeBlueprint6, // slide 11: Developer sleeping pods
      nexbridgeBlueprint7, // slide 12: Executive office
      nexbridgeBlueprint7  // slide 13: Executive conference
    ],
    headline: 'Details Matter',
    story: 'A year prior, CTVill constructed NexBridge’s 75 sqm starter office in just five days. Tripling in head count within months, NexBridge commissioned CTVill to design and build their permanent 350 sqm headquarters to house their rapidly scaling engineering teams.',
    highlights: [
      'Engineered high-ceiling architecture proven to foster abstract and inventive problem solving',
      'Custom fabricated furniture, collaboration nooks, whiteboard walls, and private sleeping pods',
      'Witty programmer details: binary code decals for restrooms and diskette markers for storage',
      'Full PEZA and municipal compliance coordination with zero inspection delays'
    ],
    keyChallenges: 'Translating software development sprints into tactile spatial architecture that balances focused coding with open-space agile standups.'
  },
  {
    id: 'owl',
    title: 'Owl Milk Tea',
    subtitle: 'Fit-Out of Milk Tea Bar (2nd Branch)',
    category: 'retail',
    categoryLabel: 'Commercial Retail & F&B',
    location: 'BF Homes, Parañaque',
    area: '60 sq. meters',
    timeline: '1 month',
    year: '2019',
    designer: 'Make Place Studio',
    designerOrg: 'Make Place Studio',
    designerImg: designerMakeplace,
    designerBio: 'Specializing in lifestyle retail environments that maximize customer dwell time and create viral, picture-perfect moments.',
    designerContact: '0917-676-3618 • makeplacestudio@gmail.com',
    outerImg: owlOuter,
    bannerImgs: [
      owlBanner1,
      owlBanner2,
      owlBanner3,
      owlBanner4,
      owlBanner5,
      owlBanner6,
      owlBanner7,
      owlBanner8,
      owlBanner9,
      owlBanner10,
      owlBanner11,
      owlBanner12,
      owlBanner13
    ],
    bannerThumbs: [
      owlThumb1,
      owlThumb2,
      owlThumb3,
      owlThumb4,
      owlThumb5,
      owlThumb6,
      owlThumb7,
      owlThumb8,
      owlThumb9,
      owlThumb10,
      owlThumb11,
      owlThumb12,
      owlThumb13
    ],
    // 1:1 synchronized blueprint mappings matching ctvill.com exactly
    blueprintImgs: [
      owlBlueprint1, // slide 1: Main ordering counter
      owlBlueprint1, // slide 2: Service bar angle
      owlBlueprint1, // slide 3: Menu display front
      owlBlueprint1, // slide 4: Bar prep station
      owlBlueprint1, // slide 5: POS point
      owlBlueprint1, // slide 6: Counter terrazzo detail
      owlBlueprint2, // slide 7: Customer dining lounge
      owlBlueprint2, // slide 8: Banquette seating
      owlBlueprint2, // slide 9: Pastel wall geometry
      owlBlueprint2, // slide 10: Window seating rail
      owlBlueprint2, // slide 11: Dining tables
      owlBlueprint3, // slide 12: Kitchen & sanitary prep
      owlBlueprint4  // slide 13: Storage & inventory room
    ],
    headline: 'Playful Patterns',
    story: 'The objective for Owl Milk Tea’s second flagship branch was to introduce colorful geometric patterns while creating a fun, stress-free hospitality environment for urban milk tea lovers.',
    highlights: [
      'Innovative custom solution: direct ceramic printing of terrazzo patterns when raw terrazzo was unavailable',
      'Strict color matching across multiple paint batches to achieve vivid pastel brand consistency',
      'Optimized sanitary, plumbing, and grease-trap engineering compliant with local city health codes',
      'Rapid turnkey handover in exactly 30 calendar days'
    ],
    keyChallenges: 'Overcoming supply shortages in natural terrazzo stone without compromising the design intent or exceeding budget constraints.'
  },
  {
    id: 'redbin',
    title: 'Redbin',
    subtitle: 'Fit-Out of Advertising Company Office',
    category: 'agency',
    categoryLabel: 'Creative Advertising Studio',
    location: 'Makati City',
    area: '135 sq. meters',
    timeline: '2 months',
    year: '2019',
    designer: 'Make Place Studio',
    designerOrg: 'Make Place Studio',
    designerImg: designerMakeplace,
    designerBio: 'Focused on purposeful, human-centered architectural layouts that unleash workplace creativity and team cohesion.',
    designerContact: '0917-676-3618 • makeplacestudio@gmail.com',
    outerImg: redbinOuter,
    bannerImgs: [
      redbinBanner1,
      redbinBanner2,
      redbinBanner3,
      redbinBanner4,
      redbinBanner5,
      redbinBanner6,
      redbinBanner7,
      redbinBanner8,
      redbinBanner9,
      redbinBanner10,
      redbinBanner11
    ],
    bannerThumbs: [
      redbinThumb1,
      redbinThumb2,
      redbinThumb3,
      redbinThumb4,
      redbinThumb5,
      redbinThumb6,
      redbinThumb7,
      redbinThumb8,
      redbinThumb9,
      redbinThumb10,
      redbinThumb11
    ],
    // 1:1 synchronized blueprint mappings matching ctvill.com exactly
    blueprintImgs: [
      redbinBlueprint1, // slide 1: Reception entry & chill bar
      redbinBlueprint2, // slide 2: Creative open bullpen
      redbinBlueprint2, // slide 3: Ideation workbench
      redbinBlueprint2, // slide 4: Workstation cluster
      redbinBlueprint3, // slide 5: Brainstorm lounge
      redbinBlueprint3, // slide 6: Flexible sliding partitions
      redbinBlueprint4, // slide 7: Conference room
      redbinBlueprint5, // slide 8: Executive office
      redbinBlueprint6, // slide 9: Casual pantry & bar
      redbinBlueprint7, // slide 10: Concealed storage
      redbinBlueprint8  // slide 11: Outdoor patio deck
    ],
    headline: 'Squeezing Creativity',
    story: 'Housing some of the sharpest young minds in Philippine creative advertising, this Makati office was engineered to offer a cool, chill, and inspiring ecosystem tailored to high-velocity idea incubation.',
    highlights: [
      'Intelligent layout packing a lounge, bar, conference suite, executive office, pantry, and open desks in 135 sqm',
      'Flexible acoustic sliding door partitions that instantly expand room capacity for company-wide gatherings',
      'Concealed storage rooms masked behind seamless wall-matched finishes',
      'Outdoor patio integration transformed into a casual open-air brainstorming deck'
    ],
    keyChallenges: 'Operating within rigorous Makati Commercial Estate Association (MACEA) working permits and strict building noise restriction hours.'
  }
];

const DYK_FACTS = [
  {
    icon: Layers,
    tag: 'COGNITIVE ARCHITECTURE',
    title: 'High Ceilings Foster Abstract Innovation; Focused Low Ceilings Enhance Precision',
    body: 'Cognitive architectural studies demonstrate that high ceiling volumes encourage broader abstract synthesis (ideal for brainstorm nooks and design studios), while lower structural drops foster sharp detail orientation. We calibrate every elevation to the exact tasks performed within.'
  },
  {
    icon: Activity,
    tag: 'ACOUSTIC ENGINEERING',
    title: 'Targeted Acoustic Baffles Reduce Cognitive Fatigue by Up to 40%',
    body: 'Speech intelligibility in open-plan offices is the #1 driver of worker distraction. Strategic NRC 0.85+ ceiling baffles and wall panels absorb flanking sound waves, dramatically lowering stress hormones while preserving open team collaboration.'
  },
  {
    icon: Sparkles,
    tag: 'CIRCADIAN LIGHTING',
    title: 'Dynamic 6,500K to 2,700K Kelvin Tuning Boosts Alertness by 16%',
    body: 'Cool 6,500K daylight-mimicking LEDs trigger dopamine and alertness during peak mid-day sprints, while transitioning to warm 2,700K fixtures at dusk supports natural melatonin cycles. Our MEP engineers design human-centric lighting schemes for every shift.'
  },
  {
    icon: Compass,
    tag: 'BIOPHILIC PSYCHOLOGY',
    title: 'Natural Textures & Living Elements Lower Workplace Stress by 37%',
    body: 'Integrating real timber grain, slate textures, and live foliage reduces sympathetic nervous system arousal. Commercial workspaces with biophilic elements report 15% higher wellbeing and lower absenteeism compared to sterile cubicle layouts.'
  },
  {
    icon: Ruler,
    tag: 'ERGONOMIC ENGINEERING',
    title: 'Task-Calibrated Workstations Reduce Repetitive Strain by 54%',
    body: 'Proper desk clearances, ANSI/BIFMA-rated task chairs, and 105° visual angles prevent musculoskeletal strain in high-density BPO and tech setups. We optimize physical circulation paths to encourage subconscious movement breaks.'
  },
  {
    icon: Eye,
    tag: 'CHROMATIC PSYCHOLOGY',
    title: 'High-Contrast Amber & Deep Slate Accelerates Visual Focus',
    body: 'Warm amber accents paired with deep charcoal surfaces provide warm focal grounding without visual glare. This chromatic balance sharpens executive attention spans during high-stakes boardroom negotiations and agile scrums.'
  }
];

export default function LandingPage({ onEnterPortal }: LandingPageProps) {
  // Navigation & transition state
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [modalActivePhotoIndex, setModalActivePhotoIndex] = useState<number>(0);
  const [showStoryModal, setShowStoryModal] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const handleOpenProject = (project: ProjectData) => {
    setSelectedProject(project);
    setModalActivePhotoIndex(0);
    setShowStoryModal(false);
  };

  // Did You Know? auto-rotating carousel state
  const [dykIndex, setDykIndex] = useState<number>(0);
  const [dykFade, setDykFade] = useState<boolean>(true);
  const [dykPaused, setDykPaused] = useState<boolean>(false);

  useEffect(() => {
    if (dykPaused) return;
    const timer = setInterval(() => {
      setDykFade(false);
      setTimeout(() => {
        setDykIndex((prev) => (prev + 1) % DYK_FACTS.length);
        setDykFade(true);
      }, 400);
    }, 7000);

    return () => clearInterval(timer);
  }, [dykPaused]);

  const handleSelectDykFact = (idx: number) => {
    if (idx === dykIndex) return;
    setDykFade(false);
    setTimeout(() => {
      setDykIndex(idx);
      setDykFade(true);
    }, 250);
  };

  const handlePrevDykFact = () => {
    handleSelectDykFact((dykIndex - 1 + DYK_FACTS.length) % DYK_FACTS.length);
  };

  const handleNextDykFact = () => {
    handleSelectDykFact((dykIndex + 1) % DYK_FACTS.length);
  };

  const handleConsultFromDyk = () => {
    const fact = DYK_FACTS[dykIndex];
    setProjectScope(`Commercial Fit-Out (${fact.tag})`);
    setProjectNotes(`Inquiring about ${fact.title.toLowerCase()} for our workplace layout.`);
    setShowQuoteModal(true);
  };
  
  // Quotation Modal State
  const [showQuoteModal, setShowQuoteModal] = useState<boolean>(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState<boolean>(false);
  const [quoteSubmittedEmail, setQuoteSubmittedEmail] = useState<string>('');
  const [isSubmittingQuote, setIsSubmittingQuote] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [projectScope, setProjectScope] = useState('Full Turnkey Fit-Out (Design + Build)');
  const [projectNotes, setProjectNotes] = useState('');

  // Interactive Fit-Out Cost & Timeline Estimator State
  const [estimatorSpaceType, setEstimatorSpaceType] = useState<'bpo' | 'tech' | 'retail' | 'corporate'>('corporate');
  const [estimatorArea, setEstimatorArea] = useState<number>(180);
  const [estimatorTier, setEstimatorTier] = useState<'standard' | 'premium' | 'bespoke'>('premium');

  // Calculation Logic for Fit-Out
  const rateMatrix = {
    corporate: { standard: 14500, premium: 19500, bespoke: 25000, baseWeeks: 5, weekPer100Sqm: 1.2 },
    bpo: { standard: 12500, premium: 16800, bespoke: 21500, baseWeeks: 6, weekPer100Sqm: 1.0 },
    tech: { standard: 15500, premium: 21000, bespoke: 27500, baseWeeks: 5, weekPer100Sqm: 1.3 },
    retail: { standard: 16500, premium: 23000, bespoke: 29500, baseWeeks: 4, weekPer100Sqm: 1.4 }
  };

  const currentRates = rateMatrix[estimatorSpaceType];
  const ratePerSqm = currentRates[estimatorTier];
  const estimatedCost = estimatorArea * ratePerSqm;
  const estimatedWeeks = Math.max(3, Math.round(currentRates.baseWeeks + (estimatorArea / 100) * currentRates.weekPer100Sqm));

  const handleSmoothEnterPortal = () => {
    setIsNavigating(true);
    setTimeout(() => {
      onEnterPortal();
    }, 280);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLElement> | undefined, id: string) => {
    if (e) e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteError(null);

    const cleanEmail = clientEmail.trim();
    if (!cleanEmail) {
      setQuoteError('Please enter a valid email address.');
      return;
    }

    setIsSubmittingQuote(true);
    try {
      const res = await fetch('/api/quotations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: cleanEmail,
          clientPhone: clientPhone.trim(),
          projectScope: projectScope.trim(),
          projectNotes: projectNotes.trim(),
          estimatedCost,
          estimatedWeeks,
          estimatorArea,
          spaceType: estimatorSpaceType,
          finishTier: estimatorTier,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch quotation request.');
      }

      setQuoteSubmittedEmail(cleanEmail);
      setQuoteSubmitted(true);
    } catch (err: any) {
      console.error('Quotation submission error:', err);
      setQuoteError(err.message || 'Error connecting to estimating server. Please try again or reach out to estimate@ctvill.com directly.');
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const filteredProjects = activeCategory === 'all'
    ? PROJECTS
    : PROJECTS.filter(p => p.category === activeCategory);

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen font-sans selection:bg-amber-500 selection:text-slate-950" id="landing-page-root">
      
      {/* 1. TOP UTILITY STATUS BAR */}
      <div className="bg-slate-900/95 border-b border-slate-800 text-slate-400 text-[11px] font-mono py-2 px-6 flex flex-wrap justify-between items-center tracking-wider gap-2">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="text-slate-200 font-semibold tracking-wide uppercase">CTVILL DESIGN & CONSTRUCTION</span>
          <span className="hidden sm:inline text-slate-500">• CABUYAO, LAGUNA HEADQUARTERS</span>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Phone className="w-3 h-3 text-amber-400" />
            <span>(049) 544 7724 / 0933-827-8885</span>
          </span>
          <span className="hidden md:flex items-center gap-1 text-slate-400">
            <Mail className="w-3 h-3 text-amber-400" />
            <span>estimate@ctvill.com</span>
          </span>
          <span className="bg-amber-400/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider hidden lg:inline">
            PCAB-Licensed • PEZA & MACEA Permitting Specialist
          </span>
        </div>
      </div>

      {/* 2. MAIN HEADER NAVIGATION */}
      <header className="border-b border-slate-800/80 bg-slate-950/92 backdrop-blur-md sticky top-0 z-40 transform-gpu will-change-transform">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          
          {/* Logo & Brand Identity */}
          <a href="#" className="flex items-center gap-3.5 group cursor-pointer">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-black border border-slate-800 flex items-center justify-center shadow-lg group-hover:border-amber-500/40 transition-all shrink-0 overflow-hidden">
              <img 
                src={logoJpg} 
                alt="CTVill Logo" 
                className="w-full h-full object-cover"
                decoding="async"
              />
            </div>
            <div>
              <span className="font-sans font-black text-lg sm:text-xl text-white tracking-tight block leading-tight group-hover:text-amber-400 transition-colors">
                CTVILL
              </span>
              <span className="text-[10px] text-amber-400 font-mono tracking-widest block uppercase font-bold">
                Design & Construction
              </span>
            </div>
          </a>

          {/* Navigation Links (Matching ctvill.com architecture) */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold text-slate-300">
            <a 
              href="#create" 
              onClick={(e) => scrollToSection(e, 'create')}
              className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>CREATE</span>
            </a>
            <a 
              href="#construct" 
              onClick={(e) => scrollToSection(e, 'construct')}
              className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>CONSTRUCT</span>
              <span className="text-[9px] bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded-full font-mono">Portfolio</span>
            </a>
            <a 
              href="#aftercare" 
              onClick={(e) => scrollToSection(e, 'aftercare')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              <span>AFTER CARE</span>
            </a>
            <a 
              href="#estimator" 
              onClick={(e) => scrollToSection(e, 'estimator')}
              className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400" />
              <span>Cost Estimator</span>
            </a>
            <a 
              href="#contact" 
              onClick={(e) => scrollToSection(e, 'contact')}
              className="hover:text-amber-400 transition-colors cursor-pointer"
            >
              <span>CONTACT</span>
            </a>
          </nav>

          {/* Action Hub */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            <button
              onClick={() => setShowQuoteModal(true)}
              className="hidden sm:flex px-4 py-2 border border-amber-500/40 hover:border-amber-500 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-xl cursor-pointer transition-all items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Get a Quote</span>
            </button>

            {/* Enterprise Portal Access */}
            <button
              onClick={handleSmoothEnterPortal}
              disabled={isNavigating}
              id="nav-log-in-btn"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black rounded-xl cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 group"
            >
              {isNavigating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading Hub...</span>
                </>
              ) : (
                <>
                  <span>Enterprise Portal Sign-In</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 3. HERO SHOWCASE SECTION */}
      <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
        
        {/* Architectural Glow Accents */}
        <div className="absolute inset-0 z-0 opacity-25 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-gradient-to-tr from-amber-500 to-orange-600 rounded-full blur-[140px] animate-pulseGlow"></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:36px_36px]"></div>
        </div>

        <div className="max-w-6xl mx-auto px-6 text-center relative z-10 space-y-8">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold tracking-wider uppercase shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Commercial & Corporate Fit-Out Experts
          </div>

          <h1 className="font-sans font-black text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-[1.08] max-w-4xl mx-auto">
            Consider your <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200 bg-clip-text text-transparent">dream space</span> done.
          </h1>

          <p className="font-sans text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            At <strong>CTVill</strong>, our design approach marries <strong>science and architecture</strong>. We promote strategic space functionality through in-depth analysis of client identity, ergonomics, and operational workflows — delivering turnkey fit-out and engineering from concept to handover.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => setShowQuoteModal(true)}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-bold rounded-xl cursor-pointer shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-3 group"
            >
              <span>Request Fit-Out Quotation</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={(e) => scrollToSection(e, 'construct')}
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Explore Completed Projects ↓
            </button>
          </div>

          {/* Featured Hero Portfolio Preview Card */}
          <div className="max-w-5xl mx-auto mt-10 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900/90 p-3 relative group">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              
              <div className="md:col-span-7 overflow-hidden rounded-2xl h-64 sm:h-80 relative">
                <img 
                  src={bgcommBanner1} 
                  alt="BG Comm BPO Office Fit-Out by CTVill" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 bg-slate-950/90 border border-slate-800 px-3 py-1 rounded-lg text-[11px] font-mono text-amber-300 font-bold shadow-md">
                  ★ FEATURED 1,000 SQM FIT-OUT
                </div>
              </div>

              <div className="md:col-span-5 p-4 sm:p-6 text-left space-y-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-extrabold block">
                  FLAGSHIP COMMERCIAL SHOWCASE
                </span>
                <h3 className="font-sans font-black text-xl sm:text-2xl text-white">
                  BG Comm BPO Headquarters
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  "Go big AND go home." A sprawling 1,000 sq. meter BPO workplace in Dumaguete, Negros. Completed within 3 months, featuring custom ergonomic workstations, concrete-finish accent walls, and full MEPFS acoustic engineering.
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-300">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">FLOOR AREA</span>
                    <strong>1,000 sqm</strong>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">TIMELINE</span>
                    <strong className="text-emerald-400">3 Months Handover</strong>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button 
                    onClick={() => setSelectedProject(PROJECTS[0])}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <span>Discover Full Story</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-slate-500">Design by Make Place Studio</span>
                </div>
              </div>

            </div>
          </div>

          {/* Core High-Level Credentials */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto pt-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xs text-left">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-400 block">1,000+ sqm</span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">Largest Single Fit-Out</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xs text-left">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400 block">100% On-Time</span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">Schedule Handover Record</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xs text-left">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-blue-400 block">5-Day Record</span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">Fast-Track Turnkey Sprint</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xs text-left">
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-purple-400 block">PEZA / MACEA</span>
              <span className="text-xs text-slate-400 block mt-1 font-medium">Full Permitting Mastery</span>
            </div>
          </div>

        </div>
      </section>

      {/* 4. THE 4 PILLARS OF "CREATE" */}
      <section className="py-20 bg-slate-900/60 border-b border-slate-800" id="create">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-3 max-w-3xl mx-auto mb-16">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
              THE "CREATE" PILLAR
            </span>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
              From In-Depth Research to Ready-to-Build Engineering
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Every project begins with comprehensive feasibility. CTVill aligns client operational culture with structural, mechanical, electrical, and regulatory precision before breaking ground.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Phase 01 */}
            <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl">
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={createThumb1} 
                  alt="Design Conceptualization" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow-md">
                  01
                </div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">ARCHITECTURAL VISION</span>
                  <h3 className="font-sans font-bold text-base text-white mt-1">Design Conceptualization</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    An integrated team effort of CTVill, partner designers, and specialized suppliers based on deep analysis of the company’s brand identity, user preferences, and day-to-day operational flows.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                  Aesthetics • Space Identity • Human Factors
                </div>
              </div>
            </div>

            {/* Phase 02 */}
            <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl">
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={createThumb2} 
                  alt="Engineering Design" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow-md">
                  02
                </div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">TECHNICAL BLUEPRINTS</span>
                  <h3 className="font-sans font-bold text-base text-white mt-1">Engineering Design</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Our licensed engineering team details all structural, electrical, mechanical (HVAC), Fire Detection and Alarm Systems (FDAS), plumbing, and sanitary layouts to guarantee safety and compliance.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                  MEPFS • Structural Loads • Fire Safety
                </div>
              </div>
            </div>

            {/* Phase 03 */}
            <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl">
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={createThumb3} 
                  alt="Permitting Application" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow-md">
                  03
                </div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">REGULATORY CLEARANCE</span>
                  <h3 className="font-sans font-bold text-base text-white mt-1">Permitting Application</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Before mobilization, CTVill secures all mandatory permits to avoid stops or penalties: Building Admin work permits, MACEA (Makati), City Hall building permits, Barangay clearances, and PEZA Permits to Operate.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                  MACEA • PEZA • City Hall • Building Admin
                </div>
              </div>
            </div>

            {/* Phase 04 */}
            <div className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl">
              <div className="h-44 overflow-hidden relative">
                <img 
                  src={createThumb4} 
                  alt="Construction Planning" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow-md">
                  04
                </div>
              </div>
              <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">GANTT MILESTONES</span>
                  <h3 className="font-sans font-bold text-base text-white mt-1">Construction Planning</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Rigorous operational scheduling detailing material delivery dates, specialized labor rosters, and milestone dependencies. Delivered to the client in interactive Gantt charts at least 1 week prior to mobilization.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-900 text-[11px] font-mono text-slate-500">
                  Gantt Charts • Supply Chain • Manpower
                </div>
              </div>
            </div>

          </div>

          {/* Science & Architecture Highlight Callout - Auto-Rotating "Did You Know?" */}
          <div 
            className="mt-12 bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 justify-between transition-all group relative overflow-hidden shadow-xl"
            onMouseEnter={() => setDykPaused(true)}
            onMouseLeave={() => setDykPaused(false)}
          >
            {/* Animated 7-Second Progress Bar at Bottom of Card */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900 overflow-hidden">
              <div
                key={dykIndex}
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
                style={{
                  width: '100%',
                  animation: 'dykProgress 7000ms linear forwards',
                  animationPlayState: dykPaused ? 'paused' : 'running'
                }}
              />
            </div>

            <div className="space-y-3 max-w-2xl w-full">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                  {React.createElement(DYK_FACTS[dykIndex].icon, { className: 'w-3.5 h-3.5' })}
                  DID YOU KNOW? • {DYK_FACTS[dykIndex].tag}
                </span>

                {/* Carousel controls: Prev, Dots, Next, Counter */}
                <div className="flex items-center gap-2" title="Hover to pause rotation">
                  <button
                    onClick={handlePrevDykFact}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                    aria-label="Previous fact"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {DYK_FACTS.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectDykFact(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === dykIndex 
                            ? 'w-6 bg-amber-400' 
                            : 'w-1.5 bg-slate-700 hover:bg-slate-500'
                        }`}
                        aria-label={`Go to fact ${idx + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleNextDykFact}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                    aria-label="Next fact"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-[9px] font-mono text-slate-500 ml-1 hidden sm:inline">
                    {dykIndex + 1}/{DYK_FACTS.length}
                  </span>
                </div>
              </div>

              <div className={`min-h-[120px] sm:min-h-[96px] flex flex-col justify-center transition-all duration-400 ${
                dykFade ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
              }`}>
                <h4 className="font-sans font-bold text-white text-lg sm:text-xl leading-snug">
                  {DYK_FACTS[dykIndex].title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  {DYK_FACTS[dykIndex].body}
                </p>
              </div>
            </div>

            <button
              onClick={handleConsultFromDyk}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl whitespace-nowrap cursor-pointer transition-colors shrink-0 shadow-lg shadow-amber-500/20"
              title={`Consult with engineers regarding ${DYK_FACTS[dykIndex].tag}`}
            >
              Consult with Our Engineers ➔
            </button>
          </div>

        </div>
      </section>

      {/* 5. "CONSTRUCT" PORTFOLIO SHOWCASE */}
      <section className="py-20 bg-slate-950 border-b border-slate-800" id="construct">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block mb-3">
                THE "CONSTRUCT" PILLAR
              </span>
              <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
                Featured Fit-Out Projects
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xl">
                Execution across two uncompromising stages: <strong>Preparatory Phase</strong> (mobilization & site prep) and <strong>Construction Phase</strong> (precision fabrication of approved quotation scope).
              </p>
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All Projects' },
                { id: 'bpo', label: 'BPO & Corporate' },
                { id: 'tech', label: 'Software & Tech' },
                { id: 'retail', label: 'Retail & F&B' },
                { id: 'agency', label: 'Creative Agency' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold cursor-pointer transition-all ${
                    activeCategory === tab.id
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* CTVill Construct Portfolio Archive Overview Banner */}
          <div className="mb-10 relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900/80 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
              <div className="lg:col-span-7 p-6 sm:p-10 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Official CTVill Construct Archive
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold">
                    48 High-Res Photos • 4 CAD Blueprints
                  </span>
                </div>
                <h3 className="font-sans font-black text-2xl sm:text-3xl text-white tracking-tight">
                  Turnkey Commercial Fit-Out & Architectural Engineering
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  Every workspace is built from ground-up CAD schematics to certified turnover. Explore our complete documentation archive below — featuring authentic high-definition photography, architectural floor plans, and spatial execution notes across BPO centers, software headquarters, and commercial retail.
                </p>
                <div className="flex flex-wrap gap-4 pt-2 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>2D CAD Architectural Blueprints</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Strict 1-to-3 Month Handover Cycles</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>PCAB & MACEA Compliant</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 h-64 lg:h-full min-h-[220px] relative overflow-hidden border-t lg:border-t-0 lg:border-l border-slate-800">
                <img 
                  src={introOuter} 
                  alt="CTVill Construct Portfolio Showcase" 
                  className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Project Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredProjects.map((project) => (
              <div 
                key={project.id}
                onClick={() => handleOpenProject(project)}
                className="bg-slate-900/70 border border-slate-800 hover:border-amber-500/60 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 flex flex-col justify-between group cursor-pointer"
              >
                <div className="h-64 overflow-hidden relative border-b border-slate-800">
                  <img 
                    src={project.outerImg} 
                    alt={project.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                    <span className="bg-slate-950/95 border border-slate-800 text-amber-300 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold shadow-md">
                      {project.categoryLabel}
                    </span>
                    <span className="bg-emerald-950/95 border border-emerald-700 text-emerald-300 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold shadow-md">
                      {project.timeline}
                    </span>
                    <span className="bg-slate-900/95 border border-slate-700 text-slate-300 text-[10px] font-mono px-2.5 py-1 rounded-full font-bold shadow-md">
                      {project.year}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-amber-500/90 text-slate-950 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
                    <Eye className="w-3 h-3" />
                    <span>{project.bannerImgs.length} Photos + CAD Blueprint</span>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-slate-950/90 border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono text-slate-300 shadow-md">
                    {project.area}
                  </div>
                </div>

                <div className="p-6 sm:p-8 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-sans font-black text-2xl text-white group-hover:text-amber-400 transition-colors">
                          {project.title}
                        </h3>
                        <p className="text-xs text-amber-400/90 font-mono font-medium">
                          {project.subtitle} • {project.location}
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-slate-300 leading-relaxed pt-2">
                      {project.headline} — {project.story.substring(0, 190)}...
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img 
                        src={project.designerImg} 
                        alt={project.designer} 
                        className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="text-[10px]">
                        <span className="text-slate-400 block">Lead Designer</span>
                        <strong className="text-slate-200 font-medium">{project.designer}</strong>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProject(project);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 group-hover:shadow-md"
                    >
                      <span>Explore Gallery ({project.bannerImgs.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 6. "AFTER CARE" PILLAR */}
      <section className="py-20 bg-slate-900/40 border-b border-slate-800" id="aftercare">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto mb-16">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
              THE "AFTER CARE" PILLAR
            </span>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
              Turnkey Accountability After Turnover
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Our commitment never terminates when the physical fit-out finishes. CTVill backs every commercial space with contractual warranties, punch-list rectifications, and occupancy permit closeout.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            
            {/* 01 Punch List */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 relative shadow-xl hover:border-amber-500/40 transition-colors">
              <span className="font-mono text-4xl font-black text-amber-400/40 block">01</span>
              <h3 className="font-sans font-bold text-lg text-white">Punch List Completion</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prior to final signoff, our QA inspectors walk the space alongside your management team. Every item is logged into the system and corrected before final acceptance.
              </p>
              <div className="pt-2 text-[11px] font-mono text-amber-400 font-bold flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-amber-400" />
                <span>Subject to Client Approval</span>
              </div>
            </div>

            {/* 02 Warranty */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 relative shadow-xl hover:border-amber-500/40 transition-colors">
              <span className="font-mono text-4xl font-black text-amber-400/40 block">02</span>
              <h3 className="font-sans font-bold text-lg text-white">Comprehensive Warranty</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We stand behind our materials and workmanship. Any structural, electrical, or plumbing defect is serviced free of charge within the active warranty period.
              </p>
              <div className="pt-2 text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Free Maintenance & Repairs</span>
              </div>
            </div>

            {/* 03 Permitting Application */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 relative shadow-xl hover:border-amber-500/40 transition-colors">
              <span className="font-mono text-4xl font-black text-amber-400/40 block">03</span>
              <h3 className="font-sans font-bold text-lg text-white">Occupancy Permitting</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We manage the complex bureaucratic processing of final Occupancy Permits, Fire Safety Inspection Certificates (FSIC), and PEZA final operations licenses.
              </p>
              <div className="pt-2 text-[11px] font-mono text-blue-400 font-bold flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-blue-400" />
                <span>Turnkey Regulatory Clearance</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. INTERACTIVE COMMERCIAL FIT-OUT ESTIMATOR */}
      <section className="py-20 bg-slate-950 border-b border-slate-800" id="estimator">
        <div className="max-w-5xl mx-auto px-6">
          
          <div className="text-center space-y-3 mb-12">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
              COMMERCIAL TOOLS
            </span>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
              Commercial Fit-Out Cost & Timeline Estimator
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Configure your space category, square meterage, and architectural finish grade to preview benchmark timelines and budget estimates.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Input Controls */}
            <div className="md:col-span-7 space-y-6">
              
              {/* Space Type Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 font-bold uppercase">
                  1. SELECT FACILITY TYPOLOGY
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'corporate', label: 'Corporate Office' },
                    { id: 'bpo', label: 'BPO / Call Center' },
                    { id: 'tech', label: 'Tech & Dev Studio' },
                    { id: 'retail', label: 'Retail Store / F&B' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setEstimatorSpaceType(item.id as any)}
                      className={`p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left ${
                        estimatorSpaceType === item.id
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                          : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">2. FLOOR AREA (SQM):</span>
                  <span className="text-amber-400 font-bold">{estimatorArea} SQM</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="1200"
                  step="10"
                  value={estimatorArea}
                  onChange={(e) => setEstimatorArea(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-950 rounded-lg cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>40 sqm (Small Studio)</span>
                  <span>500 sqm (Mid Office)</span>
                  <span>1,200 sqm (BPO Floor)</span>
                </div>
              </div>

              {/* Quality Finish Tier */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-slate-400 font-bold uppercase">
                  3. SPECIFICATION & FINISH TIER
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'standard', label: 'Standard Commercial' },
                    { id: 'premium', label: 'Premium Modern' },
                    { id: 'bespoke', label: 'Bespoke Executive' }
                  ].map(tier => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setEstimatorTier(tier.id as any)}
                      className={`p-2.5 rounded-xl text-[11px] font-mono cursor-pointer transition-all text-center ${
                        estimatorTier === tier.id
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Results Preview Box */}
            <div className="md:col-span-5 bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 text-center shadow-inner">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                PRELIMINARY BALLPARK ESTIMATE
              </span>

              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-amber-400">
                  ₱{estimatedCost.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Estimated Turnkey Fit-Out Investment
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-500 block">EST. TIMELINE</span>
                  <strong className="text-white text-sm">~{estimatedWeeks} Weeks</strong>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[9px] text-slate-500 block">RATE / SQM</span>
                  <strong className="text-emerald-400 text-sm">₱{ratePerSqm.toLocaleString()}</strong>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 font-mono text-left leading-relaxed bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                ✓ Includes Architectural Drawings & 3D Renders<br />
                ✓ Includes Structural, MEPFS & FDAS Engineering<br />
                ✓ Includes City Hall, PEZA & Admin Permitting Support
              </div>

              <button
                onClick={() => {
                  setProjectScope(`Turnkey Fit-Out (${estimatorArea} sqm ${estimatorSpaceType.toUpperCase()} - ${estimatorTier} tier)`);
                  setShowQuoteModal(true);
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Request Official Line-Item Bid</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 8. TESTIMONIALS & DESIGN PARTNER ENDORSEMENTS */}
      <section className="py-20 bg-slate-900/60 border-b border-slate-800" id="testimonials">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto mb-14">
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-4 py-1 text-xs font-mono font-bold uppercase inline-block">
              REPUTATION & PARTNERSHIPS
            </span>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white tracking-tight">
              Endorsed by Fast-Growing Enterprises
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            {/* Testimonial 1 */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="text-amber-400 flex gap-1 text-sm">★★★★★</div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "CTVill constructed our 75 sqm office in 5 days, and when we tripled in size they built out our 350 sqm headquarters in Bulacan. Their detail-oriented craftsmanship — from binary decals to acoustic pods — gave our engineers a real sanctuary."
              </p>
              <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
                  NB
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">NexBridge Technologies</h4>
                  <p className="text-[10px] text-slate-400 font-mono">System Developer • Malolos, Bulacan</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-4 shadow-xl">
              <div className="text-amber-400 flex gap-1 text-sm">★★★★★</div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "Collaborating with CTVill as our construction arm has allowed our interior design visions to become reality without friction. Their problem-solving on the ground — like tile-printed terrazzo at Owl Milk Tea — makes them our go-to partner."
              </p>
              <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
                <img 
                  src={designerMakeplace} 
                  alt="Make Place Studio" 
                  className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <h4 className="font-bold text-xs text-white">Make Place Studio</h4>
                  <p className="text-[10px] text-slate-400 font-mono">Interior Design Firm • Est. 2016</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 9. CONTACT SECTION */}
      <section className="py-20 bg-slate-950 border-b border-slate-800" id="contact">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              <div className="lg:col-span-6 space-y-6">
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-3.5 py-1 text-xs font-mono font-bold uppercase inline-block">
                  DIRECT CONTACT & QUOTATIONS
                </span>
                <h2 className="font-sans font-black text-3xl sm:text-5xl text-white tracking-tight leading-tight">
                  Let's bring your space into reality.
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Send us your preliminary floor plan, scope of work, or leasing address. Our estimators and licensed project architects will evaluate feasibility and deliver a formal schedule and quotation.
                </p>

                <div className="space-y-3 pt-2 text-xs font-mono">
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span>Unit 201-202B Centennial Plaza Bldg., Brgy. San Isidro, Cabuyao, Laguna</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span>(049) 544 7724 • 0933-827-8885 • 0916-297-4604</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span>concierge@ctvill.com (queries) • estimate@ctvill.com (quotations)</span>
                  </div>
                </div>
              </div>

              {/* Interactive Quotation Launcher Box */}
              <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
                <h3 className="font-sans font-bold text-lg text-white">
                  Fast-Track Your Fit-Out Bid
                </h3>
                <p className="text-xs text-slate-400">
                  Fill in your project basics to route directly to our Laguna estimating engineering desk.
                </p>

                <form onSubmit={handleQuoteSubmit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Company / Client Name</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Acme Tech Corporation"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
                      <input 
                        type="email"
                        required
                        placeholder="operations@acme.com"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Phone / Mobile</label>
                      <input 
                        type="tel"
                        required
                        placeholder="0917-000-0000"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Scope / Space Details</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. 250 sqm Office Fit-Out, BGC Taguig"
                      value={projectScope}
                      onChange={(e) => setProjectScope(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit to Estimating Desk (estimate@ctvill.com)</span>
                  </button>
                </form>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer className="bg-slate-950 text-slate-400 pt-16 pb-8 border-t border-slate-800 font-sans" id="corporate-footer">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-800">
            
            {/* Brand Profile */}
            <div className="lg:col-span-4 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-black border border-slate-800 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
                  <img src={logoJpg} alt="CTVill Logo" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                </div>
                <span className="font-sans font-black text-white text-base tracking-tight">
                  CTVILL DESIGN & CONSTRUCTION
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                A premier commercial, corporate, and retail fit-out contractor uniting scientific ergonomics with innovative architecture across Metro Manila, Laguna, and nationwide.
              </p>
              <div className="space-y-1.5 pt-2 text-xs font-mono text-slate-400">
                <p>Unit 201-202B Centennial Plaza Bldg.</p>
                <p>Brgy. San Isidro, Cabuyao, Laguna, Philippines</p>
                <p className="text-amber-400">(049) 544 7724 • 0933-827-8885</p>
              </div>
            </div>

            {/* Operational Services */}
            <div className="lg:col-span-3 space-y-4 text-left">
              <h4 className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase border-l-2 border-amber-500 pl-2">
                CORE WORKFLOWS
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li><a href="#create" className="hover:text-amber-400 transition-colors">01 Design Conceptualization</a></li>
                <li><a href="#create" className="hover:text-amber-400 transition-colors">02 Engineering Design (MEPFS / FDAS)</a></li>
                <li><a href="#create" className="hover:text-amber-400 transition-colors">03 Permitting (MACEA, PEZA, LGU)</a></li>
                <li><a href="#create" className="hover:text-amber-400 transition-colors">04 Construction Planning & Gantt</a></li>
                <li><a href="#construct" className="hover:text-amber-400 transition-colors">Turnkey Fit-Out Execution</a></li>
                <li><a href="#aftercare" className="hover:text-amber-400 transition-colors">After Care & Warranty Support</a></li>
              </ul>
            </div>

            {/* Enterprise ERP Access */}
            <div className="lg:col-span-2 space-y-4 text-left">
              <h4 className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase border-l-2 border-blue-500 pl-2">
                PMS WORKSPACES
              </h4>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <button onClick={handleSmoothEnterPortal} className="text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors bg-transparent border-none p-0">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>Executive Hub</span>
                  </button>
                </li>
                <li>
                  <button onClick={handleSmoothEnterPortal} className="text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors bg-transparent border-none p-0">
                    <HardHat className="w-3.5 h-3.5 text-blue-400" />
                    <span>Site Quality Inspector</span>
                  </button>
                </li>
                <li>
                  <button onClick={handleSmoothEnterPortal} className="text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors bg-transparent border-none p-0">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Client Project Portal</span>
                  </button>
                </li>
                <li>
                  <button onClick={handleSmoothEnterPortal} className="text-slate-400 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors bg-transparent border-none p-0">
                    <Scale className="w-3.5 h-3.5 text-purple-400" />
                    <span>Permits & Compliance</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Design Collaborators */}
            <div className="lg:col-span-3 space-y-4 text-left">
              <h4 className="text-[10px] font-mono font-bold text-slate-300 tracking-wider uppercase border-l-2 border-emerald-500 pl-2">
                PARTNER FIRMS
              </h4>
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2.5">
                  <img src={designerMakeplace} alt="Make Place Studio" className="w-8 h-8 rounded-lg object-cover" loading="lazy" decoding="async" />
                  <div>
                    <h5 className="text-xs font-bold text-white leading-tight">Make Place Studio</h5>
                    <p className="text-[10px] text-slate-400">Collaborative Design Partner</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  "Creating meaningful, human-centered spaces with high aesthetic and experiential impact."
                </p>
              </div>
            </div>

          </div>

          {/* Regulatory Badges */}
          <div className="py-6 flex flex-wrap items-center justify-between gap-6 border-b border-slate-800 text-[10px] font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>PEZA PERMITTING & FIT-OUT CLEARANCE</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span>MACEA (MAKATI CBD) PROTOCOL QUALIFIED</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>NBCP (NATIONAL BUILDING CODE) CERTIFIED</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
              <span>FULL MEPFS & FDAS CODE ADHERENCE</span>
            </div>
          </div>

          {/* Legal Notice */}
          <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} CTVill Design & Construction. All rights reserved.
            </p>
            <div className="flex items-center gap-3 font-mono">
              <span className="hover:text-amber-400 transition-colors cursor-pointer">concierge@ctvill.com</span>
              <span>•</span>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">estimate@ctvill.com</span>
              <span>•</span>
              <span className="hover:text-amber-400 transition-colors cursor-pointer">Privacy Policy</span>
            </div>
          </div>

        </div>
      </footer>

      {/* MODAL: PROJECT DETAIL DEEP-DIVE WITH LIVE SYNCHRONIZED BLUEPRINT */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/92 flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn overscroll-contain">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-5 sm:p-8 space-y-6 shadow-2xl animate-slideUp max-h-[92vh] overflow-y-auto transform-gpu overscroll-contain will-change-scroll [contain:paint]">
            
            {/* Modal Top Bar */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider">
                    {selectedProject.categoryLabel}
                  </span>
                  <span className="text-[10px] font-mono text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                    Completed {selectedProject.year}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    {selectedProject.timeline} Delivery
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white">{selectedProject.title}</h3>
                <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>{selectedProject.subtitle} • {selectedProject.location}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedProject(null)}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors shrink-0"
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* 1. Main Photo Carousel Viewport */}
            <div className="h-64 sm:h-[400px] md:h-[440px] rounded-2xl border border-slate-800 relative bg-black flex items-center justify-center select-none group shadow-2xl overflow-hidden">
              <img 
                src={selectedProject.bannerImgs[modalActivePhotoIndex]} 
                alt={`${selectedProject.title} Slide ${modalActivePhotoIndex + 1}`} 
                className="w-full h-full object-cover transition-all duration-300"
                decoding="async" 
              />

              {/* Previous Photo Button */}
              <button
                onClick={() => setModalActivePhotoIndex((prev) => (prev - 1 + selectedProject.bannerImgs.length) % selectedProject.bannerImgs.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-white backdrop-blur-md border border-slate-800 transition-all cursor-pointer shadow-lg opacity-80 hover:opacity-100"
                title="Previous Photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Next Photo Button */}
              <button
                onClick={() => setModalActivePhotoIndex((prev) => (prev + 1) % selectedProject.bannerImgs.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-white backdrop-blur-md border border-slate-800 transition-all cursor-pointer shadow-lg opacity-80 hover:opacity-100"
                title="Next Photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Photo Counter Overlay */}
              <span className="absolute top-3 right-3 bg-slate-950/85 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-mono text-slate-200 border border-slate-800 shadow-md">
                Photo {modalActivePhotoIndex + 1} of {selectedProject.bannerImgs.length}
              </span>

              {/* Location Badge */}
              <span className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-mono text-amber-400 font-bold border border-slate-800 shadow-md">
                {selectedProject.title} • {selectedProject.location}
              </span>
            </div>

            {/* 2. Synchronized Specs & Floor Plan Section (Matching ctvill.com Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-slate-950/70 p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-xl">
              
              {/* Left Column: Headline with Info Button & Specs Table */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <h4 className="font-sans font-black text-2xl sm:text-3xl text-white tracking-tight">
                    {selectedProject.headline}
                  </h4>
                  <button
                    onClick={() => setShowStoryModal(!showStoryModal)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-serif cursor-pointer transition-all shrink-0 ${
                      showStoryModal 
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 ring-2 ring-amber-400' 
                        : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40'
                    }`}
                    title={showStoryModal ? "Hide story details" : "View full project story & highlights"}
                  >
                    i
                  </button>
                </div>

                {/* Specification Table */}
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-baseline">
                    <span className="text-slate-400 w-32 shrink-0 font-medium tracking-wide text-[11px]">PROJECT YEAR</span>
                    <span className="text-white font-bold">{selectedProject.year}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-slate-400 w-32 shrink-0 font-medium tracking-wide text-[11px]">TYPE</span>
                    <span className="text-white font-bold">{selectedProject.subtitle}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-slate-400 w-32 shrink-0 font-medium tracking-wide text-[11px]">LOCATION</span>
                    <span className="text-white font-bold">{selectedProject.location}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-slate-400 w-32 shrink-0 font-medium tracking-wide text-[11px]">AREA</span>
                    <span className="text-white font-bold">{selectedProject.area}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-slate-400 w-32 shrink-0 font-medium tracking-wide text-[11px]">TIMELINE</span>
                    <span className="text-emerald-400 font-bold">{selectedProject.timeline}</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-slate-400 w-32 shrink-0 font-medium tracking-wide text-[11px]">DESIGNER</span>
                    <span className="text-amber-400 font-bold">{selectedProject.designer}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Synchronized Blueprint Floor Plan Canvas */}
              <div className="lg:col-span-6 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                    SYNCHRONIZED FLOOR PLAN
                  </span>
                  <span className="text-amber-400 font-bold">
                    Zone {modalActivePhotoIndex + 1} of {selectedProject.bannerImgs.length}
                  </span>
                </div>

                {/* Floor plan container with white canvas and orange highlighted active zone */}
                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-700/80 shadow-2xl flex items-center justify-center min-h-[170px] sm:min-h-[200px] overflow-hidden">
                  <img 
                    key={modalActivePhotoIndex}
                    src={selectedProject.blueprintImgs[modalActivePhotoIndex] || selectedProject.blueprintImgs[0]} 
                    alt={`${selectedProject.title} Blueprint Zone ${modalActivePhotoIndex + 1}`} 
                    className="w-full h-auto max-h-[200px] object-contain transition-opacity duration-300 animate-fadeIn" 
                    decoding="async"
                  />
                </div>
              </div>

            </div>

            {/* 3. Photo Thumbnail Navigation Strip */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider block">
                Jump to Room / Zone Photo ({selectedProject.bannerImgs.length} Captures)
              </span>
              <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-thin overscroll-x-contain">
                {selectedProject.bannerImgs.map((_img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setModalActivePhotoIndex(idx)}
                    className={`h-16 w-24 sm:h-20 sm:w-28 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer relative ${
                      modalActivePhotoIndex === idx
                        ? 'border-amber-400 ring-2 ring-amber-400/40 scale-102 shadow-lg shadow-amber-500/20'
                        : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'
                    }`}
                    title={`View Photo ${idx + 1}`}
                  >
                    <img 
                      src={selectedProject.bannerThumbs?.[idx] || selectedProject.bannerImgs[idx]} 
                      alt={`Thumb ${idx + 1}`} 
                      className="w-full h-full object-cover pointer-events-none" 
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-white">
                      {idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Project Story & Engineering Highlights Drawer */}
            {showStoryModal && (
              <div className="space-y-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-5 sm:p-6 animate-fadeIn">
                <div className="space-y-2 text-xs text-slate-300">
                  <h4 className="font-bold text-sm text-white font-sans flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Project Narrative & Spatial Strategy</span>
                  </h4>
                  <p className="leading-relaxed text-slate-300">{selectedProject.story}</p>
                </div>

                {/* Highlights */}
                <div className="space-y-2 pt-2">
                  <h5 className="text-[11px] font-mono text-amber-400 font-bold uppercase">
                    ENGINEERING & FIT-OUT HIGHLIGHTS
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-400">
                    {selectedProject.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Challenges & Solution */}
                <div className="bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono text-amber-300 font-bold uppercase block">
                    PROJECT CHALLENGE & CTVILL SOLUTION
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedProject.keyChallenges}
                  </p>
                </div>

                {/* Designer Card */}
                <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                  <img 
                    src={selectedProject.designerImg} 
                    alt={selectedProject.designer} 
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-amber-400 uppercase font-bold">PROJECT DESIGN LEAD</span>
                    <h5 className="text-xs font-bold text-white">{selectedProject.designer}</h5>
                    <p className="text-[11px] text-slate-400">{selectedProject.designerOrg}</p>
                    {selectedProject.designerContact && (
                      <p className="text-[10px] text-slate-500 font-mono">{selectedProject.designerContact}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedProject(null);
                  setProjectScope(`Fit-Out Consultation based on ${selectedProject.title} style`);
                  setShowQuoteModal(true);
                }}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-lg shadow-amber-500/20 text-center"
              >
                Inquire for Similar Project ➔
              </button>
              <button
                onClick={() => setShowStoryModal(!showStoryModal)}
                className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer transition-colors text-center"
              >
                {showStoryModal ? 'Hide Narrative' : 'Read Project Story (i)'}
              </button>
              <button
                onClick={() => setSelectedProject(null)}
                className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer transition-colors text-center"
              >
                Close Viewer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: REQUEST A QUOTE / ESTIMATION */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 animate-fadeIn overscroll-contain">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-slideUp transform-gpu [contain:paint]">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Request Fit-Out Quotation</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Direct to CTVill Estimating Desk</p>
                </div>
              </div>
              <button 
                onClick={() => setShowQuoteModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {quoteSubmitted ? (
              <div className="bg-emerald-950/80 border border-emerald-600 text-emerald-200 text-xs p-6 rounded-2xl text-center space-y-4 animate-fadeIn">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <div>
                  <h4 className="font-bold text-lg text-white">Quotation Request Dispatched!</h4>
                  <p className="text-[11px] font-mono text-emerald-400 mt-0.5">Confirmation Emailed & Synced to Database</p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-left text-[11px] space-y-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Formal quotation receipt emailed to: <strong className="text-amber-400">{quoteSubmittedEmail}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Admin alert dispatched to: <strong className="text-white">estimate@ctvill.com</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Permanently logged into CTVill Project Management System</span>
                  </div>
                </div>

                <p className="leading-relaxed text-slate-300">
                  Our licensed architects and estimators will review your spatial requirements and contact you within 24 hours to schedule a free ocular site survey.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuoteModal(false);
                    setQuoteSubmitted(false);
                    setClientName('');
                    setClientEmail('');
                    setClientPhone('');
                    setProjectNotes('');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form onSubmit={handleQuoteSubmit} className="space-y-3.5 text-xs">
                {quoteError && (
                  <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-xl text-xs text-red-200 flex items-center gap-2.5 animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="font-medium">{quoteError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Company or Individual Name</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. NexBridge Software"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Email Address (for Quotation Delivery)</label>
                    <input
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="hello@company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Mobile / WhatsApp</label>
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="0917-123-4567"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Project Scope / Estimated Area</label>
                  <input
                    type="text"
                    required
                    value={projectScope}
                    onChange={(e) => setProjectScope(e.target.value)}
                    placeholder="e.g. 500 sqm BPO Office Fit-Out, Cabuyao"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Specific Requirements / Target Move-in Date</label>
                  <textarea
                    rows={3}
                    value={projectNotes}
                    onChange={(e) => setProjectNotes(e.target.value)}
                    placeholder="Provide details such as leased building address, target handover month, or required specialized facilities..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingQuote}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingQuote ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Dispatching & Sending Email...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Request to estimate@ctvill.com</span>
                    </>
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
