#!/usr/bin/env python3
"""
HORA Mascot Generator v2 — Geometric Owl with Neural Pattern
Flat/minimal vector style, warm golden/amber tones
Professional, premium feel — Linear/Vercel/Stripe aesthetic

Refinements over v1:
- Controlled amber glow (not white)
- Tighter proportions, more geometric
- Cleaner wing silhouette
- More sophisticated neural pattern with hierarchy
- Better eye detail
- Subtle feather texture on chest
- Rounded square icon framing option
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import random

random.seed(42)

# === CANVAS ===
SIZE = 1024
CENTER = SIZE // 2
CX, CY = CENTER, CENTER

# === COLOR PALETTE ===
BG_DARK = (10, 10, 13, 255)          # #0A0A0D — deep near-black
GOLD = (212, 168, 83, 255)           # #D4A853 — primary gold
GOLD_DARK = (170, 125, 42, 255)     # Darker gold for depth
GOLD_WARM = (196, 148, 42, 255)     # #C4942A
GOLD_LIGHT = (240, 210, 150, 255)   # Bright gold highlight
GOLD_PALE = (255, 235, 190, 255)    # Palest gold for catchlights
BODY_DARK = (30, 30, 36, 255)       # #1E1E24 — owl body (more visible)
BODY_MID = (38, 38, 45, 255)        # Slightly lighter body area
WING_DARK = (22, 22, 28, 255)       # Wings darker than body
FACE_DISC = (40, 40, 48, 255)       # Facial disc area (more visible)
EYE_BG = (6, 6, 8, 255)             # Deep black for eye sockets


def circle(d, cx, cy, r, fill):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


def ring(d, cx, cy, r, w, fill):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=fill, width=w)


def poly(d, pts, fill):
    d.polygon(pts, fill=fill)


def line(d, x1, y1, x2, y2, fill, w=2):
    d.line([(x1, y1), (x2, y2)], fill=fill, width=w)


def aa_line(d, x1, y1, x2, y2, color, width=2):
    """Draw line with glow for anti-aliased look."""
    # Outer glow
    glow = (*color[:3], max(10, color[3] // 4))
    d.line([(x1, y1), (x2, y2)], fill=glow, width=width + 3)
    # Main line
    d.line([(x1, y1), (x2, y2)], fill=color, width=width)


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(len(c1)))


# =====================================================
# LAYER 1: BACKGROUND
# =====================================================

# Solid dark background
img = Image.new('RGBA', (SIZE, SIZE), BG_DARK)
draw = ImageDraw.Draw(img)

# Very subtle radial gradient — warm center
for r in range(440, 0, -2):
    t = r / 440
    # Warm amber glow, subtle but visible
    alpha = int(25 * (1 - t) ** 2)
    circle(draw, CX, CY - 20, r, (180, 140, 60, alpha))


# =====================================================
# LAYER 2: OWL BODY SILHOUETTE
# =====================================================

# The owl is built from overlapping geometric shapes
# Positioned slightly above center for visual balance

OWL_Y = -25  # Vertical offset (owl sits slightly above center)

# --- Lower body (egg/teardrop) ---
draw.ellipse([CX - 160, CY + 30 + OWL_Y, CX + 160, CY + 290 + OWL_Y], fill=BODY_DARK)

# --- Mid torso ---
draw.ellipse([CX - 155, CY - 40 + OWL_Y, CX + 155, CY + 180 + OWL_Y], fill=BODY_DARK)

# --- Upper chest / neck ---
draw.ellipse([CX - 130, CY - 120 + OWL_Y, CX + 130, CY + 60 + OWL_Y], fill=BODY_DARK)


# =====================================================
# LAYER 3: HEAD
# =====================================================

HEAD_Y = CY - 185 + OWL_Y
HEAD_RX = 148
HEAD_RY = 125

# Main head
draw.ellipse([CX - HEAD_RX, HEAD_Y - HEAD_RY, CX + HEAD_RX, HEAD_Y + HEAD_RY], fill=BODY_DARK)

# --- Ear tufts (sharp, geometric) ---
EAR_H = 70  # Height above head

for side in [-1, 1]:
    ear_x = CX + side * 105
    ear_tip_x = CX + side * 95
    ear_base_inner = CX + side * 65

    ear_pts = [
        (ear_x, HEAD_Y - HEAD_RY + 25),       # outer base
        (ear_tip_x, HEAD_Y - HEAD_RY - EAR_H), # tip
        (ear_base_inner, HEAD_Y - HEAD_RY + 15), # inner base
    ]
    poly(draw, ear_pts, BODY_DARK)

    # Gold accent line on ear edge
    line(draw, ear_x, HEAD_Y - HEAD_RY + 25, ear_tip_x, HEAD_Y - HEAD_RY - EAR_H,
         (212, 168, 83, 70), 2)


# =====================================================
# LAYER 4: FACIAL DISC
# =====================================================

# Subtle lighter area — like a barn owl facial disc
# Heart shape approximated with two overlapping ellipses
draw.ellipse([CX - 100, HEAD_Y - 75, CX + 100, HEAD_Y + 55], fill=FACE_DISC)
# Slight "V" indent at top (makes it more owl-like)
poly(draw, [
    (CX - 15, HEAD_Y - 80),
    (CX, HEAD_Y - 55),
    (CX + 15, HEAD_Y - 80),
    (CX, HEAD_Y - 90),
], fill=BODY_DARK)


# =====================================================
# LAYER 5: EYES
# =====================================================

EYE_Y = HEAD_Y - 10
EYE_SPACING = 62

for side in [-1, 1]:
    ex = CX + side * EYE_SPACING

    # Outer socket ring — gold
    ring(draw, ex, EYE_Y, 40, 3, GOLD)

    # Dark socket
    circle(draw, ex, EYE_Y, 38, EYE_BG)

    # Iris — radial gradient amber
    for r in range(30, 0, -1):
        t = r / 30
        # Inner is bright gold, outer is warm dark amber
        col = lerp(GOLD_LIGHT, GOLD_DARK, t * t)
        circle(draw, ex, EYE_Y, r, col)

    # Pupil — deep black
    circle(draw, ex, EYE_Y, 12, EYE_BG)

    # Inner pupil ring (subtle gold shimmer)
    ring(draw, ex, EYE_Y, 12, 1, (212, 168, 83, 40))

    # Primary catchlight (upper left)
    circle(draw, ex - 9, EYE_Y - 9, 5, GOLD_PALE)

    # Secondary catchlight (lower right, dimmer)
    circle(draw, ex + 5, EYE_Y + 5, 2, (240, 210, 150, 100))


# =====================================================
# LAYER 6: BEAK
# =====================================================

BEAK_Y = HEAD_Y + 32
# Elegant small beak
beak_pts = [
    (CX - 11, BEAK_Y),
    (CX + 11, BEAK_Y),
    (CX, BEAK_Y + 22),
]
poly(draw, beak_pts, GOLD_WARM)
# Subtle highlight on left edge
line(draw, CX - 10, BEAK_Y + 1, CX, BEAK_Y + 20, GOLD_LIGHT, 1)


# =====================================================
# LAYER 7: WINGS
# =====================================================

# Clean, geometric wing silhouettes — slightly folded

for side in [-1, 1]:
    s = side
    wing_pts = [
        (CX + s * 150, CY - 50 + OWL_Y),    # Top attachment
        (CX + s * 175, CY + 10 + OWL_Y),
        (CX + s * 200, CY + 80 + OWL_Y),
        (CX + s * 205, CY + 160 + OWL_Y),    # Widest point
        (CX + s * 185, CY + 220 + OWL_Y),
        (CX + s * 155, CY + 260 + OWL_Y),    # Wing tip
        (CX + s * 135, CY + 230 + OWL_Y),
        (CX + s * 130, CY + 160 + OWL_Y),
        (CX + s * 135, CY + 60 + OWL_Y),     # Back to body
    ]
    poly(draw, wing_pts, WING_DARK)

    # Wing edge accent (gold line on outer edge, more visible)
    for i in range(5):
        x1, y1 = wing_pts[i]
        x2, y2 = wing_pts[i + 1]
        line(draw, x1, y1, x2, y2, (212, 168, 83, 55), 2)

    # Wing tip accent (brighter at the bottom)
    line(draw, wing_pts[4][0], wing_pts[4][1], wing_pts[5][0], wing_pts[5][1],
         (212, 168, 83, 70), 2)

    # Wing feather lines (subtle internal lines)
    for j, frac in enumerate([0.35, 0.55, 0.75]):
        fy = int(CY + OWL_Y + 20 + frac * 200)
        fx_inner = int(CX + s * 138)
        fx_outer = int(CX + s * (195 - j * 12))
        line(draw, fx_inner, fy, fx_outer, fy + 12, (212, 168, 83, 30), 1)


# =====================================================
# LAYER 8: NEURAL PATTERN (CHEST)
# =====================================================

# The key visual element — golden neural pathways on the owl's chest
# Organized in a tree-like structure radiating from center

# Define nodes with hierarchy:
# Layer 0 (root): single node at top of chest
# Layer 1: 2-3 nodes
# Layer 2: 4-5 nodes
# Layer 3: 6-7 nodes (widest)
# Layer 4: 4-5 nodes (narrowing at bottom)

chest_top = CY + 15 + OWL_Y
chest_bot = CY + 250 + OWL_Y
chest_mid = (chest_top + chest_bot) // 2

# Warm glow behind the neural pattern (creates depth)
for r in range(130, 0, -2):
    t = r / 130
    alpha = int(12 * (1 - t) ** 2)
    circle(draw, CX, chest_mid - 10, r, (212, 168, 83, alpha))

nodes = [
    # Layer 0 — root
    (CX, chest_top + 10),                               # 0

    # Layer 1
    (CX - 35, chest_top + 55),                           # 1
    (CX + 35, chest_top + 55),                           # 2
    (CX, chest_top + 70),                                # 3

    # Layer 2
    (CX - 70, chest_top + 100),                          # 4
    (CX - 25, chest_top + 110),                          # 5
    (CX + 25, chest_top + 110),                          # 6
    (CX + 70, chest_top + 100),                          # 7

    # Layer 3 (widest)
    (CX - 100, chest_top + 155),                         # 8
    (CX - 55, chest_top + 160),                          # 9
    (CX, chest_top + 170),                               # 10
    (CX + 55, chest_top + 160),                          # 11
    (CX + 100, chest_top + 155),                         # 12

    # Layer 4
    (CX - 70, chest_top + 210),                          # 13
    (CX - 25, chest_top + 220),                          # 14
    (CX + 25, chest_top + 220),                          # 15
    (CX + 70, chest_top + 210),                          # 16
]

# Connections — structured neural tree
conns = [
    # Root to Layer 1
    (0, 1), (0, 2), (0, 3),
    # Layer 1 to Layer 2
    (1, 4), (1, 5), (2, 6), (2, 7), (3, 5), (3, 6),
    # Layer 2 to Layer 3
    (4, 8), (4, 9), (5, 9), (5, 10), (6, 10), (6, 11), (7, 11), (7, 12),
    # Layer 3 to Layer 4
    (8, 13), (9, 13), (9, 14), (10, 14), (10, 15), (11, 15), (11, 16), (12, 16),
    # Cross connections (lateral, making it more neural)
    (1, 3), (2, 3),
    (4, 5), (6, 7),
    (8, 9), (9, 10), (10, 11), (11, 12),
    (13, 14), (14, 15), (15, 16),
]

# Draw connections with glow effect
for a, b in conns:
    x1, y1 = nodes[a]
    x2, y2 = nodes[b]

    # Calculate distance for alpha variation
    dist = math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    base_alpha = 100 + int(50 * (1 - min(dist / 200, 1)))

    # Wide glow
    line(draw, x1, y1, x2, y2, (212, 168, 83, base_alpha // 3), 7)
    # Mid glow
    line(draw, x1, y1, x2, y2, (212, 168, 83, base_alpha // 2), 4)
    # Main line
    line(draw, x1, y1, x2, y2, (212, 168, 83, base_alpha), 2)
    # Bright core
    line(draw, x1, y1, x2, y2, (240, 210, 150, base_alpha // 2), 1)

# Draw nodes with hierarchy
for i, (nx, ny) in enumerate(nodes):
    # Node size based on layer
    if i == 0:
        # Root node — largest, brightest
        circle(draw, nx, ny, 12, (212, 168, 83, 60))
        circle(draw, nx, ny, 7, (212, 168, 83, 220))
        circle(draw, nx, ny, 4, GOLD_LIGHT)
    elif i <= 3:
        # Layer 1
        circle(draw, nx, ny, 10, (212, 168, 83, 50))
        circle(draw, nx, ny, 6, (212, 168, 83, 200))
        circle(draw, nx, ny, 3, GOLD_LIGHT)
    elif i <= 7:
        # Layer 2
        circle(draw, nx, ny, 8, (212, 168, 83, 45))
        circle(draw, nx, ny, 5, (212, 168, 83, 180))
        circle(draw, nx, ny, 2, GOLD_LIGHT)
    elif i <= 12:
        # Layer 3
        circle(draw, nx, ny, 7, (212, 168, 83, 40))
        circle(draw, nx, ny, 4, (212, 168, 83, 160))
        circle(draw, nx, ny, 2, GOLD_LIGHT)
    else:
        # Layer 4
        circle(draw, nx, ny, 6, (212, 168, 83, 35))
        circle(draw, nx, ny, 4, (212, 168, 83, 140))
        circle(draw, nx, ny, 2, GOLD_LIGHT)


# =====================================================
# LAYER 9: HEAD NEURAL PATTERN
# =====================================================

# Smaller, more delicate neural pattern on forehead
# Suggests the brain/wisdom aspect

h_nodes = [
    (CX, HEAD_Y - 85),                   # 0 — crown
    (CX - 35, HEAD_Y - 70),              # 1
    (CX + 35, HEAD_Y - 70),              # 2
    (CX - 55, HEAD_Y - 45),              # 3
    (CX - 18, HEAD_Y - 48),              # 4
    (CX + 18, HEAD_Y - 48),              # 5
    (CX + 55, HEAD_Y - 45),              # 6
    (CX, HEAD_Y - 28),                   # 7
]

h_conns = [
    (0, 1), (0, 2),
    (1, 3), (1, 4), (2, 5), (2, 6),
    (3, 4), (4, 7), (5, 7), (5, 6),
    (1, 2), (4, 5),
]

for a, b in h_conns:
    x1, y1 = h_nodes[a]
    x2, y2 = h_nodes[b]
    line(draw, x1, y1, x2, y2, (212, 168, 83, 30), 5)
    line(draw, x1, y1, x2, y2, (212, 168, 83, 70), 2)
    line(draw, x1, y1, x2, y2, (240, 210, 150, 35), 1)

for hx, hy in h_nodes:
    circle(draw, hx, hy, 5, (212, 168, 83, 50))
    circle(draw, hx, hy, 3, (212, 168, 83, 160))
    circle(draw, hx, hy, 1, GOLD_LIGHT)


# =====================================================
# LAYER 10: FEET (minimal)
# =====================================================

FEET_Y = CY + 280 + OWL_Y
for side in [-1, 1]:
    fx = CX + side * 45
    for offset in [-10, 0, 10]:
        line(draw, fx + offset, FEET_Y, fx + offset + side * 4, FEET_Y + 16,
             (212, 168, 83, 80), 2)


# =====================================================
# LAYER 11: FRAMING & AMBIENT
# =====================================================

# Subtle outer ring
ring(draw, CX, CY, 478, 1, (212, 168, 83, 40))

# Ambient particles (very subtle gold dust)
for _ in range(25):
    angle = random.uniform(0, 2 * math.pi)
    dist = random.uniform(360, 465)
    px = int(CX + dist * math.cos(angle))
    py = int(CY + dist * math.sin(angle))
    sz = random.choice([1, 1, 2])
    alpha = random.randint(15, 45)
    circle(draw, px, py, sz, (212, 168, 83, alpha))


# =====================================================
# SAVE
# =====================================================

output_path = "/Users/vivienmartin/Desktop/hora 2/claude/mascot-hora.png"

# Save with dark background (primary version for app icon use)
img_final = Image.new('RGBA', (SIZE, SIZE), BG_DARK)
img_final = Image.alpha_composite(img_final, img)

# Convert to RGB for PNG without transparency artifacts
img_rgb = img_final.convert('RGB')
img_rgb.save(output_path, 'PNG', quality=95)
print(f"Saved to: {output_path}")
print(f"Size: {img_final.size}")

# Also save RGBA version (with dark bg baked in but alpha channel preserved)
img_final.save(output_path.replace('.png', '-rgba.png'), 'PNG')
print("Also saved RGBA version")
