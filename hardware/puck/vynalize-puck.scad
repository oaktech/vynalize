// ═══════════════════════════════════════════════════════
// Vynalize Puck — Pi 5 + Mini USB Mic Enclosure
// ═══════════════════════════════════════════════════════
//
// A 3D-printable appliance enclosure. The Pi and mic are
// fully enclosed. Sound enters through a grille on the
// right wall. Only power, HDMI, and Ethernet are exposed.
//
// Print:  PLA or PETG · 0.2mm layers · 20% infill · no supports
//         Print base flat (bottom on bed).
//         Print lid upside-down (ceiling on bed).
//
// Hardware:
//   4× M2.5×6mm  screws  — Pi mounting
//   4× M2.5×10mm screws  — lid attachment
//   4× M2.5 heat-set inserts (or self-tap into plastic)
//   4× ~10mm adhesive rubber feet
//   1× Adafruit Mini USB Microphone (#3367)
//
// Assembly:
//   1. Press heat-set inserts into the 4 lid screw posts
//   2. Mount Pi 5 onto standoffs with M2.5×6 screws
//   3. Plug mini USB mic into a USB 3.0 port
//   4. Connect HDMI + power cables
//   5. Place lid, secure with M2.5×10 screws from top
//
// ═══════════════════════════════════════════════════════

// ── Render control ─────────────────────────────────
part    = "plate";   // "base", "lid", "both", "plate"
explode = 0;       // mm gap in preview (set 0 for assembled)

$fn = 48;

// ── Tolerances & shell ─────────────────────────────
tol  = 0.3;    // mating surface clearance
wall = 2.5;    // perimeter wall thickness
deck = 2.5;    // floor & ceiling thickness

// ── Raspberry Pi 5 PCB ─────────────────────────────
pcb_w = 85;
pcb_d = 56;
pcb_t = 1.6;

// M2.5 mounting holes from PCB bottom-left corner
mounts = [
    [3.5, 3.5],  [61.5, 3.5],
    [3.5, 52.5], [61.5, 52.5],
];

standoff_h  = 5;
standoff_od = 6;
standoff_id = 2.2;   // for M2.5 heat-set insert

// ── Internal clearances ────────────────────────────
// Asymmetric: extra space on USB-A side for the mic body
gap_left  = 0.5;    // SD card side
gap_right = 14;     // USB-A side — fits mini mic internally
gap_front = 0.5;    // HDMI / power side
gap_back  = 0.5;    // GPIO side

tallest   = 16;     // stacked USB-A connectors
top_clear = 2;      // headroom above tallest part

// ── Derived dimensions ─────────────────────────────
cavity_h = standoff_h + pcb_t + tallest + top_clear;

ext_w = pcb_w + gap_left + gap_right + 2*wall;   // ~104.5
ext_d = pcb_d + gap_front + gap_back  + 2*wall;  // ~62
ext_h = cavity_h + 2*deck;                        // ~29.6

base_h = ext_h - deck;    // base wall height (open top)
lid_t  = deck;             // lid ceiling thickness
lip_h  = 2.5;             // alignment lip depth
lip_w  = 1.5;             // alignment lip wall thickness

corner_r = 5;

// PCB origin inside enclosure
pcb_ox = wall + gap_left;
pcb_oy = wall + gap_front;
pcb_oz = deck + standoff_h;

// Z where port cutouts begin (1mm below PCB bottom)
port_z = deck + standoff_h - 1;

// ── Port definitions ───────────────────────────────
// Front wall (y=0): [pcb_center_x, width, height]
front_ports = [
    [11.2, 10,  5.5],   // USB-C power
    [25.8, 8.5, 5.5],   // micro-HDMI 0
    [39.2, 8.5, 5.5],   // micro-HDMI 1
    // Uncomment for audio jack access:
    // [53.5, 8, 8.5],
];

// Right wall: Ethernet only (USB-A ports sealed inside)
// [pcb_center_y, width, height]
eth_port = [10.25, 17, 15];

// Left wall: SD card
sd_port = [28, 14, 3.5];

// ── Mic grille (right wall) ────────────────────────
// Array of holes through the right wall, aligned with
// the USB 3.0 port where the mic plugs in.
// The mic element faces outward → sound enters here.
mic_port_y = 47;     // USB 3.0 center Y on PCB
mic_hole_d = 1.8;    // individual hole diameter
mic_pitch  = 3.0;    // hole spacing
mic_ny     = 5;      // holes across Y
mic_nz     = 4;      // holes across Z
mic_cy     = pcb_oy + mic_port_y;
mic_cz     = port_z + 9;

// ── Lid screws ─────────────────────────────────────
screw_post_od = 6;
screw_hole_id = 2.2;   // heat-set insert hole (base)
screw_clear   = 2.8;   // through-hole in lid
screw_inset   = 7;

screw_pos = [
    [wall + screw_inset,          wall + screw_inset],
    [ext_w - wall - screw_inset,  wall + screw_inset],
    [wall + screw_inset,          ext_d - wall - screw_inset],
    [ext_w - wall - screw_inset,  ext_d - wall - screw_inset],
];

// ── Vent slots (lid) ──────────────────────────────
vent_n     = 8;
vent_w     = 1.5;
vent_l     = 24;
vent_pitch = 4;

// ── Rubber feet (base) ────────────────────────────
foot_d     = 10;
foot_depth = 0.8;
foot_inset = 14;
foot_pos = [
    [foot_inset, foot_inset],
    [ext_w - foot_inset, foot_inset],
    [foot_inset, ext_d - foot_inset],
    [ext_w - foot_inset, ext_d - foot_inset],
];


// ═══════════════════════════════════════════════════
//  Primitives
// ═══════════════════════════════════════════════════

module rrect(w, d, h, r=corner_r) {
    hull() for (x=[r, w-r], y=[r, d-r])
        translate([x, y, 0])
            cylinder(h=h, r=r);
}


// ═══════════════════════════════════════════════════
//  BASE — open-top box with standoffs & port cutouts
// ═══════════════════════════════════════════════════

module base() {
    difference() {
        union() {
            // ── Outer shell ──
            difference() {
                rrect(ext_w, ext_d, base_h);
                translate([wall, wall, deck])
                    rrect(ext_w - 2*wall, ext_d - 2*wall,
                          base_h, max(1, corner_r - wall));
            }

            // ── Pi standoffs ──
            for (m = mounts)
                translate([pcb_ox + m.x, pcb_oy + m.y, deck])
                    cylinder(h=standoff_h, d=standoff_od, $fn=24);

            // ── Lid screw posts ──
            for (p = screw_pos)
                translate([p.x, p.y, deck])
                    cylinder(h=base_h - deck, d=screw_post_od, $fn=24);
        }

        // ── Standoff screw holes (through floor) ──
        for (m = mounts)
            translate([pcb_ox + m.x, pcb_oy + m.y, -0.1])
                cylinder(h=deck + standoff_h + 0.2,
                         d=standoff_id, $fn=20);

        // ── Lid screw receptacles (upper half of posts) ──
        for (p = screw_pos)
            translate([p.x, p.y, base_h * 0.35])
                cylinder(h=base_h * 0.65 + 0.1,
                         d=screw_hole_id, $fn=20);

        // ── Front ports (y=0 wall) ──
        for (p = front_ports)
            translate([pcb_ox + p[0] - p[1]/2, -0.1, port_z])
                cube([p[1], wall + 0.2, p[2]]);

        // ── Right wall: Ethernet tunnel ──
        translate([ext_w - wall - 0.1,
                   pcb_oy + eth_port[0] - eth_port[1]/2,
                   port_z])
            cube([wall + 0.2, eth_port[1], eth_port[2]]);

        // ── Right wall: mic grille ──
        for (iy = [0 : mic_ny-1], iz = [0 : mic_nz-1])
            translate([ext_w - wall - 0.1,
                       mic_cy + (iy - (mic_ny-1)/2) * mic_pitch,
                       mic_cz + (iz - (mic_nz-1)/2) * mic_pitch])
                rotate([0, 90, 0])
                    cylinder(h=wall + 0.2, d=mic_hole_d, $fn=16);

        // ── Left wall: SD card ──
        translate([-0.1,
                   pcb_oy + sd_port[0] - sd_port[1]/2,
                   port_z])
            cube([wall + 0.2, sd_port[1], sd_port[2]]);

        // ── Foot indents (bottom face) ──
        for (f = foot_pos)
            translate([f.x, f.y, -0.1])
                cylinder(h=foot_depth + 0.1, d=foot_d, $fn=32);
    }
}


// ═══════════════════════════════════════════════════
//  LID — ceiling panel with alignment lip
//  Modeled right-side-up: ceiling on top, lip below
// ═══════════════════════════════════════════════════

module lid() {
    inner_w = ext_w - 2*(wall + tol);
    inner_d = ext_d - 2*(wall + tol);
    lip_r   = max(1, corner_r - wall - tol);

    difference() {
        union() {
            // ── Ceiling panel ──
            rrect(ext_w, ext_d, lid_t);

            // ── Alignment lip (hangs into base) ──
            translate([wall + tol, wall + tol, -lip_h])
                difference() {
                    rrect(inner_w, inner_d, lip_h, lip_r);
                    translate([lip_w, lip_w, -0.1])
                        rrect(inner_w - 2*lip_w, inner_d - 2*lip_w,
                              lip_h + 0.2,
                              max(0.5, lip_r - lip_w));
                }
        }

        // ── Screw through-holes ──
        for (p = screw_pos)
            translate([p.x, p.y, -lip_h - 0.1])
                cylinder(h=lid_t + lip_h + 0.2,
                         d=screw_clear, $fn=20);

        // ── Countersinks (top face) ──
        for (p = screw_pos)
            translate([p.x, p.y, lid_t - 1.5])
                cylinder(h=1.6, d1=screw_clear, d2=5.5, $fn=20);

        // ── Vent slots (centered on lid) ──
        for (i = [0 : vent_n-1]) {
            vx = ext_w/2 + (i - (vent_n-1)/2) * vent_pitch;
            translate([vx, ext_d/2, -0.1])
                hull() {
                    translate([0, -vent_l/2 + vent_w/2, 0])
                        cylinder(h=lid_t + 0.2, d=vent_w, $fn=16);
                    translate([0,  vent_l/2 - vent_w/2, 0])
                        cylinder(h=lid_t + 0.2, d=vent_w, $fn=16);
                }
        }
    }
}


// ═══════════════════════════════════════════════════
//  Assembly / print layout
// ═══════════════════════════════════════════════════

if (part == "base" || part == "both")
    color("SlateGray") base();

if (part == "lid" || part == "both")
    color("DimGray", 0.9)
        translate([0, 0, base_h + explode])
            lid();

// Print plate: both pieces laid flat for slicing
if (part == "plate") {
    base();
    // Lid flipped upside-down (ceiling on build plate)
    translate([ext_w + 10, 0, lid_t])
        rotate([180, 0, 0])
            lid();
}
