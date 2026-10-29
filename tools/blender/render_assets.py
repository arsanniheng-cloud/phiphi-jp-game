# -*- coding: utf-8 -*-
"""
render_assets.py — สร้างโมเดล 3 มิติของรีสอร์ตใน Blender แล้วเรนเดอร์เป็นภาพ (sprite) ให้เกมใช้

รันแบบไม่เปิดหน้าจอ (background):
  blender.exe -b --factory-startup -P tools/blender/render_assets.py -- --only b_bv1,tree_palm_0 --samples 48

ผลลัพธ์:  assets/sprites/*.png  และ  assets/sprites/manifest.js  (ตำแหน่งจุดยึดของแต่ละภาพ)

หลักการ: เกมใช้มุมมองแบบเฉียง (ระยะลึกบนพื้น 1 หน่วย = ขึ้นบนจอ 1 พิกเซล, ความสูง 1 หน่วย = ขึ้นบนจอ 1 พิกเซล)
กล้อง Blender ก้ม 45 องศาแบบ orthographic แล้วยืดโมเดลแกน Y และ Z ด้วย 1/sin45 และ 1/cos45
ภาพที่ได้จึงตรงกับพิกัดในเกมพอดี (1 หน่วย Blender = 1 พิกเซลของโลกเกม)
"""
import bpy
import math
import json
import os
import re
import sys
import random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(GAME, 'assets', 'sprites')
RES = 2                                   # ความละเอียด 2 เท่าของพิกเซลเกม
THETA = math.radians(45)
SN, CS = math.sin(THETA), math.cos(THETA)
SUN_DIR = Vector((0.45, 0.55, -1.45)).normalized()   # แดดสูงจากด้านหน้าซ้าย เงาสั้นตกไปหลังขวา

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) else default
    return default
ONLY = set(filter(None, (arg('--only', '') or '').split(',')))
SAMPLES = int(arg('--samples', '48'))

# ============================================================================ utilities
def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def set_in(node, name, val):
    if name in node.inputs:
        try:
            node.inputs[name].default_value = val
        except Exception:
            pass

MATS = {}
def mat(name, color, rough=0.6, metal=0.0, kind=None, color2=None, scale=1.0, emit=0.0, alpha=1.0):
    key = name
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        try:
            m.use_nodes = True
        except Exception:
            pass
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None)
    if out is None:
        out = nt.nodes.new('ShaderNodeOutputMaterial')
    if bsdf is None:
        bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
    base = srgb(color)
    set_in(bsdf, 'Base Color', (*base, 1))
    set_in(bsdf, 'Roughness', rough)
    set_in(bsdf, 'Metallic', metal)
    if emit:
        set_in(bsdf, 'Emission Color', (*base, 1))
        set_in(bsdf, 'Emission Strength', emit)
    if alpha < 1:
        set_in(bsdf, 'Alpha', alpha)
    if kind:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        mp.inputs['Scale'].default_value = (scale, scale, scale)
        c2 = srgb(color2 or color)
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*c2, 1)
        ramp.color_ramp.elements[1].color = (*base, 1)
        bump = nt.nodes.new('ShaderNodeBump')
        set_in(bump, 'Strength', 0.35)
        if kind == 'thatch':
            wave = nt.nodes.new('ShaderNodeTexWave')
            wave.wave_type = 'BANDS'; wave.bands_direction = 'Z'
            set_in(wave, 'Scale', 0.9); set_in(wave, 'Distortion', 6.0); set_in(wave, 'Detail', 6.0)
            nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
            noise = nt.nodes.new('ShaderNodeTexNoise')
            set_in(noise, 'Scale', 1.8); set_in(noise, 'Detail', 8.0)
            nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
            mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'MULTIPLY'
            nt.links.new(wave.outputs['Fac'], mix.inputs[0]); nt.links.new(noise.outputs['Fac'], mix.inputs[1])
            nt.links.new(mix.outputs[0], ramp.inputs['Fac'])
            nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
            set_in(bump, 'Strength', 0.8)
        elif kind == 'wood':
            wave = nt.nodes.new('ShaderNodeTexWave')
            wave.wave_type = 'BANDS'; wave.bands_direction = 'X'
            set_in(wave, 'Scale', 1.2); set_in(wave, 'Distortion', 3.0); set_in(wave, 'Detail', 4.0)
            nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
            nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
            nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
        elif kind == 'tile':
            brick = nt.nodes.new('ShaderNodeTexBrick')
            set_in(brick, 'Color1', (*base, 1)); set_in(brick, 'Color2', (*[x * 0.8 for x in base], 1))
            set_in(brick, 'Mortar', (*c2, 1)); set_in(brick, 'Scale', 1.0); set_in(brick, 'Mortar Size', 0.03)
            set_in(brick, 'Brick Width', 0.6); set_in(brick, 'Row Height', 0.3)
            nt.links.new(mp.outputs['Vector'], brick.inputs['Vector'])
            nt.links.new(brick.outputs['Color'], bsdf.inputs['Base Color'])
            nt.links.new(brick.outputs['Fac'], bump.inputs['Height'])
            ramp = None
        elif kind == 'corrugated':
            wave = nt.nodes.new('ShaderNodeTexWave')
            wave.wave_type = 'BANDS'; wave.bands_direction = 'X'
            set_in(wave, 'Scale', 1.0)
            nt.links.new(mp.outputs['Vector'], wave.inputs['Vector'])
            nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
            nt.links.new(wave.outputs['Fac'], bump.inputs['Height'])
            set_in(bump, 'Strength', 0.6)
        else:   # noise: ใบไม้ ผนังปูน หิน
            noise = nt.nodes.new('ShaderNodeTexNoise')
            set_in(noise, 'Scale', 2.5); set_in(noise, 'Detail', 6.0)
            nt.links.new(mp.outputs['Vector'], noise.inputs['Vector'])
            nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
            nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        if ramp is not None:
            nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
        nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    MATS[key] = m
    return m

# ============================================================================ scene
ROOT = None
def new_scene():
    global ROOT
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
        for d in list(coll):
            coll.remove(d)
    sc = bpy.context.scene
    ROOT = bpy.data.objects.new('ROOT', None)
    sc.collection.objects.link(ROOT)
    ROOT.scale = (1, 1 / SN, 1 / CS)

def link(ob, parent=True):
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = ROOT
    return ob

def mesh(name, verts, faces, m, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    me.materials.append(m)
    return link(ob)

def box(name, x0, x1, y0, y1, z0, z1, m, bevel=0.0):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = mesh(name, v, f, m)
    if bevel:
        md = ob.modifiers.new('bevel', 'BEVEL'); md.width = bevel; md.segments = 2
    return ob

def cyl(name, x, y, z0, z1, r, m, seg=12, r2=None):
    r2 = r if r2 is None else r2
    v = [(x + r * math.cos(2 * math.pi * i / seg), y + r * math.sin(2 * math.pi * i / seg), z0) for i in range(seg)]
    v += [(x + r2 * math.cos(2 * math.pi * i / seg), y + r2 * math.sin(2 * math.pi * i / seg), z1) for i in range(seg)]
    f = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
    f.append(tuple(range(seg - 1, -1, -1))); f.append(tuple(range(seg, 2 * seg)))
    return mesh(name, v, f, m, smooth=True)

def blob(name, x, y, z, rx, ry, rz, m, rough=0.25, seed=1, sub=2):
    """ทรงกลมขรุขระ ใช้ทำพุ่มไม้"""
    import bmesh
    R = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    for vtx in bm.verts:
        k = 1 + (R.random() - 0.5) * 2 * rough
        vtx.co = Vector((x + vtx.co.x * rx * k, y + vtx.co.y * ry * k, z + vtx.co.z * rz * k))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    me.materials.append(m)
    return link(ob)

def curve(name, pts, radius, m, taper=None, res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    cu.resolution_u = res
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]
        bp.co = Vector(p)
        bp.handle_left_type = 'AUTO'; bp.handle_right_type = 'AUTO'
        bp.radius = taper[i] if taper else 1.0
    ob = bpy.data.objects.new(name, cu)
    cu.materials.append(m)
    return link(ob)

def solid(ob, t, offset=-1):
    md = ob.modifiers.new('solid', 'SOLIDIFY'); md.thickness = t; md.offset = offset
    return ob

def tri(name, a, b, c, m):
    return mesh(name, [a, b, c], [(0, 1, 2)], m)

# ============================================================================ Thai roof parts
def thai_gable(name, cx, w, y0, y1, ze, rise, roof_m, ov=10, front_panel=True, gold=None, teak=None, ornate=True):
    """หลังคาจั่วหันหน้าเข้าหากล้อง (สันหลังคาตามแกน Y) พร้อมหน้าบัน ป้านลม ช่อฟ้า หางหงส์"""
    xl, xr, zt = cx - w / 2 - ov, cx + w / 2 + ov, ze + rise
    flare = 3.0
    v = [(xl, y0, ze + flare), (cx, y0, zt), (xr, y0, ze + flare), (xl, y1, ze + flare), (cx, y1, zt), (xr, y1, ze + flare),
         (xl + 6, y0, ze), (xr - 6, y0, ze), (xl + 6, y1, ze), (xr - 6, y1, ze)]
    f = [(6, 1, 4, 8), (1, 7, 9, 4), (0, 6, 8, 3), (7, 2, 5, 9)]
    ob = solid(mesh(name, v, f, roof_m), 2.4)
    gold = gold or mat('gold', '#d9a53a', 0.35, 0.8)
    teak = teak or mat('teak', '#6b3d22', 0.55, kind='wood', color2='#4e2a16', scale=0.35)
    if front_panel:
        yy = y0 + 1.2
        tri(name + '_panel', (xl + 9, yy, ze + 1), (xr - 9, yy, ze + 1), (cx, yy, zt - 4), teak)
        if ornate:
            tri(name + '_inner', (xl + 22, yy - 0.3, ze + 3), (xr - 22, yy - 0.3, ze + 3), (cx, yy - 0.3, zt - 14), mat('gableRed', '#8c2f22', 0.5))
            cyl(name + '_medal', cx, yy - 0.6, ze + (zt - ze) * 0.33, ze + (zt - ze) * 0.33 + 0.01, min(9, w * 0.05), gold)
            for i in range(9):
                a = math.pi * (0.08 + 0.84 * i / 8)
                ln = (zt - ze) * 0.5
                p0 = (cx, yy - 0.7, ze + (zt - ze) * 0.33)
                p1 = (cx + math.cos(a) * ln * 1.3, yy - 0.7, p0[2] + math.sin(a) * ln * 0.55)
                curve(name + '_ray%d' % i, [p0, p1], 0.5, gold, res=2)
    # ป้านลม (ขอบจั่ว) + หางหงส์ + ช่อฟ้า
    for s in (-1, 1):
        xe = cx + s * (w / 2 + ov)
        curve(name + '_barge%d' % s, [(cx, y0 - 0.5, zt + 1.5), (cx + s * (w / 4 + ov / 2), y0 - 0.5, ze + rise / 2 + 2), (xe, y0 - 0.5, ze + flare + 1.5)], 1.6, gold)
        curve(name + '_hook%d' % s, [(xe, y0 - 0.5, ze + flare + 1.5), (xe + s * 4, y0 - 1.5, ze + flare + 4), (xe + s * 3, y0 - 2.5, ze + flare + 10)], 1.3, gold, taper=[1, 0.8, 0.4])
        if ornate:
            for k in range(1, 8):
                t = k / 8
                px, pz = cx + s * (w / 2 + ov) * t, zt - (zt - ze - flare) * t + 2.5
                cyl(name + '_bai%d_%d' % (s, k), px, y0 - 0.5, pz, pz + 4, 1.2, gold, seg=6, r2=0.1)
    curve(name + '_chofa', [(cx, y0 - 0.5, zt + 1), (cx + 2, y0 - 2, zt + 9), (cx - 3, y0 - 4, zt + 16), (cx - 7, y0 - 4, zt + 17)], 1.8, gold, taper=[1.2, 1, 0.7, 0.35])
    # สันหลังคา
    curve(name + '_ridge', [(cx, y0, zt + 1.2), (cx, y1, zt + 1.2)], 1.3, mat('ridge', '#3b2414', 0.6), res=2)
    return ob

def thai_cross_roof(name, w, d, ze, rise, roof_m, porch_w=0, porch_front=-14, ov=10, ornate=True, gold=None, y_off=0):
    """หลังคาเรือนไทย: สันขวางแกน X (เห็นชายคาด้านหน้า) + จั่วหน้าบันยื่นเหนือทางเข้า"""
    gold = gold or mat('gold', '#d9a53a', 0.35, 0.8)
    x0, x1 = -w / 2 - ov, w / 2 + ov
    yf, yb, ym = y_off - ov, y_off + d + ov, y_off + d / 2
    zt = ze + rise
    v = [(x0, yf, ze + 2), (x1, yf, ze + 2), (x1 - 5, ym, zt), (x0 + 5, ym, zt), (x0, yb, ze + 2), (x1, yb, ze + 2),
         (x0 + 7, yf + 1, ze), (x1 - 7, yf + 1, ze)]
    f = [(6, 7, 2, 3), (0, 6, 3), (7, 1, 2), (3, 2, 5, 4)]
    solid(mesh(name, v, f, roof_m), 2.4)
    curve(name + '_ridge', [(x0 + 5, ym, zt + 1.2), (x1 - 5, ym, zt + 1.2)], 1.4, mat('ridge', '#3b2414', 0.6), res=2)
    for s in (-1, 1):
        xe, xr = s * (w / 2 + ov), s * (w / 2 + ov - 5)
        curve(name + '_barge%d' % s, [(xe, yf - 0.5, ze + 2.5), (s * (w / 2 + ov - 2.5), (yf + ym) / 2, ze + rise / 2 + 2), (xr, ym, zt + 1.5)], 1.6, gold)
        curve(name + '_hook%d' % s, [(xe, yf - 0.5, ze + 2.5), (xe + s * 4, yf - 1.5, ze + 5), (xe + s * 3, yf - 2.5, ze + 11)], 1.3, gold, taper=[1, 0.8, 0.4])
        curve(name + '_chofa%d' % s, [(xr, ym, zt + 1), (xr + s * 2, ym - 1, zt + 8), (xr + s * 6, ym - 3, zt + 15), (xr + s * 10, ym - 3, zt + 16)], 1.7, gold, taper=[1.2, 1, 0.7, 0.35])
        if ornate:
            for k in range(1, 6):
                t = k / 6
                cyl(name + '_bai%d_%d' % (s, k), xe - s * 2.5 * t, yf + (ym - yf) * t, ze + 3 + rise * t + 1.5, ze + 3 + rise * t + 5.5, 1.1, gold, seg=6, r2=0.1)
    if porch_w:
        thai_gable(name + '_porch', 0, porch_w, porch_front, ym, ze - 1, rise - 6, roof_m, ov=7, ornate=ornate, gold=gold)
    return zt

def eave_roof(name, x0, x1, y0, y1, ze, rise, roof_m, ov=8):
    """หลังคาจั่วแบบสันตามแกน X (เห็นชายคาด้านหน้า) ใช้กับอาคารหลังบ้าน"""
    cy = (y0 + y1) / 2
    v = [(x0 - ov, y0 - ov, ze), (x1 + ov, y0 - ov, ze), (x1 + ov, cy, ze + rise), (x0 - ov, cy, ze + rise),
         (x0 - ov, y1 + ov, ze), (x1 + ov, y1 + ov, ze)]
    f = [(0, 1, 2, 3), (3, 2, 5, 4)]
    return solid(mesh(name, v, f, roof_m), 1.6)

# ============================================================================ building models
def deck_and_stairs(name, w, y_front, z, wood, rail):
    box(name + '_deck', -w / 2 - 4, w / 2 + 4, y_front - 16, y_front + 2, z - 3, z, wood)
    for i, k in enumerate((1, 2)):
        box(name + '_step%d' % i, -11 - k, 11 + k, y_front - 16 - k * 5, y_front - 16 - (k - 1) * 5, 0, z - 3 - (k - 1) * (z / 3), wood)
    x = -w / 2 - 3
    while x <= w / 2 + 3:
        if abs(x) > 13:
            box(name + '_post%.0f' % x, x - 0.8, x + 0.8, y_front - 15.5, y_front - 14, z, z + 7, rail)
        x += 10
    box(name + '_railL', -w / 2 - 4, -12, y_front - 15.6, y_front - 14, z + 6, z + 7.5, rail)
    box(name + '_railR', 12, w / 2 + 4, y_front - 15.6, y_front - 14, z + 6, z + 7.5, rail)
    for s in (-1, 1):
        box(name + '_railS%d' % s, s * (w / 2 + 4) - 0.8, s * (w / 2 + 4) + 0.8, y_front - 15, y_front + 2, z + 6, z + 7.5, rail)

def model_house(b, R, thatch):
    w, d, h = b['w'], b['d'], b['h']
    z0 = 12 if thatch else 9
    wood = mat('deck', '#b9895a', 0.6, kind='wood', color2='#9a6c42', scale=0.4)
    dark = mat('darkwood', '#4a2b17', 0.6)
    rail = mat('rail', '#6b3f22', 0.55)
    wall = mat('bamboo', '#e6cf98', 0.75, kind='wood', color2='#cdb07a', scale=0.8) if thatch else mat('plaster', '#f6ecdc', 0.8, kind='noise', color2='#e8dcc6', scale=0.2)
    roof = mat('thatch', '#cfa461', 0.9, kind='thatch', color2='#8a6534', scale=0.25) if thatch else \
        mat('roof%d' % (R.randint(0, 2)), ['#8e3b2b', '#7a4528', '#6b3a2a'][R.randint(0, 2)], 0.55, kind='tile', color2='#3a1f14', scale=0.18)
    glass = mat('glass', '#2d4f63', 0.15, 0.2)
    lamp = mat('lamp', '#ffd27a', 0.4, emit=3.0)
    for x in (-w / 2 + 3, -w / 6, w / 6, w / 2 - 3):
        for y in (2, d - 2):
            cyl('stilt', x, y, 0, z0, 1.8, dark, seg=8)
    box('floor', -w / 2, w / 2, 0, d, z0 - 3, z0, wood)
    box('wall', -w / 2 + 3, w / 2 - 3, 3, d - 3, z0, z0 + h, wall)
    for x in (-w / 2 + 3, -12, 12, w / 2 - 6):
        box('frame%.0f' % x, x, x + 3, 2.2, 3.2, z0, z0 + h, rail)
    box('beam', -w / 2 + 3, w / 2 - 3, 2.2, 3.2, z0 + h - 3, z0 + h, rail)
    box('door', -8, 8, 2.4, 3.4, z0, z0 + h - 7, mat('door', '#6d4326', 0.5, kind='wood', color2='#553219', scale=0.5))
    for sx in (-1, 1):
        cx = sx * (w / 2 - 22)
        box('win%d' % sx, cx - 8, cx + 8, 2.4, 3.6, z0 + 9, z0 + h - 9, glass)
        box('winf%d' % sx, cx - 9, cx + 9, 2.0, 2.6, z0 + 8, z0 + 9, rail)
        box('shut%dL' % sx, cx - 14, cx - 9, 1.8, 2.6, z0 + 8, z0 + h - 8, mat('shutter', '#8a5530', 0.6))
        box('shut%dR' % sx, cx + 9, cx + 14, 1.8, 2.6, z0 + 8, z0 + h - 8, mat('shutter', '#8a5530', 0.6))
    cyl('lamp', -12.5, 1.5, z0 + h - 12, z0 + h - 9, 1.4, lamp, seg=8)
    deck_and_stairs('dk', w, 0, z0, wood, rail)
    for sx in (-1, 1):
        blob('pot%d' % sx, sx * (w / 2 - 1), -12, z0 + 4, 3.5, 3.5, 4, mat('leafA', '#3f9e47', 0.7, kind='noise', color2='#2a7a35', scale=0.6), seed=sx + 5)
        if not thatch:
            blob('flw%d' % sx, sx * (w / 2 - 1), -12.5, z0 + 7.5, 1.6, 1.6, 1.6, mat('pinkflower', '#ff4fa3', 0.6), seed=sx + 9, sub=1)
    trim = mat('gold', '#d9a53a', 0.35, 0.8) if not thatch else mat('bambooTrim', '#a07440', 0.7)
    thai_cross_roof('roof', w, d, z0 + h, d / 2 + 14, roof, porch_w=w * 0.46, porch_front=-17, ov=9, ornate=not thatch, gold=trim)

def model_sala(b, R, big):
    w, d, h = b['w'], b['d'], b['h']
    stone = mat('stone', '#ddd0b4', 0.8, kind='noise', color2='#c8b893', scale=0.15)
    floor = mat('floorwood', '#c99b68', 0.35, kind='wood', color2='#a77a4b', scale=0.3)
    col = mat('column', '#7a2e1f' if big else '#6b3d22', 0.45)
    gold = mat('gold', '#d9a53a', 0.35, 0.8)
    box('plinth', -w / 2 - 6, w / 2 + 6, -6, d + 4, 0, 5, stone)
    box('floor', -w / 2, w / 2, -2, d, 5, 6, floor)
    for k in range(3):
        box('step%d' % k, -30 - k * 4, 30 + k * 4, -6 - (k + 1) * 4, -6 - k * 4, 0, 5 - k * 1.6, stone)
    n = 7 if big else 5
    for i in range(n):
        x = -w / 2 + 4 + i * (w - 8) / (n - 1)
        for y in (2, d - 3):
            cyl('col', x, y, 6, 6 + h, 2.4, col, seg=10)
            cyl('cap', x, y, 6 + h - 3, 6 + h, 3.2, gold, seg=10)
    if b['id'] == 'restaurant':
        cloth = mat('cloth', '#ffffff', 0.7)
        chair = mat('chair', '#7a4a2a', 0.6)
        for i in range(4):
            for j in range(2):
                x, y = -w / 2 + 30 + i * (w - 60) / 3, 25 + j * 45
                cyl('table', x, y, 6, 15, 8, cloth, seg=14)
                for s in (-1, 1):
                    box('chair', x + s * 12 - 2.5, x + s * 12 + 2.5, y - 2.5, y + 2.5, 6, 14, chair)
        lamp = mat('lamp', '#ffd27a', 0.4, emit=3.0)
        for i in range(12):
            x = -w / 2 + 6 + i * (w - 12) / 11
            cyl('bulb', x, -4, 6 + h - 2, 6 + h - 0.5, 1.0, lamp, seg=6)
    elif b['id'] == 'spa':
        bed = mat('spabed', '#f8f9fa', 0.6)
        for i in range(3):
            x = -w / 2 + 35 + i * (w - 70) / 2
            box('bed', x - 14, x + 14, 30, 70, 6, 13, bed)
            box('towel', x - 14, x + 14, 30, 38, 13, 14, mat('towel', '#8ce99a', 0.7))
        for s in (-1, 1):
            blob('plant%d' % s, s * (w / 2 - 10), 15, 14, 8, 8, 9, mat('leafA', '#3f9e47', 0.7, kind='noise', color2='#2a7a35', scale=0.6), seed=s + 3)
    else:
        box('counter', -40, 40, 30, 42, 6, 18, mat('counter', '#6d4326', 0.4, kind='wood', color2='#4e2a16', scale=0.4))
        box('countertop', -41, 41, 29, 43, 18, 19.5, gold)
        for s in (-1, 1):
            box('sofa%d' % s, s * 75 - 18, s * 75 + 18, 10, 24, 6, 13, mat('sofa', '#f1e3c8', 0.8))
            cyl('vase%d' % s, s * 40, 70, 6, 24, 5, mat('vase', '#b5462f', 0.35), seg=12, r2=3)
            blob('orchid%d' % s, s * 40, 70, 30, 9, 9, 7, mat('orchid', '#e599f7', 0.6), seed=s + 11)
    roof_m = mat('rooftile', '#8e3b2b', 0.5, kind='tile', color2='#3a1f14', scale=0.16)
    if b['id'] == 'spa':
        roof_m = mat('spa_roof', '#6b4a30', 0.55, kind='tile', color2='#3a2414', scale=0.16)
    rise = d / 2 + 18
    zt = thai_cross_roof('roof1', w + 6, d, 6 + h, rise, roof_m, porch_w=w * (0.5 if big else 0.42), porch_front=-16, ov=12)
    if big:
        # หลังคาชั้นบน ซ้อนสองชั้นแบบศาลาไทย
        roof2 = mat('rooftile2', '#7a3324', 0.5, kind='tile', color2='#3a1f14', scale=0.16)
        thai_cross_roof('roof2', w * 0.56, d * 0.5, 6 + h + rise * 0.62, d * 0.25 + 22, roof2, porch_w=w * 0.3, porch_front=d * 0.2, ov=8, y_off=d * 0.25)

def model_boh(b, R):
    w, d, h = b['w'], b['d'], b['h']
    wall = mat('concrete', '#e3e0d6', 0.85, kind='noise', color2='#d0ccc0', scale=0.2)
    roof = mat('metal_' + b['id'], b.get('roof', '#6c8ead'), 0.45, 0.3, kind='corrugated', color2='#3f5568', scale=0.5)
    box('base', -w / 2 - 2, w / 2 + 2, -2, d + 2, 0, 3, mat('slab', '#bdb7a8', 0.9))
    box('wall', -w / 2, w / 2, 0, d, 3, 3 + h, wall)
    box('rdoor', -w * 0.38, -w * 0.06, -0.6, 0.4, 3, 3 + h - 10, mat('rolldoor', '#a7b1bc', 0.4, 0.4, kind='corrugated', color2='#7c8794', scale=1.4))
    box('door', w * 0.08, w * 0.08 + 12, -0.6, 0.4, 3, 3 + h - 12, mat('steeldoor', '#5d6b7a', 0.5, 0.3))
    box('win', w * 0.26, w * 0.26 + 20, -0.6, 0.4, 3 + h - 22, 3 + h - 10, mat('glass', '#2d4f63', 0.15, 0.2))
    box('sign', -w * 0.38, -w * 0.06, -0.8, 0.2, 3 + h - 8, 3 + h - 2, mat('signboard', '#2f4858', 0.5))
    box('ac', w / 2 - 18, w / 2 - 4, -5, 0, 14, 24, mat('acunit', '#f1f3f5', 0.5))
    cyl('pipe', w / 2 - 2, -1, 3, 3 + h, 1.2, mat('pipe', '#9aa1a8', 0.4, 0.6), seg=8)
    eave_roof('roof', -w / 2, w / 2, 0, d, 3 + h, d * 0.38, roof)

def model_shed(b, R):
    w, d, h = b['w'], b['d'], b['h']
    box('base', -w / 2, w / 2, 0, d, 0, 2, mat('slab', '#bdb7a8', 0.9))
    post = mat('steelpost', '#6c757d', 0.5, 0.5)
    for x in (-w / 2 + 2, w / 2 - 2):
        for y in (2, d - 2):
            box('post', x - 1.5, x + 1.5, y - 1.5, y + 1.5, 2, 2 + h, post)
    box('backwall', -w / 2, w / 2, d - 3, d, 2, 2 + h, mat('concrete', '#e3e0d6', 0.85, kind='noise', color2='#d0ccc0', scale=0.2))
    if b['id'] == 'generator':
        box('gen', -w * 0.32, w * 0.32, d * 0.25, d * 0.8, 2, 20, mat('genset', '#f2b705', 0.4, 0.2))
        box('genpanel', -w * 0.25, -w * 0.05, d * 0.24, d * 0.26, 8, 16, mat('panel', '#343a40', 0.5))
        cyl('exhaust', w * 0.2, d * 0.6, 20, 30, 1.6, mat('pipe', '#9aa1a8', 0.4, 0.6), seg=8)
        roof = mat('metal_gen', b.get('roof', '#6c757d'), 0.45, 0.3, kind='corrugated', color2='#454b52', scale=0.5)
    else:
        pot = mat('pot', '#b5603a', 0.7)
        greens = [mat('leafA', '#3f9e47', 0.7, kind='noise', color2='#2a7a35', scale=0.6), mat('leafB', '#5cb85a', 0.7)]
        flowers = [mat('pinkflower', '#ff4fa3', 0.6), mat('orangeflower', '#ff922b', 0.6), mat('redflower', '#e03131', 0.6)]
        for i in range(14):
            x, y = R.uniform(-w / 2 + 8, w / 2 - 8), R.uniform(6, d - 8)
            cyl('pot', x, y, 2, 6, 2.6, pot, seg=8, r2=3.2)
            blob('seed', x, y, 9, 3.6, 3.6, 3.6, greens[i % 2], seed=i)
            if i % 3 == 0:
                blob('fl', x, y - 1, 12, 1.4, 1.4, 1.4, flowers[i % 3], seed=i + 40, sub=1)
        roof = mat('shadenet', '#7fb069', 0.9, alpha=1.0)
    eave_roof('roof', -w / 2, w / 2, 0, d, 2 + h, d * 0.3, roof, ov=4)

def model_booth(b, R):
    w, d, h = b['w'], b['d'], b['h']
    box('base', -w / 2 - 2, w / 2 + 2, -2, d + 2, 0, 2, mat('slab', '#bdb7a8', 0.9))
    box('wall', -w / 2, w / 2, 0, d, 2, 10, mat('concrete', '#e3e0d6', 0.85, kind='noise', color2='#d0ccc0', scale=0.2))
    box('glassband', -w / 2, w / 2, 0, d, 10, h, mat('glassB', '#7fbcd2', 0.1, 0.1))
    for x in (-w / 2, w / 2 - 2):
        box('mull', x, x + 2, -0.5, d + 0.5, 10, h, mat('steelpost', '#6c757d', 0.5, 0.5))
    box('roof', -w / 2 - 6, w / 2 + 6, -6, d + 6, h, h + 4, mat('boothroof', '#33465c', 0.5))
    box('sign', -12, 12, -6.5, -5.8, h + 0.5, h + 3.5, mat('signY', '#ffd43b', 0.5))
    box('barrier', w / 2 + 2, w / 2 + 40, -14, -12, 8, 10, mat('barrier', '#e03131', 0.5))
    cyl('barpost', w / 2 + 2, -13, 0, 10, 1.5, mat('steelpost', '#6c757d', 0.5, 0.5), seg=8)

def model_hut(b, R):
    w, d, h = b['w'], b['d'], b['h']
    bamboo = mat('bambooPost', '#c9a26a', 0.7)
    box('deck', -w / 2, w / 2, 0, d, 0, 3, mat('deck', '#b9895a', 0.6, kind='wood', color2='#9a6c42', scale=0.4))
    for x in (-w / 2 + 2, 0, w / 2 - 2):
        for y in (2, d - 2):
            cyl('post', x, y, 3, 3 + h, 1.6, bamboo, seg=8)
    cols = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c']
    for i, c in enumerate(cols):
        x = -w / 2 + 14 + i * (w - 28) / 3
        box('kayak%d' % i, x - 4, x + 4, d - 10, d - 6, 3, 3 + h - 4, mat('kayak_' + c, c, 0.35))
    box('board', -20, 20, -6, -5, 3, 12, mat('signB', '#1971c2', 0.5))
    thai_gable('roof', 0, w, -6, d + 4, 3 + h, (w / 2 + 8) * 0.6, mat('thatch', '#cfa461', 0.9, kind='thatch', color2='#8a6534', scale=0.25),
               ov=8, ornate=False, gold=mat('bambooTrim', '#a07440', 0.7))

def model_tower(b, R):
    w, d, h = b['w'], b['d'], b['h']
    wood = mat('deck', '#b9895a', 0.6, kind='wood', color2='#9a6c42', scale=0.4)
    for x in (-w / 2 + 2, w / 2 - 2):
        for y in (2, d - 2):
            cyl('leg', x, y, 0, h, 1.6, wood, seg=8)
    box('plat', -w / 2 - 4, w / 2 + 4, -2, d + 2, h, h + 3, wood)
    box('cabin', -w / 2 + 1, w / 2 - 1, 2, d - 2, h + 3, h + 18, mat('white', '#ffffff', 0.6))
    box('stripe', -w / 2 + 0.8, w / 2 - 0.8, 1.8, d - 1.8, h + 9, h + 13, mat('redpaint', '#e03131', 0.5))
    thai_gable('cabroof', 0, w - 2, 0, d, h + 18, w * 0.45, mat('redroof', '#e03131', 0.5), ov=4, front_panel=False, ornate=False, gold=mat('white', '#ffffff', 0.6))
    cyl('flagpole', w / 2 + 6, d / 2, h, h + 50, 0.7, mat('steelpost', '#6c757d', 0.5, 0.5), seg=6)
    box('flagR', w / 2 + 6.5, w / 2 + 20, d / 2 - 0.3, d / 2 + 0.3, h + 44, h + 49, mat('redpaint', '#e03131', 0.5))
    box('flagY', w / 2 + 6.5, w / 2 + 20, d / 2 - 0.3, d / 2 + 0.3, h + 39, h + 44, mat('yellowpaint', '#ffd43b', 0.5))
    for k in range(6):
        box('rung%d' % k, -6, 6, -6, -5, 4 + k * h / 6, 5 + k * h / 6, wood)
    box('tube', w / 2 + 2, w / 2 + 6, -4, -2, 0, 26, mat('redpaint', '#e03131', 0.5))

# ============================================================================ trees / props / boats
LEAF_MATS = None
def leaf_mats():
    global LEAF_MATS
    if LEAF_MATS is None:
        LEAF_MATS = [mat('palmleaf%d' % i, c, 0.6, kind='noise', color2=c2, scale=0.5) for i, (c, c2) in
                     enumerate([('#4cb050', '#2e8b3a'), ('#3a9d45', '#226b2c'), ('#5cbf57', '#3a8f40')])]
    return LEAF_MATS

def frond_mesh(name, crown, ang, length, droop, R, m):
    """ทางมะพร้าว: ก้านโค้ง + ใบย่อยสองข้าง"""
    verts, faces = [], []
    dx, dy = math.cos(ang), math.sin(ang)
    def point(t):
        x = crown[0] + dx * length * t
        y = crown[1] + dy * length * t
        z = crown[2] + 8 * math.sin(math.pi * t * 0.6) - droop * t * t
        return Vector((x, y, z))
    steps = 22
    for i in range(1, steps):
        t = i / steps
        p, q = point(t), point(t + 1 / steps)
        tang = (q - p).normalized()
        side = Vector((-dy, dx, 0)).normalized()
        ll = (1 - t) * 15 + 4
        for s in (-1, 1):
            tip = p + side * s * ll + tang * 3 + Vector((0, 0, -ll * 0.45))
            base0 = p - tang * 0.9
            base1 = p + tang * 0.9
            k = len(verts)
            verts += [base0, base1, tip]
            faces.append((k, k + 1, k + 2))
    ob = mesh(name, verts, faces, m)
    curve(name + '_rib', [tuple(point(0)), tuple(point(0.5)), tuple(point(1.0))], 0.6, mat('rachis', '#7a9a40', 0.7), res=4)
    return ob

def model_palm(seed):
    R = random.Random(seed)
    trunk = mat('palmtrunk', '#9b6d45', 0.85, kind='wood', color2='#6e4a2c', scale=0.9)
    lean = (R.uniform(-1, 1) * 22, R.uniform(-1, 1) * 14)
    H = R.uniform(95, 120)
    pts = [(0, 0, 0), (lean[0] * 0.25 + R.uniform(-6, 6), lean[1] * 0.25, H * 0.35), (lean[0] * 0.7, lean[1] * 0.7, H * 0.72), (lean[0], lean[1], H)]
    curve('trunk', pts, 3.8, trunk, taper=[1.2, 1.0, 0.85, 0.7])
    crown = (lean[0], lean[1], H)
    mats = leaf_mats()
    n = R.randint(10, 13)
    for i in range(n):
        a = i / n * 2 * math.pi + R.uniform(-0.2, 0.2)
        frond_mesh('frond%d' % i, crown, a, R.uniform(42, 56), R.uniform(18, 30), R, mats[i % 3])
    coco = mat('coconut', '#6b4a22', 0.6)
    for k in range(4):
        a = k / 4 * 2 * math.pi
        blob('coco%d' % k, crown[0] + math.cos(a) * 3, crown[1] + math.sin(a) * 3, H - 4, 3, 3, 3.4, coco, rough=0.05, seed=k, sub=1)

def model_canopy(kind, seed):
    R = random.Random(seed)
    big, bush = kind == 'jungle', kind in ('bougain', 'hibiscus')
    bark = mat('bark', '#7d6a56', 0.9, kind='noise', color2='#5a4a3c', scale=0.6)
    greens = [mat('leafA', '#3f9e47', 0.7, kind='noise', color2='#2a7a35', scale=0.6), mat('leafB', '#5cb85a', 0.7),
              mat('leafC', '#2e7d36', 0.75, kind='noise', color2='#1f5a27', scale=0.6)]
    if bush:
        cz, rad, n = 12, 20, 12
    else:
        cz, rad, n = (78, 40, 22) if big else (50, 30, 16)
        H = cz - 8
        curve('trunk', [(0, 0, 0), (R.uniform(-3, 3), R.uniform(-3, 3), H * 0.5), (R.uniform(-4, 4), 0, H)], 4.5 if big else 3.2, bark, taper=[1.3, 1, 0.8])
        for k in range(3):
            a = R.uniform(0, 2 * math.pi)
            curve('branch%d' % k, [(0, 0, H * 0.6), (math.cos(a) * rad * 0.4, math.sin(a) * rad * 0.4, H * 0.9), (math.cos(a) * rad * 0.7, math.sin(a) * rad * 0.7, H + 6)], 1.8, bark, taper=[1, 0.8, 0.5])
    for i in range(n):
        a, r = R.uniform(0, 2 * math.pi), math.sqrt(R.random()) * rad
        s = (8 if bush else 15 if big else 11) + R.uniform(0, 5)
        blob('leaf%d' % i, math.cos(a) * r, math.sin(a) * r * 0.8, cz + R.uniform(-0.3, 0.4) * rad * 0.6, s, s, s * 0.8, greens[i % 3], seed=seed * 31 + i)
    if kind == 'frangipani':
        petal = mat('frangipaniW' if seed % 2 else 'frangipaniP', '#fffaf0' if seed % 2 else '#ff9ec7', 0.6)
        core = mat('flowercore', '#ffd43b', 0.6)
        for i in range(26):
            a, r = R.uniform(0, 2 * math.pi), math.sqrt(R.random()) * rad
            x, y, z = math.cos(a) * r, math.sin(a) * r * 0.8, cz + rad * 0.45 + R.uniform(-4, 6)
            blob('fl%d' % i, x, y, z, 2.3, 2.3, 0.9, petal, rough=0.3, seed=i, sub=1)
            blob('fc%d' % i, x, y, z + 0.8, 0.7, 0.7, 0.5, core, rough=0.0, seed=i, sub=1)
    elif bush:
        cols = ['#e0218a', '#ff4fa3', '#c2186b'] if kind == 'bougain' else ['#e63946', '#ff6b6b', '#f08c00']
        fm = [mat('fl_' + c, c, 0.6) for c in cols]
        for i in range(48 if kind == 'bougain' else 16):
            a, r = R.uniform(0, 2 * math.pi), math.sqrt(R.random()) * rad
            blob('fl%d' % i, math.cos(a) * r, math.sin(a) * r * 0.8, cz + R.uniform(2, 14), 2.0 if kind == 'bougain' else 2.8, 2.0, 1.6, fm[i % 3], seed=i, sub=1)

def model_prop(kind, idx):
    if kind == 'lounger':
        wood = mat('deck', '#b9895a', 0.6, kind='wood', color2='#9a6c42', scale=0.4)
        box('frame', -14, 14, -4, 4, 3, 5, wood)
        for x in (-12, 12):
            box('leg', x - 1, x + 1, -4, 4, 0, 3, wood)
        box('cushion', -13, 6, -3.5, 3.5, 5, 6.5, mat('cushion', '#ffffff', 0.8))
        back = box('back', 6, 15, -3.5, 3.5, 5, 6.5, mat('cushionB', '#4dabf7', 0.8))
        back.rotation_euler = (0, math.radians(-35), 0)
        back.location = (6 - 6 * math.cos(math.radians(35)) + 6, 0, 0)
    elif kind == 'umbrella':
        cyl('pole', 0, 0, 0, 30, 0.8, mat('steelpost', '#6c757d', 0.5, 0.5), seg=6)
        seg = 10
        colors = [mat('umbA_' + str(idx % 3), ['#ff6b6b', '#4dabf7', '#ffa94d'][idx % 3], 0.6), mat('white', '#ffffff', 0.6)]
        thatchy = idx % 2 == 0
        for i in range(seg):
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            m = mat('thatch', '#cfa461', 0.9, kind='thatch', color2='#8a6534', scale=0.25) if thatchy else colors[i % 2]
            mesh('umb%d' % i, [(0, 0, 36), (math.cos(a0) * 19, math.sin(a0) * 19, 28), (math.cos(a1) * 19, math.sin(a1) * 19, 28)], [(0, 1, 2)], m)
    elif kind == 'kayak':
        blob('hull', 0, 0, 2.5, 17, 4.5, 2.6, mat('kayak_y' if idx % 2 else 'kayak_r', '#ffd43b' if idx % 2 else '#ff6b6b', 0.35), rough=0.0, seed=idx, sub=3)
        for x in (-5, 5):
            cyl('seat', x, 0, 4.5, 5.2, 2.2, mat('panel', '#343a40', 0.5), seg=10)
    elif kind == 'lpg':
        for i in range(3):
            cyl('cyl%d' % i, -8 + i * 8, 0, 0, 20, 3.4, mat('lpgcyl' if i != 1 else 'lpgcylB', '#adb5bd' if i != 1 else '#4dabf7', 0.35, 0.5), seg=12)
            cyl('valve%d' % i, -8 + i * 8, 0, 20, 23, 1.2, mat('panel', '#343a40', 0.5), seg=8)
        frame = mat('cage', '#495057', 0.5, 0.6)
        for x in (-14, 14):
            for y in (-5, 5):
                box('cp', x - 0.6, x + 0.6, y - 0.6, y + 0.6, 0, 26, frame)
        for z in (8, 16, 25):
            box('cr', -14, 14, -5.3, -4.7, z, z + 0.8, frame)
        box('sign', -6, 6, -6, -5.5, 26, 31, mat('redpaint', '#e03131', 0.5))
    elif kind == 'drums':
        for i in range(2):
            cyl('drum%d' % i, -5 + i * 10, 0, 0, 16, 4.4, mat('drum', '#1c7ed6', 0.4, 0.3), seg=14)
    elif kind == 'sign':
        box('post', -1.2, 1.2, -1.2, 1.2, 0, 26, mat('rail', '#6b3f22', 0.55))
        box('board', -18, 18, -2, 0, 22, 34, mat('deck', '#b9895a', 0.6, kind='wood', color2='#9a6c42', scale=0.4))

def model_longtail(color, canopy):
    wood = mat('hullwood', '#7a4a23', 0.55, kind='wood', color2='#5c3518', scale=0.4)
    band = mat('band_' + color, color, 0.45)
    # ตัวเรือ: หน้าตัดรูปตัว U ไล่ตามแกน X
    secs = 22
    verts, faces = [], []
    ring = 7
    for i in range(secs + 1):
        t = i / secs
        x = -55 + 108 * t
        half = 9 * math.sin(math.pi * min(1, t * 1.05)) ** 0.7 + 1.0
        if t > 0.85:
            half *= max(0.12, (1 - t) / 0.15)
        top = 6 + (22 * ((t - 0.8) / 0.2) ** 2 if t > 0.8 else 0) + (2 if t < 0.1 else 0)
        bottom = -3 * math.sin(math.pi * t) ** 0.5
        for k in range(ring):
            a = math.pi * k / (ring - 1)
            y = -math.cos(a) * half
            z = bottom + (top - bottom) * (1 - math.sin(a)) if False else top - (top - bottom) * math.sin(a)
            verts.append((x, y, z))
    for i in range(secs):
        for k in range(ring - 1):
            a, b2 = i * ring + k, (i + 1) * ring + k
            faces.append((a, b2, b2 + 1, a + 1))
    mesh('hull', verts, faces, wood, smooth=True)
    box('seat1', -30, -26, -7, 7, 3, 4.5, mat('deck', '#b9895a', 0.6, kind='wood', color2='#9a6c42', scale=0.4))
    box('seat2', 0, 4, -8, 8, 3, 4.5, mat('deck', '#b9895a', 0.6, kind='wood', color2='#9a6c42', scale=0.4))
    curve('gunwaleL', [(-54, -2, 6.5), (-20, -9.5, 6.5), (20, -9.2, 6.5), (46, -2.5, 16)], 1.0, band)
    curve('gunwaleR', [(-54, 2, 6.5), (-20, 9.5, 6.5), (20, 9.2, 6.5), (46, 2.5, 16)], 1.0, band)
    ribbons = ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#fb5607', '#06d6a0']
    for i, c in enumerate(ribbons):
        curve('rib%d' % i, [(52, 0, 27 - i * 0.6), (55 + i * 0.4, (i - 2.5) * 0.8, 18), (53 + i * 0.5, (i - 2.5) * 1.2, 8)], 0.9, mat('rib' + c, c, 0.5), taper=[1, 0.9, 0.6])
    box('engine', -60, -48, -4, 4, 5, 14, mat('engine', '#495057', 0.4, 0.6))
    curve('shaft', [(-54, 0, 9), (-72, 0, 3), (-90, 0, -2)], 0.9, mat('steelpost', '#6c757d', 0.5, 0.5))
    if canopy:
        for x in (-18, 14):
            for s in (-1, 1):
                cyl('cpost', x, s * 6, 4, 18, 0.6, mat('steelpost', '#6c757d', 0.5, 0.5), seg=6)
        box('tarp', -20, 16, -8, 8, 18, 19, mat('tarp', '#1c7ed6', 0.6))

def model_speedboat():
    white = mat('gelcoat', '#f8f9fa', 0.3)
    secs, ring = 18, 7
    verts, faces = [], []
    for i in range(secs + 1):
        t = i / secs
        x = -42 + 86 * t
        half = 11 * (1 - max(0, t - 0.7) / 0.3 * 0.92) if t > 0.7 else 11
        top = 7 + (3 * (t - 0.7) / 0.3 if t > 0.7 else 0)
        for k in range(ring):
            a = math.pi * k / (ring - 1)
            y = -math.cos(a) * half
            z = top - (top + 2) * math.sin(a) ** 0.6
            verts.append((x, y, z))
    for i in range(secs):
        for k in range(ring - 1):
            a, b2 = i * ring + k, (i + 1) * ring + k
            faces.append((a, b2, b2 + 1, a + 1))
    mesh('hull', verts, faces, white, smooth=True)
    box('deck', -40, 30, -9.5, 9.5, 6, 7, white)
    curve('stripeL', [(-42, -11.2, 4), (10, -11.2, 4), (40, -3, 6)], 0.9, mat('navy', '#1864ab', 0.4))
    curve('stripeR', [(-42, 11.2, 4), (10, 11.2, 4), (40, 3, 6)], 0.9, mat('navy', '#1864ab', 0.4))
    box('console', 0, 10, -6, 6, 7, 15, white)
    box('screen', 9.5, 11, -6, 6, 15, 21, mat('glassB', '#7fbcd2', 0.1, 0.1))
    for x in (-30, -18, -6):
        box('seat', x, x + 8, -8, 8, 7, 11, mat('seat', '#495057', 0.6))
    for s in (-1, 1):
        box('outboard', -50, -42, s * 5 - 3, s * 5 + 3, -2, 12, mat('outboard', '#212529', 0.4, 0.3))

# ============================================================================ render one asset
def setup_render(sc):
    sc.render.engine = 'CYCLES'
    try:
        sc.cycles.device = 'CPU'
    except Exception:
        pass
    sc.cycles.samples = SAMPLES
    try:
        sc.cycles.use_denoising = True
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.max_bounces = 4
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.resolution_percentage = 100
    try:
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
    except Exception:
        pass
    world = bpy.data.worlds.get('W') or bpy.data.worlds.new('W')
    if world.node_tree is None:
        try:
            world.use_nodes = True
        except Exception:
            pass
    bg = next((n for n in world.node_tree.nodes if n.type == 'BACKGROUND'), None)
    if bg is None:
        bg = world.node_tree.nodes.new('ShaderNodeBackground')
        out = next((n for n in world.node_tree.nodes if n.type == 'OUTPUT_WORLD'), None) or world.node_tree.nodes.new('ShaderNodeOutputWorld')
        world.node_tree.links.new(bg.outputs[0], out.inputs['Surface'])
    bg.inputs['Color'].default_value = (*srgb('#bfe3ff'), 1)
    bg.inputs['Strength'].default_value = 0.85
    sc.world = world

def add_lights_and_catcher():
    sun_d = bpy.data.lights.new('Sun', 'SUN')
    sun_d.energy = 3.6
    sun_d.angle = math.radians(6)
    sun_d.color = srgb('#fff1d6')
    sun = link(bpy.data.objects.new('Sun', sun_d), parent=False)
    sun.rotation_euler = SUN_DIR.to_track_quat('-Z', 'Y').to_euler()
    me = bpy.data.meshes.new('ground')
    s = 900
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    gnd = link(bpy.data.objects.new('ground', me), parent=False)
    gnd.is_shadow_catcher = True
    return gnd

def frame_and_render(key, out_dir, pad=4, include_shadow=True):
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    us, vs = [], []
    for o in sc.objects:
        if o.type not in ('MESH', 'CURVE') or o.name == 'ground':
            continue
        oe = o.evaluated_get(dg)
        try:
            me = oe.to_mesh()
        except Exception:
            me = None
        if me is None:
            continue
        mw = oe.matrix_world
        for v in me.vertices:
            p = mw @ v.co
            us.append(p.x); vs.append(-(p.y * SN + p.z * CS))
            if include_shadow and p.z > 0.5:
                q = p + SUN_DIR * (-p.z / SUN_DIR.z)
                us.append(q.x); vs.append(-(q.y * SN))
        oe.to_mesh_clear()
    u0, u1, v0, v1 = min(us) - pad, max(us) + pad, min(vs) - pad, max(vs) + pad
    wpx, hpx = int(math.ceil((u1 - u0) * RES)), int(math.ceil((v1 - v0) * RES))
    ortho = wpx / RES
    fh = hpx / RES
    uc, vc = u0 + ortho / 2, v0 + fh / 2
    cam_d = bpy.data.cameras.new('Cam')
    cam_d.type = 'ORTHO'; cam_d.ortho_scale = ortho; cam_d.sensor_fit = 'HORIZONTAL'
    cam_d.clip_start = 1; cam_d.clip_end = 8000
    cam = link(bpy.data.objects.new('Cam', cam_d), parent=False)
    target = Vector((uc, -vc / SN, 0))
    fwd = Vector((0, CS, -SN))
    cam.location = target - fwd * 3000
    cam.rotation_euler = (math.pi / 2 - THETA, 0, 0)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = wpx, hpx
    sc.render.filepath = os.path.join(out_dir, key + '.png')
    bpy.ops.render.render(write_still=True)
    return {'src': 'assets/sprites/' + key + '.png', 'sw': round(ortho, 2), 'sh': round(fh, 2),
            'ax': round(ortho / 2 - uc, 2), 'ay': round(fh / 2 - vc, 2)}

# ============================================================================ read game data
def read_buildings():
    txt = open(os.path.join(GAME, 'data', 'locations.js'), encoding='utf-8').read()
    seg = txt[txt.index('buildings: ['):]
    seg = seg[seg.index('[') + 1: seg.index('],')]
    items = []
    for m in re.finditer(r'\{([^{}]*)\}', seg):
        body = m.group(1)
        obj = {}
        for km in re.finditer(r"(\w+):\s*('(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?)", body):
            k, v = km.group(1), km.group(2)
            obj[k] = v[1:-1] if v.startswith("'") else float(v)
        items.append(obj)
    return items

def build_jobs():
    jobs = []
    for b in read_buildings():
        jobs.append(('b_' + b['id'], ('building', b)))
    for i in range(6):
        jobs.append(('tree_palm_%d' % i, ('palm', 100 + i * 17)))
    for kind, n in (('frangipani', 4), ('jungle', 3), ('bougain', 3), ('hibiscus', 2)):
        for i in range(n):
            jobs.append(('tree_%s_%d' % (kind, i), ('canopy', kind, 300 + i * 13 + len(kind))))
    for kind, n in (('lounger', 1), ('umbrella', 2), ('kayak', 2), ('lpg', 1), ('drums', 1), ('sign', 1)):
        for i in range(n):
            jobs.append(('prop_%s_%d' % (kind, i), ('prop', kind, i)))
    for name, col, canopy in (('green', '#2b9348', False), ('red', '#d00000', True), ('blue', '#3a86ff', False)):
        jobs.append(('boat_longtail_' + name, ('longtail', col, canopy)))
    jobs.append(('boat_speedboat', ('speedboat',)))
    return jobs

def run():
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'manifest.js')
    manifest = {}
    if os.path.exists(man_path):
        try:
            raw = open(man_path, encoding='utf-8').read()
            manifest = json.loads(raw[raw.index('{'): raw.rindex('}') + 1]).get('items', {})
        except Exception:
            manifest = {}
    sc = bpy.context.scene
    for key, job in build_jobs():
        if ONLY and key not in ONLY:
            continue
        new_scene()
        setup_render(sc)
        add_lights_and_catcher()
        kind = job[0]
        if kind == 'building':
            b = job[1]
            R = random.Random(sum(map(ord, b['id'])))
            t = b['type']
            if t in ('villa', 'bungalow'):
                model_house(b, R, thatch=(t == 'bungalow'))
            elif t in ('sala', 'sala_big'):
                model_sala(b, R, big=(t == 'sala_big'))
            elif t == 'boh':
                model_boh(b, R)
            elif t == 'shed':
                model_shed(b, R)
            elif t == 'booth':
                model_booth(b, R)
            elif t == 'hut':
                model_hut(b, R)
            elif t == 'tower':
                model_tower(b, R)
        elif kind == 'palm':
            model_palm(job[1])
        elif kind == 'canopy':
            model_canopy(job[1], job[2])
        elif kind == 'prop':
            model_prop(job[1], job[2])
        elif kind == 'longtail':
            model_longtail(job[1], job[2])
        elif kind == 'speedboat':
            model_speedboat()
        info = frame_and_render(key, OUT, include_shadow=not key.startswith('boat_'))
        manifest[key] = info
        print('RENDERED', key, json.dumps(info))
        sys.stdout.flush()
    with open(man_path, 'w', encoding='utf-8') as f:
        f.write('// สร้างอัตโนมัติจาก tools/blender/render_assets.py — ภาพสามมิติจาก Blender\n')
        f.write('// sw/sh = ขนาดบนโลกเกม (พิกเซล), ax/ay = จุดยึด (ฐานอาคาร/โคนต้นไม้/กลางลำเรือ) วัดจากมุมซ้ายบน\n')
        f.write('window.SPRITES = ' + json.dumps({'version': 1, 'res': RES, 'items': manifest}, ensure_ascii=False, indent=1) + ';\n')
    print('MANIFEST', len(manifest), 'items')

run()
