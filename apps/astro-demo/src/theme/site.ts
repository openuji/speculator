import type { ThemePresetName } from "./tokens";

interface SiteConfig {
  title: string;
  shortTitle: string;
  themePreset: ThemePresetName;
  description: string;
  submitReadyChecklist: string[];
}

export const site = {
  title: "Speculator Studio Theme",
  shortTitle: "Studio Theme",
  themePreset: "studio",
  description:
    "A publish-ready Astro theme starter for technical specs, with Speculator renderer blocks and shadcn-style local UI primitives.",
  submitReadyChecklist: [
    "Clear README with setup and customization instructions",
    "Starter runs with astro dev/build without extra services",
    "Responsive layout with accessible navigation",
    "Demo page showing real content and visual identity",
    "License and repository metadata prepared for Astro portal",
  ],
} as const satisfies SiteConfig;

export const nav = [
  { href: "/", label: "Overview" },
  { href: "/workspaces", label: "Workspace Showcase" },
] as const;
