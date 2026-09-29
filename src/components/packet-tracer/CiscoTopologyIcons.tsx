import React from 'react';
import { type NetworkDeviceType } from '../../types';

interface IconProps {
  className?: string;
  size?: number;
  highlighted?: boolean;
}

/**
 * 1. Cisco Router Icon
 * Authentic Cisco 3D Puck/Cylinder with 4 inward/outward arrows
 */
export const CiscoRouterIcon: React.FC<IconProps> = ({ size = 56, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.9}
    viewBox="0 0 70 62"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoRouterTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0284c7" />
        <stop offset="50%" stopColor="#0369a1" />
        <stop offset="100%" stopColor="#075985" />
      </linearGradient>
      <linearGradient id="ciscoRouterSide" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#0369a1" />
        <stop offset="100%" stopColor="#0c4a6e" />
      </linearGradient>
      <filter id="ciscoRouterGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0284c7" floodOpacity="0.4" />
      </filter>
    </defs>

    {/* Cylinder Base / 3D Rim */}
    <path
      d="M5 25 C5 38 65 38 65 25 L65 42 C65 55 5 55 5 42 Z"
      fill="url(#ciscoRouterSide)"
      stroke="#082f49"
      strokeWidth="1.5"
    />

    {/* Cylinder Bottom Shadow Highlight */}
    <path
      d="M8 43 C8 52 62 52 62 43"
      stroke="#38bdf8"
      strokeWidth="1"
      strokeOpacity="0.5"
      fill="none"
    />

    {/* Cylinder Top Oval Face */}
    <ellipse
      cx="35"
      cy="24"
      rx="30"
      ry="17"
      fill="url(#ciscoRouterTop)"
      stroke={highlighted ? '#38bdf8' : '#082f49'}
      strokeWidth="1.8"
    />

    {/* Inner Subtle Bevel Ring */}
    <ellipse
      cx="35"
      cy="24"
      rx="26"
      ry="14"
      stroke="#38bdf8"
      strokeWidth="1"
      strokeOpacity="0.4"
      fill="none"
    />

    {/* Cisco Classic 4 Crossed Arrows */}
    <g transform="translate(35, 24)" filter="url(#ciscoRouterGlow)">
      {/* Horizontal Inward Arrows: Left pointing in, Right pointing in */}
      {/* Left arrow pointing IN to center */}
      <path
        d="M -20 0 L -8 0 M -12 -3.5 L -7 0 L -12 3.5"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right arrow pointing IN to center */}
      <path
        d="M 20 0 L 8 0 M 12 -3.5 L 7 0 L 12 3.5"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Vertical Outward Arrows: Top pointing OUT, Bottom pointing OUT */}
      {/* Top arrow pointing OUT to edge */}
      <path
        d="M 0 -2 L 0 -11 M -3.5 -7 L 0 -11 L 3.5 -7"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom arrow pointing OUT to edge */}
      <path
        d="M 0 2 L 0 11 M -3.5 7 L 0 11 L 3.5 7"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central routing pivot dot */}
      <circle cx="0" cy="0" r="2.2" fill="#ffffff" />
    </g>
  </svg>
);

/**
 * 2. Cisco Switch Icon (Layer 2 2960 Series)
 * Authentic Cisco Switch Brick with 4 horizontal arrows pointing in opposite directions
 */
export const CiscoSwitchIcon: React.FC<IconProps> = ({ size = 56, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.7}
    viewBox="0 0 74 50"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoSwitchFace" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e3a8a" />
        <stop offset="60%" stopColor="#172554" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="ciscoSwitchTop" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
    </defs>

    {/* 3D Top Bevel Plane */}
    <path
      d="M 10 6 L 64 6 L 70 16 L 4 16 Z"
      fill="url(#ciscoSwitchTop)"
      stroke="#1e40af"
      strokeWidth="1.2"
    />

    {/* Main Front Face */}
    <rect
      x="4"
      y="16"
      width="66"
      height="30"
      rx="3"
      fill="url(#ciscoSwitchFace)"
      stroke={highlighted ? '#60a5fa' : '#1e3a8a'}
      strokeWidth="1.6"
    />

    {/* Switch Port Matrix Status Grid Header */}
    <line x1="7" y1="21" x2="67" y2="21" stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.4" />

    {/* Tiny Port Activity Indicator LEDs */}
    <circle cx="10" cy="18.5" r="1" fill="#4ade80" />
    <circle cx="13" cy="18.5" r="1" fill="#4ade80" />
    <circle cx="16" cy="18.5" r="1" fill="#60a5fa" />
    <circle cx="19" cy="18.5" r="1" fill="#4ade80" />

    {/* Cisco Standard 4 Horizontal Opposite Arrows */}
    <g transform="translate(37, 33)">
      {/* Top Pair: Left arrow points LEFT, Right arrow points RIGHT */}
      <path
        d="M -3 -6 L -20 -6 M -16 -9 L -21 -6 L -16 -3"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 3 -6 L 20 -6 M 16 -9 L 21 -6 L 16 -3"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bottom Pair: Left arrow points RIGHT, Right arrow points LEFT */}
      <path
        d="M -20 5 L -3 5 M -7 2 L -2 5 L -7 8"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 20 5 L 3 5 M 7 2 L 2 5 L 7 8"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

/**
 * 3. Cisco Multilayer / Core Switch Icon (Layer 3 - 3560 / 3650)
 * Authentic Cisco Multilayer Switch Brick with 4-way crossed double-ended arrows
 */
export const CiscoMultilayerSwitchIcon: React.FC<IconProps> = ({ size = 56, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.72}
    viewBox="0 0 74 52"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoL3Face" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e40af" />
        <stop offset="60%" stopColor="#1e3a8a" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="ciscoL3Top" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
    </defs>

    {/* 3D Top Bevel */}
    <path
      d="M 11 5 L 63 5 L 70 16 L 4 16 Z"
      fill="url(#ciscoL3Top)"
      stroke="#3b82f6"
      strokeWidth="1.2"
    />

    {/* Front Face */}
    <rect
      x="4"
      y="16"
      width="66"
      height="32"
      rx="3"
      fill="url(#ciscoL3Face)"
      stroke={highlighted ? '#93c5fd' : '#2563eb'}
      strokeWidth="1.6"
    />

    {/* Layer 3 Port LEDs */}
    <circle cx="10" cy="19" r="1.1" fill="#38bdf8" />
    <circle cx="13.5" cy="19" r="1.1" fill="#4ade80" />
    <circle cx="17" cy="19" r="1.1" fill="#4ade80" />
    <circle cx="20.5" cy="19" r="1.1" fill="#38bdf8" />

    {/* Cisco Multilayer Switch 4 Crossed Double Arrows (X-pattern routing & switching) */}
    <g transform="translate(37, 33)">
      {/* Diagonal 1: Top-Left to Bottom-Right */}
      <path
        d="M -16 -7 L 16 7 M -12 -8 L -17 -7 L -15 -3 M 12 8 L 17 7 L 15 3"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Diagonal 2: Bottom-Left to Top-Right */}
      <path
        d="M -16 7 L 16 -7 M -12 8 L -17 7 L -15 3 M 12 -8 L 17 -7 L 15 -3"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central L3 Core Diamond */}
      <circle cx="0" cy="0" r="2.5" fill="#60a5fa" stroke="#ffffff" strokeWidth="1" />
    </g>
  </svg>
);

/**
 * 4. Cisco Firewall Icon (ASA 5506-X / PIX)
 * Authentic Cisco Brick Wall with Mortar and Shield / Flame
 */
export const CiscoFirewallIcon: React.FC<IconProps> = ({ size = 54, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.88}
    viewBox="0 0 64 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoBrickGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#dc2626" />
        <stop offset="50%" stopColor="#b91c1c" />
        <stop offset="100%" stopColor="#7f1d1d" />
      </linearGradient>
    </defs>

    {/* Brick Wall Outline */}
    <rect
      x="5"
      y="6"
      width="54"
      height="44"
      rx="3"
      fill="url(#ciscoBrickGrad)"
      stroke={highlighted ? '#fca5a5' : '#991b1b'}
      strokeWidth="1.8"
    />

    {/* Mortar Horizontal Lines */}
    <line x1="5" y1="17" x2="59" y2="17" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    <line x1="5" y1="28" x2="59" y2="28" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    <line x1="5" y1="39" x2="59" y2="39" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />

    {/* Vertical Mortar Bricks */}
    {/* Row 1 */}
    <line x1="22" y1="6" x2="22" y2="17" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    <line x1="41" y1="6" x2="41" y2="17" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    {/* Row 2 */}
    <line x1="13" y1="17" x2="13" y2="28" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    <line x1="32" y1="17" x2="32" y2="28" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    <line x1="51" y1="17" x2="51" y2="28" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    {/* Row 3 */}
    <line x1="22" y1="28" x2="22" y2="39" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    <line x1="41" y1="28" x2="41" y2="39" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    {/* Row 4 */}
    <line x1="13" y1="39" x2="13" y2="50" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    <line x1="32" y1="39" x2="32" y2="50" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />
    <line x1="51" y1="39" x2="51" y2="50" stroke="#ffffff" strokeWidth="1.2" strokeOpacity="0.85" />

    {/* Central Firewall Shield / Flame Emblem */}
    <g transform="translate(32, 28)">
      <circle cx="0" cy="0" r="10.5" fill="#450a0a" stroke="#fef08a" strokeWidth="1.2" />
      {/* Flame Icon */}
      <path
        d="M 0 -6 C 2 -3, 5 -1, 5 3 C 5 6, 2.5 7.5, 0 7.5 C -2.5 7.5, -5 6, -5 3 C -5 0, -2 -2, 0 -6 Z"
        fill="#f59e0b"
      />
      <path
        d="M 0 -2 C 1 0, 2.5 1.5, 2.5 3.5 C 2.5 5, 1 5.5, 0 5.5 C -1 5.5, -2.5 5, -2.5 3.5 C -2.5 2, -1 0, 0 -2 Z"
        fill="#fef08a"
      />
    </g>
  </svg>
);

/**
 * 5. Cisco Wireless Access Point (Indoor AP / LAP)
 * Authentic Cisco AP saucer dome with radiating Wi-Fi wave arcs
 */
export const CiscoAPIndoorIcon: React.FC<IconProps> = ({ size = 56, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.9}
    viewBox="0 0 68 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoAPDome" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="60%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#94a3b8" />
      </linearGradient>
    </defs>

    {/* Radiating Wireless Arcs (Top) */}
    <path
      d="M 19 16 C 28 8, 40 8, 49 16"
      stroke="#38bdf8"
      strokeWidth="2.4"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 24 21 C 30 15, 38 15, 44 21"
      stroke="#0284c7"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M 29 26 C 32 23, 36 23, 39 26"
      stroke="#0369a1"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />

    {/* Base Mounting Bracket / Plate */}
    <ellipse cx="34" cy="46" rx="26" ry="9" fill="#64748b" stroke="#334155" strokeWidth="1" />

    {/* AP Dome Main Saucer */}
    <ellipse
      cx="34"
      cy="42"
      rx="24"
      ry="9.5"
      fill="url(#ciscoAPDome)"
      stroke={highlighted ? '#38bdf8' : '#64748b'}
      strokeWidth="1.5"
    />

    {/* Cisco Center LED Status Badge */}
    <ellipse cx="34" cy="41" rx="8" ry="3.2" fill="#0284c7" />
    <circle cx="34" cy="41" r="1.5" fill="#4ade80" />
  </svg>
);

/**
 * 6. Cisco Outdoor Access Point (IP67 Rugged / 1562 Series)
 * Heavy-duty industrial chassis with dual external high-gain antennas
 */
export const CiscoAPOutdoorIcon: React.FC<IconProps> = ({ size = 56, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.95}
    viewBox="0 0 68 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoAPOutdoor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="70%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
    </defs>

    {/* Dual External Dipole Antennas */}
    {/* Left Antenna */}
    <line x1="20" y1="28" x2="13" y2="4" stroke="#64748b" strokeWidth="2.8" strokeLinecap="round" />
    <circle cx="13" cy="4" r="2.2" fill="#38bdf8" />

    {/* Right Antenna */}
    <line x1="48" y1="28" x2="55" y2="4" stroke="#64748b" strokeWidth="2.8" strokeLinecap="round" />
    <circle cx="55" cy="4" r="2.2" fill="#38bdf8" />

    {/* RF Signal Waves between antennas */}
    <path
      d="M 22 14 C 30 7, 38 7, 46 14"
      stroke="#10b981"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="3 3"
      fill="none"
    />

    {/* Rugged Aluminum Outer Enclosure */}
    <rect
      x="14"
      y="26"
      width="40"
      height="32"
      rx="5"
      fill="url(#ciscoAPOutdoor)"
      stroke={highlighted ? '#34d399' : '#475569'}
      strokeWidth="1.8"
    />

    {/* Heat-sink Cooling Fins */}
    <line x1="18" y1="33" x2="50" y2="33" stroke="#475569" strokeWidth="1" />
    <line x1="18" y1="38" x2="50" y2="38" stroke="#475569" strokeWidth="1" />
    <line x1="18" y1="43" x2="50" y2="43" stroke="#475569" strokeWidth="1" />

    {/* Outdoor IP67 Weatherproof Seal Badge */}
    <rect x="22" y="47" width="24" height="7" rx="2" fill="#047857" />
    <text x="34" y="52.5" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontWeight="bold" fontFamily="monospace">
      IP67 OUT
    </text>
  </svg>
);

/**
 * 7. Cisco Server Icon
 * Authentic Cisco UCS / Packet Tracer Server Unit with drive slots & LEDs
 */
export const CiscoServerIcon: React.FC<IconProps> = ({ size = 52, highlighted = false }) => (
  <svg
    width={size}
    height={size * 1.1}
    viewBox="0 0 60 66"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoServerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="60%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
    </defs>

    {/* Server Tower / Rack Chassis */}
    <rect
      x="8"
      y="5"
      width="44"
      height="56"
      rx="4"
      fill="url(#ciscoServerGrad)"
      stroke={highlighted ? '#38bdf8' : '#334155'}
      strokeWidth="1.8"
    />

    {/* DVD/Optical / Top Bay */}
    <rect x="13" y="11" width="34" height="6" rx="1.5" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
    <line x1="16" y1="14" x2="36" y2="14" stroke="#64748b" strokeWidth="1" />

    {/* Hot-Swap Drive Bays (3 Rows) */}
    <g transform="translate(13, 21)">
      <rect x="0" y="0" width="34" height="7" rx="1.2" fill="#0f172a" stroke="#334155" strokeWidth="0.7" />
      <circle cx="4" cy="3.5" r="1.2" fill="#22c55e" />
      <line x1="8" y1="3.5" x2="30" y2="3.5" stroke="#475569" strokeWidth="1" strokeDasharray="3 2" />

      <rect x="0" y="10" width="34" height="7" rx="1.2" fill="#0f172a" stroke="#334155" strokeWidth="0.7" />
      <circle cx="4" cy="13.5" r="1.2" fill="#22c55e" />
      <line x1="8" y1="13.5" x2="30" y2="13.5" stroke="#475569" strokeWidth="1" strokeDasharray="3 2" />

      <rect x="0" y="20" width="34" height="7" rx="1.2" fill="#0f172a" stroke="#334155" strokeWidth="0.7" />
      <circle cx="4" cy="23.5" r="1.2" fill="#38bdf8" />
      <line x1="8" y1="23.5" x2="30" y2="23.5" stroke="#475569" strokeWidth="1" strokeDasharray="3 2" />
    </g>

    {/* Ventilation Grille / Power Button */}
    <circle cx="16" cy="54" r="2.2" fill="#22c55e" />
    <circle cx="22" cy="54" r="1.5" fill="#f59e0b" />
    <line x1="28" y1="52" x2="44" y2="52" stroke="#475569" strokeWidth="1" />
    <line x1="28" y1="55" x2="44" y2="55" stroke="#475569" strokeWidth="1" />
  </svg>
);

/**
 * 8. Cisco PC (Desktop Workstation)
 * Classic Packet Tracer PC monitor with separate desktop chassis unit
 */
export const CiscoPCIcon: React.FC<IconProps> = ({ size = 54, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.9}
    viewBox="0 0 68 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoPCMonitor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
    </defs>

    {/* PC Monitor Screen Bezel */}
    <rect
      x="5"
      y="8"
      width="38"
      height="30"
      rx="3"
      fill="#1e293b"
      stroke={highlighted ? '#38bdf8' : '#475569'}
      strokeWidth="1.8"
    />
    {/* Inner Screen Display */}
    <rect x="9" y="12" width="30" height="20" rx="1.5" fill="url(#ciscoPCMonitor)" />
    {/* Screen Prompt Line */}
    <line x1="12" y1="16" x2="22" y2="16" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="12" y1="20" x2="28" y2="20" stroke="#bae6fd" strokeWidth="1" strokeLinecap="round" />

    {/* Monitor Stand */}
    <rect x="21" y="38" width="6" height="7" fill="#334155" />
    <rect x="15" y="45" width="18" height="3.5" rx="1.5" fill="#475569" />

    {/* PC Tower / Chassis (Right side) */}
    <rect
      x="46"
      y="12"
      width="17"
      height="36.5"
      rx="2.5"
      fill="#0f172a"
      stroke={highlighted ? '#38bdf8' : '#475569'}
      strokeWidth="1.5"
    />
    {/* CD Slot */}
    <line x1="49" y1="18" x2="60" y2="18" stroke="#64748b" strokeWidth="1" strokeLinecap="round" />
    {/* Power Button LED */}
    <circle cx="54.5" cy="25" r="1.8" fill="#22c55e" />
    {/* Front USB Ports */}
    <rect x="52" y="32" width="5" height="2" fill="#64748b" />
    <rect x="52" y="36" width="5" height="2" fill="#64748b" />
  </svg>
);

/**
 * 9. Cisco Laptop Icon
 * Clamshell Laptop with Open Screen and Keyboard
 */
export const CiscoLaptopIcon: React.FC<IconProps> = ({ size = 54, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.85}
    viewBox="0 0 66 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    {/* Display Lid / Screen */}
    <path
      d="M 12 8 L 54 8 L 56 34 L 10 34 Z"
      fill="#1e293b"
      stroke={highlighted ? '#38bdf8' : '#475569'}
      strokeWidth="1.6"
    />
    {/* Inner Active LCD */}
    <path d="M 15 11 L 51 11 L 53 32 L 13 32 Z" fill="#0284c7" />
    <line x1="18" y1="16" x2="32" y2="16" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />

    {/* Keyboard Deck Base */}
    <path
      d="M 4 34 L 62 34 L 66 48 L 0 48 Z"
      fill="#0f172a"
      stroke={highlighted ? '#38bdf8' : '#334155'}
      strokeWidth="1.6"
    />

    {/* Keyboard Grid Area */}
    <path d="M 12 36 L 54 36 L 56 42 L 10 42 Z" fill="#1e293b" />
    <line x1="16" y1="39" x2="50" y2="39" stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" />

    {/* Trackpad */}
    <rect x="27" y="43" width="12" height="4" rx="1" fill="#334155" />
  </svg>
);

/**
 * 10. Cisco Printer Icon
 * Office Network Laser Printer with Paper Output Tray
 */
export const CiscoPrinterIcon: React.FC<IconProps> = ({ size = 52, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.9}
    viewBox="0 0 64 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    {/* Paper Sheet Entering (Top) */}
    <path d="M 18 5 L 46 5 L 46 16 L 18 16 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />

    {/* Main Printer Body */}
    <rect
      x="8"
      y="16"
      width="48"
      height="26"
      rx="4"
      fill="#1e293b"
      stroke={highlighted ? '#38bdf8' : '#475569'}
      strokeWidth="1.8"
    />

    {/* Control Panel / Screen */}
    <rect x="13" y="21" width="10" height="6" rx="1" fill="#0284c7" />
    <circle cx="27" cy="24" r="1.5" fill="#22c55e" />

    {/* Paper Output Slot */}
    <rect x="14" y="30" width="36" height="4" rx="1" fill="#0f172a" />

    {/* Paper Ejected / Finished Document */}
    <path
      d="M 18 32 L 46 32 L 44 48 L 20 48 Z"
      fill="#ffffff"
      stroke="#cbd5e1"
      strokeWidth="1"
    />
    <line x1="22" y1="37" x2="40" y2="37" stroke="#94a3b8" strokeWidth="1" />
    <line x1="22" y1="41" x2="36" y2="41" stroke="#94a3b8" strokeWidth="1" />
  </svg>
);

/**
 * 11. Cisco Cloud / WAN Icon
 * Packet Tracer WAN / Internet Cloud
 */
export const CiscoCloudIcon: React.FC<IconProps> = ({ size = 64, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.7}
    viewBox="0 0 76 52"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    <defs>
      <linearGradient id="ciscoCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="50%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
    </defs>

    {/* Puffy Cloud Silhouette */}
    <path
      d="M 24 42 L 56 42 C 64 42, 70 36, 70 28 C 70 20, 64 15, 57 15 C 55 9, 48 5, 40 5 C 31 5, 24 10, 22 17 C 15 17, 8 23, 8 30 C 8 37, 14 42, 24 42 Z"
      fill="url(#ciscoCloudGrad)"
      stroke={highlighted ? '#bae6fd' : '#075985'}
      strokeWidth="1.8"
    />

    {/* WAN Lightning Bolt / Globe Grid inside cloud */}
    <g transform="translate(38, 25)">
      <path
        d="M 2 -10 L -6 0 L 0 0 L -2 10 L 6 0 L 0 0 Z"
        fill="#fef08a"
        stroke="#ffffff"
        strokeWidth="0.8"
      />
    </g>
  </svg>
);

/**
 * 12. Cisco Satellite / Starlink Terminal Icon
 */
export const CiscoSatelliteIcon: React.FC<IconProps> = ({ size = 54, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.9}
    viewBox="0 0 66 58"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    {/* Satellite Beam Waves */}
    <path
      d="M 38 6 C 45 10, 52 17, 56 25"
      stroke="#fbbf24"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeDasharray="4 3"
    />
    <path
      d="M 43 12 C 48 16, 53 21, 56 28"
      stroke="#f59e0b"
      strokeWidth="1.8"
      strokeLinecap="round"
    />

    {/* Parabolic Dish Face (angled at 45 deg) */}
    <ellipse
      cx="32"
      cy="28"
      rx="24"
      ry="11"
      transform="rotate(-25 32 28)"
      fill="#f8fafc"
      stroke={highlighted ? '#fbbf24' : '#64748b'}
      strokeWidth="1.8"
    />

    {/* Feed Horn Stalk & Transceiver */}
    <line x1="32" y1="28" x2="44" y2="15" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="44" cy="15" r="3" fill="#0284c7" stroke="#ffffff" strokeWidth="1" />

    {/* Angled Mounting Pole & Base */}
    <line x1="28" y1="36" x2="22" y2="48" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="12" y1="52" x2="32" y2="52" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/**
 * 13. Cisco IP Phone Icon (VoIP 7960 series)
 */
export const CiscoPhoneIcon: React.FC<IconProps> = ({ size = 50, highlighted = false }) => (
  <svg
    width={size}
    height={size * 0.95}
    viewBox="0 0 60 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="drop-shadow-md select-none transition-transform"
  >
    {/* Phone Base Body */}
    <rect
      x="8"
      y="8"
      width="44"
      height="42"
      rx="4"
      fill="#1e293b"
      stroke={highlighted ? '#38bdf8' : '#475569'}
      strokeWidth="1.6"
    />

    {/* Left Handset on Cradle */}
    <rect x="11" y="5" width="10" height="46" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1" />

    {/* LCD Screen */}
    <rect x="25" y="12" width="23" height="12" rx="1.5" fill="#0284c7" />
    <line x1="28" y1="16" x2="42" y2="16" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
    <line x1="28" y1="20" x2="38" y2="20" stroke="#bae6fd" strokeWidth="1" strokeLinecap="round" />

    {/* Keypad Grid (3x3 dots) */}
    <g transform="translate(26, 29)">
      <circle cx="3" cy="3" r="1.5" fill="#94a3b8" />
      <circle cx="10" cy="3" r="1.5" fill="#94a3b8" />
      <circle cx="17" cy="3" r="1.5" fill="#94a3b8" />

      <circle cx="3" cy="9" r="1.5" fill="#94a3b8" />
      <circle cx="10" cy="9" r="1.5" fill="#94a3b8" />
      <circle cx="17" cy="9" r="1.5" fill="#94a3b8" />

      <circle cx="3" cy="15" r="1.5" fill="#94a3b8" />
      <circle cx="10" cy="15" r="1.5" fill="#94a3b8" />
      <circle cx="17" cy="15" r="1.5" fill="#94a3b8" />
    </g>
  </svg>
);

/**
 * Master dispatcher: returns the authentic Cisco Packet Tracer topology icon for any device type
 */
export const CiscoDeviceIcon: React.FC<{
  type: NetworkDeviceType | string;
  size?: number;
  highlighted?: boolean;
}> = ({ type, size = 56, highlighted = false }) => {
  switch (type) {
    case 'Router':
      return <CiscoRouterIcon size={size} highlighted={highlighted} />;
    case 'Core Switch':
    case 'Distribution Switch':
      return <CiscoMultilayerSwitchIcon size={size} highlighted={highlighted} />;
    case 'Managed Switch':
    case 'Access Switch':
    case 'Switch':
      return <CiscoSwitchIcon size={size} highlighted={highlighted} />;
    case 'Firewall':
      return <CiscoFirewallIcon size={size} highlighted={highlighted} />;
    case 'Access Point (Indoor)':
    case 'Access Point':
      return <CiscoAPIndoorIcon size={size} highlighted={highlighted} />;
    case 'Access Point (Outdoor)':
      return <CiscoAPOutdoorIcon size={size} highlighted={highlighted} />;
    case 'Server':
      return <CiscoServerIcon size={size} highlighted={highlighted} />;
    case 'Workstation':
      return <CiscoPCIcon size={size} highlighted={highlighted} />;
    case 'Laptop':
      return <CiscoLaptopIcon size={size} highlighted={highlighted} />;
    case 'Printer':
      return <CiscoPrinterIcon size={size} highlighted={highlighted} />;
    case 'Starlink Terminal':
      return <CiscoSatelliteIcon size={size} highlighted={highlighted} />;
    default:
      return <CiscoRouterIcon size={size} highlighted={highlighted} />;
  }
};

/**
 * Cisco Packet Tracer Port Link Light Indicator
 * Green Triangle: Port Forwarding / UP
 * Amber Circle: STP Listening / Learning / Blocking
 * Red Triangle: Port Down / Shutdown
 */
export const CiscoLinkLight: React.FC<{
  status: 'up' | 'blocking' | 'down';
  angleDeg?: number;
  size?: number;
  label?: string;
}> = ({ status, angleDeg = 0, size = 10, label }) => {
  if (status === 'blocking') {
    return (
      <div
        className="flex items-center gap-1 select-none pointer-events-none"
        style={{ transform: `rotate(${angleDeg}deg)` }}
      >
        <div
          className="rounded-full bg-amber-400 border border-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
          style={{ width: `${size}px`, height: `${size}px` }}
        />
        {label && (
          <span className="text-[9px] font-mono font-bold text-amber-300 bg-slate-950/80 px-1 rounded border border-amber-800">
            {label}
          </span>
        )}
      </div>
    );
  }

  const isUp = status === 'up';
  const fillColor = isUp ? '#22c55e' : '#ef4444';
  const strokeColor = isUp ? '#15803d' : '#b91c1c';

  return (
    <div
      className="flex items-center gap-1 select-none pointer-events-none"
      style={{ transform: `rotate(${angleDeg}deg)` }}
    >
      <svg
        width={size * 1.2}
        height={size}
        viewBox="0 0 12 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={isUp ? 'drop-shadow-[0_0_4px_rgba(34,197,94,0.8)]' : 'drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]'}
      >
        {/* Pointing Triangle */}
        <polygon points="0,0 12,5 0,10" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
      </svg>
      {label && (
        <span
          className={`text-[8.5px] font-mono font-bold px-1 rounded border ${
            isUp ? 'text-emerald-300 bg-slate-950/90 border-emerald-800' : 'text-rose-300 bg-slate-950/90 border-rose-800'
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
};
